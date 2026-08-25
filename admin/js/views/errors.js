/* ============================================================================
 * ContextLayer · Admin — vistas/errors.js (#/errors)
 * error_js agrupados por mensaje: conteo, pantallas afectadas y última vez.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  const ago = (ts) => {
    if (!ts) return "—";
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "recién";
    if (m < 60) return "hace " + m + " min";
    const h = Math.floor(m / 60);
    if (h < 24) return "hace " + h + " h";
    return "hace " + Math.floor(h / 24) + " d";
  };

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).errors = {
    title: "Errores",
    icon: "💥",

    render(el, ctx) {
      const errs = Agg.errorsGrouped(ctx.events);
      const voice = ctx.events.filter((e) => e.type === "voice_error").length;

      const rows = errs.map((er) => `
        <tr>
          <td style="max-width:420px"><b class="dim" style="overflow-wrap:anywhere">${esc(er.msg)}</b>
            ${er.src ? `<div class="muted">${esc(er.src)}${er.line ? ":" + er.line : ""}</div>` : ""}</td>
          <td class="num"><b>${er.count}</b></td>
          <td class="num">${er.sessions}</td>
          <td>${er.screens.length ? er.screens.map((s) => `<span class="chip">${esc(s)}</span>`).join(" ") : '<span class="muted">—</span>'}</td>
          <td class="nowrap muted" title="${new Date(er.last).toLocaleString("es-AR")}">${ago(er.last)}</td>
        </tr>`).join("");

      el.innerHTML = `
        <div class="grid grid--kpis" style="margin-bottom:14px;grid-template-columns:repeat(auto-fit,minmax(180px,220px))">
          <div class="card kpi">
            <div class="kpi__val" style="${errs.length ? "-webkit-text-fill-color:#ff6b7d" : ""}">${errs.reduce((a, e) => a + e.count, 0)}</div>
            <div class="kpi__label">Errores de JS</div>
            <div class="kpi__hint">${errs.length} ${errs.length === 1 ? "mensaje distinto" : "mensajes distintos"}</div>
          </div>
          <div class="card kpi">
            <div class="kpi__val">${voice}</div>
            <div class="kpi__label">Errores de voz</div>
            <div class="kpi__hint">Micrófono / SpeechRecognition</div>
          </div>
        </div>
        <div class="card scroll-x">
          ${errs.length ? `<table class="tbl">
            <thead><tr><th>Mensaje</th><th class="num">Veces</th><th class="num">Sesiones</th><th>Pantallas</th><th>Última vez</th></tr></thead>
            <tbody>${rows}</tbody></table>`
            : '<div class="empty"><span class="empty__ico">🎉</span>Sin errores de JS en este rango. Así da gusto.</div>'}
        </div>`;
    },
  };
})();
