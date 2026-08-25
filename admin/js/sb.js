/* ============================================================================
 * ContextLayer · admin/sb.js — cliente mínimo de Supabase (sin SDK)
 *
 * GoTrue (login por password + refresh) y PostgREST (select/rpc) por fetch
 * directo. El token vive en sessionStorage: se pierde al cerrar la pestaña,
 * que es exactamente lo que queremos para un dashboard de admin.
 * ==========================================================================*/

(function () {
  "use strict";

  const CFG = window.CL_CFG || {};
  const URL_ = String(CFG.SUPABASE_URL || "").replace(/\/+$/, "");
  const KEY = CFG.SUPABASE_ANON_KEY || "";
  const TOK_KEY = "cl_admin_tok";

  const readTok = () => {
    try { return JSON.parse(sessionStorage.getItem(TOK_KEY)); } catch (e) { return null; }
  };
  const writeTok = (t) => {
    try {
      if (t) sessionStorage.setItem(TOK_KEY, JSON.stringify(t));
      else sessionStorage.removeItem(TOK_KEY);
    } catch (e) {}
  };

  async function gotrue(path, body) {
    const r = await fetch(URL_ + "/auth/v1/" + path, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: KEY },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(d.error_description || d.msg || d.message || ("Error de autenticación (" + r.status + ")"));
    }
    return d;
  }

  function storeSession(d) {
    writeTok({
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: Date.now() + (d.expires_in || 3600) * 1000,
      email: (d.user && d.user.email) || null,
    });
  }

  // Devuelve un access token vigente, refrescando si está por vencer.
  async function token() {
    const t = readTok();
    if (!t) return null;
    if (Date.now() < t.expires_at - 60000) return t.access_token;
    try {
      const d = await gotrue("token?grant_type=refresh_token", { refresh_token: t.refresh_token });
      storeSession(d);
      return d.access_token;
    } catch (e) {
      writeTok(null);
      return null;
    }
  }

  async function rest(path, opts) {
    const tok = await token();
    if (!tok) throw new Error("SIN_SESION");
    const r = await fetch(URL_ + "/rest/v1/" + path, Object.assign({
      headers: Object.assign({
        apikey: KEY,
        authorization: "Bearer " + tok,
        "content-type": "application/json",
      }, (opts && opts.headers) || {}),
    }, opts || {}));
    if (r.status === 401) { writeTok(null); throw new Error("SIN_SESION"); }
    if (!r.ok) throw new Error("Supabase respondió " + r.status + " en " + path.split("?")[0]);
    return r;
  }

  const qs = (params) => {
    const p = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => p.append(k, params[k]));
    const s = p.toString();
    return s ? "?" + s : "";
  };

  window.SB = {
    configured: () => !!(URL_ && KEY),

    async login(email, password) {
      const d = await gotrue("token?grant_type=password", { email, password });
      storeSession(d);
      return d.user;
    },

    logout() { writeTok(null); },

    session() { return readTok(); },

    // sb.select('events', { type: 'eq.click', order: 'ts.asc', limit: 1000 })
    async select(table, params) {
      const r = await rest(table + qs(params));
      return r.json();
    },

    // Total sin traer filas (Prefer: count=exact + Range vacío).
    async count(table, params) {
      const r = await rest(table + qs(Object.assign({ select: "id" }, params)), {
        headers: { prefer: "count=exact", range: "0-0" },
      });
      const cr = r.headers.get("content-range") || "";
      return Number(cr.split("/")[1] || 0);
    },

    // Trae TODO el rango paginando de a 1000 (límite default de PostgREST).
    async selectAll(table, params, opts) {
      const page = (opts && opts.pageSize) || 1000;
      const max = (opts && opts.max) || 100000;
      const out = [];
      for (let off = 0; off < max; off += page) {
        const batch = await this.select(table, Object.assign({}, params, { limit: page, offset: off }));
        out.push.apply(out, batch);
        if (batch.length < page) break;
      }
      return out;
    },

    async rpc(name, args) {
      const r = await rest("rpc/" + name, { method: "POST", body: JSON.stringify(args || {}) });
      return r.json();
    },
  };
})();
