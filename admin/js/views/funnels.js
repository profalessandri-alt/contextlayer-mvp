/* ============================================================================
 * ContextLayer · Admin — vistas/funnels.js (#/funnels)
 * Funnel principal (sesión → … → reserva), funnel premium y split por modo
 * de onboarding (chat vs formulario). Base = sesiones; drop-off entre pasos.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  // Render de un funnel como barras horizontales con % y drop-off.
  function funnelHTML(steps) {
    if (!steps.length || !steps[0].n) {
      return '<div class="empty"><span class="empty__ico">⏳</span>Sin sesiones en este rango.</div>';
    }
    const max = steps[0].n || 1;
    return steps.map((s, i) => {
      const w = Math.max(1.5, (s.n / max) * 100);
      const drop = s.dropPct != null && s.dropPct > 0
        ? `<span class="chip chip--bad" title="Se pierde el ${s.dropPct.toFixed(0)}% respecto del paso anterior">−${s.dropPct.toFixed(0)}%</span>`
        : s.dropPct != null && s.dropPct < 0
          ? `<span class="chip chip--brand" title="Más sesiones que el paso anterior: hay caminos que lo saltean (ej. demo sin onboarding)">+${Math.abs(s.dropPct).toFixed(0)}%</span>`
          : (i > 0 ? '<span class="chip chip--ok">sin pérdida</span>' : "");
      return `<div class="hbar" style="grid-template-columns:minmax(120px,210px) 1fr 150px" title="${esc(s.label)}: ${s.n} sesiones (${s.pctOfFirst.toFixed(0)}% del inicio)">
        <div class="hbar__label">${i + 1}. ${esc(s.label)}</div>
        <div class="hbar__track" style="height:22px"><div class="hbar__fill" style="width:${w}%"></div></div>
        <div class="hbar__val" style="text-align:left"><b>${s.n}</b> <span class="muted">(${s.pctOfFirst.toFixed(0)}%)</span> ${drop}</div>
      </div>`;
    }).join("");
  }

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).funnels = {
    title: "Funnels",
    icon: "⏳",

    render(el, ctx) {
      const main = Agg.funnel(ctx.sessions, ctx.events, Agg.FUNNEL_MAIN);
      const prem = Agg.funnel(ctx.sessions, ctx.events, Agg.FUNNEL_PREMIUM);
      const chat = Agg.funnelOnboarding(ctx.sessions, ctx.events, "chat");
      const form = Agg.funnelOnboarding(ctx.sessions, ctx.events, "form");

      el.innerHTML = `
        <div class="card" style="margin-bottom:14px">
          <div class="card__title">Funnel principal · de la sesión a la reserva</div>
          <div class="muted" style="margin-bottom:12px">Cada paso cuenta sesiones con ese hito; si un paso supera al anterior es porque hay caminos que lo saltean (ej. el demo no pasa por onboarding). Base: ${main[0] ? main[0].n : 0} ${main[0] && main[0].n === 1 ? "sesión" : "sesiones"}.</div>
          ${funnelHTML(main)}
        </div>

        <div class="grid grid--2">
          <div class="card">
            <div class="card__title">Funnel premium</div>
            <div class="muted" style="margin-bottom:12px">De ver la pantalla premium a suscribirse.</div>
            ${funnelHTML(prem)}
          </div>
          <div class="card">
            <div class="card__title">Onboarding por modo</div>
            <div class="muted" style="margin-bottom:12px">Chat vs formulario: quién completa, busca y reserva.</div>
            <div class="card__title" style="margin-top:4px">💬 Chat</div>
            ${funnelHTML(chat)}
            <div class="card__title" style="margin-top:16px">📝 Formulario</div>
            ${funnelHTML(form)}
          </div>
        </div>`;
    },
  };
})();
