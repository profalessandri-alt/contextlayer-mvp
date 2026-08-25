/* ============================================================================
 * ContextLayer · Admin — vistas/feedback.js (#/feedback)
 * Distribución de scores 1-5, promedio, tags más elegidos y listado por fecha.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" }) + " " +
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).feedback = {
    title: "Feedback",
    icon: "⭐",

    render(el, ctx) {
      const s = Agg.feedbackStats(ctx.feedback);
      const COLORS = ["#ff6b7d", "#e8b93e", "#e8b93e", "#23c3a4", "#23c3a4"];

      const bars = Charts.barsV(
        s.dist.map((n, i) => ({ label: (i + 1) + "★", value: n, color: COLORS[i], hint: (i + 1) + " estrellas: " + n })),
        { h: 170 }
      );

      const list = ctx.feedback
        .slice()
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .map((f) => `
          <tr>
            <td class="nowrap">${fmtDate(f.created_at)}</td>
            <td class="nowrap"><b style="color:${COLORS[(f.score || 1) - 1]}">${"★".repeat(f.score || 0)}</b><span class="muted">${"★".repeat(5 - (f.score || 0))}</span></td>
            <td>${esc(f.context || "—")}</td>
            <td>${(f.tags || []).map((t) => `<span class="chip">${esc(t)}</span>`).join(" ")}</td>
            <td class="muted" title="${esc(f.session_id || "")}">${esc(String(f.session_id || "").slice(0, 6))}</td>
          </tr>`).join("");

      el.innerHTML = `
        <div class="grid grid--3" style="margin-bottom:14px">
          <div class="card kpi">
            <div class="kpi__val">${s.avg != null ? s.avg.toFixed(1) + " ★" : "—"}</div>
            <div class="kpi__label">Score promedio</div>
            <div class="kpi__hint">${s.n} ${s.n === 1 ? "respuesta" : "respuestas"} en el rango</div>
          </div>
          <div class="card">
            <div class="card__title">Distribución de scores</div>
            ${bars}
          </div>
          <div class="card">
            <div class="card__title">Tags más elegidos</div>
            ${s.tags.length ? Charts.barsH(s.tags.slice(0, 8), { multi: true }) : '<div class="empty"><span class="empty__ico">🏷️</span>Sin tags.</div>'}
          </div>
        </div>
        <div class="card scroll-x">
          <div class="card__title">Respuestas</div>
          ${ctx.feedback.length ? `<table class="tbl">
            <thead><tr><th>Fecha</th><th>Score</th><th>Contexto</th><th>Tags</th><th>Sesión</th></tr></thead>
            <tbody>${list}</tbody></table>`
            : '<div class="empty"><span class="empty__ico">⭐</span>Sin feedback en este rango.</div>'}
        </div>`;
    },
  };
})();
