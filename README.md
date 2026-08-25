# ContextLayer · MVP v2

Prototipo de **pasaporte de contexto personal** para hospedaje digital (módulo 5, NBL · UDESA).
La persona carga una vez cómo le gusta viajar; cada app, hotel o agente pide **solo los campos
que necesita**, con propósito y vencimiento; todo acceso deja recibo y se puede revocar.

100% estático (vanilla JS, sin build step). Pensado para **GitHub Pages** + **Supabase** (analytics).

## Estructura

```
index.html                Redirect a /mvp
mvp/                      La app (prototipo para testers)
  js/config.js            Config compartida: credenciales Supabase + versión
  js/app.js               Router, estado, pantallas, transiciones
  js/data.js              Datos mock del vertical hospedaje
  js/track.js             Tracker de analítica (anónimo, ver Privacidad)
  js/icons.js             Set de íconos SVG inline
admin/                    Dashboard de analytics (login solo admins)
analytics/schema.sql      Esquema Supabase: tablas + RLS (pegar en SQL Editor)
docs/SETUP-ANALYTICS.md   Setup completo de Supabase + GitHub Pages (~15 min)
```

## Correr local

```bash
python3 -m http.server 8000
# → http://localhost:8000/mvp/     (la app)
# → http://localhost:8000/admin/   (el dashboard)
```

Sin configurar nada, todo corre en **modo local**: los eventos quedan en el navegador
y `/admin` muestra los de ese mismo navegador (o datos de ejemplo generados).

## Deploy

GitHub Pages: **Settings → Pages → Deploy from a branch** → rama elegida, carpeta `/ (root)`.
El sitio queda en `https://<usuario>.github.io/contextlayer/`.

Para juntar **datos reales de testers** (cross-device) y habilitar el login del dashboard,
seguir [`docs/SETUP-ANALYTICS.md`](docs/SETUP-ANALYTICS.md).

## URLs útiles

| URL | Qué hace |
|---|---|
| `/mvp/?reset=1` | Limpia el estado guardado (entre testers en el mismo dispositivo) |
| `/mvp/#/pantalla` | Deep link a cualquier pantalla (`#/pasaporte`, `#/premium`, …) |
| `/mvp/?preview=pantalla` | Render congelado con datos demo (lo usa el dashboard) |

## Mantenimiento

- **Cache-busting**: GitHub Pages cachea ~10 min. Al tocar CSS/JS, subí el `?v=NN`
  de los `<script>`/`<link>` en `mvp/index.html` y `admin/index.html`.
- **Privacidad del tracking**: nunca se envían valores del pasaporte ni texto del
  chat/pedido — solo pantallas, acciones, keys de campos y longitudes. IDs anónimos,
  sin cookies. Ver `mvp/js/track.js`.
