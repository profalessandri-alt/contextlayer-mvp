/* ============================================================================
 * ContextLayer · Admin — vistas/heatmap.js (#/heatmap)
 * Preview real de la pantalla del MVP en un iframe + overlay de heatmap.
 * Toggle clicks / rage / dead. Los clicks fuera del contenido (tabbar /
 * device) no se mapean: se muestran como conteo aparte.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  const APPS = [
    { id: "app-airbnb", nombre: "Airbnb" },
    { id: "app-booking", nombre: "Booking.com" },
    { id: "app-civitatis", nombre: "Civitatis" },
    { id: "app-terruno", nombre: "Terruño" },
  ];
  const NEEDS_APP = ["thirdApp", "sso"];
  const NEEDS_TYPE = ["agente", "resultados"];
  const KINDS = [
    { id: "click", label: "Clicks" },
    { id: "rage_click", label: "Rage" },
    { id: "dead_click", label: "Dead" },
  ];

  // Estado propio de la vista (sobrevive a cambios de rango/segmento).
  const st = { screen: null, app: "app-airbnb", type: "stay", kind: "click" };
  let msgHandler = null;
  let iframeReady = false;

  function previewSrc() {
    let src = "../mvp/?preview=" + encodeURIComponent(st.screen);
    if (NEEDS_APP.indexOf(st.screen) >= 0) src += "&app=" + encodeURIComponent(st.app);
    if (NEEDS_TYPE.indexOf(st.screen) >= 0) src += "&type=" + encodeURIComponent(st.type);
    return src;
  }

  window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
  window.ADMIN_VIEWS.heatmap = {
    title: "Heatmaps",
    icon: "🔥",

    render(el, ctx) {
      const counts = Agg.screensWithClicks(ctx.events);
      // Primera vez: arrancar en la pantalla con más clicks (si hay).
      if (!st.screen) {
        const top = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        st.screen = top || "pasaporte";
      }

      const screenOpts = Agg.SCREENS.map((s) =>
        `<option value="${s}" ${s === st.screen ? "selected" : ""}>${s}${counts[s] ? " (" + counts[s] + ")" : ""}</option>`
      ).join("");
      const appOpts = APPS.map((a) =>
        `<option value="${a.id}" ${a.id === st.app ? "selected" : ""}>${esc(a.nombre)}</option>`
      ).join("");
      const kindBtns = KINDS.map((k) =>
        `<button data-kind="${k.id}" class="${k.id === st.kind ? "is-on" : ""}">${k.label}</button>`
      ).join("");

      el.innerHTML = `
        <div class="heat-controls">
          <select id="hm-screen" class="sel" title="Pantalla">${screenOpts}</select>
          <select id="hm-app" class="sel" title="App de terceros" ${NEEDS_APP.indexOf(st.screen) < 0 ? "hidden" : ""}>${appOpts}</select>
          <select id="hm-type" class="sel" title="Tipo de búsqueda" ${NEEDS_TYPE.indexOf(st.screen) < 0 ? "hidden" : ""}>
            <option value="stay" ${st.type === "stay" ? "selected" : ""}>🛏️ Alojamiento</option>
            <option value="tour" ${st.type === "tour" ? "selected" : ""}>🎟️ Experiencia</option>
          </select>
          <div class="seg" id="hm-kind">${kindBtns}</div>
        </div>
        <div class="heat-layout">
          <div class="heat-stage" id="hm-stage">
            <iframe id="hm-frame" width="400" height="720" title="Preview de la pantalla ${esc(st.screen)}" src="${previewSrc()}"></iframe>
            <canvas id="hm-canvas" width="400" height="720"></canvas>
          </div>
          <div class="heat-side">
            <div class="card">
              <div class="card__title">Sobre este heatmap</div>
              <div id="hm-note" class="dim" style="font-size:0.9rem">Cargando preview…</div>
              <div class="muted" style="margin-top:10px">Los puntos se acumulan como splats gaussianos y se colorizan de azul (poco) a rojo (mucho). Coordenadas normalizadas al ancho del teléfono y al alto del contenido.</div>
            </div>
            <div class="card">
              <div class="card__title">Fuera del contenido</div>
              <div id="hm-off" class="dim" style="font-size:0.9rem">—</div>
              <div class="muted" style="margin-top:8px">Clicks en la tabbar o el marco del dispositivo: no se proyectan sobre el preview.</div>
            </div>
          </div>
        </div>`;

      iframeReady = false;
      const iframe = el.querySelector("#hm-frame");
      const canvas = el.querySelector("#hm-canvas");
      const paint = (geom) => {
        // Dimensionar el stage al documento completo del preview.
        iframe.height = geom.docTotal;
        const data = Agg.heatPoints(ctx.events, st.screen, st.kind);
        const pts = data.points.map((pt) => ({
          x: pt.x * geom.deviceW,
          y: geom.screenTop + pt.y * geom.docH,
        }));
        Heat.paint(canvas, pts, { width: geom.deviceW, height: geom.docTotal, radius: 26 });
        const kindLabel = KINDS.find((k) => k.id === st.kind).label.toLowerCase();
        el.querySelector("#hm-note").innerHTML =
          `<b>${data.points.length}</b> ${data.points.length === 1 ? "punto" : "puntos"} (${esc(kindLabel)}) de <b>${data.sessions}</b> ${data.sessions === 1 ? "sesión" : "sesiones"} en <b>${esc(st.screen)}</b>.`;
        el.querySelector("#hm-off").innerHTML =
          `Tabbar: <b>${data.offTabbar}</b> · Dispositivo: <b>${data.offDevice}</b>`;
      };

      if (msgHandler) window.removeEventListener("message", msgHandler);
      msgHandler = (e) => {
        const d = e.data || {};
        if (d.cl !== "preview-ready") return;
        iframeReady = true;
        if (d.screen === st.screen) paint(d);
      };
      window.addEventListener("message", msgHandler);

      // Cambiar de pantalla sin recargar el iframe (preview-go).
      const goPreview = () => {
        if (iframeReady && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ cl: "preview-go", screen: st.screen, app: st.app, type: st.type }, "*");
        } else {
          iframe.src = previewSrc();
        }
      };

      el.querySelector("#hm-screen").addEventListener("change", (e) => {
        st.screen = e.target.value;
        el.querySelector("#hm-app").hidden = NEEDS_APP.indexOf(st.screen) < 0;
        el.querySelector("#hm-type").hidden = NEEDS_TYPE.indexOf(st.screen) < 0;
        goPreview();
      });
      el.querySelector("#hm-app").addEventListener("change", (e) => { st.app = e.target.value; goPreview(); });
      el.querySelector("#hm-type").addEventListener("change", (e) => { st.type = e.target.value; goPreview(); });
      el.querySelector("#hm-kind").addEventListener("click", (e) => {
        const b = e.target.closest("[data-kind]");
        if (!b) return;
        st.kind = b.dataset.kind;
        el.querySelectorAll("#hm-kind button").forEach((x) => x.classList.toggle("is-on", x === b));
        goPreview(); // re-dispara preview-ready y repinta
      });
    },

    destroy() {
      if (msgHandler) { window.removeEventListener("message", msgHandler); msgHandler = null; }
      iframeReady = false;
    },
  };
})();
