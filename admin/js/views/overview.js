/* ============================================================================
 * ContextLayer · Admin — vistas/overview.js (#/overview)
 * KPIs generales + sesiones por día + top pantallas por tiempo + dispositivos.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).overview = {
    title: "Resumen",
    icon: "📊",

    render(el, ctx) {
      const k = Agg.kpis(ctx.sessions, ctx.events, ctx.feedback);
      const serie = Agg.sessionsPerDay(ctx.sessions, ctx.range);
      const tiempo = Agg.screenTime(ctx.events).slice(0, 8);
      const devices = Agg.deviceSplit(ctx.sessions);

      const kpi = (val, label, hint) => `
        <div class="card kpi" title="${esc(hint || label)}">
          <div class="kpi__val">${esc(val)}</div>
          <div class="kpi__label">${esc(label)}</div>
          ${hint ? `<div class="kpi__hint">${esc(hint)}</div>` : ""}
        </div>`;

      const pct = (v) => (v == null ? "—" : v.toFixed(0) + "%");

      el.innerHTML = `
        <div class="grid grid--kpis" style="margin-bottom:14px">
          ${kpi(k.sessions, "Sesiones", "En el rango elegido")}
          ${kpi(k.devices, "Dispositivos únicos", "device_id distintos")}
          ${kpi(k.avgDur, "Duración media", "max(ts) − min(ts) por sesión")}
          ${kpi(k.screensPerSession.toFixed(1), "Pantallas / sesión", "screen_view promedio")}
          ${kpi(pct(k.bouncePct), "Rebote", "Sesiones con ≤1 pantalla vista")}
          ${kpi(k.bookings, "Reservas confirmadas", "milestone booking_confirmed")}
          ${kpi(pct(k.onbPct), "Onboarding completado", k.onbStarted ? k.onbCompleted + " de " + k.onbStarted + " que lo iniciaron" : "Nadie lo inició en el rango")}
          ${kpi(k.feedbackAvg != null ? k.feedbackAvg.toFixed(1) + " ★" : "—", "Feedback promedio", k.feedbackN + (k.feedbackN === 1 ? " respuesta" : " respuestas"))}
        </div>

        <div class="grid grid--2">
          <div class="card card--span">
            <div class="card__title">Sesiones por día</div>
            ${Charts.line(serie)}
          </div>
          <div class="card">
            <div class="card__title">Top pantallas por tiempo total</div>
            ${Charts.barsH(
              tiempo.map((t) => ({
                label: t.screen,
                value: t.totalMs,
                display: t.label,
                hint: t.screen + ": " + t.label + " acumulados en " + t.sessions + (t.sessions === 1 ? " sesión" : " sesiones"),
              }))
            )}
            <div class="muted" style="margin-top:8px">Tiempo acumulado en pantalla (según screen_view.prev_ms).</div>
          </div>
          <div class="card">
            <div class="card__title">Dispositivos</div>
            ${Charts.donut(devices, { size: 150 })}
          </div>
        </div>`;
    },
  };
})();
