-- ============================================================================
-- ContextLayer · Analytics — esquema Supabase
--
-- CÓMO USAR: crear un proyecto free en supabase.com, abrir el SQL Editor,
-- pegar este archivo ENTERO y ejecutarlo. Después seguir docs/SETUP-ANALYTICS.md.
--
-- Modelo de seguridad:
--   · El sitio estático inserta eventos con la "anon key" (pública por diseño).
--     Las políticas RLS solo le permiten INSERT: no puede leer, editar ni borrar.
--   · Leer estadísticas requiere un usuario autenticado (GoTrue) CUYO EMAIL
--     figure en la tabla `admins`. Nadie más ve nada.
-- ============================================================================

-- Sesiones: una fila por visita (el cliente la crea al arrancar).
create table if not exists public.sessions (
  id           uuid primary key,
  device_id    uuid,
  started_at   timestamptz not null default now(),
  browser      text check (char_length(browser) <= 40),
  os           text check (char_length(os) <= 40),
  device_type  text check (device_type in ('mobile','tablet','desktop')),
  viewport_w   int  check (viewport_w between 0 and 10000),
  viewport_h   int  check (viewport_h between 0 and 10000),
  dpr          real,
  lang         text check (char_length(lang) <= 20),
  referrer     text check (char_length(referrer) <= 300),
  utm_source   text check (char_length(utm_source) <= 80),
  utm_medium   text check (char_length(utm_medium) <= 80),
  utm_campaign text check (char_length(utm_campaign) <= 80),
  landing      text check (char_length(landing) <= 120),
  app_version  text check (char_length(app_version) <= 20)
);
create index if not exists idx_sessions_started on public.sessions (started_at desc);
create index if not exists idx_sessions_device  on public.sessions (device_id);

-- Eventos. Sin FK a sessions a propósito: los lotes que quedaron en el buffer
-- offline pueden llegar antes o después que la fila de sesión.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  session_id  uuid   not null,
  seq         int    not null check (seq >= 0),
  ts          bigint not null,                 -- epoch ms del cliente (para el replay)
  received_at timestamptz not null default now(),
  type        text   not null check (type in (
    'screen_view','click','rage_click','dead_click','scroll_depth',
    'form_focus','form_change','chat_msg','voice_used','voice_error',
    'milestone','error_js','feedback')),
  screen      text check (char_length(screen) <= 40),
  x           real check (x between 0 and 1),  -- normalizado al ancho del teléfono
  y           real check (y between 0 and 1),  -- normalizado al alto del contenido
  props       jsonb,
  constraint uq_events_session_seq unique (session_id, seq),
  constraint chk_props_size check (pg_column_size(props) < 8192)
);
create index if not exists idx_events_session  on public.events (session_id, seq);
create index if not exists idx_events_type     on public.events (type, received_at desc);
create index if not exists idx_events_screen   on public.events (screen, type);
create index if not exists idx_events_received on public.events (received_at desc);

-- Feedback 1-tap (también queda como evento; esta tabla facilita el listado).
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  session_id uuid,
  created_at timestamptz not null default now(),
  score      smallint not null check (score between 1 and 5),
  context    text check (char_length(context) <= 60),
  tags       text[] check (coalesce(array_length(tags, 1), 0) <= 6)
);

-- Los admins autorizados a LEER (solo emails; los usuarios se crean a mano en
-- Authentication → Add user). ⚠️ REEMPLAZAR por los emails reales de los dos.
create table if not exists public.admins (email text primary key);
insert into public.admins (email) values
  ('alessandri.fr@gmail.com'),
  ('EMAIL-DE-EFRAIN@ejemplo.com')
  on conflict do nothing;

-- ---------------------------------------------------------------- RLS ------
alter table public.sessions enable row level security;
alter table public.events   enable row level security;
alter table public.feedback enable row level security;
alter table public.admins   enable row level security;

-- ¿El usuario autenticado es admin? SECURITY DEFINER para consultar `admins`
-- sin abrirle SELECT a nadie más.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.admins where email = auth.jwt()->>'email') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- anon: solo INSERT (el tracker escribe, jamás lee).
create policy anon_insert_sessions on public.sessions for insert to anon with check (true);
create policy anon_insert_events   on public.events   for insert to anon with check (true);
create policy anon_insert_feedback on public.feedback for insert to anon with check (true);

-- authenticated: SELECT solo si figura en admins.
create policy admin_read_sessions on public.sessions for select to authenticated using (public.is_admin());
create policy admin_read_events   on public.events   for select to authenticated using (public.is_admin());
create policy admin_read_feedback on public.feedback for select to authenticated using (public.is_admin());
-- (sin políticas de UPDATE/DELETE: nadie modifica ni borra por la API)

-- Defensa en profundidad: recortar los GRANTs por defecto de Supabase.
revoke update, delete, truncate on public.sessions, public.events, public.feedback from anon, authenticated;
revoke select on public.sessions, public.events, public.feedback from anon;
revoke all on public.admins from anon, authenticated;

-- ------------------------------------------------ RPCs de agregación -------
-- Opcionales: el dashboard agrega client-side a escala de pruebas de usuario;
-- estas funciones (SECURITY INVOKER: la RLS decide) quedan como atajo.
create or replace function public.stats_overview(p_from timestamptz, p_to timestamptz)
returns json language sql stable as $$
  select json_build_object(
    'sessions',     (select count(*) from public.sessions where started_at between p_from and p_to),
    'devices',      (select count(distinct device_id) from public.sessions where started_at between p_from and p_to),
    'events',       (select count(*) from public.events where received_at between p_from and p_to),
    'screen_views', (select count(*) from public.events where type = 'screen_view' and received_at between p_from and p_to)
  )
$$;

create or replace function public.stats_flows(p_from timestamptz, p_to timestamptz)
returns table (from_screen text, to_screen text, n bigint) language sql stable as $$
  select props->>'prev', screen, count(*)
  from public.events
  where type = 'screen_view' and received_at between p_from and p_to
  group by 1, 2 order by 3 desc
$$;
