/* ============================================================================
 * ContextLayer · Admin — provider.js
 * Capa única de datos con 3 backends y la misma interfaz:
 *   - remote: Supabase vía SB (login + RLS de admins)
 *   - local:  localStorage de este navegador (cl_track_local*)
 *   - demo:   ~30 sesiones sintéticas generadas client-side
 * Cache en memoria por rango para no re-bajar en cada vista.
 * ==========================================================================*/

(function () {
  "use strict";

  let MODE = "local";          // "remote" | "local" | "demo"
  let DEMO = null;             // { sessions:[], events:[], feedback:[] }
  const CACHE = {};            // clave: mode|rangeKey → { sessions, events, feedback }

  /* ---------- Rango de fechas ---------- */
  // Devuelve el límite inferior del rango (null = todo). El superior es "ahora".
  function rangeFrom(key) {
    if (key === "today") { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    if (key === "7d") return new Date(Date.now() - 7 * 864e5);
    if (key === "30d") return new Date(Date.now() - 30 * 864e5);
    return null;
  }

  const inRange = (iso, from) => !from || (iso && new Date(iso) >= from);

  /* ---------- Backend local (localStorage compartida con /mvp) ---------- */
  function readLS(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; }
  }
  function localSessions() { return readLS("cl_track_local_sessions"); }
  function localEvents() {
    // received_at no existe en local: lo derivamos de ts (epoch ms del cliente).
    return readLS("cl_track_local").map((e) =>
      e.received_at ? e : Object.assign({}, e, { received_at: new Date(e.ts).toISOString() })
    );
  }
  // El widget de feedback guarda filas propias en cl_track_local_feedback;
  // si la clave está vacía, caemos a derivarlo de los eventos type='feedback'.
  function localFeedback(events) {
    const rows = readLS("cl_track_local_feedback");
    if (rows.length) {
      return rows.map((f) => ({
        session_id: f.session_id || null,
        created_at: f.created_at,
        score: f.score,
        context: f.context || null,
        tags: f.tags || [],
      }));
    }
    return feedbackFromEvents(events);
  }

  /* ---------- Feedback derivado de eventos (local / demo) ---------- */
  function feedbackFromEvents(events) {
    return events
      .filter((e) => e.type === "feedback" && e.props)
      .map((e) => ({
        session_id: e.session_id,
        created_at: e.received_at || new Date(e.ts).toISOString(),
        score: e.props.score,
        context: e.props.context || null,
        tags: e.props.tags || [],
      }));
  }

  /* ---------- Backend remoto (Supabase) ---------- */
  async function remoteFetch(rangeKey) {
    const from = rangeFrom(rangeKey);
    const iso = from ? from.toISOString() : null;
    const sParams = { order: "started_at.asc" };
    const eParams = { order: "ts.asc" };
    const fParams = { order: "created_at.desc" };
    if (iso) {
      sParams.started_at = "gte." + iso;   // sesiones por started_at
      eParams.received_at = "gte." + iso;  // eventos por received_at
      fParams.created_at = "gte." + iso;
    }
    const sessions = await SB.selectAll("sessions", sParams);
    const events = await SB.selectAll("events", eParams);
    const feedback = await SB.selectAll("feedback", fParams);
    return { sessions, events, feedback };
  }

  /* ============================================================ DEMO ====
   * Generador de ~30 sesiones sintéticas realistas: recorren los funnels con
   * drop-off, clicks con coordenadas plausibles por pantalla, feedback,
   * algún rage click y un error de JS.
   * ======================================================================*/

  // RNG con semilla (mulberry32): datos estables entre re-renders.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeDemo(seed) {
    const R = rng(seed || 42);
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const chance = (p) => R() < p;
    const jitter = (v, j) => Math.max(0.02, Math.min(0.98, v + (R() - 0.5) * (j || 0.06)));
    const uuid = () => "demo-" + Math.floor(R() * 1e9).toString(16) + "-" + Math.floor(R() * 1e9).toString(16);

    // Coordenadas plausibles de los elementos por pantalla (x/y normalizados).
    const HOT = {
      splash: [
        { y: 0.84, sel: "data-action=start-chatload", action: "start-chatload", label: "💬 Armar mi contexto charlando" },
        { y: 0.89, sel: "data-action=start-onboarding", action: "start-onboarding", label: "Prefiero un formulario" },
        { y: 0.94, sel: "data-action=load-demo", action: "load-demo", label: "Explorar con datos de ejemplo" },
      ],
      pasaporte: [
        { y: 0.30, sel: "data-go=contexto", go: "contexto", label: "Ver y editar mi contexto" },
        { y: 0.42, sel: "data-go=reservas", go: "reservas", label: "Mis reservas" },
        { y: 0.54, sel: "data-go=premium", go: "premium", label: "ContextLayer Premium" },
        { y: 0.66, sel: "data-go=permisos", go: "permisos", label: "Permisos" },
        { y: 0.88, sel: "data-go=agente", go: "agente", label: "Buscar con tu agente" },
      ],
      agente: [
        { y: 0.35, sel: "data-action=search-type", action: "search-type", label: "🎟️ Experiencia" },
        { y: 0.48, sel: "textarea.textarea", interactive: true },
        { y: 0.92, sel: "data-action=run-agent", action: "run-agent", label: "Buscar alojamiento" },
      ],
      resultados: [
        { y: 0.28, sel: "data-action=book-in-app", action: "book-in-app", label: "Reservar en Airbnb ›" },
        { y: 0.55, sel: "data-action=book-in-app", action: "book-in-app", label: "Reservar en Booking.com ›" },
        { y: 0.82, sel: "data-action=book-in-app", action: "book-in-app", label: "Reservar en Terruño ›" },
      ],
      thirdApp: [
        { y: 0.62, sel: "data-action=open-sso", action: "open-sso", label: "◈ Continuar con ContextLayer" },
        { y: 0.90, sel: "data-action=finish-booking", action: "finish-booking", label: "Confirmar reserva" },
      ],
      sso: [
        { y: 0.40, sel: "data-action=toggle-sso-field", action: "toggle-sso-field" },
        { y: 0.93, sel: "data-action=grant-sso", action: "grant-sso", label: "Autorizar" },
        { y: 0.93, x: 0.28, sel: "data-action=cancel-sso", action: "cancel-sso", label: "Cancelar" },
      ],
      premium: [
        { y: 0.45, sel: "data-action=select-plan", action: "select-plan", label: "Anual" },
        { y: 0.94, sel: "data-action=subscribe-premium", action: "subscribe-premium", label: "Suscribirme" },
      ],
      contexto: [{ y: 0.18, sel: "data-action=start-chat-update", action: "start-chat-update", label: "Actualizar charlando" }],
      permisos: [{ y: 0.4, sel: "data-action=toggle-grant", action: "toggle-grant", label: "Revocar acceso" }],
      chatload: [
        { y: 0.68, sel: "data-action=chat-suggest", action: "chat-suggest" },
        { y: 0.96, sel: "data-action=chat-send", action: "chat-send" },
      ],
      onboarding: [{ y: 0.85, sel: "data-action=onboarding-next", action: "onboarding-next", label: "Continuar" }],
      reservaOk: [{ y: 0.9, sel: "data-action=go-user-reservas", action: "go-user-reservas", label: "Ver mis reservas" }],
    };

    const BROWSERS = ["Chrome 126", "Chrome 124", "Safari 17", "Firefox 127", "Edge 125"];
    const OS_BY_DEV = { mobile: ["Android", "iOS"], tablet: ["iOS", "Android"], desktop: ["Windows", "macOS", "Linux"] };
    const APPS = ["app-airbnb", "app-booking", "app-terruno", "app-civitatis"];
    const GUIDE_KEYS = ["identity.name", "stay.type", "stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max", "stay.activities"];
    const TAGS = ["fácil", "claro", "rápido", "me gustó", "confuso", "lento", "no entendí"];
    const CONTEXTS = ["post-reserva", "post-onboarding", "general"];

    const sessions = [];
    const events = [];
    const N = 30;

    for (let i = 0; i < N; i++) {
      const sid = uuid();
      const device_type = R() < 0.62 ? "mobile" : R() < 0.75 ? "tablet" : "desktop";
      const startMs = Date.now() - Math.floor(R() * 29.2 * 864e5) - 3600e3;
      let ts = startMs;
      let seq = 0;
      let screen = null;
      let screenAt = startMs;

      const push = (type, props, x, y) => {
        events.push({
          session_id: sid, seq: seq++, ts,
          received_at: new Date(ts + 400).toISOString(),
          type, screen,
          x: x == null ? null : x,
          y: y == null ? null : y,
          props: props && Object.keys(props).length ? props : null,
        });
      };
      const wait = (min, max) => { ts += min + Math.floor(R() * ((max || min * 2) - min)); };
      const goScreen = (next, dir) => {
        push("screen_view", { prev: screen, prev_ms: screen ? ts - screenAt : null, dir: dir || "fwd" });
        screen = next; screenAt = ts;
      };
      // Click en un elemento "caliente" de la pantalla actual.
      const clickHot = (scr, idx, extra) => {
        const spots = HOT[scr] || [{ y: 0.5, sel: "div.card" }];
        const h = spots[idx != null ? idx : Math.floor(R() * spots.length)];
        const props = { region: "screen", interactive: h.interactive !== false, doc_h: 900 + Math.floor(R() * 700) };
        ["sel", "action", "go", "nav", "label"].forEach((k) => { if (h[k] != null) props[k] = h[k]; });
        Object.assign(props, extra || {});
        push("click", props, jitter(h.x != null ? h.x : 0.5, 0.1), jitter(h.y, 0.03));
        return h;
      };
      const milestone = (name, props) => push("milestone", Object.assign({ name }, props || {}));

      // Fila de sesión
      sessions.push({
        id: sid,
        device_id: uuid(),
        started_at: new Date(startMs).toISOString(),
        browser: pick(BROWSERS),
        os: pick(OS_BY_DEV[device_type]),
        device_type,
        viewport_w: device_type === "desktop" ? 1280 + Math.floor(R() * 640) : device_type === "tablet" ? 768 : 360 + Math.floor(R() * 80),
        viewport_h: device_type === "desktop" ? 800 : 720 + Math.floor(R() * 180),
        dpr: device_type === "desktop" ? 1 : 2 + Math.floor(R() * 2),
        lang: "es-AR",
        referrer: chance(0.4) ? pick(["https://instagram.com/", "https://wa.me/", "https://t.co/x"]) : null,
        utm_source: chance(0.3) ? pick(["ig", "wpp", "afiche"]) : null,
        utm_medium: chance(0.3) ? "social" : null,
        utm_campaign: chance(0.2) ? "tesis-mvp" : null,
        landing: "/mvp/",
        app_version: "2.0.0",
      });

      /* --- Recorrido --- */
      // Sesiones "garantizadas" para que el demo siempre muestre de todo:
      // 4 y 14 recorren el funnel completo; 0 y 12 exploran premium y se
      // suscriben; 2 y 22 revocan un permiso. Ninguna rebota ni abandona.
      const forceFull = i === 4 || i === 14;
      const forceKeep = forceFull || i === 0 || i === 2 || i === 12 || i === 22;
      goScreen("splash", "none");
      wait(2500, 9000);

      // Error de JS reproducible en un par de sesiones (temprano, así aparece
      // aunque la sesión abandone después).
      if (i === 7 || i === 19) {
        push("error_js", { msg: "TypeError: Cannot read properties of undefined (reading 'valor')", src: "/mvp/js/app.js", line: 1043 });
      }
      if (i === 19) push("error_js", { msg: "unhandledrejection: NetworkError when attempting to fetch resource." });

      // Rage click garantizado en una sesión: machaca un botón del splash.
      if (i === 2) {
        const rx = jitter(0.5, 0.05), ry = jitter(0.86, 0.02);
        for (let k = 0; k < 3; k++) { push("click", { sel: "data-action=start-chatload", action: "start-chatload", region: "screen", interactive: true, doc_h: 1000 }, rx, ry); ts += 150; }
        push("rage_click", { sel: "data-action=start-chatload", count: 3, region: "screen" }, rx, ry);
      }

      // 18% rebota en el splash (≤1 screen_view).
      if (chance(0.18) && !forceKeep) {
        if (chance(0.5)) clickHot("splash");
        if (chance(0.3)) push("scroll_depth", { max_pct: pick([25, 50]), for: "splash" });
        continue;
      }

      push("scroll_depth", { max_pct: pick([50, 75, 100, 100]), for: "splash" });

      // Camino elegido: demo directo / onboarding chat / onboarding formulario.
      const path = R();
      let onboarded = false;
      if (path < 0.28) {
        clickHot("splash", 2);
        milestone("demo_loaded");
        wait(500, 1200);
        goScreen("pasaporte");
        onboarded = true;
      } else if (path < 0.68) {
        clickHot("splash", 0);
        milestone("onboarding_start", { mode: "chat" });
        wait(400, 900);
        goScreen("chatload");
        let abandoned = false;
        for (let g = 0; g < GUIDE_KEYS.length; g++) {
          wait(4000, 16000);
          if (chance(0.06) && !forceKeep) { abandoned = true; break; } // abandono a mitad del chat
          const source = chance(0.14) ? "skip" : chance(0.12) ? "voice" : chance(0.5) ? "chip" : "text";
          if (source === "voice" && chance(0.25)) push("voice_error", {});
          push("chat_msg", { source, step_key: GUIDE_KEYS[g], len: source === "skip" ? 0 : 4 + Math.floor(R() * 40) });
          if (chance(0.4)) clickHot("chatload", 0);
        }
        if (abandoned) { push("scroll_depth", { max_pct: 50, for: "chatload" }); continue; }
        milestone("onboarding_complete", { mode: "chat" });
        wait(2000, 6000);
        goScreen("pasaporte");
        onboarded = true;
      } else {
        clickHot("splash", 1);
        milestone("onboarding_start", { mode: "form" });
        wait(400, 900);
        goScreen("onboarding");
        const FORM_KEYS = ["identity.name", "identity.city", "stay.type", "stay.ambiance", "stay.diet", "stay.budget.max"];
        let quit = false;
        for (let f = 0; f < FORM_KEYS.length; f++) {
          wait(3000, 12000);
          if (chance(0.08) && !forceKeep) { quit = true; break; } // abandono del formulario
          push("form_focus", { key: FORM_KEYS[f], field_type: f < 2 ? "text" : "select" });
          wait(1500, 6000);
          push("form_change", { key: FORM_KEYS[f], field_type: f < 2 ? "text" : "select" });
          if (chance(0.5)) clickHot("onboarding", 0);
        }
        if (quit) continue;
        milestone("onboarding_complete", { mode: "form" });
        wait(1500, 4000);
        goScreen("onboardingDone");
        wait(4000, 12000);
        goScreen("pasaporte");
        onboarded = true;
      }

      if (!onboarded) continue;
      wait(2000, 8000);
      push("scroll_depth", { max_pct: pick([75, 100, 100]), for: "pasaporte" });
      clickHot("pasaporte", 0); // curiosea "mi contexto"
      wait(300, 800);
      goScreen("contexto");
      wait(3000, 10000);
      push("scroll_depth", { max_pct: pick([25, 50, 75, 100]), for: "contexto" });
      goScreen("pasaporte", "back");
      wait(1500, 5000);

      // Algún click muerto sobre una card no interactiva.
      if (chance(0.15)) push("dead_click", { sel: "div.card", region: "screen" }, jitter(0.5, 0.2), jitter(0.15, 0.08));
      if (chance(0.12)) push("click", { sel: "#tabbar", nav: "actividad", region: "tabbar", interactive: true, label: "Actividad" }, jitter(0.62, 0.05), null);

      // ~30% se queda explorando y no busca (cohorte por índice para que el
      // demo siempre tenga suscripciones premium y permisos revocados).
      if (i % 10 < 3) {
        if (i % 2 === 0) {
          // Mira premium desde el pasaporte; alguna se suscribe y canjea.
          clickHot("pasaporte", 2);
          wait(300, 700);
          goScreen("premium");
          wait(5000, 15000);
          push("scroll_depth", { max_pct: pick([50, 75, 100]), for: "premium" });
          if (i % 6 === 0) {
            const plan = chance(0.5) ? "anual" : "mes";
            if (plan === "mes") clickHot("premium", 0);
            milestone("premium_subscribed", { plan });
            clickHot("premium", 1);
            wait(2000, 6000);
            if (chance(0.6)) milestone("reward_redeemed", { reward: pick(["rw-checkout", "rw-desc"]), costo: pick([400, 800]) });
          }
          goScreen("pasaporte", "back");
          wait(1000, 3000);
        }
        if (chance(0.6) || i % 4 === 2) {
          clickHot("pasaporte", 3);
          wait(300, 600);
          goScreen("permisos");
          wait(3000, 9000);
          if (i % 4 === 2) {
            clickHot("permisos", 0);
            milestone("grant_revoked", { grant: "grant-airbnb" });
            if (chance(0.4)) milestone("grant_reactivated", { grant: "grant-airbnb" });
          }
        }
        if (chance(0.35)) {
          push("feedback", { score: pick([3, 4, 4, 5]), context: "general", tags: [pick(TAGS)] });
        }
        continue;
      }

      // Búsqueda con Aria
      clickHot("pasaporte", 4);
      wait(300, 700);
      goScreen("agente");
      wait(4000, 15000);
      const stype = chance(0.3) ? "tour" : "stay";
      if (stype === "tour") clickHot("agente", 0);
      const edited = chance(0.45);
      milestone("search_run", { type: stype, pedido_len: 30 + Math.floor(R() * 60), edited });
      clickHot("agente", 2);
      wait(200, 400);
      goScreen("thinking");
      wait(3000, 4500);
      milestone("results_shown", { type: stype, count: 5 });
      goScreen("resultados");
      wait(5000, 20000);
      push("scroll_depth", { max_pct: pick([50, 75, 100, 100]), for: "resultados" });

      // Rage click en una card de resultados (frustración simulada).
      if (chance(0.12)) {
        const rx = jitter(0.5, 0.1), ry = jitter(0.4, 0.05);
        for (let k = 0; k < 3; k++) { push("click", { sel: "div.card", region: "screen", interactive: false, doc_h: 1400 }, rx, ry); ts += 150; }
        push("rage_click", { sel: "div.card", count: 3, region: "screen" }, rx, ry);
        push("dead_click", { sel: "div.card", region: "screen" }, rx, ry);
      }

      // 28% mira resultados pero no abre ninguno.
      if (chance(0.28) && !forceFull) {
        if (chance(0.3)) push("feedback", { score: pick([2, 3, 4]), context: "resultados", tags: [pick(TAGS)] });
        continue;
      }

      const app = pick(APPS);
      const optIdx = Math.floor(R() * 3);
      milestone("option_open", { opt: (stype === "tour" ? "tour-" : "opt-") + (optIdx + 1), app, type: stype, position: optIdx });
      clickHot("resultados", optIdx);
      wait(300, 700);
      goScreen("thirdApp");
      wait(3000, 9000);
      milestone("sso_opened", { app });
      clickHot("thirdApp", 0);
      wait(200, 500);
      goScreen("sso");
      wait(5000, 18000);
      push("scroll_depth", { max_pct: pick([75, 100, 100]), for: "sso" });
      if (chance(0.5)) clickHot("sso", 0); // desactiva un campo

      // 15% cancela el consentimiento.
      if (chance(0.15) && !forceFull) {
        milestone("sso_cancelled", { app });
        clickHot("sso", 2);
        wait(300, 700);
        goScreen("thirdApp", "back");
        continue;
      }
      const fieldsN = 2 + Math.floor(R() * 3);
      milestone("sso_granted", { app, fields_count: fieldsN, fields: ["identity.name", "stay.type", "stay.budget.max", "stay.diet"].slice(0, fieldsN) });
      clickHot("sso", 1);
      wait(300, 700);
      goScreen("thirdApp", "back");
      wait(4000, 12000);

      // 12% no confirma la reserva.
      if (chance(0.12) && !forceFull) continue;
      const premiumAtBooking = chance(0.2);
      milestone("booking_confirmed", {
        opt: (stype === "tour" ? "tour-" : "opt-") + (optIdx + 1),
        app, type: stype, premium: premiumAtBooking,
        total: stype === "tour" ? 40 + Math.floor(R() * 120) : 300 + Math.floor(R() * 400),
      });
      clickHot("thirdApp", 1);
      wait(300, 700);
      goScreen("reservaOk");
      wait(4000, 12000);
      push("scroll_depth", { max_pct: pick([50, 75, 100]), for: "reservaOk" });
      if (chance(0.6)) push("feedback", { score: pick([4, 4, 5, 5, 3]), context: "post-reserva", tags: [pick(TAGS), pick(TAGS)].filter((v, ix, a) => a.indexOf(v) === ix) });
      clickHot("reservaOk", 0);
      wait(300, 600);
      goScreen("reservas");
      wait(3000, 8000);

      // Premium: ~45% lo mira, ~40% de esos se suscribe.
      if (chance(0.45)) {
        goScreen("pasaporte", "back");
        wait(1500, 4000);
        clickHot("pasaporte", 2);
        wait(300, 600);
        goScreen("premium");
        wait(6000, 20000);
        push("scroll_depth", { max_pct: pick([50, 75, 100, 100]), for: "premium" });
        if (chance(0.4)) {
          const plan = chance(0.6) ? "anual" : "mes";
          if (plan === "mes") clickHot("premium", 0);
          milestone("premium_subscribed", { plan });
          clickHot("premium", 1);
          wait(3000, 9000);
          if (chance(0.3)) milestone("reward_redeemed", { reward: pick(["rw-checkout", "rw-desc"]), costo: pick([400, 800]) });
          if (chance(0.1)) milestone("premium_cancelled");
        }
      }

      // Revocación de permisos al final (2 de cada ~10 llegan).
      if (chance(0.18)) {
        goScreen("permisos");
        wait(2000, 6000);
        clickHot("permisos", 0);
        milestone("grant_revoked", { grant: "grant-sso-" + app });
        if (chance(0.3)) milestone("grant_reactivated", { grant: "grant-sso-" + app });
      }

    }

    events.sort((a, b) => a.ts - b.ts);
    return { sessions, events, feedback: feedbackFromEvents(events) };
  }

  /* ============================================================ API ====*/
  async function load(rangeKey) {
    const key = MODE + "|" + rangeKey;
    if (CACHE[key]) return CACHE[key];
    let data;
    if (MODE === "remote") {
      data = await remoteFetch(rangeKey);
    } else {
      const src = MODE === "demo"
        ? DEMO
        : { sessions: localSessions(), events: localEvents() };
      if (MODE !== "demo") src.feedback = localFeedback(src.events);
      const from = rangeFrom(rangeKey);
      const sessions = src.sessions.filter((s) => inRange(s.started_at, from));
      const events = src.events
        .filter((e) => inRange(e.received_at, from))
        .slice()
        .sort((a, b) => a.ts - b.ts);
      const feedback = (src.feedback || feedbackFromEvents(src.events)).filter((f) => inRange(f.created_at, from));
      data = { sessions, events, feedback };
    }
    CACHE[key] = data;
    return data;
  }

  window.Provider = {
    mode() { return MODE; },

    setMode(m) { MODE = m; this.invalidate(); },

    // Activa el modo demo (re)generando los datos sintéticos.
    generateDemo(seed) {
      DEMO = makeDemo(seed || 42);
      MODE = "demo";
      this.invalidate();
      return DEMO;
    },

    hasDemo() { return !!DEMO; },

    invalidate() { Object.keys(CACHE).forEach((k) => delete CACHE[k]); },

    async sessions(rango) { return (await load(rango)).sessions; },
    async events(rango) { return (await load(rango)).events; },
    async feedback(rango) { return (await load(rango)).feedback; },
    async all(rango) { return load(rango); },

    // Eventos de UNA sesión (para el detalle + replay), ordenados por seq.
    async eventsOf(sessionId) {
      if (MODE === "remote") {
        return SB.selectAll("events", { session_id: "eq." + sessionId, order: "seq.asc" });
      }
      const src = MODE === "demo" ? DEMO.events : localEvents();
      return src.filter((e) => e.session_id === sessionId).slice().sort((a, b) => a.seq - b.seq);
    },

    // Últimos N eventos (vista "En vivo"). Sin cache: siempre fresco.
    async recent(limit) {
      const n = limit || 100;
      if (MODE === "remote") {
        return SB.select("events", { order: "ts.desc", limit: n });
      }
      const src = MODE === "demo" ? DEMO.events : localEvents();
      return src.slice().sort((a, b) => b.ts - a.ts).slice(0, n);
    },
  };
})();
