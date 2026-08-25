/* ============================================================================
 * ContextLayer · Admin — agg.js
 * Agregaciones client-side puras: reciben arrays (sessions/events/feedback)
 * ya filtrados por rango y segmento, y devuelven estructuras listas para
 * graficar. Idénticas para los 3 modos (remoto / local / demo).
 * ==========================================================================*/

(function () {
  "use strict";

  const SCREENS = [
    "splash", "onboarding", "chatload", "onboardingDone", "pasaporte", "contexto",
    "editDom", "premium", "permisos", "actividad", "reservas", "agente",
    "thinking", "resultados", "thirdApp", "sso", "reservaOk",
  ];

  /* ---------- Utilidades ---------- */
  const p = (e) => e.props || {};

  function bySession(events) {
    const m = new Map();
    events.forEach((e) => {
      let a = m.get(e.session_id);
      if (!a) { a = []; m.set(e.session_id, a); }
      a.push(e);
    });
    m.forEach((a) => a.sort((x, y) => x.ts - y.ts || x.seq - y.seq));
    return m;
  }

  const isMile = (e, name) => e.type === "milestone" && p(e).name === name;

  // NOTA de semántica del tracker: track.js registra el screen_view ANTES de
  // actualizar la pantalla actual, así que en un screen_view tanto `screen`
  // como `props.prev` son la pantalla que se DEJA. El destino se reconstruye
  // mirando los eventos siguientes (que ya llevan la pantalla nueva).
  function svDest(evts, i) {
    for (let j = i + 1; j < evts.length; j++) {
      if (evts[j].type === "screen_view") return p(evts[j]).prev || null;
      if (evts[j].screen) return evts[j].screen;
    }
    return null;
  }

  function fmtDur(ms) {
    if (ms == null || !isFinite(ms)) return "—";
    const s = Math.round(ms / 1000);
    if (s < 60) return s + " s";
    const m = Math.floor(s / 60);
    if (m < 60) return m + " min " + (s % 60) + " s";
    return Math.floor(m / 60) + " h " + (m % 60) + " min";
  }

  const dayKey = (iso) => {
    const d = new Date(iso);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  /* ---------- KPIs del resumen ---------- */
  function kpis(sessions, events, feedback) {
    const map = bySession(events);
    let durSum = 0, durN = 0, svSum = 0, bounces = 0;
    map.forEach((evts) => {
      const dur = evts[evts.length - 1].ts - evts[0].ts;
      if (dur >= 0) { durSum += dur; durN++; }
      const sv = evts.filter((e) => e.type === "screen_view").length;
      svSum += sv;
      if (sv <= 1) bounces++;
    });
    const nSes = map.size || sessions.length;
    const started = new Set(), completed = new Set();
    events.forEach((e) => {
      if (isMile(e, "onboarding_start")) started.add(e.session_id);
      if (isMile(e, "onboarding_complete")) completed.add(e.session_id);
    });
    const fbAvg = feedback.length
      ? feedback.reduce((a, f) => a + (f.score || 0), 0) / feedback.length
      : null;
    return {
      sessions: sessions.length,
      devices: new Set(sessions.map((s) => s.device_id)).size,
      avgDurMs: durN ? durSum / durN : null,
      avgDur: fmtDur(durN ? durSum / durN : null),
      screensPerSession: nSes ? svSum / nSes : 0,
      bouncePct: nSes ? (bounces / nSes) * 100 : 0,
      bookings: events.filter((e) => isMile(e, "booking_confirmed")).length,
      onbStarted: started.size,
      onbCompleted: completed.size,
      onbPct: started.size ? (completed.size / started.size) * 100 : null,
      feedbackAvg: fbAvg,
      feedbackN: feedback.length,
    };
  }

  /* ---------- Serie: sesiones por día ---------- */
  function sessionsPerDay(sessions, rangeKey) {
    const counts = {};
    sessions.forEach((s) => { const k = dayKey(s.started_at); counts[k] = (counts[k] || 0) + 1; });
    // Eje continuo: desde el primer día con datos (o el inicio del rango) hasta hoy.
    const keys = Object.keys(counts).sort();
    if (!keys.length) return [];
    const days = rangeKey === "today" ? 1 : rangeKey === "7d" ? 7 : rangeKey === "30d" ? 30 : null;
    let start = new Date(keys[0] + "T00:00:00");
    if (days) {
      const alt = new Date(); alt.setHours(0, 0, 0, 0); alt.setDate(alt.getDate() - days + 1);
      if (alt < start) start = alt;
    }
    const out = [];
    const end = new Date(); end.setHours(0, 0, 0, 0);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d.toISOString());
      out.push({ t: new Date(d), label: k.slice(5), v: counts[k] || 0 });
    }
    return out;
  }

  /* ---------- Tiempo total por pantalla ---------- */
  // Usa screen_view.prev_ms: el tiempo se atribuye a la pantalla anterior.
  function screenTime(events) {
    const tot = {}, ses = {};
    events.forEach((e) => {
      if (e.type !== "screen_view") return;
      const prev = p(e).prev, ms = p(e).prev_ms;
      if (!prev || ms == null || ms < 0 || ms > 30 * 60e3) return;
      tot[prev] = (tot[prev] || 0) + ms;
      (ses[prev] = ses[prev] || new Set()).add(e.session_id);
    });
    return Object.keys(tot)
      .map((s) => ({ screen: s, totalMs: tot[s], sessions: ses[s].size, label: fmtDur(tot[s]) }))
      .sort((a, b) => b.totalMs - a.totalMs);
  }

  /* ---------- Donut device_type ---------- */
  function deviceSplit(sessions) {
    const c = { mobile: 0, tablet: 0, desktop: 0 };
    sessions.forEach((s) => { c[s.device_type] = (c[s.device_type] || 0) + 1; });
    return [
      { label: "Mobile", value: c.mobile },
      { label: "Tablet", value: c.tablet },
      { label: "Desktop", value: c.desktop },
    ].filter((x) => x.value > 0);
  }

  /* ---------- Funnels declarativos ---------- */
  // steps: [{ label, test(e) }] — cuenta SESIONES que cumplen cada paso.
  // Cada paso se cuenta de forma independiente (el camino demo saltea el
  // onboarding y aun así reserva); el drop-off se mide entre pasos contiguos.
  function funnel(sessions, events, steps) {
    const map = bySession(events);
    const ids = new Set(sessions.map((s) => s.id));
    map.forEach((_, id) => ids.add(id)); // sesiones con eventos pero sin fila
    const out = [];
    steps.forEach((st, i) => {
      let n;
      if (!st.test) {
        n = ids.size;
      } else {
        n = 0;
        ids.forEach((id) => {
          const evts = map.get(id) || [];
          if (evts.some(st.test)) n++;
        });
      }
      const prevN = i === 0 ? n : out[i - 1].n;
      out.push({
        label: st.label,
        n,
        pctOfFirst: out.length && out[0].n ? (n / out[0].n) * 100 : 100,
        dropPct: i === 0 ? null : prevN ? ((prevN - n) / prevN) * 100 : null,
      });
    });
    return out;
  }

  const FUNNEL_MAIN = [
    { label: "Sesión iniciada", test: null },
    { label: "Onboarding iniciado", test: (e) => isMile(e, "onboarding_start") },
    { label: "Onboarding completo", test: (e) => isMile(e, "onboarding_complete") },
    { label: "Búsqueda con Aria", test: (e) => isMile(e, "search_run") },
    { label: "Vio resultados", test: (e) => isMile(e, "results_shown") },
    { label: "Abrió una opción", test: (e) => isMile(e, "option_open") },
    { label: "Autorizó el SSO", test: (e) => isMile(e, "sso_granted") },
    { label: "Reserva confirmada", test: (e) => isMile(e, "booking_confirmed") },
  ];

  // "Vio premium": cualquier evento con screen=premium cubre tanto salir de
  // la pantalla (screen_view) como clicks/scroll estando en ella (ver svDest).
  const FUNNEL_PREMIUM = [
    { label: "Sesión iniciada", test: null },
    { label: "Vio Premium", test: (e) => e.screen === "premium" || (e.type === "scroll_depth" && p(e).for === "premium") },
    { label: "Se suscribió", test: (e) => isMile(e, "premium_subscribed") },
  ];

  // Sub-funnel de onboarding filtrado por modo (chat|form).
  function funnelOnboarding(sessions, events, mode) {
    return funnel(sessions, events, [
      { label: "Inició (" + mode + ")", test: (e) => isMile(e, "onboarding_start") && p(e).mode === mode },
      { label: "Completó", test: (e) => isMile(e, "onboarding_complete") && p(e).mode === mode },
      { label: "Buscó con Aria", test: (e) => isMile(e, "search_run") },
      { label: "Reservó", test: (e) => isMile(e, "booking_confirmed") },
    ]);
  }

  /* ---------- Matriz de flujos (origen → destino) ---------- */
  // Reconstruye las transiciones por sesión: cada screen_view deja una
  // pantalla (props.prev) y el destino sale de los eventos siguientes.
  function flowsMatrix(events) {
    const cell = {}; // "from→to" → n
    const seen = new Set();
    bySession(events).forEach((evts) => {
      evts.forEach((e, i) => {
        if (e.type !== "screen_view") return;
        const from = p(e).prev || "(inicio)";
        const to = svDest(evts, i);
        if (!to) return;
        seen.add(from); seen.add(to);
        const k = from + "→" + to;
        cell[k] = (cell[k] || 0) + 1;
      });
    });
    // Orden estable: (inicio) primero, después el orden natural del MVP.
    const order = ["(inicio)"].concat(SCREENS);
    const names = Array.from(seen).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const rows = names.filter((n) => Object.keys(cell).some((k) => k.startsWith(n + "→")));
    const cols = names.filter((n) => n !== "(inicio)" && Object.keys(cell).some((k) => k.endsWith("→" + n)));
    const max = Math.max(1, ...Object.values(cell));
    const paths = Object.keys(cell)
      .map((k) => ({ from: k.split("→")[0], to: k.split("→")[1], n: cell[k] }))
      .sort((a, b) => b.n - a.n);
    return {
      rows, cols, max,
      get: (r, c) => cell[r + "→" + c] || 0,
      rowTotal: (r) => paths.filter((x) => x.from === r).reduce((a, x) => a + x.n, 0),
      colTotal: (c) => paths.filter((x) => x.to === c).reduce((a, x) => a + x.n, 0),
      topPaths: paths.slice(0, 10),
    };
  }

  /* ---------- Heatmap: puntos por pantalla ---------- */
  // kind: 'click' | 'rage_click' | 'dead_click'
  function heatPoints(events, screen, kind) {
    const pts = [], sess = new Set();
    let offTabbar = 0, offDevice = 0;
    events.forEach((e) => {
      if (e.type !== kind || e.screen !== screen) return;
      const region = p(e).region || (e.y == null ? "device" : "screen");
      if (region === "tabbar") { offTabbar++; return; }
      if (region === "device") { offDevice++; return; }
      if (e.x == null || e.y == null) return;
      pts.push({ x: e.x, y: e.y });
      sess.add(e.session_id);
    });
    return { points: pts, sessions: sess.size, offTabbar, offDevice };
  }

  // Pantallas que tienen al menos un click con coordenadas.
  function screensWithClicks(events) {
    const c = {};
    events.forEach((e) => {
      if (e.type === "click" && e.screen && p(e).region === "screen") c[e.screen] = (c[e.screen] || 0) + 1;
    });
    return c;
  }

  /* ---------- Ranking de elementos tocados ---------- */
  function elementsRanking(events, screen) {
    const map = {};
    let totalClicks = 0;
    const badSel = { dead: new Set(), rage: new Set() };
    events.forEach((e) => {
      if (screen && e.screen !== screen) return;
      if (e.type === "dead_click") { badSel.dead.add((e.screen || "") + "|" + (p(e).sel || "")); return; }
      if (e.type === "rage_click") { badSel.rage.add((e.screen || "") + "|" + (p(e).sel || "")); return; }
      if (e.type !== "click") return;
      totalClicks++;
      const pr = p(e);
      const id = pr.action ? "action: " + pr.action
        : pr.go ? "go: " + pr.go
        : pr.nav ? "nav: " + pr.nav
        : pr.sel || "(sin selector)";
      const k = (e.screen || "?") + "|" + id;
      let it = map[k];
      if (!it) {
        it = map[k] = { screen: e.screen || "?", id, sel: pr.sel || null, label: pr.label || null, clicks: 0, sessions: new Set(), interactive: !!pr.interactive };
      }
      it.clicks++;
      it.sessions.add(e.session_id);
      if (pr.label && !it.label) it.label = pr.label;
    });
    return Object.values(map)
      .map((it) => ({
        screen: it.screen, id: it.id, sel: it.sel, label: it.label,
        clicks: it.clicks,
        sessions: it.sessions.size,
        pct: totalClicks ? (it.clicks / totalClicks) * 100 : 0,
        interactive: it.interactive,
        dead: badSel.dead.has(it.screen + "|" + (it.sel || "")),
        rage: badSel.rage.has(it.screen + "|" + (it.sel || "")),
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  /* ---------- Scroll depth por pantalla ---------- */
  function scrollDepth(events) {
    const per = {}; // screen → {25,50,75,100, sessions:Set}
    events.forEach((e) => {
      if (e.type !== "scroll_depth") return;
      const scr = p(e).for || e.screen;
      if (!scr) return;
      const b = per[scr] || (per[scr] = { 25: 0, 50: 0, 75: 0, 100: 0, total: 0 });
      const pct = p(e).max_pct;
      if (b[pct] == null) return;
      b[pct]++;
      b.total++;
    });
    return Object.keys(per)
      .map((scr) => {
        const b = per[scr];
        return { screen: scr, b25: b[25], b50: b[50], b75: b[75], b100: b[100], total: b.total, bottomPct: b.total ? (b[100] / b.total) * 100 : 0 };
      })
      .sort((a, b) => b.total - a.total);
  }

  /* ---------- Features / adopción ---------- */
  function features(sessions, events) {
    const map = bySession(events);
    const nSes = Math.max(map.size, sessions.length, 1);
    const count = (fn) => events.filter(fn).length;
    const group = (fn, keyFn) => {
      const g = {};
      events.forEach((e) => { if (fn(e)) { const k = keyFn(e); if (k != null) g[k] = (g[k] || 0) + 1; } });
      return Object.keys(g).map((k) => ({ label: k, value: g[k] })).sort((a, b) => b.value - a.value);
    };
    const sesWith = (fn) => {
      let n = 0;
      map.forEach((evts) => { if (evts.some(fn)) n++; });
      return n;
    };
    return {
      onboardingMode: [
        { label: "Chat", value: sesWith((e) => isMile(e, "onboarding_start") && p(e).mode === "chat") },
        { label: "Formulario", value: sesWith((e) => isMile(e, "onboarding_start") && p(e).mode === "form") },
        { label: "Demo directo", value: sesWith((e) => isMile(e, "demo_loaded")) },
      ].filter((x) => x.value > 0),
      voicePct: (sesWith((e) => e.type === "chat_msg" && p(e).source === "voice") / nSes) * 100,
      voiceSessions: sesWith((e) => e.type === "chat_msg" && p(e).source === "voice"),
      voiceErrors: count((e) => e.type === "voice_error"),
      skipsByStep: group((e) => e.type === "chat_msg" && p(e).source === "skip", (e) => p(e).step_key),
      chatBySource: group((e) => e.type === "chat_msg", (e) => p(e).source),
      searchByType: [
        { label: "Alojamiento (stay)", value: count((e) => isMile(e, "search_run") && p(e).type === "stay") },
        { label: "Experiencia (tour)", value: count((e) => isMile(e, "search_run") && p(e).type === "tour") },
      ],
      ssoByApp: group((e) => isMile(e, "sso_granted"), (e) => p(e).app),
      premiumByPlan: group((e) => isMile(e, "premium_subscribed"), (e) => p(e).plan),
      premiumCancelled: count((e) => isMile(e, "premium_cancelled")),
      redeemByReward: group((e) => isMile(e, "reward_redeemed"), (e) => p(e).reward),
      formChangeByKey: group((e) => e.type === "form_change", (e) => p(e).key),
      grantsRevoked: count((e) => isMile(e, "grant_revoked")),
      grantsReactivated: count((e) => isMile(e, "grant_reactivated")),
      appLogouts: count((e) => isMile(e, "app_logout")),
    };
  }

  /* ---------- Feedback ---------- */
  function feedbackStats(feedback) {
    const dist = [0, 0, 0, 0, 0];
    const tags = {};
    feedback.forEach((f) => {
      if (f.score >= 1 && f.score <= 5) dist[f.score - 1]++;
      (f.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; });
    });
    return {
      dist,
      avg: feedback.length ? feedback.reduce((a, f) => a + (f.score || 0), 0) / feedback.length : null,
      n: feedback.length,
      tags: Object.keys(tags).map((t) => ({ label: t, value: tags[t] })).sort((a, b) => b.value - a.value),
    };
  }

  /* ---------- Errores agrupados ---------- */
  function errorsGrouped(events) {
    const g = {};
    events.forEach((e) => {
      if (e.type !== "error_js") return;
      const msg = p(e).msg || "(sin mensaje)";
      const it = g[msg] || (g[msg] = { msg, count: 0, screens: new Set(), sessions: new Set(), last: 0, src: p(e).src, line: p(e).line });
      it.count++;
      if (e.screen) it.screens.add(e.screen);
      it.sessions.add(e.session_id);
      if (e.ts > it.last) it.last = e.ts;
    });
    return Object.values(g)
      .map((it) => ({ msg: it.msg, count: it.count, screens: Array.from(it.screens), sessions: it.sessions.size, last: it.last, src: it.src, line: it.line }))
      .sort((a, b) => b.count - a.count);
  }

  /* ---------- Resumen por sesión (tabla de la vista Sesiones) ---------- */
  function sessionSummaries(sessions, events) {
    const map = bySession(events);
    const rowsById = {};
    sessions.forEach((s) => { rowsById[s.id] = s; });
    const out = [];
    const ids = new Set(sessions.map((s) => s.id));
    map.forEach((_, id) => ids.add(id));
    ids.forEach((id) => {
      const s = rowsById[id] || {};
      const evts = map.get(id) || [];
      out.push({
        id,
        started_at: s.started_at || (evts.length ? new Date(evts[0].ts).toISOString() : null),
        device_type: s.device_type || "?",
        browser: s.browser || "?",
        os: s.os || "",
        events: evts.length,
        screens: evts.filter((e) => e.type === "screen_view").length,
        durMs: evts.length ? evts[evts.length - 1].ts - evts[0].ts : 0,
        dur: fmtDur(evts.length ? evts[evts.length - 1].ts - evts[0].ts : null),
        booked: evts.some((e) => isMile(e, "booking_confirmed")),
        feedback: evts.some((e) => e.type === "feedback"),
        errors: evts.filter((e) => e.type === "error_js").length,
      });
    });
    return out.sort((a, b) => new Date(b.started_at || 0) - new Date(a.started_at || 0));
  }

  window.Agg = {
    SCREENS,
    bySession,
    kpis,
    sessionsPerDay,
    screenTime,
    deviceSplit,
    funnel,
    FUNNEL_MAIN,
    FUNNEL_PREMIUM,
    funnelOnboarding,
    flowsMatrix,
    heatPoints,
    screensWithClicks,
    elementsRanking,
    scrollDepth,
    features,
    feedbackStats,
    errorsGrouped,
    sessionSummaries,
    fmtDur,
    isMile,
    svDest,
  };
})();
