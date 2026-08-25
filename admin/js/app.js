/* ============================================================================
 * ContextLayer · Admin — app.js
 * Shell del dashboard: login (modo remoto), banner de modo local/demo,
 * router por hash, filtros globales (rango + device_type) y ciclo de vida
 * de las vistas registradas en window.ADMIN_VIEWS.
 * ==========================================================================*/

(function () {
  "use strict";

  const VIEWS = window.ADMIN_VIEWS || {};
  const NAV_ORDER = ["overview", "heatmap", "elements", "scroll", "funnels", "flows", "sessions", "live", "features", "feedback", "errors", "export"];

  const RANGE_LABEL = { today: "hoy", "7d": "últimos 7 días", "30d": "últimos 30 días", all: "todo" };
  const SEG_LABEL = { all: "todos los dispositivos", mobile: "mobile", tablet: "tablet", desktop: "desktop" };

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const state = {
    route: "overview",
    param: null,
    range: "all",
    segment: "all",
    current: null,      // vista activa (para destroy())
    adminWarn: false,   // remoto sin filas: probable falta de acceso RLS
  };

  /* ------------------------------------------------------------- Login */
  function showLogin(msg) {
    $("#shell").hidden = true;
    $("#login").hidden = false;
    const err = $("#login-error");
    if (msg) { err.textContent = msg; err.hidden = false; } else { err.hidden = true; }
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#login-btn");
    btn.disabled = true;
    btn.textContent = "Entrando…";
    try {
      await SB.login($("#login-email").value.trim(), $("#login-pass").value);
      await startApp("remote");
    } catch (err) {
      showLogin(err.message === "SIN_SESION" ? "La sesión no es válida. Probá de nuevo." : err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "Entrar";
    }
  });

  // Escape de emergencia: mirar la localStorage propia sin loguearse.
  $("#login-local").addEventListener("click", () => startApp("local"));

  /* ------------------------------------------------------------ Sidebar */
  function buildNav() {
    $("#nav").innerHTML = NAV_ORDER.map((r) => {
      const v = VIEWS[r];
      return `<a class="nav-item" href="#/${r}" data-route="${r}">
        <span class="nav-item__ico">${v ? v.icon : "•"}</span>${v ? esc(v.title) : r}
      </a>`;
    }).join("");
  }

  function markNav() {
    document.querySelectorAll(".nav-item").forEach((a) => {
      a.classList.toggle("is-active", a.dataset.route === state.route);
    });
    const v = VIEWS[state.route];
    $("#view-title").textContent = v ? v.title : "—";
  }

  function buildFoot() {
    const mode = Provider.mode();
    const pill = mode === "remote"
      ? '<span class="mode-pill mode-pill--remote">● Remoto</span>'
      : mode === "demo"
        ? '<span class="mode-pill mode-pill--demo">● Demo</span>'
        : '<span class="mode-pill mode-pill--local">● Local</span>';
    const ses = mode === "remote" ? SB.session() : null;
    $("#sidebar-foot").innerHTML = `
      ${pill}
      ${ses && ses.email ? `<span title="${esc(ses.email)}" style="overflow:hidden;text-overflow:ellipsis">${esc(ses.email)}</span>` : ""}
      ${mode === "remote" ? '<button class="btn btn--sm btn--ghost" id="logout-btn">Cerrar sesión</button>' : ""}
      <span>ContextLayer v${esc((window.CL_CFG || {}).VERSION || "?")}</span>`;
    const lo = $("#logout-btn");
    if (lo) lo.addEventListener("click", () => {
      SB.logout();
      showLogin();
    });
  }

  /* ------------------------------------------------------------- Banner */
  function updateBanner() {
    const b = $("#banner");
    const mode = Provider.mode();
    if (mode === "local") {
      b.className = "banner banner--local";
      b.innerHTML = `<span>⚠️</span><span class="grow"><b>Modo local:</b> datos de este navegador (no hay Supabase configurado o elegiste verlos). Abrí el MVP en esta misma pestaña/navegador para generar eventos.</span>
        <button class="btn btn--sm btn--primary" id="gen-demo">✨ Generar datos de ejemplo</button>`;
      b.hidden = false;
    } else if (mode === "demo") {
      b.className = "banner banner--demo";
      b.innerHTML = `<span>🧪</span><span class="grow"><b>Modo demo:</b> ~30 sesiones sintéticas para explorar el dashboard. Nada de esto es real.</span>
        <button class="btn btn--sm" id="gen-demo">↻ Regenerar</button>
        <button class="btn btn--sm btn--ghost" id="back-local">Volver a datos locales</button>`;
      b.hidden = false;
    } else if (state.adminWarn) {
      b.className = "banner banner--warn";
      b.innerHTML = `<span>🚫</span><span class="grow">No llegó ninguna fila desde Supabase. Si ya hubo sesiones, <b>tu usuario no tiene acceso de lectura (no está en la tabla admins)</b>: agregá tu email en la tabla <code>admins</code> del proyecto.</span>`;
      b.hidden = false;
    } else {
      b.hidden = true;
    }
    const gen = $("#gen-demo");
    if (gen) gen.addEventListener("click", () => {
      Provider.generateDemo(Date.now() % 100000 || 42);
      updateBanner();
      buildFoot();
      route();
    });
    const back = $("#back-local");
    if (back) back.addEventListener("click", () => {
      Provider.setMode("local");
      updateBanner();
      buildFoot();
      route();
    });
  }

  /* ------------------------------------------------------------ Filtros */
  $("#range-seg").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-range]");
    if (!btn) return;
    state.range = btn.dataset.range;
    document.querySelectorAll("#range-seg button").forEach((x) => x.classList.toggle("is-on", x === btn));
    route();
  });

  $("#segment-sel").addEventListener("change", (e) => {
    state.segment = e.target.value;
    route();
  });

  $("#nav-toggle").addEventListener("click", () => {
    $("#nav").classList.toggle("is-open");
  });
  $("#nav").addEventListener("click", (e) => {
    if (e.target.closest(".nav-item")) $("#nav").classList.remove("is-open");
  });

  /* ------------------------------------------------------------- Router */
  function parseHash() {
    const parts = String(location.hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    state.route = VIEWS[parts[0]] ? parts[0] : "overview";
    state.param = parts[1] ? decodeURIComponent(parts[1]) : null;
  }

  async function route() {
    parseHash();
    markNav();
    const el = $("#view");
    if (state.current && state.current.destroy) { try { state.current.destroy(); } catch (e) {} }
    const view = VIEWS[state.route];
    state.current = view;
    el.innerHTML = '<div class="loading">Cargando datos…</div>';

    let data;
    try {
      data = await Provider.all(state.range);
    } catch (err) {
      if (err.message === "SIN_SESION") { showLogin("Tu sesión venció. Entrá de nuevo."); return; }
      el.innerHTML = `<div class="banner banner--warn" style="margin:0">💥 No se pudieron cargar los datos: ${esc(err.message)}</div>`;
      return;
    }

    // Aviso de "sin acceso" (remoto): si con rango TODO no llega ni una fila.
    if (Provider.mode() === "remote" && state.range === "all") {
      state.adminWarn = !data.sessions.length && !data.events.length;
      updateBanner();
    }

    // Filtro global de segmento (device_type) sobre sesiones → eventos → feedback.
    let sessions = data.sessions, events = data.events, feedback = data.feedback;
    if (state.segment !== "all") {
      sessions = sessions.filter((s) => s.device_type === state.segment);
      const ids = new Set(sessions.map((s) => s.id));
      events = events.filter((e) => ids.has(e.session_id));
      feedback = feedback.filter((f) => ids.has(f.session_id));
    }

    const ctx = {
      mode: Provider.mode(),
      range: state.range,
      rangeLabel: RANGE_LABEL[state.range],
      segment: state.segment,
      segmentLabel: SEG_LABEL[state.segment],
      sessions, events, feedback,
      param: state.param,
      go: (r) => { location.hash = "#/" + r; },
      refresh: route,
    };

    try {
      await view.render(el, ctx);
    } catch (err) {
      el.innerHTML = `<div class="banner banner--warn" style="margin:0">💥 Error al renderizar la vista: ${esc(err.message)}</div>`;
      if (window.console) console.error(err);
    }
  }

  window.addEventListener("hashchange", route);

  /* ------------------------------------------------------------ Arranque */
  async function startApp(mode) {
    Provider.setMode(mode);
    state.adminWarn = false;
    $("#login").hidden = true;
    $("#shell").hidden = false;
    buildNav();
    buildFoot();
    updateBanner();
    if (!location.hash) history.replaceState(null, "", "#/overview");
    await route();
  }

  (function boot() {
    if (!SB.configured()) {
      // Sin backend → directo a modo local (misma localStorage que /mvp).
      startApp("local");
    } else if (SB.session()) {
      startApp("remote");
    } else {
      showLogin();
    }
  })();
})();
