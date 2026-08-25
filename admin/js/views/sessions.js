/* ============================================================================
 * ContextLayer · Admin — vistas/sessions.js (#/sessions y #/sessions/<id>)
 * Tabla filtrable de sesiones → detalle con timeline legible + replay
 * fantasma: el preview cambia de pantalla según los screen_view y un cursor
 * animado repite cada click mapeado. Velocidades 1x/4x/10x.
 * ==========================================================================*/

(function () {
  "use strict";
  const esc = Charts.esc;

  const st = { device: "", booked: false, fb: false };

  /* ---------- Descripción legible de un evento ---------- */
  // dest: pantalla de destino reconstruida (ver Agg.svDest) para screen_view.
  function describe(e, dest) {
    const p = e.props || {};
    switch (e.type) {
      case "screen_view": {
        const stay = p.prev_ms != null ? " tras " + (p.prev_ms / 1000).toFixed(1) + " s" : "";
        if (dest) return "→ " + dest + (p.prev ? "  (deja " + p.prev + stay + ")" : "");
        return p.prev ? "deja " + p.prev + stay : "→ (arranque)";
      }
      case "click": {
        const id = p.action || p.go || p.nav || p.sel || "?";
        return "click " + id + (p.label ? " · “" + p.label + "”" : "") + (p.region !== "screen" ? " [" + p.region + "]" : "");
      }
      case "rage_click": return "RAGE CLICK ×" + (p.count || "?") + " en " + (p.sel || "?");
      case "dead_click": return "dead click en " + (p.sel || "?");
      case "scroll_depth": return "scroll " + p.max_pct + "% en " + (p.for || e.screen);
      case "form_focus": return "focus " + p.key;
      case "form_change": return "cambió " + p.key;
      case "chat_msg": return "chat (" + p.source + ")" + (p.step_key ? " · " + p.step_key : "") + (p.len ? " · " + p.len + " chars" : "");
      case "voice_error": return "error de voz";
      case "error_js": return "ERROR: " + (p.msg || "?");
      case "feedback": return "feedback " + p.score + "★" + (p.tags && p.tags.length ? " · " + p.tags.join(", ") : "");
      case "milestone": {
        const rest = Object.keys(p).filter((k) => k !== "name" && k !== "fields").map((k) => k + "=" + p[k]).join(" ");
        return (p.name || "?") + (rest ? " · " + rest : "");
      }
      default: return e.type;
    }
  }

  const fmtT = (ms) => {
    const s = Math.max(0, Math.round(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  };
  const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) + " " +
      d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  };

  /* ================================================= Replay fantasma ==== */
  const R = {
    raf: null, playing: false, speed: 1, vt: 0, total: 0,
    steps: [], idx: 0, geom: {}, lastGeom: null, msgHandler: null,
    app: null, type: "stay", curScreen: null,
    els: null, // referencias al DOM del replay
  };

  function replayStop() {
    if (R.raf) cancelAnimationFrame(R.raf);
    R.raf = null;
    R.playing = false;
    if (R.msgHandler) { window.removeEventListener("message", R.msgHandler); R.msgHandler = null; }
  }

  // Línea de tiempo comprimida (pausas largas capadas a 3 s) con el destino
  // de cada screen_view ya reconstruido (Agg.svDest).
  function buildSteps(events) {
    const steps = [];
    let cum = 0;
    events.forEach((e, i) => {
      if (i > 0) cum += Math.min(Math.max(0, e.ts - events[i - 1].ts), 3000);
      steps.push({ e, at: cum, dest: e.type === "screen_view" ? Agg.svDest(events, i) : null });
    });
    return steps;
  }

  function previewGo(screen) {
    if (R.curScreen === screen) return;
    R.curScreen = screen;
    const f = R.els.frame;
    if (f && f.contentWindow) {
      f.contentWindow.postMessage({ cl: "preview-go", screen, app: R.app, type: R.type }, "*");
    }
  }

  function applyStep(step, animate) {
    const e = step.e;
    const p = e.props || {};
    // El contexto de app/type viaja en los milestones: lo vamos siguiendo.
    if (e.type === "milestone") {
      if (p.app) R.app = p.app;
      if (p.type === "stay" || p.type === "tour") R.type = p.type;
    }
    if (e.type === "screen_view" && step.dest) previewGo(step.dest);
    if ((e.type === "click" || e.type === "rage_click") && p.region === "screen" && e.x != null && e.y != null) {
      const g = R.geom[e.screen] || R.lastGeom;
      if (g) {
        const x = e.x * g.deviceW;
        const y = g.screenTop + e.y * g.docH;
        const ghost = R.els.ghost;
        ghost.style.left = x + "px";
        ghost.style.top = y + "px";
        if (animate) {
          ghost.classList.remove("pulse");
          void ghost.offsetWidth; // reinicia la animación
          ghost.classList.add("pulse");
        }
      }
    }
    // Resaltar la fila del timeline.
    const rows = R.els.tline.children;
    if (rows[step.i]) {
      for (let i = 0; i < rows.length; i++) rows[i].classList.remove("is-now");
      rows[step.i].classList.add("is-now");
      if (animate) rows[step.i].scrollIntoView({ block: "nearest" });
    }
  }

  function replayTick(now) {
    if (!R.playing) return;
    const dt = now - (R.lastNow || now);
    R.lastNow = now;
    R.vt += dt * R.speed;
    while (R.idx < R.steps.length && R.steps[R.idx].at <= R.vt) {
      applyStep(R.steps[R.idx], true);
      R.idx++;
    }
    R.els.fill.style.width = Math.min(100, (R.vt / (R.total || 1)) * 100) + "%";
    if (R.idx >= R.steps.length) {
      R.playing = false;
      R.els.play.textContent = "↺ Repetir";
      return;
    }
    R.raf = requestAnimationFrame(replayTick);
  }

  function replayPlay() {
    if (R.idx >= R.steps.length) { replaySeek(0); }
    R.playing = true;
    R.lastNow = null;
    R.els.play.textContent = "⏸ Pausa";
    R.raf = requestAnimationFrame(replayTick);
  }
  function replayPause() {
    R.playing = false;
    if (R.raf) cancelAnimationFrame(R.raf);
    R.els.play.textContent = "▶ Play";
  }
  // Salta a un tiempo virtual: re-aplica el último estado sin animar.
  function replaySeek(vt) {
    R.vt = vt;
    R.idx = 0;
    let lastScreen = null, lastClick = null;
    for (let i = 0; i < R.steps.length && R.steps[i].at <= vt; i++) {
      const e = R.steps[i].e, p = e.props || {};
      if (e.type === "milestone") {
        if (p.app) R.app = p.app;
        if (p.type === "stay" || p.type === "tour") R.type = p.type;
      }
      if (e.type === "screen_view") lastScreen = R.steps[i];
      if (e.type === "click" && p.region === "screen" && e.x != null) lastClick = R.steps[i];
      R.idx = i + 1;
    }
    if (lastScreen) applyStep(lastScreen, false);
    if (lastClick) applyStep(lastClick, false);
    R.els.fill.style.width = Math.min(100, (vt / (R.total || 1)) * 100) + "%";
  }

  /* ================================================= Vista ==== */
  window.ADMIN_VIEWS = window.ADMIN_VIEWS || {};
  window.ADMIN_VIEWS.sessions = {
    title: "Sesiones",
    icon: "🧑‍💻",

    async render(el, ctx) {
      if (ctx.param) return this.renderDetail(el, ctx);
      this.renderList(el, ctx);
    },

    /* ---------- Lista ---------- */
    renderList(el, ctx) {
      let rows = Agg.sessionSummaries(ctx.sessions, ctx.events);
      if (st.device) rows = rows.filter((r) => r.device_type === st.device);
      if (st.booked) rows = rows.filter((r) => r.booked);
      if (st.fb) rows = rows.filter((r) => r.feedback);

      const tr = rows.map((r) => `
        <tr class="is-click" data-id="${esc(r.id)}" title="Ver detalle y replay">
          <td class="nowrap">${fmtDate(r.started_at)}</td>
          <td>${r.device_type === "mobile" ? "📱" : r.device_type === "tablet" ? "📲" : "🖥️"} ${esc(r.device_type)}</td>
          <td class="nowrap">${esc(r.browser)}${r.os ? ' <span class="muted">· ' + esc(r.os) + "</span>" : ""}</td>
          <td class="num">${r.events}</td>
          <td class="num">${r.screens}</td>
          <td class="num nowrap">${esc(r.dur)}</td>
          <td>${r.booked ? '<span class="chip chip--ok">✓ reservó</span>' : '<span class="muted">—</span>'}</td>
          <td>${r.feedback ? '<span class="chip chip--brand">★ sí</span>' : '<span class="muted">—</span>'}${r.errors ? ' <span class="chip chip--bad">' + r.errors + " err</span>" : ""}</td>
        </tr>`).join("");

      el.innerHTML = `
        <div class="heat-controls">
          <select id="ss-device" class="sel">
            <option value="">Todos los dispositivos</option>
            <option value="mobile" ${st.device === "mobile" ? "selected" : ""}>📱 Mobile</option>
            <option value="tablet" ${st.device === "tablet" ? "selected" : ""}>📲 Tablet</option>
            <option value="desktop" ${st.device === "desktop" ? "selected" : ""}>🖥️ Desktop</option>
          </select>
          <label class="chip" style="cursor:pointer;padding:6px 12px"><input type="checkbox" id="ss-booked" ${st.booked ? "checked" : ""}/> Solo con reserva</label>
          <label class="chip" style="cursor:pointer;padding:6px 12px"><input type="checkbox" id="ss-fb" ${st.fb ? "checked" : ""}/> Solo con feedback</label>
          <span class="muted">${rows.length} ${rows.length === 1 ? "sesión" : "sesiones"}</span>
        </div>
        <div class="card scroll-x">
          ${rows.length ? `<table class="tbl">
            <thead><tr><th>Fecha</th><th>Device</th><th>Browser</th><th class="num">Eventos</th><th class="num">Pantallas</th><th class="num">Duración</th><th>¿Reservó?</th><th>¿Feedback?</th></tr></thead>
            <tbody>${tr}</tbody></table>`
            : '<div class="empty"><span class="empty__ico">🧑‍💻</span>No hay sesiones con estos filtros.</div>'}
        </div>`;

      el.querySelector("#ss-device").addEventListener("change", (e) => { st.device = e.target.value; this.renderList(el, ctx); });
      el.querySelector("#ss-booked").addEventListener("change", (e) => { st.booked = e.target.checked; this.renderList(el, ctx); });
      el.querySelector("#ss-fb").addEventListener("change", (e) => { st.fb = e.target.checked; this.renderList(el, ctx); });
      el.querySelectorAll("tr.is-click").forEach((row) => {
        row.addEventListener("click", () => ctx.go("sessions/" + row.dataset.id));
      });
    },

    /* ---------- Detalle + replay ---------- */
    async renderDetail(el, ctx) {
      const id = ctx.param;
      el.innerHTML = '<div class="loading">Cargando sesión…</div>';
      let events;
      try {
        events = await Provider.eventsOf(id);
      } catch (err) {
        el.innerHTML = `<div class="banner banner--warn">No se pudieron cargar los eventos: ${esc(err.message)}</div>`;
        return;
      }
      events = events.slice().sort((a, b) => a.ts - b.ts || a.seq - b.seq);
      const ses = ctx.sessions.find((s) => s.id === id) || {};

      if (!events.length) {
        el.innerHTML = `<button class="btn btn--sm" id="ss-back">‹ Volver a sesiones</button>
          <div class="empty"><span class="empty__ico">🫥</span>Esta sesión no tiene eventos.</div>`;
        el.querySelector("#ss-back").addEventListener("click", () => ctx.go("sessions"));
        return;
      }

      const t0 = events[0].ts;
      const tline = events.map((e, i) => {
        const cls = e.type === "screen_view" ? "is-screen"
          : e.type === "milestone" ? "is-mile"
          : (e.type === "error_js" || e.type === "rage_click" || e.type === "dead_click") ? "is-bad" : "";
        const badge = e.type === "milestone" ? '<span class="tline__badge">MILESTONE</span>'
          : e.type === "feedback" ? '<span class="tline__badge" style="background:rgba(85,102,255,.2);color:#aab4ff">FEEDBACK</span>' : "";
        const dest = e.type === "screen_view" ? Agg.svDest(events, i) : null;
        return `<div class="tline__item ${cls}" data-i="${i}">
          <span class="tline__t">${fmtT(e.ts - t0)}</span>${badge}
          <span class="tline__txt">${esc(describe(e, dest))}</span>
        </div>`;
      }).join("");

      // Primera pantalla que se VIO: destino del primer screen_view (el
      // evento en sí lleva la pantalla que se deja, ver Agg.svDest).
      let firstScreen = "splash";
      for (let i = 0; i < events.length; i++) {
        if (events[i].type === "screen_view") { firstScreen = Agg.svDest(events, i) || (events[i].props || {}).prev || "splash"; break; }
        if (events[i].screen) { firstScreen = events[i].screen; break; }
      }
      const meta = [
        fmtDate(ses.started_at || new Date(t0).toISOString()),
        ses.device_type, ses.browser, ses.os,
        ses.viewport_w ? ses.viewport_w + "×" + ses.viewport_h : null,
        ses.lang,
      ].filter(Boolean).map((x) => `<span class="chip">${esc(x)}</span>`).join(" ");

      el.innerHTML = `
        <div class="heat-controls">
          <button class="btn btn--sm" id="ss-back">‹ Sesiones</button>
          <span class="dim" style="font-size:0.82rem">Sesión <b>${esc(id.slice(0, 8))}…</b></span>
          ${meta}
        </div>
        <div class="heat-layout">
          <div style="flex:none">
            <div class="replay-bar" style="max-width:402px">
              <button class="btn btn--sm btn--primary" id="rp-play">▶ Play</button>
              <div class="seg" id="rp-speed">
                <button data-s="1" class="is-on">1x</button>
                <button data-s="4">4x</button>
                <button data-s="10">10x</button>
              </div>
              <div class="progress" id="rp-prog"><div class="progress__fill" id="rp-fill"></div></div>
            </div>
            <div class="heat-stage" id="rp-stage">
              <iframe id="rp-frame" width="400" height="720" title="Replay de la sesión" src="../mvp/?preview=${encodeURIComponent(firstScreen)}"></iframe>
              <div class="ghost" id="rp-ghost" style="left:200px;top:120px"></div>
            </div>
            <div class="muted" style="margin-top:8px;max-width:402px">Replay fantasma: pantallas según los screen_view reales y cursor en cada click mapeado. Pausas &gt;3 s comprimidas.</div>
          </div>
          <div class="heat-side">
            <div class="card">
              <div class="card__title">Timeline · ${events.length} eventos · ${Agg.fmtDur(events[events.length - 1].ts - t0)}</div>
              <div class="tline" id="rp-tline">${tline}</div>
            </div>
          </div>
        </div>`;

      el.querySelector("#ss-back").addEventListener("click", () => ctx.go("sessions"));

      /* --- armar el replay --- */
      replayStop();
      R.steps = buildSteps(events);
      R.steps.forEach((s, i) => { s.i = i; });
      R.total = R.steps.length ? R.steps[R.steps.length - 1].at : 0;
      R.idx = 0; R.vt = 0; R.speed = 1;
      R.app = null; R.type = "stay"; R.curScreen = firstScreen;
      R.geom = {}; R.lastGeom = null;
      R.els = {
        frame: el.querySelector("#rp-frame"),
        ghost: el.querySelector("#rp-ghost"),
        fill: el.querySelector("#rp-fill"),
        play: el.querySelector("#rp-play"),
        tline: el.querySelector("#rp-tline"),
      };

      R.msgHandler = (e) => {
        const d = e.data || {};
        if (d.cl !== "preview-ready") return;
        R.geom[d.screen] = d;
        R.lastGeom = d;
        R.els.frame.height = d.docTotal;
      };
      window.addEventListener("message", R.msgHandler);

      R.els.play.addEventListener("click", () => (R.playing ? replayPause() : replayPlay()));
      el.querySelector("#rp-speed").addEventListener("click", (e) => {
        const b = e.target.closest("[data-s]");
        if (!b) return;
        R.speed = Number(b.dataset.s);
        el.querySelectorAll("#rp-speed button").forEach((x) => x.classList.toggle("is-on", x === b));
      });
      el.querySelector("#rp-prog").addEventListener("click", (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        replaySeek(((e.clientX - r.left) / r.width) * R.total);
        if (!R.playing) R.els.play.textContent = "▶ Play";
      });
      // Click en una fila del timeline = saltar a ese momento.
      R.els.tline.addEventListener("click", (e) => {
        const row = e.target.closest("[data-i]");
        if (!row) return;
        replaySeek(R.steps[Number(row.dataset.i)].at);
      });
    },

    destroy() {
      replayStop();
    },
  };
})();
