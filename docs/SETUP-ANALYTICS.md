# Setup de Analytics + Admin (una sola vez, ~15 minutos)

El prototipo trackea el uso de forma anónima y lo muestra en el dashboard `/admin`,
al que solo pueden entrar los dos admins. Los datos viven en un proyecto **gratuito**
de Supabase (Postgres) de la cuenta de ustedes.

> Sin este setup todo funciona igual en **modo local**: los eventos quedan en el
> navegador y `/admin` muestra los de ese mismo dispositivo. El setup es lo que
> habilita juntar datos de testers reales desde cualquier dispositivo.

## 1. Crear el proyecto en Supabase

1. Entrar a [supabase.com](https://supabase.com) → **Start your project** (cuenta gratis con GitHub o email).
2. **New project**: nombre `contextlayer-analytics`, una contraseña de base (guardarla), región `South America (São Paulo)`.
3. Esperar ~1 minuto a que el proyecto quede listo.

## 2. Crear las tablas y la seguridad

1. En el menú de la izquierda: **SQL Editor** → **New query**.
2. Abrir el archivo [`analytics/schema.sql`](../analytics/schema.sql) de este repo,
   **editar la línea con `EMAIL-DE-EFRAIN@ejemplo.com`** poniendo los emails reales
   de los dos admins, y pegar el archivo entero en el editor.
3. **Run**. Tiene que decir "Success. No rows returned".

## 3. Crear los 2 usuarios admin

1. **Authentication → Users → Add user → Create new user.**
2. Crear un usuario por cada admin con **el mismo email que pusieron en el paso 2**
   y una contraseña fuerte. Marcar **Auto Confirm User**.
3. **Authentication → Sign In / Providers**: deshabilitar **"Allow new users to sign up"**
   (nadie más puede crearse cuenta; y aunque pudiera, sin estar en la tabla
   `admins` no puede leer nada).

## 4. Conectar el sitio

1. **Settings → API**: copiar la **Project URL** y la key **`anon` `public`**.
2. Pegarlas en [`mvp/js/config.js`](../mvp/js/config.js):

```js
SUPABASE_URL: "https://TU-PROYECTO.supabase.co",
SUPABASE_ANON_KEY: "eyJ…",
```

3. Commitear y pushear. La anon key es **pública por diseño** (viaja en cada
   visita del sitio): la seguridad la dan las políticas RLS del paso 2.

## 5. Publicar en GitHub Pages

1. En el repo: **Settings → Pages → Build and deployment**.
2. Source: **Deploy from a branch** → elegir la rama y carpeta **`/ (root)`** → Save.
3. En 1–2 minutos el sitio queda en `https://<usuario>.github.io/contextlayer/`.
   - La app: `…/contextlayer/mvp/`
   - El dashboard: `…/contextlayer/admin/`

## 6. Verificar

1. Abrir la app publicada, recorrer un par de pantallas.
2. En Supabase: **Table Editor → events** — tienen que aparecer filas.
3. Abrir `…/contextlayer/admin/`, entrar con email+contraseña de admin y ver los datos.
4. Probar que un email que NO está en `admins` no ve nada (crear un usuario de
   prueba si quieren comprobarlo).

## Mantenimiento

- **Borrar datos de prueba**: SQL Editor → `truncate public.events, public.sessions, public.feedback;`
- **Sumar/sacar un admin**: editar la tabla `admins` (Table Editor) y crear/borrar
  el usuario en Authentication.
- **Si aparece spam** (la anon key es pública): truncar las tablas y, si insiste,
  Settings → API → rotar la anon key y actualizar `config.js`.
