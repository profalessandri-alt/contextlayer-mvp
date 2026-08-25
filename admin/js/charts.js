/* ============================================================================
 * ContextLayer · Admin — charts.js
 * Mini-lib de gráficos propia (SVG puro, sin dependencias): barras H/V,
 * línea/área temporal, donut, sparkline y tabla-heatmap. Los tooltips son
 * <title> nativos. Cada función devuelve un string de HTML/SVG.
 * ==========================================================================*/

(function () {
  "use strict";

  const PALETTE = ["#5566ff", "#23c3a4", "#e8b93e", "#ff6b7d", "#9b7bff", "#38bdf8", "#f97fb5", "#7ddf82"];
  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fmt = (n) => (n == null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

  /* ---------- Barras horizontales (HTML+CSS, más legible que SVG acá) ---------- */
  // items: [{label, value, hint?, color?, suffix?}]
  function barsH(items, opts) {
    opts = opts || {};
    if (!items.length) return '<div class="empty"><span class="empty__ico">📊</span>Sin datos en este rango.</div>';
    const max = opts.max || Math.max(...items.map((i) => i.value), 1);
    return items.map((it, i) => {
      const w = Math.max(1.5, (it.value / max) * 100);
      const color = it.color || (opts.multi ? PALETTE[i % PALETTE.length] : null);
      const style = color ? `background:${color}` : "";
      return `<div class="hbar" title="${esc(it.hint || it.label + ": " + fmt(it.value))}">
        <div class="hbar__label">${esc(it.label)}</div>
        <div class="hbar__track"><div class="hbar__fill" style="width:${w}%;${style}"></div></div>
        <div class="hbar__val">${esc(it.display != null ? it.display : fmt(it.value))}${esc(opts.suffix || "")}</div>
      </div>`;
    }).join("");
  }

  /* ---------- Barras verticales (SVG) ---------- */
  // items: [{label, value, hint?}]
  function barsV(items, opts) {
    opts = opts || {};
    if (!items.length) return '<div class="empty"><span class="empty__ico">📊</span>Sin datos en este rango.</div>';
    const W = 460, H = opts.h || 180, padB = 26, padT = 14;
    const max = Math.max(...items.map((i) => i.value), 1);
    const bw = Math.min(56, (W - 20) / items.length - 10);
    const step = (W - 20) / items.length;
    let s = "";
    items.forEach((it, i) => {
      const h = ((H - padB - padT) * it.value) / max;
      const x = 10 + i * step + (step - bw) / 2;
      const y = H - padB - h;
      const color = it.color || PALETTE[0];
      s += `<g><title>${esc(it.hint || it.label + ": " + fmt(it.value))}</title>
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(h, 1).toFixed(1)}" rx="5" fill="${color}" opacity="0.9"/>
        <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" font-size="11" fill="#a2aacd" text-anchor="middle" font-weight="700">${esc(fmt(it.value))}</text>
        <text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" font-size="10.5" fill="#6d7598" text-anchor="middle">${esc(it.label)}</text>
      </g>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">${s}</svg></div>`;
  }

  /* ---------- Línea/área con eje temporal ---------- */
  // series: [{t: Date, v, label}]
  function line(series, opts) {
    opts = opts || {};
    if (!series.length) return '<div class="empty"><span class="empty__ico">📈</span>Sin datos en este rango.</div>';
    const W = 640, H = opts.h || 190, padL = 30, padR = 12, padT = 12, padB = 24;
    const max = Math.max(...series.map((d) => d.v), 1);
    const iw = W - padL - padR, ih = H - padT - padB;
    const X = (i) => padL + (series.length === 1 ? iw / 2 : (i / (series.length - 1)) * iw);
    const Y = (v) => padT + ih - (v / max) * ih;
    let path = "", area = "";
    series.forEach((d, i) => {
      const cmd = (i === 0 ? "M" : "L") + X(i).toFixed(1) + " " + Y(d.v).toFixed(1);
      path += cmd + " ";
    });
    area = path + `L ${X(series.length - 1).toFixed(1)} ${(padT + ih).toFixed(1)} L ${X(0).toFixed(1)} ${(padT + ih).toFixed(1)} Z`;
    // Puntos con tooltip
    let dots = "";
    series.forEach((d, i) => {
      dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(d.v).toFixed(1)}" r="3.4" fill="#23c3a4"><title>${esc(d.label)}: ${fmt(d.v)}</title></circle>`;
    });
    // Labels del eje X: primero, medio, último (más si entran).
    const idxs = series.length <= 8 ? series.map((_, i) => i)
      : [0, Math.floor(series.length / 4), Math.floor(series.length / 2), Math.floor((3 * series.length) / 4), series.length - 1];
    let xlabels = "";
    idxs.forEach((i) => {
      xlabels += `<text x="${X(i).toFixed(1)}" y="${H - 6}" font-size="10" fill="#6d7598" text-anchor="middle">${esc(series[i].label)}</text>`;
    });
    const grid = [0, 0.5, 1].map((f) =>
      `<line x1="${padL}" y1="${(padT + ih * f).toFixed(1)}" x2="${W - padR}" y2="${(padT + ih * f).toFixed(1)}" stroke="#262b4a" stroke-dasharray="3 4"/>
       <text x="${padL - 6}" y="${(padT + ih * f + 3).toFixed(1)}" font-size="10" fill="#6d7598" text-anchor="end">${fmt(max * (1 - f))}</text>`
    ).join("");
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img">
      <defs><linearGradient id="clArea" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5566ff" stop-opacity="0.4"/><stop offset="1" stop-color="#23c3a4" stop-opacity="0.03"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#clArea)"/>
      <path d="${path}" fill="none" stroke="#5566ff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${xlabels}
    </svg></div>`;
  }

  /* ---------- Donut ---------- */
  // parts: [{label, value, color?}]
  function donut(parts, opts) {
    opts = opts || {};
    const total = parts.reduce((a, x) => a + x.value, 0);
    if (!total) return '<div class="empty"><span class="empty__ico">🍩</span>Sin datos en este rango.</div>';
    const size = opts.size || 150, r = size / 2 - 8, cx = size / 2, cy = size / 2, thick = opts.thick || 22;
    let a0 = -Math.PI / 2, segs = "";
    parts.forEach((pt, i) => {
      const frac = pt.value / total;
      const a1 = a0 + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const color = pt.color || PALETTE[i % PALETTE.length];
      if (frac >= 0.999) {
        segs += `<circle cx="${cx}" cy="${cy}" r="${r - thick / 2}" fill="none" stroke="${color}" stroke-width="${thick}"><title>${esc(pt.label)}: ${pt.value} (100%)</title></circle>`;
      } else {
        const rm = r - thick / 2;
        const x0 = cx + rm * Math.cos(a0), y0 = cy + rm * Math.sin(a0);
        const x1 = cx + rm * Math.cos(a1), y1 = cy + rm * Math.sin(a1);
        segs += `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${rm} ${rm} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}"
          fill="none" stroke="${color}" stroke-width="${thick}" stroke-linecap="butt">
          <title>${esc(pt.label)}: ${pt.value} (${((pt.value / total) * 100).toFixed(0)}%)</title></path>`;
      }
      a0 = a1;
    });
    const center = opts.center != null ? opts.center : total;
    const legend = parts.map((pt, i) =>
      `<span class="legend__it"><span class="legend__sw" style="background:${pt.color || PALETTE[i % PALETTE.length]}"></span>${esc(pt.label)} · <b>${pt.value}</b> (${((pt.value / total) * 100).toFixed(0)}%)</span>`
    ).join("");
    return `<div class="chart" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <svg viewBox="0 0 ${size} ${size}" style="width:${size}px;flex:none">${segs}
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="20" font-weight="800" fill="#e9ecfc">${esc(center)}</text>
      </svg>
      <div class="legend" style="flex-direction:column;align-items:flex-start;gap:6px">${legend}</div>
    </div>`;
  }

  /* ---------- Sparkline ---------- */
  function spark(values, opts) {
    opts = opts || {};
    const W = opts.w || 110, H = opts.h || 30;
    if (!values.length) return "";
    const max = Math.max(...values, 1), min = Math.min(...values, 0);
    const X = (i) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 4) + 2);
    const Y = (v) => H - 3 - ((v - min) / (max - min || 1)) * (H - 6);
    const pts = values.map((v, i) => X(i).toFixed(1) + "," + Y(v).toFixed(1)).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px"><polyline points="${pts}" fill="none" stroke="#23c3a4" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  }

  /* ---------- Tabla-heatmap (celdas coloreadas por volumen) ---------- */
  // m: salida de Agg.flowsMatrix (rows, cols, max, get, rowTotal, colTotal)
  function tableHeat(m) {
    if (!m.rows.length) return '<div class="empty"><span class="empty__ico">🔀</span>Sin navegación registrada en este rango.</div>';
    const cellBg = (v) => {
      if (!v) return "transparent";
      const f = Math.pow(v / m.max, 0.6); // curva para que lo chico también se vea
      // índigo → agua según volumen
      const a = 0.14 + f * 0.8;
      return f < 0.55
        ? `rgba(85,102,255,${a.toFixed(2)})`
        : `rgba(35,195,164,${a.toFixed(2)})`;
    };
    let html = '<div class="scroll-x"><table class="heat-tbl"><thead><tr><th></th>';
    m.cols.forEach((c) => { html += `<th>${esc(c)}</th>`; });
    html += "<th>Σ</th></tr></thead><tbody>";
    m.rows.forEach((r) => {
      html += `<tr><th>${esc(r)}</th>`;
      m.cols.forEach((c) => {
        const v = m.get(r, c);
        html += `<td style="background:${cellBg(v)}" title="${esc(r)} → ${esc(c)}: ${v}">${v || ""}</td>`;
      });
      html += `<td class="tot">${m.rowTotal(r)}</td></tr>`;
    });
    html += '<tr><th style="text-align:right">Σ</th>';
    m.cols.forEach((c) => { html += `<td class="tot">${m.colTotal(c)}</td>`; });
    html += "<td></td></tr></tbody></table></div>";
    return html;
  }

  /* ---------- Barras apiladas horizontales (scroll depth) ---------- */
  // rows: [{label, segs: [{value, color, hint}], right}]
  function stackH(rows) {
    if (!rows.length) return '<div class="empty"><span class="empty__ico">📜</span>Sin datos de scroll en este rango.</div>';
    return rows.map((r) => {
      const total = r.segs.reduce((a, s) => a + s.value, 0) || 1;
      const segs = r.segs.map((s) =>
        s.value ? `<div style="width:${(s.value / total) * 100}%;background:${s.color}" title="${esc(s.hint)}"></div>` : ""
      ).join("");
      return `<div class="hbar" style="grid-template-columns:minmax(90px,160px) 1fr 90px">
        <div class="hbar__label">${esc(r.label)}</div>
        <div class="stack">${segs}</div>
        <div class="hbar__val muted">${esc(r.right || "")}</div>
      </div>`;
    }).join("");
  }

  window.Charts = { PALETTE, barsH, barsV, line, donut, spark, tableHeat, stackH, esc, fmt };
})();
