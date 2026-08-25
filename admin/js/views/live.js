/* ============================================================================
 * ContextLayer · Admin — vistas/live.js (#/live)
 * Últimos 100 eventos en orden descendente. En remoto: polling cada 5 s,
 * pausable. En local/demo: refresco manual (no hay nada que pollear).
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  let timer = null;
  let paused = false;

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function describe(e) {
    const p = e.props || {};
    if (e.type === "milestone") return "🏁 " + (p.name || "?") + (p.app ? " · " + p.app : "") + (p.plan ? " · " + p.plan : "") + (p.mode ? " · " + p.mode : "");
    // El screen_view lleva la pantalla que se DEJA (el destino queda en los
    // eventos siguientes): lo decimos tal cual para no mentir en vivo.
    if (e.type === "screen_view") return p.prev ? "navegó (dejó " + p.prev + ")" : "arrancó la sesión";
    if (e.type === "click") return "click " + (p.action || p.go || p.nav || p.sel || "?");
    if (e.type === "error_js") return "💥 " + (p.msg || "error");
    if (e.type === "feedback") return "★" + p.score + (p.context ? " · " + p.context : "");
    if (e.type === "chat_msg") return "chat (" + p.source + ")";
    if (e.type === "scroll_depth") return "scroll " + p.max_pct + "%";
    return e.type;
  }

  async function refresh(el) {
    let evts;
    try {
      evts = await Provider.recent(100);
    } catch (err) {
      const list = el.querySelector("#lv-list");
      if (list) list.innerHTML = `<div class="banner banner--warn">No se pudo actualizar: ${esc(err.message)}</div>`;
      return;
    }
    const now = Date.now();
    const active = new Set(evts.filter((e) => now - e.ts < 5 * 60e3).map((e) => e.session_id));
    const cnt = el.querySelector("#lv-active");
    if (cnt) cnt.textContent = active.size;
    const list = el.querySelector("#lv-list");
    if (!list) return;
    list.innerHTML = evts.length ? evts.map((e) => {
      const d = new Date(e.ts);
      const hh = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const bad = e.type === "error_js" || e.type === "rage_click";
      return `<div class="tline__item ${e.type === "screen_view" ? "is-screen" : e.type === "milestone" ? "is-mile" : bad ? "is-bad" : ""}">
        <span class="tline__t" style="width:62px">${hh}</span>
        <span class="chip" title="${esc(e.session_id)}">${esc(String(e.session_id).slice(0, 6))}</span>
        <span class="tline__txt">${esc(describe(e))}${e.screen && e.type !== "screen_view" ? ' <span class="muted">@ ' + esc(e.screen) + "</span>" : ""}</span>
      </div>`;
    }).join("") : '<div class="empty"><span class="empty__ico">📡</span>Sin eventos todavía.</div>';
    list.scrollTop = 0; // lo más nuevo queda arriba, a la vista
  }

  window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
  window.ADMIN_VIEWS.live = {
    title: "En vivo",
    icon: "📡",

    render(el, ctx) {
      const remote = ctx.mode === "remote";
      el.innerHTML = `
        <div class="heat-controls">
          <span class="live-dot"></span>
          <b>Sesiones activas (últimos 5 min): <span id="lv-active">…</span></b>
          ${remote
            ? `<button class="btn btn--sm" id="lv-pause">${paused ? "▶ Reanudar" : "⏸ Pausar"}</button><span class="muted">Actualiza cada 5 s</span>`
            : `<button class="btn btn--sm btn--primary" id="lv-refresh">↻ Refrescar</button><span class="muted">En modo ${ctx.mode === "demo" ? "demo" : "local"} el refresco es manual</span>`}
        </div>
        <div class="card">
          <div class="card__title">Últimos 100 eventos</div>
          <div class="tline live-list" id="lv-list"><div class="loading">Cargando…</div></div>
        </div>`;

      refresh(el);
      stop();
      if (remote) {
        if (!paused) timer = setInterval(() => refresh(el), 5000);
        el.querySelector("#lv-pause").addEventListener("click", (e) => {
          paused = !paused;
          e.target.textContent = paused ? "▶ Reanudar" : "⏸ Pausar";
          stop();
          if (!paused) timer = setInterval(() => refresh(el), 5000);
        });
      } else {
        el.querySelector("#lv-refresh").addEventListener("click", () => refresh(el));
      }
    },

    destroy() { stop(); },
  };
})();
