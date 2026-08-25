/* ============================================================================
 * ContextLayer · Admin — vistas/flows.js (#/flows)
 * Matriz origen → destino de navegación (screen_view.prev → screen) como
 * tabla-heatmap + los 10 caminos de 2 pasos más comunes.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).flows = {
    title: "Flujos",
    icon: "🔀",

    render(el, ctx) {
      const m = Agg.flowsMatrix(ctx.events);
      const top = m.topPaths.map((pt, i) => `
        <tr>
          <td class="num muted">${i + 1}</td>
          <td><b>${esc(pt.from)}</b> <span class="muted">→</span> <b>${esc(pt.to)}</b></td>
          <td class="num"><b>${pt.n}</b></td>
        </tr>`).join("");

      el.innerHTML = `
        <div class="card" style="margin-bottom:14px">
          <div class="card__title">Matriz de navegación · origen (filas) → destino (columnas)</div>
          <div class="muted" style="margin-bottom:12px">Cada celda cuenta transiciones de pantalla. Σ = totales por fila/columna. Más color = más volumen.</div>
          ${Charts.tableHeat(m)}
        </div>
        <div class="card">
          <div class="card__title">Top 10 caminos de 2 pasos</div>
          ${m.topPaths.length ? `<table class="tbl"><thead><tr><th class="num">#</th><th>Camino</th><th class="num">Veces</th></tr></thead><tbody>${top}</tbody></table>`
            : '<div class="empty"><span class="empty__ico">🔀</span>Sin navegación registrada.</div>'}
        </div>`;
    },
  };
})();
