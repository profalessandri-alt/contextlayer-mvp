/* ============================================================================
 * ContextLayer · Admin — vistas/scroll.js (#/scroll)
 * Distribución de profundidad de scroll (25/50/75/100) por pantalla, con
 * % de sesiones que llegaron al fondo.
 * ==========================================================================*/

(function () {
  "use strict";

  const COLORS = { 25: "#ff6b7d", 50: "#e8b93e", 75: "#5566ff", 100: "#23c3a4" };

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).scroll = {
    title: "Scroll",
    icon: "📜",

    render(el, ctx) {
      const data = Agg.scrollDepth(ctx.events);

      const rows = data.map((d) => ({
        label: d.screen,
        segs: [
          { value: d.b25, color: COLORS[25], hint: d.screen + " · llegó al 25%: " + d.b25 },
          { value: d.b50, color: COLORS[50], hint: d.screen + " · llegó al 50%: " + d.b50 },
          { value: d.b75, color: COLORS[75], hint: d.screen + " · llegó al 75%: " + d.b75 },
          { value: d.b100, color: COLORS[100], hint: d.screen + " · llegó al fondo: " + d.b100 },
        ],
        right: d.bottomPct.toFixed(0) + "% al fondo",
      }));

      const legend = [25, 50, 75, 100].map((b) =>
        `<span class="legend__it"><span class="legend__sw" style="background:${COLORS[b]}"></span>máx. ${b}%</span>`
      ).join("");

      el.innerHTML = `
        <div class="card">
          <div class="card__title">Profundidad máxima por pantalla</div>
          <div class="muted" style="margin-bottom:12px">Cada sesión emite un scroll_depth con su profundidad máxima al salir de la pantalla. Solo pantallas con contenido scrolleable.</div>
          ${Charts.stackH(rows)}
          ${data.length ? `<div class="legend">${legend}</div>` : ""}
        </div>
        ${data.length ? `<div class="card" style="margin-top:14px">
          <div class="card__title">% que llegó al fondo</div>
          ${Charts.barsH(data.map((d) => ({
            label: d.screen,
            value: d.bottomPct,
            display: d.bottomPct.toFixed(0) + "%",
            hint: d.screen + ": " + d.b100 + " de " + d.total + " llegaron al 100%",
          })), { max: 100 })}
        </div>` : ""}`;
    },
  };
})();
