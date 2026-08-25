/* ============================================================================
 * ContextLayer · track.js — analítica de uso para las pruebas de usuario
 *
 * Autónomo: si este archivo no carga, la app funciona igual. app.js solo
 * emite CustomEvents ("cl:nav") y milestones vía window.CLTrack.ev().
 *
 * Modos:
 *  - remoto: hay SUPABASE_URL/KEY en config.js → los eventos van a Postgres
 *    (PostgREST) con la anon key. RLS permite INSERT y nada más.
 *  - local: sin config o sin red → los eventos quedan en localStorage y el
 *    dashboard /admin los lee de este mismo navegador.
 *
 * Privacidad (regla dura): jamás se envían valores del pasaporte, texto del
 * chat ni del pedido. Solo pantallas, acciones, keys de campos y longitudes.
 * IDs anónimos (crypto.randomUUID), sin cookies.
 * ==========================================================================*/

(function () {
  "use strict";

  const LS = {
    did: "cl_did",            // id anónimo del dispositivo
    sid: "cl_sid",            // id de la sesión actual
    sidAt: "cl_sid_at",       // última actividad (rota la sesión a los 30 min)
    sidNew: "cl_sid_new",     // la fila de sessions todavía no se envió
    seq: "cl_seq",            // secuencia de eventos de la sesión
    queue: "cl_track_queue",  // cola pendiente de envío (modo remoto)
    local: "cl_track_local",  // eventos acumulados (modo local)
    localSes: "cl_track_local_sessions",
  };

  const SESSION_GAP_MS = 30 * 60 * 1000;
  const FLUSH_MS = 5000;
  const FLUSH_N = 20;
  const BATCH_MAX = 50;
  const LOCAL_CAP = 2000;

  const T = {
    mode: "off",       // "remote" | "local" | "off"
    url: "",
    key: "",
    version: "",
    sid: null,
    did: null,
    seq: 0,
    queue: [],
    screen: null,      // pantalla actual (la mantiene el listener de cl:nav)
    screenAt: 0,
    scrollMax: 0,      // profundidad máxima de la pantalla actual
    failUntil: 0,      // backoff tras errores de red
    fails: 0,
  };

  /* ------------------------------------------------------------- helpers */
  const now = () => Date.now();
  const uuid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const cut = (s, n) => (s == null ? null : String(s).slice(0, n));

  function uaInfo() {
    const ua = navigator.userAgent;
    const os = /android/i.test(ua) ? "Android"
      : /iphone|ipad|ipod/i.test(ua) ? "iOS"
      : /windows/i.test(ua) ? "Windows"
      : /mac os/i.test(ua) ? "macOS"
      : /linux/i.test(ua) ? "Linux" : "otro";
    const m =
      ua.match(/(edg|opr|firefox|chrome|safari)\/([\d.]+)/i) ||
      ua.match(/(safari)/i) || [];
    const names = { edg: "Edge", opr: "Opera", firefox: "Firefox", chrome: "Chrome", safari: "Safari" };
    const browser = (names[(m[1] || "").toLowerCase()] || "otro") + (m[2] ? " " + m[2].split(".")[0] : "");
    const mobile = /mobi|android|iphone/i.test(ua);
    const tablet = /ipad|tablet/i.test(ua) || (mobile && Math.min(innerWidth, innerHeight) >= 600);
    return { os, browser, device_type: tablet ? "tablet" : mobile ? "mobile" : "desktop" };
  }

  /* ---------------------------------------------------- identidad/sesión */
  function ensureIds() {
    T.did = lsGet(LS.did) || uuid();
    lsSet(LS.did, T.did);
    const last = Number(lsGet(LS.sidAt) || 0);
    const stale = !lsGet(LS.sid) || now() - last > SESSION_GAP_MS;
    if (stale) {
      T.sid = uuid();
      T.seq = 0;
      lsSet(LS.sid, T.sid);
      lsSet(LS.seq, "0");
      lsSet(LS.sidNew, "1");
      sessionRow();
    } else {
      T.sid = lsGet(LS.sid);
      T.seq = Number(lsGet(LS.seq) || 0);
      if (lsGet(LS.sidNew) === "1") sessionRow(); // reintento pendiente
    }
    lsSet(LS.sidAt, String(now()));
  }

  function sessionRow() {
    const u = uaInfo();
    const q = new URLSearchParams(location.search);
    const row = {
      id: T.sid || lsGet(LS.sid),
      device_id: T.did || lsGet(LS.did),
      browser: cut(u.browser, 40),
      os: cut(u.os, 40),
      device_type: u.device_type,
      viewport_w: innerWidth,
      viewport_h: innerHeight,
      dpr: devicePixelRatio || 1,
      lang: cut(navigator.language, 20),
      referrer: cut(document.referrer, 300) || null,
      utm_source: cut(q.get("utm_source"), 80),
      utm_medium: cut(q.get("utm_medium"), 80),
      utm_campaign: cut(q.get("utm_campaign"), 80),
      landing: cut(location.pathname + location.hash, 120),
      app_version: cut(T.version, 20),
    };
    if (T.mode === "remote") {
      sbInsert("sessions", [row], "id")
        .then((ok) => { if (ok) lsSet(LS.sidNew, "0"); })
        .catch(() => {});
    } else if (T.mode === "local") {
      const all = readJson(LS.localSes, []);
      if (!all.some((s) => s.id === row.id)) {
        row.started_at = new Date().toISOString();
        all.push(row);
        lsSet(LS.localSes, JSON.stringify(all.slice(-200)));
      }
      lsSet(LS.sidNew, "0");
    }
  }

  function readJson(k, dflt) {
    try { return JSON.parse(lsGet(k)) || dflt; } catch (e) { return dflt; }
  }

  /* ------------------------------------------------------ envío (remoto) */
  // Inserción directa en PostgREST. `return=minimal` es obligatorio (la RLS
  // no permite SELECT) e `ignore-duplicates` hace idempotente el reintento.
  function sbInsert(table, rows, onConflict) {
    const qs = onConflict ? "?on_conflict=" + onConflict : "";
    return fetch(T.url + "/rest/v1/" + table + qs, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: T.key,
        authorization: "Bearer " + T.key,
        prefer: "return=minimal" + (onConflict ? ",resolution=ignore-duplicates" : ""),
      },
      body: JSON.stringify(rows),
    }).then((r) => r.ok || r.status === 409);
  }

  let flushTimer = null;
  function scheduleFlush(ms) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, ms || FLUSH_MS);
  }

  function persistQueue() {
    lsSet(LS.queue, JSON.stringify(T.queue.slice(0, 500)));
  }

  function flush(final) {
    if (T.mode !== "remote" || !T.queue.length) return;
    if (!final && now() < T.failUntil) { scheduleFlush(T.failUntil - now() + 100); return; }
    const batch = T.queue.slice(0, BATCH_MAX);
    const req = fetch(T.url + "/rest/v1/events?on_conflict=session_id,seq", {
      method: "POST",
      // keepalive solo al cerrar (límite 64 KB): los batches normales no lo necesitan.
      keepalive: !!final,
      headers: {
        "content-type": "application/json",
        apikey: T.key,
        authorization: "Bearer " + T.key,
        prefer: "return=minimal,resolution=ignore-duplicates",
      },
      body: JSON.stringify(batch),
    });
    req.then((r) => {
      if (r.ok || r.status === 409) {
        T.queue.splice(0, batch.length);
        T.fails = 0;
        T.failUntil = 0;
        persistQueue();
        if (T.queue.length) scheduleFlush(200);
      } else {
        fail();
      }
    }).catch(fail);
  }
  function fail() {
    T.fails = Math.min(T.fails + 1, 6);
    T.failUntil = now() + Math.pow(2, T.fails) * 1000; // 2s, 4s… 64s
    scheduleFlush(Math.pow(2, T.fails) * 1000);
  }

  /* ----------------------------------------------------------- registrar */
  function record(type, props, coords) {
    if (T.mode === "off") return;
    lsSet(LS.sidAt, String(now()));
    const e = {
      session_id: T.sid,
      seq: T.seq++,
      ts: now(),
      type,
      screen: cut(T.screen, 40),
      x: coords && coords.x != null ? coords.x : null,
      y: coords && coords.y != null ? coords.y : null,
      props: props && Object.keys(props).length ? props : null,
    };
    lsSet(LS.seq, String(T.seq));
    if (T.mode === "remote") {
      T.queue.push(e);
      persistQueue();
      if (T.queue.length >= FLUSH_N) flush();
      else scheduleFlush();
    } else {
      const all = readJson(LS.local, []);
      all.push(e);
      lsSet(LS.local, JSON.stringify(all.slice(-LOCAL_CAP)));
    }
  }

  /* ----------------------------------------------- instrumentación auto */
  const DATASET_OK = ["action", "go", "nav", "app", "opt", "plan", "reward", "dom", "key", "type"];
  const INTERACTIVE = "[data-action],[data-go],[data-nav],button,a,input,select,textarea,label,summary";

  function shortSel(el) {
    if (!el || el === document.body) return null;
    for (const k of ["action", "go", "nav"]) {
      const hit = el.closest("[data-" + k + "]");
      if (hit) return "data-" + k + "=" + hit.dataset[k];
    }
    if (el.id) return "#" + el.id;
    const cls = (el.className && String(el.className).split(/\s+/)[0]) || "";
    return cut(el.tagName.toLowerCase() + (cls ? "." + cls : ""), 60);
  }

  const clicksBuf = []; // para rage clicks
  let lastRageAt = 0;

  function onClick(e) {
    if (T.mode === "off") return;
    const device = document.querySelector(".device");
    const screenEl = document.getElementById("screen");
    if (!device) return;
    const dr = device.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - dr.left) / Math.max(dr.width, 1)));

    let y = null;
    let region = "device";
    const props = {};
    if (screenEl && screenEl.contains(e.target)) {
      region = "screen";
      const sr = screenEl.getBoundingClientRect();
      const docH = Math.max(screenEl.scrollHeight, 1);
      y = Math.max(0, Math.min(1, (e.clientY - sr.top + screenEl.scrollTop) / docH));
      props.doc_h = docH;
    } else if (e.target.closest("#tabbar")) {
      region = "tabbar";
    }
    props.region = region;

    const target = e.target.closest ? e.target : null;
    const interactiveEl = target && target.closest(INTERACTIVE);
    props.sel = shortSel(target);
    if (interactiveEl) {
      DATASET_OK.forEach((k) => {
        if (interactiveEl.dataset && interactiveEl.dataset[k] != null) props[k] = cut(interactiveEl.dataset[k], 60);
      });
      // El texto del elemento ayuda a leer el ranking; nunca en el chat
      // (los chips son valores del contexto) ni en botones que interpolan
      // datos del tester (ej. "Continuar como {nombre}").
      const LABEL_DENY = ["resume", "edit-summary", "save-summary"];
      if (T.screen !== "chatload" && LABEL_DENY.indexOf(interactiveEl.dataset && interactiveEl.dataset.action) === -1) {
        const label = (interactiveEl.textContent || "").trim().replace(/\s+/g, " ");
        if (label) props.label = cut(label, 40);
      }
    }
    props.interactive = !!interactiveEl;

    record("click", props, { x, y });
    if (!interactiveEl) record("dead_click", { sel: props.sel, region }, { x, y });

    // Rage: 3+ clicks en <600 ms en un radio de 24 px.
    const nowT = now();
    clicksBuf.push({ t: nowT, px: e.clientX, py: e.clientY });
    while (clicksBuf.length && nowT - clicksBuf[0].t > 600) clicksBuf.shift();
    if (clicksBuf.length >= 3 && nowT - lastRageAt > 1000) {
      const near = clicksBuf.every(
        (c) => Math.hypot(c.px - e.clientX, c.py - e.clientY) < 24
      );
      if (near) {
        lastRageAt = nowT;
        record("rage_click", { sel: props.sel, count: clicksBuf.length, region }, { x, y });
      }
    }
  }

  function onScroll() {
    const screenEl = document.getElementById("screen");
    if (!screenEl) return;
    const h = screenEl.scrollHeight - screenEl.clientHeight;
    if (h < 50) return; // no scrolleable: no medimos
    const pct = Math.min(1, (screenEl.scrollTop + screenEl.clientHeight) / screenEl.scrollHeight);
    if (pct > T.scrollMax) T.scrollMax = pct;
  }

  function emitScrollDepth(forScreen) {
    if (!forScreen || !T.scrollMax) return;
    const bucket = T.scrollMax >= 0.98 ? 100 : T.scrollMax >= 0.75 ? 75 : T.scrollMax >= 0.5 ? 50 : 25;
    record("scroll_depth", { max_pct: bucket, for: cut(forScreen, 40) });
    T.scrollMax = 0;
  }

  /* --------------------------------------------------------- API pública */
  window.CLTrack = {
    init(cfg) {
      cfg = cfg || {};
      const preview = new URLSearchParams(location.search).has("preview");
      if (preview) { T.mode = "off"; return; }
      T.url = String(cfg.SUPABASE_URL || "").replace(/\/+$/, "");
      T.key = cfg.SUPABASE_ANON_KEY || "";
      T.version = cfg.VERSION || "";
      T.mode = T.url && T.key ? "remote" : "local";
      T.queue = readJson(LS.queue, []);
      ensureIds();
      if (T.queue.length) scheduleFlush(1500); // drenar lo pendiente de antes

      document.addEventListener("click", onClick, true);
      document.addEventListener("scroll", throttle(onScroll, 250), true);
      document.addEventListener("focusin", (e) => {
        const el = e.target.closest && e.target.closest("[data-key]");
        if (el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) {
          record("form_focus", { key: cut(el.dataset.key, 40), field_type: el.type || el.tagName.toLowerCase() });
        }
      });
      document.addEventListener("change", (e) => {
        const el = e.target.closest && e.target.closest("[data-key]");
        if (el) record("form_change", { key: cut(el.dataset.key, 40), field_type: el.type || el.tagName.toLowerCase() });
      }, true);

      document.addEventListener("cl:nav", (e) => {
        const d = e.detail || {};
        emitScrollDepth(d.prev);
        const prevMs = T.screenAt ? now() - T.screenAt : null;
        record("screen_view", { prev: cut(d.prev, 40) || null, prev_ms: prevMs, dir: d.dir || null });
        T.screen = d.screen;
        T.screenAt = now();
      });

      window.addEventListener("error", (e) => {
        record("error_js", { msg: cut(e.message, 200), src: cut(e.filename, 120), line: e.lineno || null });
      });
      window.addEventListener("unhandledrejection", (e) => {
        record("error_js", { msg: cut("unhandledrejection: " + (e.reason && e.reason.message || e.reason), 200) });
      });

      const finalFlush = () => { emitScrollDepth(T.screen); flush(true); };
      window.addEventListener("pagehide", finalFlush);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") finalFlush();
      });
    },

    // Evento genérico (milestones, chat_msg…). Sin coordenadas.
    ev(type, props) { record(type, props || {}); },
    milestone(name, props) { record("milestone", Object.assign({ name }, props || {})); },

    // Feedback 1-tap: queda como evento Y como fila propia (tabla feedback
    // en remoto / cl_track_local_feedback en local) para listarlo fácil.
    feedback(score, context, tags) {
      record("feedback", { score, context: cut(context, 60), tags: tags || [] });
      const row = { session_id: T.sid, score, context: cut(context, 60), tags: tags || [] };
      if (T.mode === "remote") {
        sbInsert("feedback", [row]).catch(() => {});
      } else if (T.mode === "local") {
        const all = readJson("cl_track_local_feedback", []);
        all.push(Object.assign({ created_at: new Date().toISOString() }, row));
        lsSet("cl_track_local_feedback", JSON.stringify(all.slice(-300)));
      }
    },
    mode() { return T.mode; },
  };

  function throttle(fn, ms) {
    let last = 0, timer = null;
    return function () {
      const n = now();
      if (n - last >= ms) { last = n; fn(); }
      else if (!timer) timer = setTimeout(() => { timer = null; last = Date.now(); fn(); }, ms);
    };
  }

  // Autoinit si config.js ya cargó (orden de scripts en index.html).
  if (window.CL_CFG) window.CLTrack.init(window.CL_CFG);
})();
