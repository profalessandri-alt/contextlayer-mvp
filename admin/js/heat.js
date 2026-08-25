/* ============================================================================
 * ContextLayer · Admin — heat.js
 * Heatmap por splats gaussianos sobre <canvas>:
 *   1) acumula intensidad en un canvas offscreen (gradiente radial de alpha
 *      por punto, radio ~26 px),
 *   2) coloriza mapeando alpha → paleta azul→verde→amarillo→rojo,
 *   3) el canvas destino se pinta con opacidad ~0.75 (vía CSS).
 * ==========================================================================*/

(function () {
  "use strict";

  let LUT = null; // lookup de 256 colores de la paleta

  function buildLUT() {
    if (LUT) return LUT;
    const c = document.createElement("canvas");
    c.width = 256; c.height = 1;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0.00, "rgba(45,80,255,0)");
    grad.addColorStop(0.20, "rgba(45,80,255,0.7)");   // azul
    grad.addColorStop(0.45, "rgba(35,195,164,0.85)"); // verde agua
    grad.addColorStop(0.70, "rgba(255,210,62,0.92)"); // amarillo
    grad.addColorStop(1.00, "rgba(255,59,48,1)");     // rojo
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 1);
    LUT = g.getImageData(0, 0, 256, 1).data;
    return LUT;
  }

  /**
   * Pinta el heatmap en `canvas`.
   * points: [{x, y}] en PÍXELES del canvas destino.
   * opts: { width, height, radius=26, intensity=0.35 }
   */
  function paint(canvas, points, opts) {
    opts = opts || {};
    const w = Math.max(1, Math.round(opts.width || canvas.width));
    const h = Math.max(1, Math.round(opts.height || canvas.height));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return;

    const radius = opts.radius || 26;
    // Con pocos puntos subimos la intensidad para que igual se vea el color.
    const base = opts.intensity || Math.min(0.85, Math.max(0.25, 6 / Math.sqrt(points.length)));

    // 1) Acumular alpha en un canvas offscreen (en negro).
    const off = document.createElement("canvas");
    off.width = w; off.height = h;
    const octx = off.getContext("2d");
    points.forEach((pt) => {
      const g = octx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius);
      g.addColorStop(0, "rgba(0,0,0," + base + ")");
      g.addColorStop(1, "rgba(0,0,0,0)");
      octx.fillStyle = g;
      octx.fillRect(pt.x - radius, pt.y - radius, radius * 2, radius * 2);
    });

    // 2) Colorizar alpha → paleta.
    const lut = buildLUT();
    const img = octx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      if (!a) continue;
      const j = a * 4;
      d[i - 3] = lut[j];
      d[i - 2] = lut[j + 1];
      d[i - 1] = lut[j + 2];
      d[i] = Math.min(255, Math.round(lut[j + 3] * (a / 255) * 1.6 + a * 0.35));
    }
    ctx.putImageData(img, 0, 0);
  }

  window.Heat = { paint };
})();
