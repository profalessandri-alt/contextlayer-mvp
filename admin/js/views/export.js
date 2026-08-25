/* ============================================================================
 * ContextLayer · Admin — vistas/export.js (#/export)
 * Exportación client-side (Blob + a[download]) de events / sessions /
 * feedback del rango y segmento filtrados, en CSV o JSON.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  function download(name, mime, content) {
    const blob = new Blob([content], { type: mime + ";charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // CSV con columnas = unión de keys; los objetos (props, tags) van como JSON.
  function toCSV(rows) {
    if (!rows.length) return "";
    const cols = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (cols.indexOf(k) < 0) cols.push(k); }));
    const cell = (v) => {
      if (v == null) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [cols.join(",")];
    rows.forEach((r) => lines.push(cols.map((c) => cell(r[c])).join(",")));
    return lines.join("\n");
  }

  (window.ADMIN_VIEWS = window.ADMIN_VIEWS || {}).export = {
    title: "Exportar",
    icon: "📦",

    render(el, ctx) {
      const stamp = new Date().toISOString().slice(0, 10);
      const sets = [
        { key: "events", label: "Eventos", rows: ctx.events, desc: "Todos los eventos del rango (con props como JSON)." },
        { key: "sessions", label: "Sesiones", rows: ctx.sessions, desc: "Una fila por sesión (device, browser, UTM, viewport…)." },
        { key: "feedback", label: "Feedback", rows: ctx.feedback, desc: "Scores 1-5 con contexto y tags." },
      ];

      el.innerHTML = `
        <div class="card">
          <div class="card__title">Exportar datos filtrados</div>
          <div class="muted" style="margin-bottom:6px">
            Se exporta lo que estás viendo: rango <b>${esc(ctx.rangeLabel)}</b> · segmento <b>${esc(ctx.segmentLabel)}</b> · modo <b>${esc(ctx.mode)}</b>. Todo client-side, no sale nada del navegador.
          </div>
          ${sets.map((s) => `
            <div class="exp-row">
              <b>${esc(s.label)}</b>
              <span class="chip">${s.rows.length} filas</span>
              <button class="btn btn--sm btn--primary" data-set="${s.key}" data-fmt="csv" ${s.rows.length ? "" : "disabled"}>⬇ CSV</button>
              <button class="btn btn--sm" data-set="${s.key}" data-fmt="json" ${s.rows.length ? "" : "disabled"}>⬇ JSON</button>
              <span class="muted">${esc(s.desc)}</span>
            </div>`).join("")}
        </div>`;

      // #view es un nodo persistente: sacar el handler del render anterior
      // para no descargar archivos duplicados (y con datos viejos).
      if (el._expHandler) el.removeEventListener("click", el._expHandler);
      el._expHandler = (e) => {
        const b = e.target.closest("[data-set]");
        if (!b || b.disabled) return;
        const set = sets.find((s) => s.key === b.dataset.set);
        const base = "contextlayer-" + set.key + "-" + ctx.range + "-" + stamp;
        if (b.dataset.fmt === "csv") download(base + ".csv", "text/csv", toCSV(set.rows));
        else download(base + ".json", "application/json", JSON.stringify(set.rows, null, 2));
      };
      el.addEventListener("click", el._expHandler);
    },
  };
})();
