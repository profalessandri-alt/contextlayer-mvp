/* ============================================================================
 * ContextLayer · MVP para pruebas de usuario
 * data.js — Datos mock y esquema del "pasaporte de contexto personal"
 *
 * Alcance: HOSPEDAJE DIGITAL. El contexto y todos los actores (apps, webs,
 * comercios y agentes) son del vertical de alojamiento: hoteles, OTAs
 * (Booking, Airbnb) y agentes de IA de viaje.
 *
 * Modelo (estilo AI Passport): la persona guarda su contexto una sola vez;
 * cada app/comercio pide los CAMPOS EXACTOS que necesita, con un PROPÓSITO y
 * una DURACIÓN; la persona aprueba por campo; cada acceso deja un RECIBO; y
 * las apps pueden SUGERIR escrituras que la persona acepta o rechaza.
 *
 * Nota: prototipo. Todo el estado vive en memoria; nada se integra con
 * sistemas reales.
 * ==========================================================================*/

const CL_DATA = {

  arquetipo: {
    nombre: "Valentina",
    detalle: "Viajera frecuente · 4 a 6 viajes al año",
  },

  /* ------------------------------------------------------------------------
   * PASAPORTE DE CONTEXTO (acotado a hospedaje).
   * Cada campo tiene una `key` punteada (stay.*) usada por las solicitudes
   * para pedir campos exactos, como en el ejemplo de referencia.
   * ----------------------------------------------------------------------*/
  passport: [
    {
      id: "identidad",
      dominio: "Identidad",
      icono: "👤",
      campos: [
        { key: "identity.name", label: "Nombre", tipo: "text", valor: "Valentina R." },
        { key: "identity.city", label: "Ciudad base", tipo: "text", valor: "Buenos Aires" },
        { key: "identity.language", label: "Idioma preferido", tipo: "select", valor: "Español", opciones: ["Español", "Inglés", "Portugués"] },
      ],
    },
    {
      id: "preferencias",
      dominio: "Preferencias de estadía",
      icono: "🏨",
      campos: [
        { key: "stay.type", label: "Tipo de alojamiento", tipo: "select", valor: "Hotel boutique", opciones: ["Hotel boutique", "Hotel de cadena", "Departamento", "Cabaña / retiro"] },
        { key: "stay.ambiance", label: "Ambiente que buscás", tipo: "select", valor: "Tranquilo para trabajar", opciones: ["Tranquilo para trabajar", "Social / con movimiento", "Naturaleza", "Lujo / spa"] },
        { key: "stay.activities", label: "Estilo de actividades", tipo: "select", valor: "Enoturismo y caminatas suaves", opciones: ["Enoturismo y caminatas suaves", "Aventura / alta exigencia", "Cultural / museos", "Gastronómico"] },
      ],
    },
    {
      id: "restricciones",
      dominio: "Restricciones",
      icono: "⛔",
      campos: [
        { key: "stay.diet", label: "Restricción de comida", tipo: "select", valor: "No come carne", opciones: ["Sin restricciones", "No come carne", "Vegana", "Celíaca", "Sin lácteos"] },
        { key: "stay.wifi", label: "WiFi", tipo: "select", valor: "Innegociable", opciones: ["Innegociable", "Deseable", "Indistinto"] },
        { key: "stay.accessibility", label: "Accesibilidad", tipo: "select", valor: "No requiere", opciones: ["No requiere", "Habitación en planta baja", "Acceso para silla de ruedas"] },
      ],
    },
    {
      id: "presupuesto",
      dominio: "Presupuesto por noche",
      icono: "💳",
      campos: [
        { key: "stay.budget.currency", label: "Moneda", tipo: "select", valor: "USD", opciones: ["USD", "ARS", "EUR"] },
        { key: "stay.budget.max", label: "Máximo por noche", tipo: "number", valor: 180 },
        { key: "stay.budget.flex", label: "Flexibilidad", tipo: "select", valor: "±15% por buen match", opciones: ["Estricto", "±15% por buen match", "Flexible"] },
      ],
    },
    {
      id: "grupo",
      dominio: "Grupo y ocasión",
      icono: "🧳",
      campos: [
        { key: "stay.group.people", label: "Personas", tipo: "number", valor: 1 },
        { key: "stay.occasion", label: "Ocasión del viaje", tipo: "select", valor: "Trabajo remoto", opciones: ["Trabajo remoto", "Escapada en pareja", "Familiar", "Con amigos"] },
      ],
    },
  ],

  /* ------------------------------------------------------------------------
   * PERMISOS ACTIVOS (grants ya otorgados). Cada uno se puede revocar.
   * ----------------------------------------------------------------------*/
  grantsIniciales: [
    {
      id: "grant-aria",
      solicitante: "Aria · tu agente de viaje",
      icono: "🤖",
      fields: ["stay.type", "stay.ambiance", "stay.diet", "stay.budget.max"],
      proposito: "Buscar alojamiento en tu nombre",
      duracion: "Hasta que lo revoques",
      activo: true,
    },
    {
      id: "grant-airbnb",
      solicitante: "Airbnb",
      appId: "app-airbnb",
      icono: "🏠",
      fields: ["identity.name", "stay.type"],
      proposito: "Recordarte entre búsquedas",
      duracion: "Vence en 12 días",
      activo: true,
    },
  ],

  /* ------------------------------------------------------------------------
   * RECIBOS (actividad auditable): cada lectura y cada escritura.
   * ----------------------------------------------------------------------*/
  receipts: [
    { tipo: "read", solicitante: "Airbnb", appId: "app-airbnb", icono: "🏠", detalle: "Leyó tu nombre y tipo de alojamiento", fields: ["identity.name", "stay.type"], fecha: "Hoy, 10:22" },
    { tipo: "write", solicitante: "Aria · tu agente de viaje", icono: "🤖", detalle: "Actualizó tus preferencias de estadía (con tu ok)", fields: ["stay.ambiance"], fecha: "Ayer, 19:05" },
    { tipo: "read", solicitante: "Booking.com", appId: "app-booking", icono: "🌐", detalle: "Leyó tu presupuesto por noche", fields: ["stay.budget.max"], fecha: "Hace 3 días" },
  ],

  pedidoSugerido: "Hotel tranquilo en Mendoza para trabajar 3 días",
  pedidoSugeridoTour: "Un tour de bodegas con almuerzo sin carne en Mendoza",

  /* ------------------------------------------------------------------------
   * RESERVAS del usuario (hechas vía apps conectadas). `estado`:
   * "en_curso" (próxima o en marcha) | "finalizada" (ya ocurrió).
   * Se agregan nuevas cuando el usuario confirma una reserva en la app.
   * ----------------------------------------------------------------------*/
  reservasBase: [
    {
      id: "rsv-seed-1",
      hotel: "Casa Andina Boutique",
      appId: "app-airbnb",
      zona: "Chacras de Coria, Mendoza",
      fechas: "18–21 sep 2026",
      noches: 3,
      precioNoche: 155,
      moneda: "USD",
      estado: "en_curso",
    },
    {
      id: "rsv-seed-2",
      hotel: "Posada del Alto",
      appId: "app-booking",
      zona: "Godoy Cruz, Mendoza",
      fechas: "10–13 mar 2026",
      noches: 3,
      precioNoche: 140,
      moneda: "USD",
      estado: "finalizada",
    },
    {
      id: "rsv-seed-3",
      hotel: "Hotel de Bodega Terruño",
      appId: "app-terruno",
      zona: "Luján de Cuyo, Mendoza",
      fechas: "4–6 nov 2025",
      noches: 2,
      precioNoche: 172,
      moneda: "USD",
      estado: "finalizada",
    },
    {
      id: "rsv-seed-4",
      esTour: true,
      hotel: "Clase de cocina mendocina (veggie friendly)",
      appId: "app-booking",
      zona: "Ciudad de Mendoza",
      fechas: "5 nov 2025",
      duracion: "4 h",
      precio: 65,
      moneda: "USD",
      estado: "finalizada",
    },
  ],

  /* ------------------------------------------------------------------------
   * RESULTADOS del agente: 3 hoteles ya matcheados contra el contexto.
   * ----------------------------------------------------------------------*/
  opciones: [
    {
      id: "opt-1",
      nombre: "Hotel de Bodega Terruño",
      zona: "Luján de Cuyo, Mendoza",
      precioNoche: 172,
      moneda: "USD",
      rating: 4.8,
      destacada: true,
      sourceAppId: "app-terruno",
      match: [
        "Habitación silenciosa, ala de trabajo (buscás tranquilidad)",
        "Desayuno sin carne confirmado (tu restricción)",
        "WiFi fibra dedicada (innegociable para vos)",
        "US$172/noche, dentro de tu presupuesto",
      ],
      contextoUsado: ["stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max"],
      amenities: ["WiFi fibra", "Escritorio", "Menú sin carne", "Viñedos"],
    },
    {
      id: "opt-2",
      nombre: "Casa Andina Boutique",
      zona: "Chacras de Coria, Mendoza",
      precioNoche: 155,
      moneda: "USD",
      rating: 4.6,
      destacada: false,
      sourceAppId: "app-airbnb",
      match: [
        "Zona residencial tranquila",
        "Opciones veganas y sin carne en el restaurante",
        "WiFi de alta velocidad verificado",
        "US$155/noche, por debajo de tu tope",
      ],
      contextoUsado: ["stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max"],
      amenities: ["WiFi", "Coworking", "Bici", "Pileta"],
    },
    {
      id: "opt-3",
      nombre: "Finca del Silencio",
      zona: "Maipú, Mendoza",
      precioNoche: 198,
      moneda: "USD",
      rating: 4.9,
      destacada: false,
      sourceAppId: "app-booking",
      match: [
        "Retiro de trabajo entre viñedos, sin ruido",
        "Cocina de autor con carta sin carne",
        "WiFi Starlink + escritorio ergonómico",
        "US$198/noche (sobre tu tope, dentro de tu ±15%)",
      ],
      contextoUsado: ["stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max", "stay.occasion"],
      amenities: ["Starlink", "Escritorio", "Spa", "Menú de autor"],
    },
    {
      id: "opt-4",
      nombre: "Viñas Lodge & Co-work",
      zona: "Tupungato, Valle de Uco",
      precioNoche: 165,
      moneda: "USD",
      rating: 4.7,
      destacada: false,
      sourceAppId: "app-airbnb",
      match: [
        "Espacio de co-work silencioso incluido",
        "Menú del día siempre con opción sin carne",
        "Fibra óptica simétrica verificada",
        "US$165/noche, dentro de tu presupuesto",
      ],
      contextoUsado: ["stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max"],
      amenities: ["Co-work", "WiFi fibra", "Desayuno flexible", "Vista al valle"],
    },
    {
      id: "opt-5",
      nombre: "Posada del Alto",
      zona: "Godoy Cruz, Mendoza",
      precioNoche: 140,
      moneda: "USD",
      rating: 4.5,
      destacada: false,
      sourceAppId: "app-booking",
      match: [
        "Barrio tranquilo, ideal para trabajar",
        "Cocina propia con alternativas sin carne",
        "WiFi estable en toda la posada",
        "US$140/noche, la opción más económica de tu match",
      ],
      contextoUsado: ["stay.ambiance", "stay.diet", "stay.wifi", "stay.budget.max"],
      amenities: ["WiFi", "Cocina", "Escritorio", "Terraza"],
    },
  ],

  /* ------------------------------------------------------------------------
   * TOURS / EXPERIENCIAS ofrecidos por las apps conectadas. Mismo modelo que
   * las opciones de alojamiento, pero con `esTour: true`, `duracion` y
   * `categoria` (matchea con stay.activities del contexto).
   * ----------------------------------------------------------------------*/
  tours: [
    {
      id: "tour-1",
      esTour: true,
      nombre: "Tour de bodegas premium con almuerzo",
      zona: "Luján de Cuyo, Mendoza",
      categoria: "Enoturismo",
      duracion: "6 h · almuerzo incluido",
      precio: 95,
      moneda: "USD",
      rating: 4.9,
      destacada: true,
      sourceAppId: "app-civitatis",
      match: [
        "Enoturismo, tu estilo de actividad preferido",
        "Menú de pasos con opción sin carne (tu restricción)",
        "Ritmo tranquilo, grupos reducidos",
        "US$95 por persona, dentro de tu presupuesto",
      ],
      contextoUsado: ["stay.activities", "stay.diet", "stay.budget.max"],
    },
    {
      id: "tour-2",
      esTour: true,
      nombre: "Caminata suave entre viñedos al atardecer",
      zona: "Valle de Uco, Mendoza",
      categoria: "Enoturismo",
      duracion: "3 h · con degustación",
      precio: 48,
      moneda: "USD",
      rating: 4.8,
      destacada: false,
      sourceAppId: "app-airbnb",
      match: [
        "Caminata suave, coincide con tu perfil",
        "Degustación con snacks sin carne",
        "Actividad relajada ideal para desconectar",
        "US$48 por persona",
      ],
      contextoUsado: ["stay.activities", "stay.diet", "stay.budget.max"],
    },
    {
      id: "tour-3",
      esTour: true,
      nombre: "Clase de cocina mendocina (veggie friendly)",
      zona: "Ciudad de Mendoza",
      categoria: "Gastronómico",
      duracion: "4 h",
      precio: 65,
      moneda: "USD",
      rating: 4.7,
      destacada: false,
      sourceAppId: "app-booking",
      match: [
        "Experiencia gastronómica local",
        "Recetas adaptadas sin carne",
        "En grupo reducido, ambiente tranquilo",
        "US$65 por persona",
      ],
      contextoUsado: ["stay.activities", "stay.diet", "stay.budget.max"],
    },
    {
      id: "tour-4",
      esTour: true,
      nombre: "Visita guiada a la bodega del hotel",
      zona: "Luján de Cuyo, Mendoza",
      categoria: "Enoturismo",
      duracion: "2 h · en el hotel",
      precio: 30,
      moneda: "USD",
      rating: 4.6,
      destacada: false,
      sourceAppId: "app-terruno",
      match: [
        "Sin traslados: es en tu propio alojamiento",
        "Cata con opción de maridaje sin carne",
        "Perfecta para una tarde tranquila",
        "US$30 por persona",
      ],
      contextoUsado: ["stay.activities", "stay.diet", "stay.budget.max"],
    },
    {
      id: "tour-5",
      esTour: true,
      nombre: "Cabalgata al pie de la cordillera",
      zona: "Potrerillos, Mendoza",
      categoria: "Aventura",
      duracion: "5 h · guía bilingüe",
      precio: 80,
      moneda: "USD",
      rating: 4.7,
      destacada: false,
      sourceAppId: "app-civitatis",
      match: [
        "Naturaleza y aire libre",
        "Almuerzo de campo con alternativa sin carne",
        "Nivel accesible, sin exigencia extrema",
        "US$80 por persona",
      ],
      contextoUsado: ["stay.activities", "stay.diet", "stay.budget.max"],
    },
  ],

  /* ------------------------------------------------------------------------
   * APPS DE TERCEROS conectadas (hospedaje) que ofrecen
   * "Iniciar sesión con ContextLayer". Al loguearse, la app pide un alcance
   * (fields) con propósito y duración; el usuario consiente y su contexto
   * viaja a esa app en cada compra/reserva.
   * ----------------------------------------------------------------------*/
  connectedApps: [
    {
      id: "app-airbnb",
      nombre: "Airbnb",
      icono: "🏠",
      color: "#FF385C",
      tagline: "Alojamientos y experiencias",
      fields: ["identity.name", "stay.type", "stay.ambiance", "stay.budget.max"],
      proposito: "Personalizar tu búsqueda de alojamiento sin cuestionarios",
      duracion: "Mientras uses la app",
      resultsTitle: "Alojamientos para vos",
      brand: {
        primary: "#FF385C",
        headerBg: "#ffffff",
        headerInk: "#FF385C",
        font: "'Poppins','Segoe UI',sans-serif",
        wordmark: '<span style="color:#FF385C;font-weight:800;font-size:1.7rem;letter-spacing:-.5px">airbnb</span>',
        eyebrow: "",
        mark: "a",
        markFont: "'Poppins',sans-serif",
      },
    },
    {
      id: "app-terruno",
      nombre: "Hotel de Bodega Terruño",
      icono: "🏨",
      color: "#6E2233",
      tagline: "Reservá directo con el hotel",
      fields: ["identity.name", "stay.diet", "stay.wifi", "stay.ambiance"],
      proposito: "Preparar tu habitación y desayuno antes del check-in",
      duracion: "Esta reserva",
      resultsTitle: "Tu estadía, a tu medida",
      brand: {
        primary: "#6E2233",
        headerBg: "#6E2233",
        headerInk: "#ffffff",
        font: "Georgia,'Times New Roman',serif",
        wordmark: '<span style="font-family:Georgia,serif;color:#fff;font-weight:700;font-size:1.5rem;letter-spacing:.5px">Terruño</span>',
        eyebrow: "HOTEL DE BODEGA",
        mark: "T",
        markFont: "Georgia,serif",
      },
    },
    {
      id: "app-civitatis",
      nombre: "Civitatis",
      icono: "🎟️",
      color: "#E30613",
      tagline: "Tours y experiencias",
      fields: ["identity.name", "stay.activities", "stay.budget.max"],
      proposito: "Recomendarte experiencias según tus gustos",
      duracion: "Esta sesión",
      resultsTitle: "Experiencias para vos",
      brand: {
        primary: "#E30613",
        headerBg: "#E30613",
        headerInk: "#ffffff",
        font: "'Montserrat','Segoe UI',sans-serif",
        wordmark: '<span style="color:#fff;font-weight:800;font-size:1.55rem;letter-spacing:.5px">Civitatis</span>',
        eyebrow: "",
        mark: "C",
        markFont: "'Montserrat',sans-serif",
      },
    },
    {
      id: "app-booking",
      nombre: "Booking.com",
      icono: "🅱️",
      color: "#003580",
      tagline: "Hoteles y experiencias",
      fields: ["identity.name", "stay.type", "stay.budget.max"],
      proposito: "Ordenar los resultados según tu contexto",
      duracion: "Esta sesión",
      resultsTitle: "Hoteles ordenados para vos",
      brand: {
        primary: "#003580",
        headerBg: "#003580",
        headerInk: "#ffffff",
        accent: "#febb02",
        font: "'Segoe UI',Arial,sans-serif",
        wordmark: '<span style="color:#fff;font-weight:800;font-size:1.5rem">Booking.com</span>',
        eyebrow: "",
        mark: "B.",
        markFont: "'Segoe UI',Arial,sans-serif",
      },
    },
  ],
};

window.CL_DATA = CL_DATA;
