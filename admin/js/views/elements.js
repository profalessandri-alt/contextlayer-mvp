/* ============================================================================
 * ContextLayer · Admin — vistas/elements.js (#/elements)
 * Ranking de elementos tocados (action/go/nav/sel + label) con marca de
 * dead/rage clicks. Filtro por pantalla.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;
  const st = { screen: "" }; // "" = todas

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).elements = {
    title: "Elementos",
    icon: "🎯",

    render(el, ctx) {
      const counts = Agg.screensWithClicks(ctx.events);
      const items = Agg.elementsRanking(ctx.events, st.screen || null);
      const maxClicks = Math.max(1, ...items.map((i) => i.clicks));

      const opts = ['<option value="">Todas las pantallas</option>']
        .concat(Agg.SCREENS.map((s) =>
          `<option value="${s}" ${s === st.screen ? "selected" : ""}>${s}${counts[s] ? " (" + counts[s] + ")" : ""}</option>`
        )).join("");

      const rows = items.map((it) => {
        const marks = [
          it.rage ? '<span class="chip chip--bad" title="Hubo rage clicks sobre este elemento">😤 rage</span>' : "",
          it.dead ? '<span class="chip chip--warn" title="Hubo dead clicks sobre este elemento">💀 dead</span>' : "",
          !it.interactive ? '<span class="chip" title="El elemento no es interactivo">no interactivo</span>' : "",
        ].filter(Boolean).join(" ");
        const bar = `<div class="hbar__track" style="max-width:160px"><div class="hbar__fill" style="width:${Math.max(2, (it.clicks / maxClicks) * 100)}%"></div></div>`;
        return `<tr>
          <td class="nowrap dim">${esc(it.screen)}</td>
          <td><b>${esc(it.id)}</b>${it.label ? `<div class="muted">“${esc(it.label)}”</div>` : ""}</td>
          <td>${bar}</td>
          <td class="num"><b>${it.clicks}</b></td>
          <td class="num">${it.sessions}</td>
          <td class="num">${it.pct.toFixed(1)}%</td>
          <td>${marks}</td>
        </tr>`;
      }).join("");

      el.innerHTML = `
        <div class="heat-controls">
          <select id="el-screen" class="sel">${opts}</select>
          <span class="muted">${items.length} ${items.length === 1 ? "elemento" : "elementos"} · % sobre el total de clicks ${st.screen ? "de la pantalla" : "del rango"}</span>
        </div>
        <div class="card scroll-x">
          ${items.length ? `<table class="tbl">
            <thead><tr><th>Pantalla</th><th>Elemento</th><th></th><th class="num">Clicks</th><th class="num">Sesiones</th><th class="num">%</th><th>Señales</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>` : '<div class="empty"><span class="empty__ico">🎯</span>No hay clicks registrados en este rango.</div>'}
        </div>`;

      el.querySelector("#el-screen").addEventListener("change", (e) => {
        st.screen = e.target.value;
        this.render(el, ctx);
      });
    },
  };
})();
