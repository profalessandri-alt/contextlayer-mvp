/* ============================================================================
 * ContextLayer · Admin — vistas/features.js (#/features)
 * Adopción de funcionalidades: modo de onboarding, voz, skips, tipos de
 * búsqueda, SSO por app, premium, canjes, campos editados y permisos.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  const APP_NAMES = { "app-airbnb": "Airbnb", "app-booking": "Booking.com", "app-civitatis": "Civitatis", "app-terruno": "Terruño" };
  const REWARD_NAMES = { "rw-desc": "US$15 de descuento", "rw-checkout": "Late check-out", "rw-upgrade": "Upgrade de habitación", "rw-exp": "Experiencia gratis" };

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).features = {
    title: "Features",
    icon: "🧩",

    render(el, ctx) {
      const f = Agg.features(ctx.sessions, ctx.events);
      const named = (items, dict) => items.map((it) => ({ label: (dict && dict[it.label]) || it.label, value: it.value }));

      el.innerHTML = `
        <div class="grid grid--3">
          <div class="card">
            <div class="card__title">Cómo arman el contexto</div>
            ${Charts.donut(f.onboardingMode, { size: 140 })}
          </div>
          <div class="card">
            <div class="card__title">Dictado por voz</div>
            <div class="kpi" style="margin-bottom:10px">
              <div class="kpi__val">${f.voicePct.toFixed(0)}%</div>
              <div class="kpi__label">de las sesiones usó voz</div>
              <div class="kpi__hint">${f.voiceSessions} ${f.voiceSessions === 1 ? "sesión" : "sesiones"} · ${f.voiceErrors} ${f.voiceErrors === 1 ? "error" : "errores"} de micrófono</div>
            </div>
            <div class="card__title">Mensajes de chat por fuente</div>
            ${Charts.barsH(f.chatBySource, { multi: true })}
          </div>
          <div class="card">
            <div class="card__title">“Prefiero no decirlo” por pregunta</div>
            ${f.skipsByStep.length ? Charts.barsH(f.skipsByStep) : '<div class="empty"><span class="empty__ico">🙊</span>Nadie salteó preguntas.</div>'}
          </div>

          <div class="card">
            <div class="card__title">Búsquedas con Aria</div>
            ${Charts.donut(f.searchByType.filter((x) => x.value > 0), { size: 140 })}
          </div>
          <div class="card">
            <div class="card__title">SSO autorizado por app</div>
            ${Charts.barsH(named(f.ssoByApp, APP_NAMES), { multi: true })}
          </div>
          <div class="card">
            <div class="card__title">Premium</div>
            ${f.premiumByPlan.length
              ? Charts.barsH(f.premiumByPlan.map((x) => ({ label: "Plan " + x.label, value: x.value })))
              : '<div class="empty"><span class="empty__ico">⭐</span>Sin suscripciones en el rango.</div>'}
            <div class="muted" style="margin-top:8px">Cancelaciones: <b>${f.premiumCancelled}</b></div>
            <div class="card__title" style="margin-top:14px">Canjes de puntos</div>
            ${f.redeemByReward.length ? Charts.barsH(named(f.redeemByReward, REWARD_NAMES)) : '<div class="muted">Sin canjes.</div>'}
          </div>

          <div class="card">
            <div class="card__title">Campos más editados (formularios)</div>
            ${f.formChangeByKey.length ? Charts.barsH(f.formChangeByKey.slice(0, 10)) : '<div class="empty"><span class="empty__ico">📝</span>Sin ediciones de campos.</div>'}
          </div>
          <div class="card">
            <div class="card__title">Permisos</div>
            <div class="kpi" style="margin-bottom:8px">
              <div class="kpi__val">${f.grantsRevoked}</div>
              <div class="kpi__label">grants revocados</div>
              <div class="kpi__hint">${f.grantsReactivated} reactivados · ${f.appLogouts} logout de apps</div>
            </div>
            <div class="muted">La revocación es la promesa central del producto: acá se ve si la usan.</div>
          </div>
        </div>`;
    },
  };
})();
