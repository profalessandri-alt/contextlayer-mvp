/* ============================================================================
 * ContextLayer · icons.js — set de íconos SVG inline
 *
 * Un solo estilo (grilla 24px, stroke 1.8, puntas redondeadas, currentColor)
 * para reemplazar los emojis del sistema: se ven idénticos en iOS, Android y
 * desktop. Geometría propia inspirada en Lucide (ISC).
 * ==========================================================================*/

(function () {
  "use strict";

  const P = {
    // Identidad / contexto
    "idcard": '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><circle cx="8.3" cy="10.4" r="1.9"/><path d="M5.4 15.8c.6-1.6 1.6-2.4 2.9-2.4s2.3.8 2.9 2.4"/><path d="M14 9.5h4.5M14 12.8h4.5"/>',
    "user": '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.9-3.4 3.4-5.2 7-5.2s6.1 1.8 7 5.2"/>',
    "hotel": '<path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V20"/><path d="M2.5 20h19"/><path d="M8 8h2M14 8h2M8 12h2M14 12h2M10.5 20v-3.5h3V20"/>',
    "ban": '<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/>',
    "credit-card": '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 14.5h4"/>',
    "luggage": '<rect x="6" y="7" width="12" height="13" rx="2"/><path d="M9.5 7V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3V7"/><path d="M9.5 11v5M14.5 11v5"/>',

    // Navegación / acciones
    "bell": '<path d="M12 4a5.5 5.5 0 0 0-5.5 5.5c0 4-1.7 5.6-1.7 5.6h14.4s-1.7-1.6-1.7-5.6A5.5 5.5 0 0 0 12 4z"/><path d="M10.2 18.5a2 2 0 0 0 3.6 0"/>',
    "receipt": '<path d="M6 3.5h12V20l-2.4-1.5L13.2 20l-1.2-.8-1.2.8-2.4-1.5L6 20z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    "lock": '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/><circle cx="12" cy="15.3" r="1.3"/>',
    "chat": '<path d="M12 3.5a8.4 8.4 0 0 1 8.5 8.3 8.4 8.4 0 0 1-8.5 8.3 8.8 8.8 0 0 1-3.5-.7L3.5 20.5l1.2-4.3a8 8 0 0 1-1.2-4.4A8.4 8.4 0 0 1 12 3.5z"/>',
    "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
    "send": '<path d="M4 12L20 4l-4.2 16-4.3-6.2z"/><path d="M11.5 13.8L20 4"/>',
    "check": '<path d="M4.5 12.5l5 5L19.5 7"/>',
    "chevron-left": '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
    "chevron-right": '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
    "search": '<circle cx="10.8" cy="10.8" r="6.3"/><path d="M15.4 15.4L20 20"/>',
    "x": '<path d="M6 6l12 12M18 6L6 18"/>',
    "edit": '<path d="M14.5 5.5l4 4L8 20H4v-4z"/><path d="M12.5 7.5l4 4"/>',

    // Contenido
    "star": '<path d="M12 3.6l2.5 5.2 5.7.7-4.2 4 1.1 5.7L12 16.4l-5.1 2.8 1.1-5.7-4.2-4 5.7-.7z"/>',
    "sparkles": '<path d="M12 4l1.7 4.3L18 10l-4.3 1.7L12 16l-1.7-4.3L6 10l4.3-1.7z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    "bot": '<rect x="4.5" y="8" width="15" height="11" rx="3"/><path d="M12 8V4.5M12 4.5h.01"/><circle cx="9" cy="13" r="1.1"/><circle cx="15" cy="13" r="1.1"/><path d="M9.5 16.3h5"/>',
    "wifi": '<path d="M3 9.5a13.5 13.5 0 0 1 18 0"/><path d="M6.2 13a9 9 0 0 1 11.6 0"/><path d="M9.4 16.4a4.5 4.5 0 0 1 5.2 0"/><circle cx="12" cy="19.3" r="0.8" fill="currentColor"/>',
    "ticket": '<path d="M3.5 9V6.5h17V9a2 2 0 0 0 0 6v2.5h-17V15a2 2 0 0 0 0-6z"/><path d="M13.5 7v2M13.5 15v2M13.5 11v2"/>',
    "gift": '<rect x="4" y="10.5" width="16" height="9.5" rx="1.5"/><path d="M3.5 7.5h17v3h-17z"/><path d="M12 7.5V20"/><path d="M12 7.5c-1.5-3-5.5-4-5.5-1.4 0 1.4 2.5 1.4 5.5 1.4zM12 7.5c1.5-3 5.5-4 5.5-1.4 0 1.4-2.5 1.4-5.5 1.4z"/>',
    "clock": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "shield": '<path d="M12 3.5l7 2.7v5.2c0 4.6-3 8-7 9.1-4-1.1-7-4.5-7-9.1V6.2z"/><path d="M9 12l2.2 2.2L15.5 9.7"/>',
    "home": '<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
    "moon": '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
    "sun": '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.4 5.4l1.4 1.4M17.2 17.2l1.4 1.4M18.6 5.4l-1.4 1.4M6.8 17.2l-1.4 1.4"/>',
    "refresh": '<path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L20 9.5"/><path d="M20 4.5v5h-5"/><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4 14.5"/><path d="M4 19.5v-5h5"/>',
    "compass": '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  };

  const CACHE = {};

  // icon("lock") → svg inline; icon("lock", "ico--lg") agrega clase extra.
  window.CL_ICONS = P;
  window.icon = function (name, cls) {
    const key = name + "|" + (cls || "");
    if (CACHE[key]) return CACHE[key];
    const path = P[name] || P["sparkles"];
    const svg =
      '<svg class="ico ' + (cls || "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
    CACHE[key] = svg;
    return svg;
  };
})();
