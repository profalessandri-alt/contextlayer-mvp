/* ============================================================================
 * ContextLayer · config.js — configuración compartida (mvp + admin)
 *
 * SUPABASE_URL y SUPABASE_ANON_KEY se completan una sola vez siguiendo
 * docs/SETUP-ANALYTICS.md. La anon key es pública por diseño: la seguridad
 * la dan las políticas RLS del esquema (analytics/schema.sql).
 *
 * Con los dos campos vacíos, la app y el dashboard funcionan en MODO LOCAL:
 * los eventos se guardan en el navegador y /admin muestra esos datos.
 * ==========================================================================*/

window.CL_CFG = {
  VERSION: "2.0.0",

  // Proyecto MVP-NBL-UDESA.
  SUPABASE_URL: "https://mprxazoemhwocrxdewqd.supabase.co",
  // Key "publishable": pública por diseño; la seguridad la da la RLS.
  SUPABASE_ANON_KEY: "sb_publishable_2UyHOTaea4KmbO1XosPfhA_oNi0Qp-k",

  // Transiciones con View Transitions API donde exista (además del fallback).
  useViewTransitions: false,
};
