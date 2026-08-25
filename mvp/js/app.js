/* ============================================================================
 * ContextLayer · MVP — app.js
 * Modelo "pasaporte de contexto personal" acotado a HOSPEDAJE DIGITAL.
 * Router + estado + pantallas para pruebas de usuario.
 * ==========================================================================*/

(function () {
  "use strict";

  const D = window.CL_DATA;
  const screenEl = document.getElementById("screen");
  const tabbar = document.getElementById("tabbar");

  // Analítica tolerante: si track.js no está, no pasa nada.
  const track = (t, p) => window.CLTrack && window.CLTrack.ev(t, p);
  const milestone = (name, p) => window.CLTrack && window.CLTrack.milestone(name, p);

  /* -------------------------------------------------------------- Utils */
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const money = (v, m) => (m === "USD" ? "US$" : m === "EUR" ? "€" : "$") + v;

  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.querySelector(".device").appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // Vibración sutil donde el dispositivo lo soporte (confirmaciones).
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms || 12); } catch (e) {} };

  /* ---- Bottom sheet genérica (confirmaciones, feedback) ---- */
  function openSheet(html) {
    closeSheet(true);
    const wrap = document.createElement("div");
    wrap.className = "sheet";
    wrap.innerHTML = `
      <div class="sheet__backdrop"></div>
      <div class="sheet__panel" role="dialog" aria-modal="true">
        <div class="sheet__grip"></div>
        ${html}
      </div>`;
    document.querySelector(".device").appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("is-open"));
    const onKey = (e) => { if (e.key === "Escape") closeSheet(); };
    document.addEventListener("keydown", onKey);
    wrap._cleanup = () => document.removeEventListener("keydown", onKey);
    wrap.querySelector(".sheet__backdrop").addEventListener("click", () => closeSheet());
    wrap.addEventListener("click", (e) => {
      const actEl = e.target.closest("[data-action]");
      if (actEl) handleAction(actEl.dataset.action, actEl);
    });
    return wrap;
  }
  function closeSheet(instant) {
    const s = document.querySelector(".sheet");
    if (!s) return;
    if (s._cleanup) s._cleanup();
    if (instant || reducedMotion()) return s.remove();
    s.classList.remove("is-open");
    setTimeout(() => s.remove(), 280);
  }

  /* ---- Confetti (canvas propio, 1.2 s) ---- */
  function confetti() {
    if (reducedMotion()) return;
    const device = document.querySelector(".device");
    const c = document.createElement("canvas");
    c.className = "confetti";
    c.width = device.clientWidth;
    c.height = device.clientHeight;
    device.appendChild(c);
    const ctx = c.getContext("2d");
    const colores = ["#5566ff", "#23c3a4", "#ffd76a", "#ef4d63", "#a48fff"];
    const parts = [];
    for (let i = 0; i < 46; i++) {
      parts.push({
        x: c.width / 2 + (Math.random() - 0.5) * 90,
        y: c.height * 0.32,
        vx: (Math.random() - 0.5) * 7,
        vy: -4 - Math.random() * 6,
        s: 4 + Math.random() * 5,
        r: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        col: colores[i % colores.length],
      });
    }
    const t0 = performance.now();
    (function tick(now) {
      const dt = now - t0;
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.22; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - dt / 1200);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        ctx.restore();
      });
      if (dt < 1200) requestAnimationFrame(tick);
      else c.remove();
    })(t0);
  }

  /* ---- Contador animado (puntos premium) ---- */
  function animateCounts(root) {
    if (reducedMotion()) return;
    root.querySelectorAll("[data-count]").forEach((el) => {
      const to = Number(el.dataset.count);
      const from = Number(el.dataset.from);
      if (isNaN(to) || isNaN(from) || from === to) return;
      const t0 = performance.now();
      const dur = 650;
      (function tick(now) {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3); // easeOutCubic
        el.textContent = Math.round(from + (to - from) * e).toLocaleString("es");
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }

  /* -------------------------------------------------------------- Estado */
  const state = {
    perspective: "user",
    screen: "splash",
    onboardingStep: 0,
    passport: emptyPassportData(),
    grants: [],
    receipts: [],
    pedido: D.pedidoSugerido,
    searchType: "stay", // "stay" (alojamiento) | "tour" (experiencia)
    selectedOptionId: null,
    reservas: [],
    premium: false,
    premiumPlan: null, // "mes" | "anual" (plan contratado)
    selectedPlan: "anual", // plan elegido en la pantalla (antes de suscribir)
    points: 0,
    redemptions: [], // historial de canjes
    onboarded: false,
    // Carga conversacional
    chat: [],
    chatDone: false,
    guideStep: 0, // paso del onboarding guiado por chat
    guidedComplete: false, // true al terminar el guiado (muestra resumen)
    summaryEditKey: null, // campo del resumen que se está editando
    narrative: "", // resumen en lenguaje natural (editable)
    narrativeEdited: false, // el usuario editó el resumen a mano
    // App de terceros (login con ContextLayer)
    currentAppId: null,
    ssoDraft: null,
    appLogged: {}, // { appId: true } una vez autorizado
    openListingId: null, // alojamiento que el usuario eligió y va a reservar en la app
  };

  const appById = (id) => D.connectedApps.find((a) => a.id === id);
  // Busca una oferta por id, sea alojamiento (opciones) o experiencia (tours).
  const findOffer = (id) =>
    D.opciones.find((o) => o.id === id) || D.tours.find((o) => o.id === id) || null;

  /* ---- Validación inline de los pasos del formulario ---- */
  function validateDom(dom) {
    if (!dom) return null;
    for (const f of dom.campos) {
      if (f.key === "identity.name" && String(f.valor || "").trim() === "") {
        return { key: f.key, msg: "Contanos tu nombre para personalizar la experiencia." };
      }
      if (f.key === "stay.budget.max") {
        const n = Number(f.valor);
        if (f.valor === "" || isNaN(n) || n < 10 || n > 100000) {
          return { key: f.key, msg: "Ingresá tu presupuesto por noche (entre 10 y 100.000)." };
        }
      } else if (f.tipo === "number" && f.valor !== "" && f.valor != null) {
        const n = Number(f.valor);
        if (isNaN(n) || n <= 0 || n > 100000) return { key: f.key, msg: "Ingresá un número válido." };
      }
    }
    return null;
  }

  function markFieldError(key, msg) {
    const input = screenEl.querySelector('[data-key="' + key + '"]');
    if (!input) return toast(msg);
    const field = input.closest(".field");
    if (field) {
      field.classList.add("field--error");
      let m = field.querySelector(".field__msg");
      if (!m) {
        m = document.createElement("div");
        m.className = "field__msg";
        field.appendChild(m);
      }
      m.textContent = msg;
      input.addEventListener("input", () => {
        field.classList.remove("field--error");
        const mm = field.querySelector(".field__msg");
        if (mm) mm.remove();
      }, { once: true });
    }
    input.focus();
  }

  // Al armar por formulario, los select vacíos toman su primera opción por
  // defecto (se aplica al entrar a cada paso, nunca durante el render).
  function defaultSelects(dom) {
    if (!dom) return;
    dom.campos.forEach((f) => {
      if (f.tipo === "select" && (f.valor === "" || f.valor == null)) f.valor = f.opciones[0];
    });
  }

  // Pasaporte vacío (para armarlo desde cero) vs. de ejemplo (demo).
  function emptyPassportData() {
    const p = JSON.parse(JSON.stringify(D.passport));
    p.forEach((dom) => dom.campos.forEach((f) => (f.valor = "")));
    return p;
  }
  const demoPassportData = () => JSON.parse(JSON.stringify(D.passport));
  const clone = (x) => JSON.parse(JSON.stringify(x));

  // Usuario NUEVO: contexto vacío y sin historial (reservas, solicitudes, actividad, permisos).
  function resetEmptyUser() {
    state.passport = emptyPassportData();
    state.grants = [];
    state.receipts = [];
    state.reservas = [];
    state.premium = false;
    state.premiumPlan = null;
    state.selectedPlan = "anual";
    state.points = 0;
    state.redemptions = [];
    state.narrative = "";
    state.narrativeEdited = false;
    state.guidedComplete = false;
    state.summaryEditKey = null;
  }
  // Usuario de EJEMPLO (demo): contexto e historial precargados.
  function loadDemoUser() {
    state.passport = demoPassportData();
    state.grants = clone(D.grantsIniciales);
    state.receipts = clone(D.receipts);
    state.reservas = clone(D.reservasBase);
    state.premium = true;
    state.premiumPlan = "anual";
    state.points = 1250;
    state.redemptions = [{ titulo: "Late check-out garantizado", costo: 400, fecha: "Hace 1 semana" }];
  }

  /* ---- Premium: descuento y puntos ---- */
  const PREM = D.premium;
  const isPremium = () => state.premium;
  // Precio con descuento premium aplicado (redondeado).
  const premiumPrice = (v) => (isPremium() ? Math.round(v * (1 - PREM.discountPct / 100)) : v);
  const pointsFor = (v) => Math.round(v * PREM.pointsPerUsd);

  // Guion del onboarding conversacional: campos relevantes, uno por uno.
  const GUIDE = [
    { key: "identity.name", q: "Para empezar, ¿cómo te llamás?" },
    { key: "stay.type", q: "¿Qué tipo de alojamiento preferís? Por ejemplo: hotel boutique, hotel de cadena, departamento o cabaña." },
    { key: "stay.ambiance", q: "¿Qué ambiente buscás? Tranquilo para trabajar, naturaleza, social o lujo/spa." },
    { key: "stay.diet", q: "¿Tenés alguna restricción de comida? (no como carne, vegana, celíaca, sin lácteos, o ninguna)" },
    { key: "stay.wifi", q: "¿Qué tan importante es el WiFi? Innegociable, deseable o indistinto." },
    { key: "stay.budget.max", q: "¿Cuál es tu presupuesto máximo por noche en USD?" },
    { key: "stay.activities", q: "Por último, ¿qué actividades disfrutás? Enoturismo, aventura, cultural o gastronómico." },
  ];
  /* ---- Helpers de pasaporte (keys punteadas) ---- */
  function findField(key) {
    for (const dom of state.passport) {
      const f = dom.campos.find((c) => c.key === key);
      if (f) return f;
    }
    return null;
  }
  const fieldLabel = (key) => (findField(key) || {}).label || key;
  const fieldValue = (key) => {
    const f = findField(key);
    return f ? f.valor : "—";
  };
  const domainOfField = (key) =>
    state.passport.find((d) => d.campos.some((c) => c.key === key));

  /* ------------------------------------------------ Persistencia local */
  // El estado del tester sobrevive al refresh (crítico en pruebas de usuario).
  const STORE_KEY = "cl_state_v1";
  const PERSIST_KEYS = [
    "passport", "grants", "receipts", "reservas", "premium", "premiumPlan",
    "selectedPlan", "points", "redemptions", "onboarded", "narrative",
    "narrativeEdited", "appLogged", "pedido", "searchType", "chat", "chatDone",
    "guideStep", "guidedComplete", "currentAppId", "_editDomId",
    "selectedOptionId", "openListingId", "perspective", "feedbackGiven",
  ];

  function saveState() {
    try {
      const s = {};
      PERSIST_KEYS.forEach((k) => (s[k] = state[k]));
      // Las burbujas de "escribiendo…" son efímeras: no se persisten.
      if (Array.isArray(s.chat)) s.chat = s.chat.filter((m) => !m.typing);
      localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, t: Date.now(), s }));
    } catch (e) { /* quota o storage bloqueado: seguimos en memoria */ }
  }
  let _saveTimer = null;
  function saveSoon() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(saveState, 300);
  }
  function loadState() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && d.v === 1 && d.s) {
        PERSIST_KEYS.forEach((k) => { if (k in d.s) state[k] = d.s[k]; });
        return true;
      }
    } catch (e) {}
    return false;
  }
  function clearSavedState() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  window.addEventListener("pagehide", saveState);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveState();
  });

  /* -------------------------------------------------------------- Router */
  const USER_TABS = ["pasaporte", "reservas", "actividad", "permisos"];

  // Jerarquía de navegación: decide la dirección de la transición.
  // Mayor lvl = más profundo; los tabs comparten nivel y se ordenan por `tab`.
  const NAV = {
    splash: { lvl: 0 }, onboarding: { lvl: 1 }, chatload: { lvl: 1 }, onboardingDone: { lvl: 2 },
    pasaporte: { lvl: 1, tab: 0 }, reservas: { lvl: 1, tab: 1 }, actividad: { lvl: 1, tab: 2 }, permisos: { lvl: 1, tab: 3 },
    contexto: { lvl: 2 }, editDom: { lvl: 3 }, premium: { lvl: 2 }, agente: { lvl: 2 },
    thinking: { lvl: 3 }, resultados: { lvl: 3 }, thirdApp: { lvl: 4 }, sso: { lvl: 5 }, reservaOk: { lvl: 4 },
  };

  function dirBetween(a, b) {
    const A = NAV[a] || { lvl: 1 };
    const B = NAV[b] || { lvl: 1 };
    if (a === b) return "none";
    // La hoja de consentimiento SSO entra/sale como bottom sheet.
    if (b === "sso") return "sheet";
    if (a === "sso") return "unsheet";
    if (A.tab != null && B.tab != null) return B.tab > A.tab ? "tab-fwd" : "tab-back";
    if (B.lvl > A.lvl) return "fwd";
    if (B.lvl < A.lvl) return "back";
    return "fade";
  }

  // Ruta (hash) de cada pantalla; las que necesitan contexto llevan parámetro.
  function routeFor(screen) {
    switch (screen) {
      case "editDom": return "#/editDom/" + encodeURIComponent(state._editDomId || "");
      case "thirdApp": return "#/thirdApp" + (state.currentAppId ? "/" + encodeURIComponent(state.currentAppId) : "");
      case "sso": return "#/sso/" + encodeURIComponent(state.currentAppId || "");
      case "resultados": return "#/resultados/" + state.searchType;
      default: return "#/" + screen;
    }
  }

  // Hash → pantalla, validando parámetros y redirigiendo las transitorias.
  function resolveRoute(hash) {
    const parts = String(hash || "").replace(/^#\/?/, "").split("/").filter(Boolean);
    const screen = parts[0] || "";
    const arg = parts[1] ? decodeURIComponent(parts[1]) : "";
    if (!screens[screen]) return state.onboarded ? "pasaporte" : "splash";
    switch (screen) {
      case "editDom":
        if (!state.passport.some((d) => d.id === arg)) return "contexto";
        state._editDomId = arg;
        break;
      case "thirdApp":
        state.currentAppId = appById(arg) ? arg : null;
        break;
      case "sso":
        if (!appById(arg)) return "thirdApp";
        state.currentAppId = arg;
        break;
      case "resultados":
        if (arg === "stay" || arg === "tour") state.searchType = arg;
        break;
      case "thinking":
        return "agente"; // pantalla transitoria: no se puede aterrizar en ella
      case "reservaOk":
        if (!findOffer(state.selectedOptionId)) return state.onboarded ? "pasaporte" : "splash";
        break;
    }
    return screen;
  }

  let navIdx = 0;                // índice de la entrada actual del historial
  const scrollMem = {};          // idx → { route, top } para restaurar scroll

  function navigate(screen, opts = {}) {
    const desde = state.screen;
    const mismo = screen === desde;
    const route = routeFor(screen);

    // Botón ‹ de la app hacia la entrada anterior del historial: usar
    // history.back() para no apilar entradas duplicadas.
    if (!opts.pop && !mismo) {
      const prev = scrollMem[navIdx - 1];
      if (prev && prev.route === route) {
        history.back(); // el popstate termina la navegación
        return;
      }
    }

    state._navDir = mismo ? "none" : dirBetween(desde, screen);
    state.screen = screen;
    if (!mismo) closeSheet(true);

    // Misma pantalla con otro parámetro (ej. volver al selector de apps):
    // actualizar la ruta in place, sin apilar historia.
    if (mismo && !opts.pop && scrollMem[navIdx] && scrollMem[navIdx].route !== route) {
      history.replaceState({ idx: navIdx }, "", route);
      scrollMem[navIdx].route = route;
    }

    if (!opts.pop && !mismo) {
      if (scrollMem[navIdx]) scrollMem[navIdx].top = screenEl.scrollTop;
      // Saltar entre tabs reemplaza la entrada: el historial no acumula tabs.
      const entreTabs = NAV[desde] && NAV[desde].tab != null && NAV[screen] && NAV[screen].tab != null;
      if (opts.replace || entreTabs) {
        history.replaceState({ idx: navIdx }, "", route);
        scrollMem[navIdx] = { route, top: 0 };
      } else {
        navIdx++;
        history.pushState({ idx: navIdx }, "", route);
        scrollMem[navIdx] = { route, top: 0 };
        Object.keys(scrollMem).forEach((k) => { if (+k > navIdx) delete scrollMem[k]; });
      }
    }

    render();
    if (!mismo) screenEl.scrollTop = (opts.pop && scrollMem[navIdx] && scrollMem[navIdx].top) || 0;
    if (!mismo) {
      document.dispatchEvent(new CustomEvent("cl:nav", {
        detail: { screen, prev: desde, dir: state._navDir },
      }));
    }
    saveSoon();
  }

  const go = navigate;

  window.addEventListener("popstate", (e) => {
    if (scrollMem[navIdx]) scrollMem[navIdx].top = screenEl.scrollTop;
    navIdx = (e.state && e.state.idx) || 0;
    const destino = resolveRoute(location.hash);
    const route = routeFor(destino);
    // Normalizar la URL si la ruta pedida redirigió (ej. #/thinking → agente)
    // o si el hash fue editado a mano.
    if (location.hash !== route) history.replaceState({ idx: navIdx }, "", route);
    if (!scrollMem[navIdx]) scrollMem[navIdx] = { route, top: 0 };
    navigate(destino, { pop: true });
  });

  function view(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html;
    return wrap;
  }

  function sHead(title, backTo, rightHtml) {
    return `<div class="shead">
      ${backTo ? `<button class="shead__back" data-go="${backTo}" aria-label="Volver">${icon("chevron-left")}</button>` : ""}
      <div class="shead__title">${esc(title)}</div>
      ${rightHtml ? `<div class="shead__right">${rightHtml}</div>` : ""}
    </div>`;
  }

  /* ---- Transiciones: la pantalla saliente queda como "fantasma" ---- */
  const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sufijos de animación por dirección; `top` decide quién queda arriba
  // (la pantalla entrante o el fantasma saliente).
  const ANIM = {
    "fwd":      { in: "fwd",  out: "fwd",  top: "in" },
    "back":     { in: "back", out: "back", top: "out" },
    "tab-fwd":  { in: "tabf", out: "tabf", top: "in" },
    "tab-back": { in: "tabb", out: "tabb", top: "in" },
    "fade":     { in: "fade", out: "fade", top: "in" },
    "sheet":    { in: "up",   out: "hold", top: "in" },
    "unsheet":  { in: "hold", out: "down", top: "out" },
  };

  let ghostTimer = null;
  function finishGhost() {
    clearTimeout(ghostTimer);
    const g = screenEl.querySelector(".screen__ghost");
    if (g) g.remove();
    screenEl.classList.remove("is-anim");
    const n = screenEl.firstElementChild;
    if (n) {
      Array.prototype.slice.call(n.classList).forEach((c) => {
        if (c.indexOf("s-in-") === 0 || c === "s-new") n.classList.remove(c);
      });
    }
  }

  let firstRender = true;

  function render() {
    const fn = screens[state.screen] || screens.splash;
    const dir = state._navDir || "none";
    state._navDir = "none";
    const spec = !state._preview && !reducedMotion() ? ANIM[dir] : null;

    finishGhost(); // si había una transición en curso, cerrarla ya
    const saliente = screenEl.firstElementChild;
    const scrollPrev = screenEl.scrollTop;

    const node = fn();

    if (spec && saliente) {
      const ghost = document.createElement("div");
      ghost.className = "screen__ghost s-out-" + spec.out + (spec.top === "out" ? " screen__ghost--top" : "");
      // Compensar el scroll: el fantasma muestra exactamente lo que se veía.
      saliente.style.transform = "translateY(" + -scrollPrev + "px)";
      ghost.appendChild(saliente);
      node.classList.add("s-new", "s-in-" + spec.in);
      screenEl.innerHTML = "";
      screenEl.classList.add("is-anim");
      screenEl.appendChild(node);
      screenEl.appendChild(ghost);
      node.addEventListener("animationend", finishGhost, { once: true });
      ghostTimer = setTimeout(finishGhost, 450); // red de seguridad
    } else {
      screenEl.innerHTML = "";
      if (!state._preview) node.classList.add("fade-in");
      screenEl.appendChild(node);
    }

    // Cascada de cards cuando la pantalla no llega deslizándose entera.
    if (!state._preview && !reducedMotion() && state.screen !== "chatload" &&
        (firstRender || dir === "none" || dir === "fade" || dir.indexOf("tab") === 0)) {
      let i = 0;
      node.querySelectorAll(".card, .value-row, .receipt").forEach((el) => {
        if (i < 8) el.style.setProperty("--i", i++);
      });
      node.classList.add("stagger");
    }
    firstRender = false;
    animateCounts(node);

    // Anillos de match: animar el arco al montarse.
    node.querySelectorAll("[data-ring]").forEach((el) => {
      if (reducedMotion()) el.style.strokeDashoffset = el.dataset.ring;
      else requestAnimationFrame(() => requestAnimationFrame(() => {
        el.style.strokeDashoffset = el.dataset.ring;
      }));
    });

    const showTabs = state.perspective === "user" && USER_TABS.includes(state.screen);
    tabbar.hidden = !showTabs;
    if (showTabs) {
      tabbar.querySelectorAll(".tabbar__btn").forEach((b) => {
        const activo = b.dataset.nav === state.screen;
        b.classList.toggle("is-active", activo);
        if (activo) b.setAttribute("aria-current", "page");
        else b.removeAttribute("aria-current");
      });
    }
    // Re-bindear inputs de campos
    bindFieldInputs(screenEl);
  }

  /* ============================================================ PANTALLAS */
  const screens = {};

  /* ---------- Splash ---------- */
  screens.splash = function () {
    const nombre = state.onboarded ? String(fieldValue("identity.name") || "").split(" ")[0] : "";
    return view(`
      <div class="splash">
        <div class="splash__hero">
          <div class="logo-mark">◈</div>
          <div class="eyebrow">ContextLayer</div>
          <h1 class="title">Tu contexto de viajero, en un solo lugar.</h1>
          <p class="lead">Cargá una vez cómo te gusta viajar. Cada app, web, hotel o tour te pide solo lo que necesita, con un propósito y un plazo, y vos aprobás. Alojamiento y experiencias, sin repetir lo mismo en cada reserva.</p>

          <div style="margin-top:22px">
            <div class="value-row">
              <div class="value-row__ico">${icon("idcard")}</div>
              <div><b>Tu contexto de viaje</b><div class="muted">Preferencias, restricciones, actividades y presupuesto, siempre con vos.</div></div>
            </div>
            <div class="value-row">
              <div class="value-row__ico">${icon("lock")}</div>
              <div><b>Vos aprobás cada acceso</b><div class="muted">Campo por campo, con propósito y vencimiento. Revocás cuando querés.</div></div>
            </div>
            <div class="value-row">
              <div class="value-row__ico">${icon("receipt")}</div>
              <div><b>Todo deja recibo</b><div class="muted">Ves quién leyó qué y cuándo. Nada pasa a tus espaldas.</div></div>
            </div>
          </div>
        </div>
        <div class="btn-stack">
          ${state.onboarded
            ? `<button class="btn" data-action="resume">Continuar${nombre ? " como " + esc(nombre) : ""}</button>
               <button class="btn btn--ghost" data-action="start-chatload">${icon("chat")} Armar un contexto nuevo</button>
               <button class="btn btn--ghost" data-action="reset-demo">Empezar de nuevo</button>`
            : `<button class="btn" data-action="start-chatload">${icon("chat")} Armar mi contexto charlando</button>
               <button class="btn btn--ghost" data-action="start-onboarding">Prefiero un formulario</button>
               <button class="btn btn--ghost" data-action="load-demo">Explorar con datos de ejemplo</button>`}
        </div>
        <p class="muted" style="text-align:center;margin-top:10px;font-size:0.78rem">${state.onboarded ? "Tu contexto quedó guardado en este dispositivo." : "¿Solo querés ver cómo funciona? Probá con un perfil de ejemplo."}</p>
      </div>
    `);
  };

  /* ---------- Onboarding ---------- */
  screens.onboarding = function () {
    const doms = state.passport;
    const i = state.onboardingStep;
    const dom = doms[i];
    const dots = doms
      .map((_, idx) => {
        const cls = idx < i ? "is-done" : idx === i ? "is-active" : "";
        return `<div class="progress__dot ${cls}"></div>`;
      })
      .join("");
    const campos = dom.campos.map(fieldInputHTML).join("");
    const last = i === doms.length - 1;
    return view(`
      <div class="progress">${dots}</div>
      <div class="eyebrow">Paso ${i + 1} de ${doms.length}</div>
      <h2 class="title">${esc(dom.dominio)}</h2>
      <p class="muted" style="margin-bottom:16px">Se guarda una sola vez en tu contexto. Después lo prestás con permisos.</p>
      ${campos}
      <div class="btn-stack">
        <button class="btn" data-action="onboarding-next">${last ? "Listo, crear contexto" : "Continuar"}</button>
        ${i > 0 ? `<button class="btn btn--ghost" data-action="onboarding-prev">Atrás</button>` : ""}
      </div>
    `);
  };

  function fieldInputHTML(f) {
    if (f.tipo === "select") {
      const opts = f.opciones
        .map((o) => `<option ${o === f.valor ? "selected" : ""}>${esc(o)}</option>`)
        .join("");
      return `<div class="field"><label class="field__label">${esc(f.label)}</label>
        <select data-key="${f.key}">${opts}</select></div>`;
    }
    const type = f.tipo === "number" ? "number" : "text";
    return `<div class="field"><label class="field__label">${esc(f.label)}</label>
      <input type="${type}" value="${esc(f.valor)}" data-key="${f.key}" /></div>`;
  }

  /* ---------- Onboarding terminado (formulario) ---------- */
  screens.onboardingDone = function () {
    return view(`
      <div style="text-align:center;padding-top:16px">
        <div class="success-mark">✓</div>
        <h2 class="title">Tu contexto está listo</h2>
        <p class="lead" style="margin-bottom:6px">Ya podemos usarlo para planificar tu próximo viaje.</p>
      </div>
      <div class="section-label">En pocas palabras</div>
      <textarea class="textarea" id="narrative-input" rows="4" style="font-style:italic">${esc(getNarrative())}</textarea>
      <div class="muted" style="font-size:0.74rem;margin:5px 2px 0">Resumen generado automáticamente. Podés editarlo.</div>
      <div class="btn-stack" style="margin-top:18px">
        <button class="btn" data-action="plan-trip">${icon("sparkles")} Planifiquemos el viaje</button>
        <button class="btn btn--ghost" data-action="skip-to-dashboard">Omitir por ahora</button>
      </div>
    `);
  };

  /* ---------- ContextLayer Premium ---------- */
  screens.premium = function () {
    const memberships = D.connectedApps
      .map((a) => {
        const perk = PREM.perks[a.id] || "Beneficios premium";
        return `
        <div class="card" style="border-left:4px solid ${(a.brand && a.brand.primary) || a.color}">
          <div class="row" style="gap:12px">
            ${brandBadge(a, 40)}
            <div class="grow"><b>${esc(a.nombre)}</b><div class="muted">${esc(perk)}</div></div>
            ${isPremium() ? `<span class="chip chip--ok">Activa</span>` : `<span class="chip">Bloqueada</span>`}
          </div>
        </div>`;
      })
      .join("");

    if (!isPremium()) {
      const benes = PREM.beneficios
        .map((b) => `<li>${esc(b)}</li>`)
        .join("");
      const ahorro = PREM.price * 12 - PREM.priceYear;
      const sel = state.selectedPlan || "anual";
      const selMes = sel === "mes";
      const dot = (on) => `<span class="radio ${on ? "radio--on" : ""}"></span>`;
      const btnPrecio = selMes ? `US$${PREM.price}/mes` : `US$${PREM.priceYear}/año`;
      return view(`
        ${sHead("ContextLayer Premium", "pasaporte")}
        <div class="card card--premium" style="border:none;text-align:center">
          <div style="color:#3a2c00">${icon("star", "ico--xl")}</div>
          <div style="font-weight:800;font-size:1.2rem;color:#3a2c00">Hacete Premium</div>
          <div style="color:#5c4a12;margin-top:2px">Una membresía, todos los proveedores.</div>
        </div>
        <ul class="match-list" style="margin:4px 2px 14px">${benes}</ul>

        <div class="section-label">Elegí tu plan</div>
        <div class="card plan-card ${selMes ? "plan-card--on" : ""}" role="button" tabindex="0" data-action="select-plan" data-plan="mes">
          <div class="row" style="gap:12px">
            ${dot(selMes)}
            <div class="grow"><b>Mensual</b><div class="muted">Facturado cada mes</div></div>
            <div style="text-align:right"><b style="font-size:1.2rem">US$${PREM.price}</b><div class="muted" style="font-size:0.72rem">/mes</div></div>
          </div>
        </div>
        <div class="card plan-card ${!selMes ? "plan-card--on" : ""}" role="button" tabindex="0" data-action="select-plan" data-plan="anual">
          <div class="row" style="gap:12px">
            ${dot(!selMes)}
            <div class="grow"><b>Anual</b> <span class="chip chip--ok">Ahorrás US$${ahorro}</span><div class="muted">Facturado una vez al año</div></div>
            <div style="text-align:right"><b style="font-size:1.2rem">US$${PREM.priceYear}</b><div class="muted" style="font-size:0.72rem">/año</div></div>
          </div>
        </div>

        <div class="section-label">Membresías que se activan</div>
        ${memberships}
        <div class="action-bar">
          <button class="btn" data-action="subscribe-premium">Suscribirme · ${btnPrecio}</button>
        </div>
      `);
    }

    // Premium activo
    const ptsFrom = state._ptsFrom != null ? state._ptsFrom : state.points;
    state._ptsFrom = null;
    const rewards = PREM.rewards
      .map((r) => {
        const canjeable = state.points >= r.costo;
        return `
        <div class="card">
          <div class="row" style="gap:12px">
            <div class="avatar">${esc(r.icono)}</div>
            <div class="grow"><b>${esc(r.titulo)}</b><div class="muted">${esc(r.detalle)}</div></div>
            <div style="text-align:right">
              <div style="font-weight:800;color:var(--brand-2)">${r.costo.toLocaleString("es")}</div>
              <div class="muted" style="font-size:0.72rem">puntos</div>
            </div>
          </div>
          <button class="btn btn--sm ${canjeable ? "" : "btn--dark"}" style="margin-top:10px;width:100%" data-action="redeem" data-reward="${r.id}" ${canjeable ? "" : "disabled"}>
            ${canjeable ? "Canjear" : "Te faltan " + (r.costo - state.points).toLocaleString("es") + " pts"}
          </button>
        </div>`;
      })
      .join("");

    return view(`
      ${sHead("ContextLayer Premium", "pasaporte")}
      <div class="card card--premium" style="border:none">
        <div class="row row--between">
          <div>
            <div style="font-weight:800;color:#3a2c00">${icon("star", "ico--sm")} Sos Premium</div>
            <div style="color:#5c4a12;font-size:0.82rem;margin-top:2px">${state.premiumPlan === "anual" ? "US$" + PREM.priceYear + "/año" : "US$" + PREM.price + "/mes"} · renovación automática</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:1.6rem;font-weight:800;color:#3a2c00" data-count="${state.points}" data-from="${ptsFrom}">${state.points.toLocaleString("es")}</div>
            <div style="color:#5c4a12;font-size:0.72rem">puntos</div>
          </div>
        </div>
      </div>

      <div class="section-label">Tus membresías</div>
      ${memberships}

      <div class="section-label">Canjeá tus puntos</div>
      ${rewards}

      ${state.redemptions.length
        ? `<div class="section-label">Canjes realizados</div>
           <div class="card">${state.redemptions
             .map(
               (c) => `<div class="ctx-item">
                 <div class="grow">${esc(c.titulo)}<div class="log__date">${esc(c.fecha)}</div></div>
                 <div class="ctx-item__val">-${c.costo.toLocaleString("es")} pts</div>
               </div>`
             )
             .join("")}</div>`
        : ""}

      <div class="btn-stack" style="margin-top:6px">
        <button class="btn btn--danger btn--sm" data-action="cancel-premium">Cancelar suscripción</button>
      </div>
    `);
  };

  /* ---------- Pasaporte (home) ---------- */
  screens.pasaporte = function () {
    const nombre = fieldValue("identity.name") || "viajera";
    const activos = state.grants.filter((g) => g.activo).length;
    const temaOscuro = (document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

    return view(`
      ${sHead("Hola, " + String(nombre).split(" ")[0], null,
        `<button class="icon-btn" data-action="toggle-theme" aria-label="Cambiar tema" title="Modo claro / oscuro">${icon(temaOscuro ? "sun" : "moon")}</button>`)}
      <div class="card card--brand">
        <div class="eyebrow" style="color:rgba(255,255,255,0.9)">Tu contexto está activo</div>
        <div style="font-size:1.05rem;font-weight:700;margin:4px 0 2px">Listo para tu próxima reserva</div>
        <div class="muted">${activos} ${activos === 1 ? "permiso activo" : "permisos activos"} · vos tenés el control</div>
      </div>

      <div class="card" data-go="contexto" role="button" tabindex="0">
        <div class="row">
          <div class="avatar">${icon("idcard")}</div>
          <div class="grow"><b>Ver y editar mi contexto</b><div class="muted">Tus ${state.passport.length} categorías de hospedaje</div></div>
          <div style="color:var(--txt-mute)">›</div>
        </div>
      </div>

      <div class="card" data-go="reservas" role="button" tabindex="0">
        <div class="row">
          <div class="avatar">${icon("bell")}</div>
          <div class="grow"><b>Mis reservas</b><div class="muted">En curso y finalizadas</div></div>
          <div style="color:var(--txt-mute)">›</div>
        </div>
      </div>

      <div class="card ${isPremium() ? "" : "card--premium"}" data-go="premium" role="button" tabindex="0"${isPremium() ? "" : ' style="border:none"'}>
        <div class="row">
          <div class="avatar" style="background:${isPremium() ? "var(--surface-2)" : "rgba(255,255,255,.18)"};color:${isPremium() ? "var(--warn)" : "#3a2c00"}">${icon("star")}</div>
          <div class="grow">
            <b${isPremium() ? "" : ' style="color:#3a2c00"'}>ContextLayer Premium</b>
            <div class="muted"${isPremium() ? "" : ' style="color:#5c4a12"'}>${isPremium() ? state.points.toLocaleString("es") + " puntos · membresías activas" : "US$10/mes o US$100/año · descuentos y puntos"}</div>
          </div>
          <div style="color:${isPremium() ? "var(--txt-mute)" : "#3a2c00"}">›</div>
        </div>
      </div>

      <div class="card" data-go="permisos" role="button" tabindex="0">
        <div class="row">
          <div class="avatar">${icon("lock")}</div>
          <div class="grow"><b>Permisos</b><div class="muted">Quién ve tu contexto y hasta cuándo</div></div>
          <div style="color:var(--txt-mute)">›</div>
        </div>
      </div>

      <div class="section-label">Velo en acción</div>
      <div class="card card--soft" data-go="agente" role="button" tabindex="0">
        <div class="row">
          <div class="avatar">${icon("sparkles")}</div>
          <div class="grow"><b>Buscar con tu agente</b><div class="muted">Aria busca alojamiento o experiencias con tu contexto</div></div>
          <div style="color:var(--txt-mute)">›</div>
        </div>
      </div>
    `);
  };

  /* ---------- Mi contexto ---------- */
  screens.contexto = function () {
    const doms = state.passport
      .map(
        (dom) => `
      <div class="card">
        <div class="row row--between">
          <div class="row" style="gap:10px">
            <div class="avatar" style="width:38px;height:38px">${domIcon(dom)}</div>
            <b>${esc(dom.dominio)}</b>
          </div>
          <button class="btn btn--dark btn--sm" data-action="edit-dom" data-dom="${dom.id}">Editar</button>
        </div>
        <div style="margin-top:6px">
          ${dom.campos
            .map(
              (f) => `<div class="ctx-item">
                <div class="grow">${esc(f.label)}<div class="field-grant__key">${esc(f.key)}</div></div>
                <div class="ctx-item__val">${esc(f.valor)}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>`
      )
      .join("");

    return view(`
      ${sHead("Mi contexto", "pasaporte")}
      <p class="muted" style="margin-bottom:12px">Esta información te pertenece. Ninguna app ni hotel la ve sin tu permiso.</p>
      <div class="card card--soft" data-action="start-chat-update" role="button" tabindex="0">
        <div class="row" style="gap:10px">
          <div class="avatar">${icon("chat")}</div>
          <div class="grow"><b>Actualizar charlando</b><div class="muted">Contale al agente por texto o voz y ajustá tu contexto</div></div>
          <div style="color:var(--txt-mute)">›</div>
        </div>
      </div>
      ${doms}
    `);
  };

  /* ---------- Editar dominio ---------- */
  screens.editDom = function () {
    const dom = state.passport.find((d) => d.id === state._editDomId);
    if (!dom) return view(sHead("Editar", "contexto"));
    const campos = dom.campos.map(fieldInputHTML).join("");
    return view(`
      ${sHead("Editar: " + dom.dominio, "contexto")}
      ${campos}
      <div class="action-bar">
        <button class="btn" data-action="save-dom">Guardar cambios</button>
      </div>
    `);
  };

  function buildPayload(granted) {
    const g = granted || {};
    const keys = Object.keys(g).filter((k) => g[k]);
    if (!keys.length) return `<div class="muted">No seleccionaste ningún campo. No se compartirá nada.</div>`;
    const lines = keys
      .map((k, i) => {
        const comma = i < keys.length - 1 ? "," : "";
        return `  <span class="c-key">"${esc(k)}"</span>: <span class="c-str">"${esc(fieldValue(k))}"</span>${comma}`;
      })
      .join("\n");
    return `<div class="codeblock">{\n${lines}\n}</div>`;
  }

  /* ---------- Actividad (recibos) ---------- */
  screens.actividad = function () {
    const items = state.receipts
      .map((r) => {
        const tag =
          r.tipo === "write"
            ? `<span class="receipt__tag receipt__tag--write">Escritura</span>`
            : `<span class="receipt__tag receipt__tag--read">Lectura</span>`;
        const fields = (r.fields || [])
          .map((k) => `<span class="chip pill--dim">${esc(fieldLabel(k))}</span>`)
          .join("");
        return `
        <div class="receipt">
          ${providerAvatar(r, 34)}
          <div class="grow">
            <div class="row row--between">
              <b style="font-size:0.92rem">${esc(r.solicitante)}</b>
              ${tag}
            </div>
            <div class="muted" style="margin:2px 0 6px">${esc(r.detalle)}</div>
            <div class="chip-wrap">${fields}</div>
            <div class="log__date" style="margin-top:6px">${esc(r.fecha)}</div>
          </div>
        </div>`;
      })
      .join("");

    return view(`
      ${sHead("Actividad")}
      <p class="muted" style="margin-bottom:8px">Cada lectura y cada escritura deja un recibo. Todo es inspeccionable.</p>
      <div class="card">${items || '<div class="empty"><span class="empty__ico">' + icon("receipt", "ico--xl") + '</span>Todavía no hay actividad.</div>'}</div>
    `);
  };

  /* ---------- Permisos (grants) ---------- */
  screens.permisos = function () {
    const items = state.grants
      .map((g) => {
        const chips = g.fields
          .map((k) => `<span class="chip">${esc(fieldLabel(k))}</span>`)
          .join("");
        return `
        <div class="card">
          <div class="row row--between">
            <div class="row" style="gap:10px">
              ${providerAvatar(g, 44)}
              <div><b>${esc(g.solicitante)}</b><div class="muted">${esc(g.proposito)}</div></div>
            </div>
            <label class="switch">
              <input type="checkbox" ${g.activo ? "checked" : ""} data-action="toggle-grant" data-grant="${g.id}" aria-label="Acceso de ${esc(g.solicitante)}" />
              <span class="switch__track"></span>
            </label>
          </div>
          <div class="section-label" style="margin:14px 2px 6px">Comparte</div>
          <div class="chip-wrap">${chips}</div>
          <div class="row row--between" style="margin-top:12px">
            <span class="chip ${g.activo ? "chip--ok" : ""}">${g.activo ? "Activo" : "Revocado"}</span>
            <span class="muted">${esc(g.duracion)}</span>
          </div>
          ${
            g.activo
              ? `<button class="btn btn--danger btn--sm" style="margin-top:12px" data-action="ask-revoke" data-grant="${g.id}">Revocar acceso</button>`
              : ""
          }
        </div>`;
      })
      .join("");

    return view(`
      ${sHead("Permisos", "pasaporte")}
      <p class="muted" style="margin-bottom:14px">Quién tiene acceso a tu contexto, con qué alcance y hasta cuándo. Revocás de un toque.</p>
      ${items || '<div class="empty"><span class="empty__ico">' + icon("lock", "ico--xl") + '</span>Todavía no diste ningún permiso.</div>'}
    `);
  };

  /* ---------- Mis reservas ---------- */
  function reservaCard(r) {
    const app = appById(r.appId);
    const enCurso = r.estado === "en_curso";
    const tipoChip = r.esTour ? icon("ticket", "ico--sm") + " Experiencia" : icon("bell", "ico--sm") + " Alojamiento";
    const meta = r.esTour
      ? `${esc(r.fechas)} · ${esc(r.duracion || "experiencia")}`
      : `${esc(r.fechas)} · ${r.noches} noche${r.noches === 1 ? "" : "s"}`;
    const baseTotal = r.esTour ? r.precio : r.precioNoche * r.noches;
    const finalTotal = r.premium ? Math.round(baseTotal * (1 - PREM.discountPct / 100)) : baseTotal;
    const suffix = r.esTour ? ' <span class="muted" style="font-weight:400">p/persona</span>' : "";
    const total = r.premium
      ? `${money(finalTotal, r.moneda)}${suffix} <span class="muted" style="text-decoration:line-through;font-size:0.75rem;font-weight:400">${money(baseTotal, r.moneda)}</span>`
      : `${money(finalTotal, r.moneda)}${suffix}`;
    return `
      <div class="card">
        <div class="row row--between">
          <div class="row" style="gap:10px">
            ${app ? brandBadge(app, 44) : '<div class="avatar">🏨</div>'}
            <div><b>${esc(r.hotel)}</b><div class="muted">${esc(r.zona)}</div></div>
          </div>
          <span class="chip ${enCurso ? "chip--ok" : ""}">${enCurso ? "En curso" : "Finalizada"}</span>
        </div>
        <div class="chip-wrap" style="margin-top:8px"><span class="chip pill--dim">${tipoChip}</span>${r.puntos ? `<span class="chip chip--ok">⭐ +${r.puntos} pts</span>` : ""}</div>
        <div class="row row--between" style="margin-top:10px">
          <span class="muted">${meta}</span>
          <b>${total}</b>
        </div>
        <div class="muted" style="margin-top:6px;font-size:0.8rem">Reservado en ${esc(app ? app.nombre : "una app conectada")}</div>
      </div>`;
  }

  screens.reservas = function () {
    const enCurso = state.reservas.filter((r) => r.estado === "en_curso");
    const finalizadas = state.reservas.filter((r) => r.estado === "finalizada");
    const vacio =
      state.reservas.length === 0
        ? `<div class="empty"><span class="empty__ico">${icon("bell", "ico--xl")}</span>Todavía no tenés reservas.<br/>Buscá alojamiento con Aria para empezar.</div>`
        : "";
    return view(`
      ${sHead("Mis reservas", "pasaporte")}
      <p class="muted" style="margin-bottom:8px">Tus estadías reservadas a través de tus apps conectadas.</p>
      ${enCurso.length ? `<div class="section-label">En curso</div>${enCurso.map(reservaCard).join("")}` : ""}
      ${finalizadas.length ? `<div class="section-label">Finalizadas</div>${finalizadas.map(reservaCard).join("")}` : ""}
      ${vacio}
    `);
  };

  /* ---------- Demo: pedido al agente ---------- */
  screens.agente = function () {
    const isTour = state.searchType === "tour";
    const placeholder = isTour
      ? "Ej: Un tour de bodegas con almuerzo sin carne en Mendoza"
      : "Ej: Hotel tranquilo en Mendoza para trabajar 3 días";
    const hint = isTour
      ? "estilo de actividades, restricciones y presupuesto"
      : "tipo de alojamiento, ambiente, restricciones y presupuesto";
    return view(`
      ${sHead("Buscar con Aria", "pasaporte")}
      <div class="card">
        <div class="row" style="gap:10px">
          <div class="avatar">${icon("bot")}</div>
          <div><b>Aria</b><div class="muted">Busca en tus apps conectadas con tu contexto</div></div>
        </div>
      </div>
      <div class="section-label">¿Qué buscás?</div>
      <div class="seg">
        <button class="seg__btn ${!isTour ? "is-active" : ""}" data-action="search-type" data-type="stay">${icon("hotel")} Alojamiento</button>
        <button class="seg__btn ${isTour ? "is-active" : ""}" data-action="search-type" data-type="tour">${icon("ticket")} Experiencia</button>
      </div>
      <textarea class="textarea" id="pedido-input" placeholder="${esc(placeholder)}">${esc(state.pedido)}</textarea>
      <div class="card card--soft" style="margin-top:12px">
        <div class="row" style="gap:8px;align-items:flex-start">
          <span style="color:var(--brand)">${icon("lock")}</span>
          <div class="muted">Aria leerá, con tu permiso: <b style="color:var(--txt-dim)">${esc(hint)}</b>. Cada acceso deja recibo.</div>
        </div>
      </div>
      <div class="action-bar">
        <button class="btn" data-action="run-agent">${isTour ? "Buscar experiencias" : "Buscar alojamiento"}</button>
      </div>
    `);
  };

  screens.thinking = function () {
    const isTour = state.searchType === "tour";
    const steps = [
      "Leyendo tu contexto autorizado…",
      "Consultando tus apps conectadas…",
      isTour ? "Filtrando por tus actividades y presupuesto…" : "Filtrando por tus gustos y presupuesto…",
      "Ordenando el mejor match para vos…",
    ];
    const skelCard = `
      <div class="card">
        <div class="skel skel--title"></div>
        <div class="skel skel--line"></div>
        <div class="skel skel--line short"></div>
      </div>`;
    const node = view(`
      <div class="thinking">
        <div class="spinner"></div>
        <b>Aria está trabajando</b>
        <div class="thinking__list">
          ${steps.map((s) => `
            <div class="tstep">
              <span class="tstep__ico">
                <span class="tstep__spin"></span>
                <svg class="tstep__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
              </span>
              <span>${esc(s)}</span>
            </div>`).join("")}
        </div>
        <div class="skel-cards">${skelCard}${skelCard}</div>
      </div>
    `);
    // En preview la pantalla queda congelada, con todos los pasos completos.
    if (state._preview) {
      node.querySelectorAll(".tstep").forEach((el) => el.classList.add("is-done"));
      node.querySelector(".skel-cards").classList.add("show");
      return node;
    }
    // Token de esta corrida: si el usuario navega antes de terminar, no lo
    // teletransportamos a resultados.
    const run = (state._thinkingRun = {});
    const els = Array.prototype.slice.call(node.querySelectorAll(".tstep"));
    let t = 120;
    els.forEach((el, idx) => {
      const dur = 480 + Math.random() * 320; // duración levemente aleatoria
      setTimeout(() => el.classList.add("is-active"), t);
      t += dur;
      setTimeout(() => {
        el.classList.remove("is-active");
        el.classList.add("is-done");
        if (idx === 1) node.querySelector(".skel-cards").classList.add("show");
      }, t);
    });
    setTimeout(() => {
      if (state._thinkingRun === run && state.screen === "thinking") {
        milestone("results_shown", {
          type: state.searchType,
          count: (state.searchType === "tour" ? D.tours : D.opciones).slice(0, 5).length,
        });
        go("resultados");
      }
    }, t + 500);
    return node;
  };

  /* ---- Match %: qué tan bien coincide una oferta con el contexto ---- */
  // Determinístico: campos usados con valor / total + bonus por destacada,
  // menos penalidad si el precio supera el presupuesto. Rango 40–99.
  function matchScore(o) {
    const usados = o.contextoUsado || [];
    const conValor = usados.filter((k) => {
      const v = fieldValue(k);
      return v !== "" && v != null && v !== "—";
    }).length;
    const frac = usados.length ? conValor / usados.length : 0.5;
    let s = 62 + Math.round(frac * 30);
    if (o.destacada) s += 6;
    const budget = Number(fieldValue("stay.budget.max")) || 0;
    const precio = o.esTour ? o.precio : o.precioNoche;
    if (budget && precio > budget) s -= 8;
    return Math.max(40, Math.min(99, s));
  }

  const RING_C = (2 * Math.PI * 18).toFixed(1);
  function matchRing(score) {
    const off = (RING_C * (1 - score / 100)).toFixed(1);
    return `<div class="matchring" title="Coincidencia con tu contexto" role="img" aria-label="${score}% de match">
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle class="matchring__bg" cx="22" cy="22" r="18"></circle>
        <circle class="matchring__val" cx="22" cy="22" r="18" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}" data-ring="${off}"></circle>
      </svg>
      <span class="matchring__num">${score}%</span>
    </div>`;
  }

  // Tarjeta de resultado, sirve para alojamiento y experiencia.
  function offerCard(o) {
    const matches = o.match.map((m) => `<li>${esc(m)}</li>`).join("");
    const app = appById(o.sourceAppId);
    const source = app
      ? `<span class="chip" style="padding-left:4px">${brandBadge(app, 18)} ${esc(app.nombre)}</span>`
      : "";
    const sub = o.esTour
      ? `${esc(o.zona)} · ${esc(o.duracion)} · ★ ${o.rating}`
      : `${esc(o.zona)} · ★ ${o.rating}`;
    const base = o.esTour ? o.precio : o.precioNoche;
    const unit = o.esTour ? "por persona" : "por noche";
    const price = isPremium()
      ? `<b>${money(premiumPrice(base), o.moneda)}</b><div class="muted" style="text-decoration:line-through;font-size:0.72rem">${money(base, o.moneda)}</div><div class="muted">${unit}</div>`
      : `<b>${money(base, o.moneda)}</b><div class="muted">${unit}</div>`;
    const premiumChip = isPremium()
      ? `<span class="chip chip--ok">⭐ -${PREM.discountPct}% · +${pointsFor(o.esTour ? premiumPrice(o.precio) : premiumPrice(o.precioNoche) * 3)} pts</span>`
      : "";
    const cta = o.esTour ? "Reservar experiencia en" : "Reservar en";
    return `
      <div class="card">
        <div class="opt__top">
          <div>
            ${o.destacada ? `<span class="badge-best">Mejor match</span>` : ""}
            ${o.esTour ? `<span class="chip pill--dim" style="margin-left:4px">${esc(o.categoria)}</span>` : ""}
            <div style="font-weight:700;margin-top:6px">${esc(o.nombre)}</div>
            <div class="muted">${sub}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            ${matchRing(matchScore(o))}
            <div class="opt__price">${price}</div>
          </div>
        </div>
        <div class="chip-wrap" style="margin-top:8px">${source}${premiumChip}</div>
        <ul class="match-list">${matches}</ul>
        <button class="btn btn--sm" style="margin-top:14px;width:100%" data-action="book-in-app" data-opt="${o.id}">
          ${cta} ${esc(app ? app.nombre : "la app")} ›
        </button>
      </div>`;
  }

  screens.resultados = function () {
    const isTour = state.searchType === "tour";
    const top = (isTour ? D.tours : D.opciones).slice(0, 5);
    const cards = top.map(offerCard).join("");
    const titulo = top.length + (isTour ? " experiencias para vos" : " opciones para vos");
    return view(`
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
        <linearGradient id="ringgrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5566ff"/><stop offset="1" stop-color="#23c3a4"/>
        </linearGradient>
      </defs></svg>
      ${sHead(titulo, "agente")}
      <div class="card card--soft"><div class="muted">Aria buscó ${isTour ? "experiencias" : "alojamiento"} en tus <b style="color:var(--txt-dim)">apps conectadas</b> usando tu contexto. Tocá una y seguí la reserva directamente en esa app.</div></div>
      ${cards}
    `);
  };

  /* ---- Sugerencia de experiencias filtradas por destino + contexto ---- */
  const regionOf = (zona) => {
    const p = String(zona || "").split(",");
    return p[p.length - 1].trim().toLowerCase();
  };
  const cityOf = (zona) => String(zona || "").split(",")[0].trim().toLowerCase();

  // Mapea la actividad preferida del usuario (stay.activities) a categoría de tour.
  function preferredTourCategory() {
    const act = String(fieldValue("stay.activities")).toLowerCase();
    if (/enoturismo|caminata/.test(act)) return "Enoturismo";
    if (/aventura|exigen/.test(act)) return "Aventura";
    if (/cultural|museo/.test(act)) return "Cultural";
    if (/gastron/.test(act)) return "Gastronómico";
    return null;
  }

  // Experiencias en el MISMO destino que la reserva, ordenadas por contexto.
  function suggestedTours(booked, limit) {
    const region = regionOf(booked.zona);
    const city = cityOf(booked.zona);
    const prefCat = preferredTourCategory();
    const budget = Number(fieldValue("stay.budget.max")) || 0;
    const enDestino = D.tours.filter((tr) => tr.id !== booked.id && regionOf(tr.zona) === region);
    const scored = enDestino.map((tr) => {
      let s = tr.rating || 0;
      if (cityOf(tr.zona) === city) s += 3; // mismo pueblo/ciudad
      if (prefCat && tr.categoria === prefCat) s += 5; // coincide con tu actividad preferida
      if (budget && tr.precio <= budget) s += 1;
      else if (budget) s -= 2; // fuera de presupuesto
      return { tr, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit || 2).map((x) => x.tr);
  }

  /* ---- Micro-encuesta 1-tap tras la primera reserva ---- */
  const FB_TAGS = ["Rápido", "Confuso", "Me dio confianza", "Pediría más control"];

  function feedbackSheetHTML() {
    const caras = ["😖", "😕", "😐", "🙂", "🤩"];
    const fb = state._fb || { score: 0, tags: [] };
    return `
      <h2 class="title" style="text-align:center">¿Qué te pareció reservar así?</h2>
      <p class="muted" style="text-align:center;margin-bottom:14px">Tu opinión mejora el prototipo. Es anónima.</p>
      <div class="fb-faces">
        ${caras.map((c, i) => `<button class="fb-face ${fb.score === i + 1 ? "is-on" : ""}" data-action="fb-score" data-v="${i + 1}" aria-label="Puntaje ${i + 1} de 5">${c}</button>`).join("")}
      </div>
      ${fb.score
        ? `<div class="chip-wrap" style="justify-content:center;margin:12px 0 2px">
             ${FB_TAGS.map((t) => `<button class="chip fb-tag ${fb.tags.indexOf(t) >= 0 ? "chip--ok" : ""}" data-action="fb-tag" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
           </div>
           <div class="btn-stack" style="margin-top:12px">
             <button class="btn" data-action="fb-send">Enviar</button>
           </div>`
        : `<div class="btn-stack" style="margin-top:12px">
             <button class="btn btn--ghost" data-action="close-sheet">Ahora no</button>
           </div>`}
    `;
  }

  function refreshFeedbackSheet() {
    const panel = document.querySelector(".sheet__panel");
    if (panel) panel.innerHTML = '<div class="sheet__grip"></div>' + feedbackSheetHTML();
  }

  function openFeedbackSheet() {
    if (state.screen !== "reservaOk" || state.feedbackGiven) return;
    state._fb = { score: 0, tags: [] };
    openSheet(feedbackSheetHTML());
  }

  screens.reservaOk = function () {
    const o = findOffer(state.selectedOptionId) || {};
    const app = appById(o.sourceAppId);
    const esTour = !!o.esTour;

    // Celebración: confetti al llegar desde una reserva recién confirmada,
    // y una única micro-encuesta de feedback un momento después.
    if (state._celebrate && !state._preview) {
      state._celebrate = false;
      setTimeout(confetti, 350);
      if (!state.feedbackGiven) setTimeout(openFeedbackSheet, 1900);
    }

    // Cross-sell: tras reservar un alojamiento, sugerir experiencias en el MISMO
    // destino, ordenadas por el contexto del usuario.
    let crossSell = "";
    if (!esTour && o.zona) {
      const prefCat = preferredTourCategory();
      const destino = (String(o.zona).split(",").pop() || "").trim();
      const sugeridas = suggestedTours(o, 2);
      const cards = sugeridas
        .map((tr) => {
          const tApp = appById(tr.sourceAppId);
          const matchCat = prefCat && tr.categoria === prefCat;
          return `
          <div class="card">
            <div class="row row--between">
              <div class="grow">
                <div style="font-weight:700">${esc(tr.nombre)}</div>
                <div class="muted">${esc(tr.zona)} · ${esc(tr.duracion)}</div>
                <div class="chip-wrap" style="margin-top:6px">
                  <span class="chip">${esc(tApp ? tApp.icono : "🎟️")} ${esc(tApp ? tApp.nombre : "")}</span>
                  ${matchCat ? `<span class="chip chip--ok">Tu estilo: ${esc(tr.categoria)}</span>` : ""}
                </div>
              </div>
              <div class="opt__price"><b>${money(tr.precio, tr.moneda)}</b><div class="muted">p/persona</div></div>
            </div>
            <button class="btn btn--sm" style="margin-top:12px;width:100%" data-action="book-in-app" data-opt="${tr.id}">Sumar esta experiencia ›</button>
          </div>`;
        })
        .join("");
      crossSell = sugeridas.length
        ? `<div class="section-label">Sumá una experiencia en ${esc(destino)}</div>
           <p class="muted" style="margin:-4px 2px 8px">Aria encontró estas experiencias en tu destino que encajan con tu contexto.</p>
           ${cards}`
        : "";
    }

    const rsv = state.reservas.find((r) => r.optId === (o && o.id));
    const puntosMsg = rsv && rsv.puntos
      ? `<div class="card card--premium" style="border:none;text-align:center;margin-bottom:12px">⭐ Ganaste <b>+${rsv.puntos} puntos</b> Premium · saldo ${state.points.toLocaleString("es")} pts</div>`
      : "";
    return view(`
      <div style="text-align:center;padding-top:20px">
        <div class="success-mark">✓</div>
        <h2 class="title">${esTour ? "Experiencia confirmada" : "Reserva confirmada"}</h2>
        <p class="lead" style="margin-bottom:18px">Reservaste <b>${esc(o.nombre || "")}</b> en ${esc(app ? app.nombre : "la app")}. Como entraste con ContextLayer, ya recibió tu contexto: te reconoce desde el primer momento.</p>
      </div>
      ${puntosMsg}
      <div class="card card--soft" style="text-align:left">
        <div class="row" style="gap:10px">
          <span style="color:var(--brand)">${icon("lock")}</span>
          <div class="muted">${esc(app ? app.nombre : "La app")} tiene acceso a tu contexto según lo que autorizaste. Lo ves y lo revocás cuando quieras desde <b style="color:var(--txt-dim)">Permisos</b>. Quedó registrado en Actividad.</div>
        </div>
      </div>
      ${crossSell}
      <div class="btn-stack">
        <button class="btn" data-action="go-user-reservas">Ver mis reservas</button>
        <button class="btn btn--ghost" data-action="go-user-home">Volver a ContextLayer</button>
      </div>
    `);
  };

  /* ============================================================ CHAT (carga conversacional) */
  // Piezas del chat que se re-renderizan solas (sin tocar la barra de entrada,
  // así el foco y el teclado del tester no se pierden en cada mensaje).
  function buildChatMsgs() {
    return state.chat
      .map((m) => {
        if (m.typing) {
          return `<div class="bubble bubble--agent bubble--typing" aria-label="El agente está escribiendo"><span></span><span></span><span></span></div>`;
        }
        const chips = (m.chips && m.chips.length)
          ? `<div class="bubble__chips chip-wrap">${m.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>`
          : "";
        return `<div class="bubble bubble--${m.role === "user" ? "user" : "agent"}">${esc(m.text)}${chips}</div>`;
      })
      .join("");
  }

  // Respuestas rápidas + saltar + aviso de texto libre (durante el guiado).
  function buildQuickBlock() {
    const step = state.guideStep < GUIDE.length ? GUIDE[state.guideStep] : null;
    if (!step || state.chatDone || state._typingTimer) return "";
    const f = findField(step.key);
    let opts = [];
    if (f && f.opciones) opts = f.opciones.slice();
    else if (step.key === "stay.budget.max") opts = ["120 USD", "180 USD", "250 USD"];
    const chips = opts
      .map((s) => `<button data-action="chat-suggest" data-text="${esc(s)}">${esc(s)}</button>`)
      .join("");
    return `
      <div class="chat-suggest">
        ${chips}
        <button data-action="chat-skip" style="border-style:dashed">Prefiero no decirlo</button>
      </div>
      <div class="muted" style="text-align:center;font-size:0.76rem;margin:2px 0 6px">
        Elegí una opción o escribí/dictá tu propia respuesta.
      </div>`;
  }

  function buildProgress() {
    return state.guideStep < GUIDE.length
      ? `<div class="progress" style="margin-bottom:14px">${GUIDE.map((_, i) =>
          `<div class="progress__dot ${i < state.guideStep ? "is-done" : i === state.guideStep ? "is-active" : ""}"></div>`
        ).join("")}</div>`
      : "";
  }

  // Re-render parcial: solo mensajes, chips y progreso.
  function renderChatArea() {
    const log = document.getElementById("chat-log");
    if (!log) return; // no estamos en el chat
    log.innerHTML = buildChatMsgs();
    const quick = document.getElementById("chat-quick");
    if (quick) quick.innerHTML = buildQuickBlock();
    const prog = document.getElementById("chat-progress");
    if (prog) prog.innerHTML = buildProgress();
  }

  screens.chatload = function () {
    const msgs = buildChatMsgs();
    const quickBlock = `<div id="chat-quick">${buildQuickBlock()}</div>`;
    const progreso = `<div id="chat-progress">${buildProgress()}</div>`;

    // Resumen del contexto al terminar el guiado.
    const resumen = state.guidedComplete
      ? `<div class="section-label">En pocas palabras</div>
         <textarea class="textarea" id="narrative-input" rows="4" style="font-style:italic">${esc(getNarrative())}</textarea>
         <div class="muted" style="font-size:0.74rem;margin:5px 2px 0">Resumen generado automáticamente a partir de tus datos. Podés editarlo.</div>

         <div class="section-label">Detalle · tocá una fila para editar</div>
         <div class="card">${GUIDE.map((g) => summaryRow(g.key)).join("")}</div>`
      : "";

    return view(`
      ${sHead("Armar mi contexto", "pasaporte")}
      ${progreso}
      <div class="chat" id="chat-log" aria-live="polite">${msgs}</div>
      ${quickBlock}
      ${resumen}
      ${state.guidedComplete
        ? `<div class="btn-stack">
             <button class="btn" data-action="plan-trip">${icon("sparkles")} Planifiquemos el viaje</button>
             <button class="btn btn--ghost" data-action="skip-to-dashboard">Omitir por ahora</button>
           </div>`
        : state.chatDone
          ? `<div class="btn-stack"><button class="btn" data-action="chat-finish">Listo, ver mi contexto</button></div>`
          : ""}
      <div class="chatbar">
        <button class="icon-btn mic-btn" data-action="mic" aria-label="Hablar" title="Dictar por voz">${icon("mic")}</button>
        <textarea class="textarea" id="chat-input" rows="1" placeholder="Escribí o tocá el micrófono…"></textarea>
        <button class="icon-btn icon-btn--send" data-action="chat-send" aria-label="Enviar">${icon("send")}</button>
      </div>
    `);
  };

  // Interpreta lenguaje natural (ES) y devuelve actualizaciones al contexto.
  function parseContext(raw) {
    const t = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const ups = [];
    const set = (key, valor) => {
      const f = findField(key);
      if (f) { f.valor = valor; ups.push({ key, label: f.label, valor }); }
    };

    // Restricciones de comida
    if (/vegan[ao]/.test(t)) set("stay.diet", "Vegana");
    else if (/celiac[ao]|sin gluten|sin tacc/.test(t)) set("stay.diet", "Celíaca");
    else if (/sin lacteos|lactosa/.test(t)) set("stay.diet", "Sin lácteos");
    else if (/no como carne|vegetarian[ao]|sin carne/.test(t)) set("stay.diet", "No come carne");

    // WiFi
    if (/wifi|internet|conexion/.test(t)) {
      if (/innegociable|imprescindible|necesito|si o si|clave|fundamental|obligator/.test(t)) set("stay.wifi", "Innegociable");
      else set("stay.wifi", "Deseable");
    }

    // Tipo de alojamiento
    if (/boutique/.test(t)) set("stay.type", "Hotel boutique");
    else if (/cadena|hilton|marriott|sheraton/.test(t)) set("stay.type", "Hotel de cadena");
    else if (/departamento|depto|monoambiente/.test(t)) set("stay.type", "Departamento");
    else if (/cabana|caba|retiro|casa de campo/.test(t)) set("stay.type", "Cabaña / retiro");

    // Ambiente
    if (/tranquil|silenci|trabajar|concentr|laburar/.test(t)) set("stay.ambiance", "Tranquilo para trabajar");
    else if (/naturaleza|montana|playa|aire libre|verde/.test(t)) set("stay.ambiance", "Naturaleza");
    else if (/lujo|spa|premium|relax/.test(t)) set("stay.ambiance", "Lujo / spa");
    else if (/social|fiesta|movimiento|salir|noche/.test(t)) set("stay.ambiance", "Social / con movimiento");

    // Actividades
    if (/enoturismo|vino|bodega|degustaci|caminata/.test(t)) set("stay.activities", "Enoturismo y caminatas suaves");
    else if (/aventura|trekking|exigen|deporte/.test(t)) set("stay.activities", "Aventura / alta exigencia");
    else if (/museo|cultural|historia|arte/.test(t)) set("stay.activities", "Cultural / museos");
    else if (/gastronom|comer|restaurant|foodie/.test(t)) set("stay.activities", "Gastronómico");

    // Presupuesto por noche
    if (/presupuesto|noche|gastar|hasta|maximo|tope|dolar|dólar|usd|peso|euro/.test(t)) {
      const num = (t.match(/(\d{2,6})/) || [])[1];
      if (num) set("stay.budget.max", Number(num));
      if (/peso|ars/.test(t)) set("stay.budget.currency", "ARS");
      else if (/euro|eur/.test(t)) set("stay.budget.currency", "EUR");
      else if (/dolar|dólar|usd|u\$s/.test(t)) set("stay.budget.currency", "USD");
    }

    // Ocasión
    if (/pareja|romantic|luna de miel|novi/.test(t)) set("stay.occasion", "Escapada en pareja");
    else if (/famili|hijos|ninos|chicos/.test(t)) set("stay.occasion", "Familiar");
    else if (/amigos/.test(t)) set("stay.occasion", "Con amigos");
    else if (/trabajo|negocios|laboral|remoto/.test(t)) set("stay.occasion", "Trabajo remoto");

    // Personas
    const pers = t.match(/somos\s+(\d+)|(\d+)\s*personas?/);
    if (pers) set("stay.group.people", Number(pers[1] || pers[2]));

    // Nombre y ciudad (conservador)
    const nm = raw.match(/me llamo\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)/i);
    if (nm) set("identity.name", nm[1][0].toUpperCase() + nm[1].slice(1));
    const cy = raw.match(/vivo en\s+([A-Za-zÁÉÍÓÚáéíóúñ ]{3,20})/i);
    if (cy) set("identity.city", cy[1].trim());

    return ups;
  }

  function chatSend(text, source) {
    const clean = (text || "").trim();
    if (!clean) return false;
    if (state._typingTimer) return false; // el agente todavía está "escribiendo"
    // Solo fuente, paso y longitud: el contenido del chat nunca se trackea.
    track("chat_msg", {
      source: source || "text",
      step_key: state.guideStep < GUIDE.length ? GUIDE[state.guideStep].key : null,
      len: clean.length,
    });
    state.chat.push({ role: "user", text: clean });

    const estabaCompleto = state.guidedComplete;
    const antes = state.chat.length;
    if (state.guideStep < GUIDE.length) {
      guidedTurn(clean);
    } else {
      // Modo libre, una vez completado el guiado.
      const ups = parseContext(clean);
      if (ups.length) {
        state.chat.push({ role: "agent", text: "Listo, lo actualicé:", chips: ups.map((u) => u.label + ": " + u.valor) });
      } else {
        state.chat.push({ role: "agent", text: "Puedo seguir anotando lo que me cuentes, o tocá “Listo, ver mi contexto”." });
      }
    }

    // Diferir la respuesta del agente detrás de un typing indicator.
    const respuestas = state.chat.splice(antes);
    if (reducedMotion()) {
      respuestas.forEach((r) => state.chat.push(r));
      chatAfterReply(estabaCompleto);
      return true;
    }
    state.chat.push({ role: "agent", typing: true });
    renderChatArea();
    scrollChatBottom();
    state._typingTimer = setTimeout(() => {
      state._typingTimer = null;
      const ultimo = state.chat[state.chat.length - 1];
      if (ultimo && ultimo.typing) state.chat.pop(); // saca el typing (si el chat no fue reiniciado)
      respuestas.forEach((r) => state.chat.push(r));
      chatAfterReply(estabaCompleto);
      saveSoon();
    }, 480 + Math.random() * 420);
    return true;
  }

  function cancelTyping() {
    if (state._typingTimer) {
      clearTimeout(state._typingTimer);
      state._typingTimer = null;
    }
    state.chat = state.chat.filter((m) => !m.typing);
  }

  // Cuando el guiado termina hay que re-renderizar la pantalla completa
  // (aparecen el resumen y los botones); si no, alcanza con el área del chat.
  function chatAfterReply(estabaCompleto) {
    if (state.guidedComplete && !estabaCompleto && state.screen === "chatload") render();
    else renderChatArea();
    scrollChatBottom();
  }

  const normTxt = (s) => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  function snapshotGuide() {
    const s = {};
    GUIDE.forEach((g) => {
      const f = findField(g.key);
      s[g.key] = f ? f.valor : "";
    });
    return s;
  }

  // Interpreta la respuesta del usuario para el campo del paso actual.
  function applyGuidedAnswer(step, answer) {
    const f = findField(step.key);
    if (!f) return null;
    const a = normTxt(answer);
    if (f.tipo === "number") {
      const n = (a.match(/\d{2,6}/) || [])[0];
      if (n) { f.valor = Number(n); return f.valor; }
      return null;
    }
    if (f.tipo === "select") {
      let hit = f.opciones.find((o) => normTxt(o) === a);
      if (!hit) hit = f.opciones.find((o) => a.includes(normTxt(o)) || normTxt(o).includes(a));
      if (!hit) {
        const ups = parseContext(answer);
        if (ups.find((u) => u.key === step.key)) return f.valor;
      }
      if (hit) { f.valor = hit; return hit; }
      if (step.key === "stay.diet" && /(ningun|no tengo|nada|sin restri)/.test(a)) {
        f.valor = "Sin restricciones";
        return f.valor;
      }
      return null;
    }
    // Texto (nombre)
    let v = answer.replace(/^\s*(soy|me llamo|mi nombre es)\s+/i, "").trim();
    v = v.split(/\s+/).slice(0, 2).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
    if (v) { f.valor = v; return v; }
    return null;
  }

  function guidedTurn(answer) {
    const step = GUIDE[state.guideStep];
    const before = snapshotGuide();
    const val = applyGuidedAnswer(step, answer);
    // Bonus: capturar cualquier otro dato mencionado en la misma respuesta.
    parseContext(answer);

    const filled = GUIDE.filter((g) => before[g.key] === "" && fieldValue(g.key) !== "");
    if (val || filled.length) {
      const chips = (filled.length ? filled.map((g) => g.key) : [step.key]).map(
        (k) => fieldLabel(k) + ": " + fieldValue(k)
      );
      state.chat.push({ role: "agent", text: "Anoté 👇", chips });
      advanceGuide();
    } else {
      state.chat.push({ role: "agent", text: "No lo interpreté bien, pero podés escribirlo con tus palabras. " + step.q });
    }
  }

  function finishGuide() {
    state.chat.push({ role: "agent", text: "¡Listo! Este es el resumen de tu contexto. Podés ajustar lo que quieras y después planificamos tu viaje." });
    state.chatDone = true;
    state.guidedComplete = true;
    state.onboarded = true;
    milestone("onboarding_complete", { mode: "chat" });
  }

  /* ---- Resumen en lenguaje natural del contexto ---- */
  const DIET_PHRASE = {
    "No come carne": "no come carne",
    "Vegana": "sigue una dieta vegana",
    "Celíaca": "es celíaca, necesita opciones sin gluten",
    "Sin lácteos": "evita los lácteos",
  };
  const WIFI_PHRASE = {
    "Innegociable": "el WiFi es innegociable",
    "Deseable": "valora tener buen WiFi",
    "Indistinto": "el WiFi le resulta indistinto",
  };

  function buildNarrative() {
    const name = fieldValue("identity.name");
    const city = fieldValue("identity.city");
    const type = fieldValue("stay.type");
    const amb = fieldValue("stay.ambiance");
    const diet = fieldValue("stay.diet");
    const wifi = fieldValue("stay.wifi");
    const act = fieldValue("stay.activities");
    const budget = fieldValue("stay.budget.max");
    const cur = fieldValue("stay.budget.currency") || "USD";
    const occ = fieldValue("stay.occasion");
    const sign = cur === "USD" ? "US$" : cur === "EUR" ? "€" : "$";
    const subject = name || "Esta persona";
    const parts = [];

    let intro = subject;
    if (city) intro += ` viaja desde ${city}`;
    parts.push(intro + ".");

    if (type || amb) {
      let s = "Prefiere " + (type ? type.toLowerCase() : "su alojamiento");
      if (amb) s += ` con un ambiente ${amb.toLowerCase()}`;
      parts.push(s + ".");
    }
    if (diet) {
      parts.push(
        diet === "Sin restricciones"
          ? "No tiene restricciones de comida."
          : "En cuanto a la comida, " + (DIET_PHRASE[diet] || diet.toLowerCase()) + "."
      );
    }
    if (wifi) parts.push((WIFI_PHRASE[wifi] || ("el WiFi le resulta " + wifi.toLowerCase())).replace(/^el/, "El") + ".");
    if (act) parts.push("Disfruta de " + act.toLowerCase() + ".");
    if (budget !== "" && budget != null) parts.push(`Su presupuesto ronda los ${sign}${budget} por noche.`);
    if (occ) parts.push("Suele viajar para: " + occ.toLowerCase() + ".");

    if (parts.length <= 1) return "Todavía no cargaste datos suficientes para armar un resumen. Completá algunos campos y aparecerá acá.";
    return parts.join(" ");
  }

  const getNarrative = () =>
    state.narrativeEdited && state.narrative ? state.narrative : buildNarrative();

  // Fila del resumen; se puede tocar para editar/completar el campo inline.
  function summaryRow(key) {
    const f = findField(key);
    if (state.summaryEditKey === key) {
      let control;
      if (f && f.opciones) {
        const opts = ['<option value="">Elegí…</option>']
          .concat(f.opciones.map((o) => `<option value="${esc(o)}" ${o === f.valor ? "selected" : ""}>${esc(o)}</option>`))
          .join("");
        control = `<select id="sum-input" data-key="${esc(key)}">${opts}</select>`;
      } else {
        const type = f && f.tipo === "number" ? "number" : "text";
        control = `<input id="sum-input" data-key="${esc(key)}" type="${type}" value="${esc(f ? f.valor : "")}" placeholder="${esc(fieldLabel(key))}" />`;
      }
      return `<div class="sum-edit">
        <div class="grow">${control}</div>
        <button class="btn btn--sm" data-action="save-summary" data-key="${esc(key)}">✓</button>
        <button class="btn btn--dark btn--sm" data-action="cancel-summary">✕</button>
      </div>`;
    }
    const v = fieldValue(key);
    return `<div class="ctx-item" data-action="edit-summary" data-key="${esc(key)}" role="button" tabindex="0" style="cursor:pointer">
      <div class="grow">${esc(fieldLabel(key))}</div>
      <div class="ctx-item__val">${v !== "" ? esc(v) : '<span class="muted">Sin especificar</span>'} <span style="color:var(--txt-mute);margin-left:4px">✎</span></div>
    </div>`;
  }

  // Avanza al próximo paso pendiente (salta los ya completados). Cierra si no quedan.
  function advanceGuide() {
    do { state.guideStep++; } while (state.guideStep < GUIDE.length && fieldValue(GUIDE[state.guideStep].key) !== "");
    if (state.guideStep < GUIDE.length) {
      state.chat.push({ role: "agent", text: GUIDE[state.guideStep].q });
    } else {
      finishGuide();
    }
  }

  function scrollChatBottom() {
    requestAnimationFrame(() => { screenEl.scrollTop = screenEl.scrollHeight; });
  }

  /* ============================================================ APP DE TERCEROS (login con ContextLayer) */
  const currentApp = () => D.connectedApps.find((a) => a.id === state.currentAppId);

  // Avatar de proveedor: monograma de marca si hay app asociada; si no, emoji.
  function providerAvatar(item, size) {
    const app = item && item.appId ? appById(item.appId) : null;
    if (app) return brandBadge(app, size || 44);
    const s = size || 44;
    const inner = item && item.iconName ? icon(item.iconName) : esc(item && item.icono ? item.icono : "🔒");
    return `<div class="avatar" style="width:${s}px;height:${s}px">${inner}</div>`;
  }

  // Ícono de un dominio del pasaporte: SVG si tiene iconName, si no el emoji.
  const domIcon = (dom) => (dom.iconName ? icon(dom.iconName) : esc(dom.icono));

  // Insignia de marca (monograma sobre el color de la empresa).
  function brandBadge(a, size) {
    const b = a.brand || {};
    const s = size || 44;
    const bg = b.primary || a.color;
    const mark = b.mark || (a.nombre ? a.nombre[0] : "?");
    return `<div class="brandmark" style="width:${s}px;height:${s}px;background:${bg};font-family:${b.markFont || "inherit"};font-size:${Math.round(s * 0.42)}px">${esc(mark)}</div>`;
  }

  screens.thirdApp = function () {
    // 1) Sin app elegida -> selector
    if (!state.currentAppId) {
      const cards = D.connectedApps
        .map((a) => {
          const bb = a.brand || {};
          const wm = bb.wordmark
            ? `<span style="transform:scale(.7);transform-origin:left center;display:inline-block">${bb.wordmark}</span>`
            : `<b>${esc(a.nombre)}</b>`;
          return `
        <div class="card brandcard" data-action="pick-app" data-app="${a.id}" role="button" tabindex="0" style="border-left:4px solid ${bb.primary || a.color}">
          <div class="row" style="gap:12px">
            ${brandBadge(a, 44)}
            <div class="grow">${wm}<div class="muted">${esc(a.tagline)}</div></div>
            <span class="pill">Conectada</span>
          </div>
        </div>`;
        })
        .join("");
      return view(`
        <div class="eyebrow">Apps de terceros</div>
        <h2 class="title">Entrá con ContextLayer</h2>
        <p class="muted" style="margin-bottom:12px">Estas apps de hospedaje dejan iniciar sesión con ContextLayer. Elegí una para ver la experiencia del usuario.</p>
        ${cards}
      `);
    }

    const a = currentApp();
    const host = a.nombre.toLowerCase().replace(/[^a-z]/g, "") + ".com";
    const bo = state.openListingId ? findOffer(state.openListingId) : null;
    const booking = bo && bo.sourceAppId === a.id ? bo : null;

    // 2.5) Reserva de un alojamiento/experiencia puntual traído por Aria (ya logueado)
    if (booking && state.appLogged[a.id]) {
      const o = booking;
      const esTour = !!o.esTour;
      const matches = o.match.map((m) => `<li>${esc(m)}</li>`).join("");
      const amen = (o.amenities || []).map((x) => `<span class="chip">${esc(x)}</span>`).join("");
      const compartido = a.fields.map((k) => `<span class="chip chip--ok">${esc(fieldLabel(k))}</span>`).join("");
      const sub = esTour ? `${esc(o.zona)} · ${esc(o.duracion)} · ★ ${o.rating}` : `${esc(o.zona)} · ★ ${o.rating}`;
      const unitBase = esTour ? o.precio : o.precioNoche;
      const price = isPremium()
        ? `<b>${money(premiumPrice(unitBase), o.moneda)}</b><div class="muted" style="text-decoration:line-through;font-size:0.72rem">${money(unitBase, o.moneda)}</div><div class="muted">${esTour ? "por persona" : "por noche"}</div>`
        : `<b>${money(unitBase, o.moneda)}</b><div class="muted">${esTour ? "por persona" : "por noche"}</div>`;
      const totalBase = esTour ? o.precio : o.precioNoche * 3;
      const totalFinal = premiumPrice(totalBase);
      const totalRow = isPremium()
        ? `<span class="muted">${esTour ? "Experiencia" : "3 noches"} · ⭐ premium</span><span style="text-align:right"><b>${money(totalFinal, o.moneda)}</b> <span class="muted" style="text-decoration:line-through;font-size:0.75rem">${money(totalBase, o.moneda)}</span></span>`
        : `<span class="muted">${esTour ? "Experiencia · " + esc(o.duracion) : "3 noches"}</span><b>${money(totalBase, o.moneda)}</b>`;
      const pointsRow = isPremium()
        ? `<div class="row row--between" style="margin-top:6px"><span class="muted">Ganás</span><b style="color:var(--brand-2)">+${pointsFor(totalFinal)} pts</b></div>`
        : "";
      const bl = a.brand || {};
      const hbl = bl.headerBg || a.color;
      const wml = bl.wordmark || `<span style="color:${bl.headerInk || "#fff"};font-weight:800">${esc(a.nombre)}</span>`;
      return view(`
        <div style="font-family:${bl.font || "inherit"}">
        <div class="appframe" style="border-color:${hbl}">
          <div class="appframe__bar"><span class="appframe__dot"></span><span class="appframe__url">${esc(host)}/reservar</span></div>
          <div class="brandhero" style="background:${hbl};padding:12px 18px;${hbl.toLowerCase() === "#ffffff" ? "border-bottom:1px solid var(--line)" : ""}">
            <div class="brandhero__wm" style="transform:scale(.72)">${wml}</div>
          </div>
        </div>
        <div class="card">
          <div class="opt__top">
            <div><div style="font-weight:700;font-size:1.1rem">${esc(o.nombre)}</div><div class="muted">${sub}</div></div>
            <div class="opt__price">${price}</div>
          </div>
          ${amen ? `<div class="chip-wrap" style="margin-top:10px">${amen}</div>` : ""}
          <ul class="match-list" style="margin-top:12px">${matches}</ul>
          <div class="row row--between" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line)">${totalRow}</div>
          ${pointsRow}
        </div>
        <div class="card card--soft">
          <div class="row" style="gap:8px;align-items:flex-start">
            <span style="color:var(--brand)">${icon("lock")}</span>
            <div class="muted">${esc(a.nombre)} ya tiene tu contexto vía ContextLayer:<div class="chip-wrap" style="margin-top:6px">${compartido}</div></div>
          </div>
        </div>
        <div class="action-bar">
          <div class="row" style="gap:8px">
            <button class="btn btn--dark" data-action="back-to-results">‹ Opciones</button>
            <button class="btn" data-action="finish-booking">${esTour ? "Confirmar experiencia" : "Confirmar reserva"}</button>
          </div>
        </div>
        </div>
      `);
    }

    // 3) Logueado -> home personalizado de la app
    if (state.appLogged[a.id]) {
      const nombre = String(fieldValue("identity.name")).split(" ")[0];
      const compartido = a.fields.map((k) => `<span class="chip chip--ok">${esc(fieldLabel(k))}</span>`).join("");
      const results = D.opciones
        .slice(0, 2)
        .map(
          (o) => `
          <div class="card" style="margin-bottom:10px">
            <div class="opt__top">
              <div><div style="font-weight:700">${esc(o.nombre)}</div><div class="muted">${esc(o.zona)} · ★ ${o.rating}</div></div>
              <div class="opt__price"><b>${o.moneda === "USD" ? "US$" : "$"}${o.precioNoche}</b><div class="muted">noche</div></div>
            </div>
          </div>`
        )
        .join("");
      const bh = a.brand || {};
      const hb = bh.headerBg || a.color;
      const hink = bh.headerInk || "#fff";
      const url2 = a.nombre.toLowerCase().replace(/[^a-z]/g, "") + ".com";
      const wm2 = bh.wordmark || `<span style="color:${hink};font-weight:800;font-size:1.3rem">${esc(a.nombre)}</span>`;
      return view(`
        <div style="font-family:${bh.font || "inherit"}">
          <div class="appframe" style="border-color:${hb}">
            <div class="appframe__bar"><span class="appframe__dot"></span><span class="appframe__url">${esc(url2)}</span></div>
            <div class="brandhero" style="background:${hb};padding:16px 18px;${hb.toLowerCase() === "#ffffff" ? "border-bottom:1px solid var(--line)" : ""}">
              <div class="brandhero__wm" style="transform:scale(.85)">${wm2}</div>
              <div style="color:${hink};font-weight:700;font-size:1.05rem;margin-top:8px">Hola, ${esc(nombre)} 👋</div>
              <div style="color:${hink};opacity:.85;font-size:0.82rem;margin-top:2px">Sesión iniciada con ContextLayer</div>
            </div>
          </div>
          <div class="card card--soft">
            <div class="row" style="gap:8px;align-items:flex-start">
              <span style="color:var(--brand)">${icon("lock")}</span>
              <div class="muted">${esc(a.nombre)} está usando tu contexto: <div class="chip-wrap" style="margin-top:6px">${compartido}</div></div>
            </div>
          </div>
          <div class="section-label">${esc(a.resultsTitle)}</div>
          ${results}
          <div class="btn-stack">
            <button class="btn btn--dark" data-action="app-logout" data-app="${a.id}">Cerrar sesión</button>
            <button class="btn btn--ghost" data-action="pick-app-reset">Probar otra app</button>
          </div>
        </div>
      `);
    }

    // 2) App elegida, no logueado -> pantalla de login con el look & feel de la marca
    const b = a.brand || {};
    const headerBg = b.headerBg || a.color;
    const headerInk = b.headerInk || "#ffffff";
    const primary = b.primary || a.color;
    const wm = b.wordmark || `<span style="color:${headerInk};font-weight:800;font-size:1.4rem">${esc(a.nombre)}</span>`;
    const url = a.nombre.toLowerCase().replace(/[^a-z]/g, "") + ".com";
    const eyebrow = b.eyebrow
      ? `<div style="color:${headerInk};opacity:.8;font-size:0.66rem;letter-spacing:2px;margin-bottom:4px">${esc(b.eyebrow)}</div>`
      : "";
    return view(`
      <div class="applogin" style="font-family:${b.font || "inherit"}">
        <div class="appframe" style="border-color:${headerBg}">
          <div class="appframe__bar"><span class="appframe__dot"></span><span class="appframe__url">${esc(url)}</span></div>
          <div class="brandhero" style="background:${headerBg};${headerBg.toLowerCase() === "#ffffff" ? "border-bottom:1px solid var(--line)" : ""}">
            ${eyebrow}
            <div class="brandhero__wm">${wm}</div>
            <div style="color:${headerInk};opacity:.85;font-size:0.82rem;margin-top:6px">${esc(a.tagline)}</div>
          </div>
        </div>
        ${booking
          ? `<div class="card card--soft" style="text-align:center;margin-bottom:12px">Estás reservando <b>${esc(booking.nombre)}</b>.<br/>Iniciá sesión para continuar.</div>`
          : `<p class="muted" style="text-align:center;margin-bottom:14px">Iniciá sesión para continuar en ${esc(a.nombre)}</p>`}
        <button class="btn-plain" style="background:${primary};color:#fff;border:none">Continuar con email</button>
        <button class="btn-plain">Continuar con Google</button>
        <div class="applogin__sep"><span>o</span></div>
        <button class="btn-ctxlayer" data-action="open-sso">
          <span class="btn-ctxlayer__mark">◈</span> Continuar con ContextLayer
        </button>
        <p class="muted" style="text-align:center;margin-top:12px;font-size:0.78rem">Con ContextLayer, ${esc(a.nombre)} recibe solo lo que autorices.</p>
        <div class="btn-stack"><button class="btn btn--ghost" data-action="pick-app-reset">‹ Elegir otra app</button></div>
      </div>
    `);
  };

  // Hoja de consentimiento (handoff tipo OAuth)
  screens.sso = function () {
    const a = currentApp();
    if (!a) return view(`<div class="empty">App no encontrada</div>`);
    if (!state.ssoDraft || state.ssoDraft.id !== a.id) {
      state.ssoDraft = { id: a.id, granted: {} };
      a.fields.forEach((k) => (state.ssoDraft.granted[k] = true));
    }
    const rows = a.fields
      .map((k) => {
        const on = state.ssoDraft.granted[k];
        return `
        <div class="field-grant">
          <div class="grow">
            <div>${esc(fieldLabel(k))}</div>
            <div class="field-grant__key">${esc(k)}</div>
            <div class="field-grant__val">${esc(fieldValue(k))}</div>
          </div>
          <label class="switch">
            <input type="checkbox" ${on ? "checked" : ""} data-action="toggle-sso-field" data-key="${esc(k)}" aria-label="Compartir ${esc(fieldLabel(k))}" />
            <span class="switch__track"></span>
          </label>
        </div>`;
      })
      .join("");

    return view(`
      <div class="sso">
        <div class="sso__head">
          <div class="sso__apps">
            <div class="sso__badge">${esc(a.icono)}</div>
            <span class="sso__link">⇄</span>
            <div class="sso__badge" style="background:var(--brand-grad);color:#fff">◈</div>
          </div>
          <h2 class="title" style="margin-bottom:2px">${esc(a.nombre)} quiere entrar con ContextLayer</h2>
          <p class="muted">Elegí qué de tu contexto compartís.</p>
        </div>

        <div class="sso__acct">
          <div class="avatar" style="width:38px;height:38px">${icon("user")}</div>
          <div class="grow"><b>${esc(fieldValue("identity.name"))}</b><div class="muted">Tu cuenta ContextLayer</div></div>
        </div>

        <div class="meta-row"><span class="k">Propósito</span><span>${esc(a.proposito)}</span></div>
        <div class="meta-row" style="margin-bottom:8px"><span class="k">Duración</span><span>${esc(a.duracion)}</span></div>

        <div class="section-label">Campos solicitados</div>
        <div class="card">${rows}</div>

        <div class="section-label">Lo que se compartiría</div>
        <div class="card">${buildPayload(state.ssoDraft.granted)}</div>

        <div class="action-bar">
          <div class="row" style="gap:8px">
            <button class="btn btn--dark" data-action="cancel-sso">Cancelar</button>
            <button class="btn" data-action="grant-sso">Autorizar</button>
          </div>
        </div>
      </div>
    `);
  };

  /* ============================================================ EVENTOS */
  function bindFieldInputs(root) {
    root.querySelectorAll("[data-key]").forEach((el) => {
      if (el.tagName !== "INPUT" && el.tagName !== "SELECT") return;
      if (el.type === "checkbox") return; // los toggles se manejan aparte
      el.addEventListener("change", () => {
        const f = findField(el.dataset.key);
        if (f) f.valor = el.type === "number" ? Number(el.value) : el.value;
      });
    });
  }

  screenEl.addEventListener("click", (e) => {
    const goEl = e.target.closest("[data-go]");
    if (goEl) return go(goEl.dataset.go);
    const actEl = e.target.closest("[data-action]");
    if (actEl) handleAction(actEl.dataset.action, actEl);
  });

  // Enter envía en el chat (Shift+Enter hace salto de línea).
  // Las cards con role="button" también responden a Enter/Espacio.
  screenEl.addEventListener("keydown", (e) => {
    if (e.target && e.target.id === "chat-input" && e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAction("chat-send", e.target);
      return;
    }
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.matches("input, select, textarea, button, a")) return;
    const el = e.target.closest('[role="button"]');
    if (!el) return;
    e.preventDefault();
    el.click();
  });

  // El textarea del chat crece con el texto (hasta 120 px).
  screenEl.addEventListener("input", (e) => {
    if (e.target && e.target.id === "chat-input") {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    }
  });

  screenEl.addEventListener("change", (e) => {
    const t = e.target;
    if (t.id === "narrative-input") {
      state.narrative = t.value;
      state.narrativeEdited = true;
      return;
    }
    if (t.matches('[data-action="toggle-sso-field"]')) {
      if (state.ssoDraft) state.ssoDraft.granted[t.dataset.key] = t.checked;
      const pre = screenEl.querySelector(".codeblock");
      if (pre && pre.parentElement) pre.parentElement.innerHTML = buildPayload(state.ssoDraft.granted);
      else render();
    } else if (t.matches('[data-action="toggle-grant"]') && t.tagName === "INPUT") {
      toggleGrant(t.dataset.grant);
    }
  });

  // Toda acción persiste el estado al terminar (aunque haya returns tempranos).
  function handleAction(action, el) {
    try {
      doAction(action, el);
    } finally {
      saveSoon();
    }
  }

  function doAction(action, el) {
    switch (action) {
      case "resume":
        go("pasaporte");
        break;
      case "reset-demo":
        clearSavedState();
        resetEmptyUser();
        state.onboarded = false;
        state.chat = [];
        state.chatDone = false;
        state.guideStep = 0;
        state.appLogged = {};
        state.currentAppId = null;
        toast("Demo reiniciada");
        go("splash");
        break;
      case "start-onboarding":
        resetEmptyUser();
        state.onboardingStep = 0;
        defaultSelects(state.passport[0]);
        milestone("onboarding_start", { mode: "form" });
        go("onboarding");
        break;
      case "load-demo":
        loadDemoUser();
        state.onboarded = true;
        milestone("demo_loaded");
        toast("Perfil de ejemplo cargado");
        go("pasaporte");
        break;
      case "onboarding-next": {
        const errV = validateDom(state.passport[state.onboardingStep]);
        if (errV) {
          markFieldError(errV.key, errV.msg);
          break;
        }
        if (state.onboardingStep < state.passport.length - 1) {
          state.onboardingStep++;
          defaultSelects(state.passport[state.onboardingStep]);
          go("onboarding");
        } else {
          state.onboarded = true;
          state.narrativeEdited = false;
          milestone("onboarding_complete", { mode: "form" });
          toast("Contexto creado ✓");
          go("onboardingDone");
        }
        break;
      }
      case "onboarding-prev":
        if (state.onboardingStep > 0) state.onboardingStep--;
        go("onboarding");
        break;

      case "edit-dom":
        state._editDomId = el.dataset.dom;
        go("editDom");
        break;
      case "save-dom":
        toast("Cambios guardados");
        go("contexto");
        break;

      /* ---- Carga conversacional ---- */
      case "start-chatload":
        resetEmptyUser();
        cancelTyping();
        milestone("onboarding_start", { mode: "chat" });
        state.guideStep = 0;
        state.chatDone = false;
        state.guidedComplete = false;
        state.summaryEditKey = null;
        state.narrative = "";
        state.narrativeEdited = false;
        state.chat = [
          { role: "agent", text: "¡Hola! Soy tu agente. Te hago unas preguntas rápidas para armar tu contexto. En cada una podés elegir una opción, escribir libremente o dictar por voz 🎤 — y si preferís, saltearla." },
          { role: "agent", text: GUIDE[0].q },
        ];
        go("chatload");
        break;
      case "chat-send": {
        const input = document.getElementById("chat-input");
        const v = input ? input.value : "";
        if (chatSend(v) && input) {
          input.value = "";
          input.style.height = "";
          input.focus();
        }
        break;
      }
      case "chat-suggest":
        chatSend(el.dataset.text, "chip");
        break;
      case "edit-summary":
        state.summaryEditKey = el.dataset.key;
        render();
        break;
      case "cancel-summary":
        state.summaryEditKey = null;
        render();
        break;
      case "save-summary": {
        const inp = document.getElementById("sum-input");
        const f = findField(el.dataset.key);
        if (inp && f) {
          f.valor = f.tipo === "number" ? (inp.value === "" ? "" : Number(inp.value)) : inp.value;
        }
        state.summaryEditKey = null;
        render(); // el resumen en lenguaje natural se regenera solo (si no fue editado a mano)
        break;
      }
      case "chat-skip": {
        if (state.guideStep >= GUIDE.length) break;
        track("chat_msg", { source: "skip", step_key: GUIDE[state.guideStep].key });
        state.chat.push({ role: "user", text: "Prefiero no decirlo" });
        state.chat.push({ role: "agent", text: "Sin problema, lo dejo en blanco. Podés completarlo cuando quieras." });
        advanceGuide();
        render();
        scrollChatBottom();
        break;
      }
      case "start-chat-update":
        cancelTyping();
        state.guideStep = GUIDE.length; // modo libre (no reinicia el contexto)
        state.chatDone = true;
        state.guidedComplete = false;
        state.chat = [
          { role: "agent", text: "Contame qué querés actualizar de tu contexto. Por ejemplo: “ahora prefiero naturaleza” o “subí mi presupuesto a 250”." },
        ];
        go("chatload");
        break;
      case "chat-finish":
        state.onboarded = true;
        toast("Contexto actualizado ✓");
        go("pasaporte");
        break;
      case "plan-trip":
        state.onboarded = true;
        state.searchType = "stay";
        go("agente");
        break;
      case "skip-to-dashboard":
        state.onboarded = true;
        go("pasaporte");
        break;
      case "mic":
        startVoice(el);
        break;

      /* ---- App de terceros / login con ContextLayer ---- */
      case "pick-app":
        state.currentAppId = el.dataset.app;
        state.ssoDraft = null;
        go("thirdApp");
        break;
      case "pick-app-reset":
        state.currentAppId = null;
        state.ssoDraft = null;
        state.openListingId = null;
        go("thirdApp");
        break;
      case "open-sso":
        state.ssoDraft = null;
        milestone("sso_opened", { app: state.currentAppId });
        go("sso");
        break;
      case "cancel-sso":
        milestone("sso_cancelled", { app: state.currentAppId });
        go("thirdApp");
        break;
      case "grant-sso":
        grantSso();
        break;
      case "app-logout": {
        const id = el.dataset.app;
        milestone("app_logout", { app: id });
        delete state.appLogged[id];
        state.openListingId = null;
        // revocar el permiso asociado a esta app
        state.grants = state.grants.filter((g) => g.id !== "grant-sso-" + id);
        toast("Sesión cerrada");
        go("thirdApp");
        break;
      }

      case "toggle-grant":
        if (el.tagName !== "INPUT") toggleGrant(el.dataset.grant);
        break;

      case "search-type": {
        const input = document.getElementById("pedido-input");
        if (input) state.pedido = input.value; // conservar lo escrito
        const nuevo = el.dataset.type;
        if (nuevo !== state.searchType) {
          state.searchType = nuevo;
          const sug = nuevo === "tour" ? D.pedidoSugeridoTour : D.pedidoSugerido;
          // Si el campo estaba vacío o con la sugerencia del otro tipo, actualizarlo.
          if (!state.pedido || state.pedido === D.pedidoSugerido || state.pedido === D.pedidoSugeridoTour) {
            state.pedido = sug;
          }
        }
        go("agente");
        break;
      }

      case "run-agent": {
        const input = document.getElementById("pedido-input");
        if (input) state.pedido = input.value.trim();
        if (!state.pedido) return toast("Contale a Aria qué necesitás");
        milestone("search_run", {
          type: state.searchType,
          pedido_len: state.pedido.length,
          edited: state.pedido !== D.pedidoSugerido && state.pedido !== D.pedidoSugeridoTour,
        });
        addReceipt({
          tipo: "read",
          solicitante: "Aria · tu agente de viaje",
          icono: "🤖",
          iconName: "bot",
          detalle: 'Leyó tu contexto para: "' + state.pedido + '"',
          fields:
            state.searchType === "tour"
              ? ["stay.activities", "stay.diet", "stay.budget.max"]
              : ["stay.type", "stay.ambiance", "stay.diet", "stay.budget.max"],
        });
        go("thinking");
        break;
      }

      /* ---- Aria: elegir una opción abre la app de terceros para reservar ---- */
      case "book-in-app": {
        const o = findOffer(el.dataset.opt);
        if (!o) break;
        milestone("option_open", {
          opt: o.id,
          app: o.sourceAppId,
          type: o.esTour ? "tour" : "stay",
          position: (o.esTour ? D.tours : D.opciones).findIndex((x) => x.id === o.id),
        });
        state.selectedOptionId = o.id;
        state.openListingId = o.id;
        state.currentAppId = o.sourceAppId;
        state.perspective = "app";
        go("thirdApp");
        break;
      }
      case "back-to-results":
        state.openListingId = null;
        state.perspective = "user";
        go("resultados");
        break;
      case "finish-booking": {
        const o = findOffer(state.openListingId) || findOffer(state.selectedOptionId);
        const a = o ? appById(o.sourceAppId) : null;
        if (a && o) {
          addReceipt({
            tipo: "read",
            solicitante: a.nombre,
            appId: a.id,
            icono: a.icono,
            detalle: (o.esTour ? "Experiencia confirmada: " : "Reserva confirmada: ") + o.nombre,
            fields: a.fields,
          });
          // Registrar en "Mis reservas" como "en curso". Los puntos premium se
          // suman solo si la reserva es nueva (evita duplicar re-reservando).
          if (!state.reservas.some((r) => r.optId === o.id)) {
            const totalBase = o.esTour ? o.precio : o.precioNoche * 3;
            const ganados = isPremium() ? pointsFor(premiumPrice(totalBase)) : 0;
            if (ganados) state.points += ganados;
            state.reservas.unshift(
              o.esTour
                ? {
                    id: "rsv-" + o.id + "-" + Date.now(),
                    optId: o.id,
                    esTour: true,
                    hotel: o.nombre,
                    appId: o.sourceAppId,
                    zona: o.zona,
                    fechas: "Próxima experiencia",
                    duracion: o.duracion,
                    precio: o.precio,
                    moneda: o.moneda,
                    premium: isPremium(),
                    puntos: ganados,
                    estado: "en_curso",
                  }
                : {
                    id: "rsv-" + o.id + "-" + Date.now(),
                    optId: o.id,
                    hotel: o.nombre,
                    appId: o.sourceAppId,
                    zona: o.zona,
                    fechas: "Próxima estadía",
                    noches: 3,
                    precioNoche: o.precioNoche,
                    moneda: o.moneda,
                    premium: isPremium(),
                    puntos: ganados,
                    estado: "en_curso",
                  }
            );
          }
        }
        if (a && o) {
          milestone("booking_confirmed", {
            opt: o.id,
            app: a.id,
            type: o.esTour ? "tour" : "stay",
            premium: isPremium(),
            total: premiumPrice(o.esTour ? o.precio : o.precioNoche * 3),
          });
        }
        state.openListingId = null;
        state._celebrate = true;
        buzz(18);
        go("reservaOk");
        break;
      }
      case "go-user-permisos":
        state.perspective = "user";
        go("permisos");
        break;
      case "go-user-reservas":
        state.perspective = "user";
        go("reservas");
        break;
      case "go-user-home":
        state.perspective = "user";
        go("pasaporte");
        break;

      /* ---- Premium ---- */
      case "select-plan":
        state.selectedPlan = el.dataset.plan === "mes" ? "mes" : "anual";
        go("premium");
        break;
      case "subscribe-premium":
        state._ptsFrom = state.points;
        state.premium = true;
        state.premiumPlan = state.selectedPlan || "anual";
        state.points += 200; // puntos de bienvenida
        milestone("premium_subscribed", { plan: state.premiumPlan });
        buzz();
        toast("¡Bienvenido a Premium! +200 pts de regalo");
        go("premium");
        confetti();
        break;

      case "cancel-premium":
        openSheet(`
          <h2 class="title">¿Cancelar tu suscripción Premium?</h2>
          <p class="muted" style="margin-bottom:16px">Perdés los descuentos y las membresías en los proveedores. Tus ${state.points.toLocaleString("es")} puntos quedan congelados hasta que vuelvas.</p>
          <div class="btn-stack">
            <button class="btn btn--danger" data-action="confirm-cancel-premium">Sí, cancelar Premium</button>
            <button class="btn btn--ghost" data-action="close-sheet">Seguir siendo Premium</button>
          </div>`);
        break;
      case "confirm-cancel-premium":
        closeSheet();
        state.premium = false;
        state.premiumPlan = null;
        milestone("premium_cancelled");
        toast("Suscripción cancelada");
        go("pasaporte");
        break;

      case "redeem": {
        const rw = PREM.rewards.find((x) => x.id === el.dataset.reward);
        if (!rw) break;
        if (state.points < rw.costo) return toast("No te alcanzan los puntos");
        openSheet(`
          <h2 class="title">${esc(rw.icono)} ${esc(rw.titulo)}</h2>
          <p class="muted" style="margin-bottom:16px">${esc(rw.detalle)}. Cuesta <b>${rw.costo.toLocaleString("es")} puntos</b> y te quedarían ${(state.points - rw.costo).toLocaleString("es")}.</p>
          <div class="btn-stack">
            <button class="btn" data-action="confirm-redeem" data-reward="${rw.id}">Confirmar canje</button>
            <button class="btn btn--ghost" data-action="close-sheet">Ahora no</button>
          </div>`);
        break;
      }
      case "confirm-redeem": {
        const rw = PREM.rewards.find((x) => x.id === el.dataset.reward);
        if (!rw || state.points < rw.costo) { closeSheet(); break; }
        closeSheet();
        milestone("reward_redeemed", { reward: rw.id, costo: rw.costo });
        state._ptsFrom = state.points;
        state.points -= rw.costo;
        state.redemptions.unshift({ titulo: rw.titulo, costo: rw.costo, fecha: "Ahora" });
        buzz();
        toast("Canjeaste: " + rw.titulo);
        go("premium");
        break;
      }

      case "ask-revoke": {
        const g = state.grants.find((x) => x.id === el.dataset.grant);
        if (!g) break;
        openSheet(`
          <h2 class="title">¿Revocar el acceso de ${esc(g.solicitante)}?</h2>
          <p class="muted" style="margin-bottom:16px">Deja de ver los campos que le compartiste. Podés reactivarlo cuando quieras desde esta misma pantalla.</p>
          <div class="btn-stack">
            <button class="btn btn--danger" data-action="confirm-revoke" data-grant="${esc(g.id)}">Sí, revocar acceso</button>
            <button class="btn btn--ghost" data-action="close-sheet">Cancelar</button>
          </div>`);
        break;
      }
      case "confirm-revoke":
        closeSheet();
        buzz();
        toggleGrant(el.dataset.grant);
        break;

      case "close-sheet":
        closeSheet();
        break;

      case "toggle-theme": {
        const actual = document.documentElement.dataset.theme ||
          (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        const proximo = actual === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = proximo;
        try { localStorage.setItem("cl_theme", proximo); } catch (e) {}
        go(state.screen); // re-dibuja el ícono sol/luna
        break;
      }

      /* ---- Micro-feedback post-reserva ---- */
      case "fb-score":
        if (!state._fb) state._fb = { score: 0, tags: [] };
        state._fb.score = Number(el.dataset.v);
        refreshFeedbackSheet();
        break;
      case "fb-tag": {
        if (!state._fb) break;
        const t = el.dataset.t;
        const i = state._fb.tags.indexOf(t);
        if (i >= 0) state._fb.tags.splice(i, 1);
        else state._fb.tags.push(t);
        refreshFeedbackSheet();
        break;
      }
      case "fb-send": {
        const fb = state._fb || {};
        if (!fb.score) break;
        state.feedbackGiven = true;
        if (window.CLTrack && window.CLTrack.feedback) window.CLTrack.feedback(fb.score, "reserva", fb.tags);
        closeSheet();
        buzz();
        toast("¡Gracias por tu opinión! 💙");
        break;
      }

    }
  }

  function addReceipt(r) {
    r.fecha = "Ahora";
    state.receipts.unshift(r);
  }

  function toggleGrant(id) {
    const g = state.grants.find((x) => x.id === id);
    if (!g) return;
    g.activo = !g.activo;
    if (!g.activo) g.duracion = "Revocado hace instantes";
    milestone(g.activo ? "grant_reactivated" : "grant_revoked", { grant: g.id });
    toast(g.activo ? "Acceso reactivado" : "Acceso revocado");
    go("permisos");
  }

  /* ---- Login con ContextLayer: autorizar el consentimiento ---- */
  function grantSso() {
    const a = currentApp();
    if (!a) return;
    const granted = state.ssoDraft ? state.ssoDraft.granted : {};
    const keys = a.fields.filter((k) => granted[k]);
    if (!keys.length) return toast("Elegí al menos un campo para continuar");

    // Crea/actualiza el permiso de la app y deja recibo.
    state.grants = state.grants.filter((g) => g.id !== "grant-sso-" + a.id);
    state.grants.push({
      id: "grant-sso-" + a.id,
      solicitante: a.nombre,
      appId: a.id,
      icono: a.icono,
      fields: keys,
      proposito: a.proposito,
      duracion: a.duracion,
      activo: true,
    });
    addReceipt({
      tipo: "read",
      solicitante: a.nombre,
      appId: a.id,
      icono: a.icono,
      detalle: "Iniciaste sesión con ContextLayer",
      fields: keys,
    });
    state.appLogged[a.id] = true;
    state.ssoDraft = null;
    milestone("sso_granted", { app: a.id, fields_count: keys.length, fields: keys });
    buzz();
    toast("Sesión iniciada con ContextLayer ✓");
    go("thirdApp");
  }

  /* ---- Dictado por voz (Web Speech API, con fallback) ---- */
  function startVoice(btn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const input = document.getElementById("chat-input");
    if (!SR) {
      toast("Tu navegador no soporta voz. Escribí el mensaje 🙂");
      if (input) input.focus();
      return;
    }
    if (state._recognizing && state._recog) {
      try { state._recog.stop(); } catch (e) {}
      return;
    }
    const recog = new SR();
    recog.lang = "es-AR";
    recog.interimResults = true;
    recog.continuous = false;
    state._recog = recog;
    state._recognizing = true;
    if (btn) btn.classList.add("is-listening");
    let finalText = "";
    recog.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const tr = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += tr;
        else interim += tr;
      }
      if (input) input.value = (finalText + interim).trim();
    };
    const stop = () => {
      state._recognizing = false;
      const b = document.querySelector(".mic-btn");
      if (b) b.classList.remove("is-listening");
    };
    recog.onerror = () => { stop(); track("voice_error"); toast("No se pudo activar el micrófono"); };
    recog.onend = () => {
      stop();
      const val = input ? input.value.trim() : "";
      if (val) chatSend(val, "voice");
    };
    try { recog.start(); } catch (e) { stop(); }
  }

  /* ---------- Tabbar ---------- */
  tabbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tabbar__btn");
    if (btn) go(btn.dataset.nav);
  });



  /* ---------- Modo preview (iframes del dashboard /admin) ---------- */
  // /mvp/?preview=<pantalla>[&app=<appId>][&type=stay|tour] renderiza esa
  // pantalla con datos demo, congelada (sin timers ni tracking), y le avisa
  // al padre las dimensiones para superponer heatmaps y el replay.
  function applyPreviewFixtures(scr, app, type) {
    if (type === "stay" || type === "tour") state.searchType = type;
    if (scr === "thirdApp" || scr === "sso") {
      state.currentAppId = appById(app) ? app : "app-airbnb";
      if (scr === "sso") state.ssoDraft = null;
    }
    if (scr === "reservaOk") state.selectedOptionId = "opt-1";
    if (scr === "editDom") state._editDomId = "preferencias";
    if (scr === "onboarding") state.onboardingStep = 1;
    if (scr === "chatload") {
      state.guideStep = 2;
      state.chatDone = false;
      state.guidedComplete = false;
      state.chat = [
        { role: "agent", text: "¡Hola! Soy tu agente. Te hago unas preguntas rápidas para armar tu contexto." },
        { role: "agent", text: GUIDE[0].q },
        { role: "user", text: "Valentina" },
        { role: "agent", text: GUIDE[1].q },
      ];
    }
  }

  function postPreviewReady() {
    requestAnimationFrame(() => {
      try {
        parent.postMessage({
          cl: "preview-ready",
          screen: state.screen,
          docH: screenEl.scrollHeight,
          screenTop: screenEl.getBoundingClientRect().top + window.scrollY,
          deviceW: document.querySelector(".device").clientWidth,
          docTotal: document.documentElement.scrollHeight,
        }, "*");
      } catch (e) {}
    });
  }

  function bootPreview(scr, qs) {
    state._preview = true;
    document.body.classList.add("preview-mode");
    loadDemoUser();
    state.onboarded = true;
    applyPreviewFixtures(scr, qs.get("app"), qs.get("type"));
    state.screen = screens[scr] ? scr : "pasaporte";
    render();
    postPreviewReady();
    window.addEventListener("message", (e) => {
      const d = e.data || {};
      if (d.cl === "preview-go" && screens[d.screen]) {
        applyPreviewFixtures(d.screen, d.app, d.type);
        state.screen = d.screen;
        render();
        postPreviewReady();
      }
    });
  }

  /* ---------- Arranque ---------- */
  (function boot() {
    // Íconos SVG de la tabbar (reemplazan los emojis del HTML estático).
    const TAB_ICONS = { pasaporte: "idcard", reservas: "bell", actividad: "receipt", permisos: "lock" };
    tabbar.querySelectorAll(".tabbar__btn").forEach((b) => {
      const ic = b.querySelector(".tabbar__ico");
      if (ic && window.icon) ic.innerHTML = icon(TAB_ICONS[b.dataset.nav] || "sparkles");
    });

    const qs = new URLSearchParams(location.search);
    const previewScreen = qs.get("preview");
    if (previewScreen) return bootPreview(previewScreen, qs);
    if (qs.get("reset") === "1") {
      // Limpieza entre testers: /mvp/?reset=1
      clearSavedState();
      qs.delete("reset");
      const q = qs.toString();
      history.replaceState(null, "", location.pathname + (q ? "?" + q : "") + location.hash);
    } else {
      loadState();
    }
    history.scrollRestoration = "manual";
    const inicial = resolveRoute(location.hash);
    state.screen = inicial;
    history.replaceState({ idx: 0 }, "", routeFor(inicial));
    scrollMem[0] = { route: routeFor(inicial), top: 0 };
    render();
    document.dispatchEvent(new CustomEvent("cl:nav", {
      detail: { screen: inicial, prev: null, dir: "none" },
    }));
  })();
})();
