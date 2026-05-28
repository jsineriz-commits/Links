# CONTEXTO DEL PROYECTO — deCampoaCampo Story Generator

## ¿Qué es?

Una web app desplegada en **Vercel** que toma el link de una publicación del sitio [decampoacampo.com](https://www.decampoacampo.com/) y genera automáticamente una imagen (story) lista para compartir en **WhatsApp Status** o **Instagram Stories**.

El usuario solo pega el link, toca un botón, y obtiene una imagen profesional con todos los datos del lote (foto, categoría, cantidad de cabezas, peso, ubicación y precio) sobre un fondo de color personalizable.

---

## URLs

- **Producción (Vercel):** https://links-ashen-eta.vercel.app
  *(proyecto `links` bajo cuenta `juansineriz-s-projects`)*
- **URL vieja (desconectada):** https://links-wine-xi.vercel.app
  *(era de otra sesión de Vercel — ya no auto-deplíea)*
- **Repositorio GitHub:** https://github.com/jsineriz-commits/Links.git
- **Sitio origen de los datos:** https://www.decampoacampo.com/

> **Para reconectar auto-deploy GitHub → Vercel:**
> Entrar a [vercel.com](https://vercel.com) → proyecto `links` → Settings → Git → conectar `jsineriz-commits/Links`
> (requiere instalar la GitHub App de Vercel en la org `jsineriz-commits`)
>
> **Para deployar manualmente desde la PC:**
> ```bash
> npx vercel --prod --yes
> ```

---

## Estructura de archivos

```
Links/
├── index.html        ← Toda la UI y lógica del cliente (canvas, parsing, share)
├── vercel.json       ← Config de rutas y build de Vercel
├── dev-server.cjs    ← Servidor local de desarrollo (Node.js, sin npm install)
├── CONTEXTO.md       ← Este archivo de documentación
├── .gitignore
└── api/
    ├── proxy.js      ← Serverless function: fetcha el HTML del lote (CORS bypass)
    └── image.js      ← Serverless function: proxea imágenes externas al canvas
```

---

## Cómo funciona (flujo completo)

### 1. El usuario pega un link
Puede ser link largo o link corto:
- **Link largo:** `https://www.decampoacampo.com/__dcac/25-Vacas-CUT-Prenadas-480kg-invernada-31667`
- **Link corto:** `https://www.decampoacampo.com/cria/31667`

### 2. El proxy fetchea el HTML (`/api/proxy.js`)
El browser no puede fetchear HTML de otro dominio por CORS. La serverless function actúa como intermediaria:

1. Hace `GET` a la URL con headers de browser real (User-Agent, Accept, etc.)
2. Sigue redirects HTTP (301/302) automáticamente
3. **Clave:** Si el HTML tiene un redirect JavaScript (`window.location.href = '...'`) — como ocurre con los links cortos `/cria/` — lo detecta con regex y hace un segundo fetch a esa URL real
4. Si aún no tiene og:tags, busca el `<link rel="canonical">` y fetchea esa URL
5. Devuelve el HTML final con `X-Final-Url` en el header

### 3. El cliente parsea el HTML
En `index.html`, la función `parseHTML()` extrae:
- `og:image` → imagen del lote (video thumbnail)
- `og:title` → título completo del lote
- `og:description` → descripción / zona
- `og:url` → URL canónica
- Precio: busca patrones `$X.XXX.XXX` en el HTML
- SKU/ID del lote: del URL o de elementos `.numero_lote`
- Categoría, cabezas, peso promedio: del título y de la descripción

### 4. La imagen se carga via proxy (`/api/image.js`)
El canvas HTML5 no puede dibujar imágenes de otros dominios (CORS taint). La función `/api/image` fetchea la imagen y la devuelve con header `Access-Control-Allow-Origin: *`, permitiendo dibujarla en el canvas sin problemas.

### 5. Se dibuja el canvas (1080×1920 px)
La función `drawStory()` dibuja en un canvas de formato story vertical:

```
┌─────────────────────────────┐  ← y=0 (zona segura: 74px vacíos arriba)
│  [LOGO deCampoaCampo] [#ID] │  ← logo izq + pill "Lote #XXXXX" derecha (y=74)
├─────────────────────────────┤  ← y=138: foto del lote
│                             │
│        📷 IMAGEN            │     (46% del alto = ~883px, cover-fit, bordes redondeados)
│                             │
│   ┌──────────────────┐      │
│   │   VACAS CUT      │      │     (badge de categoría sobre foto, abajo-izq)
│   └──────────────────┘      │
├─────────────────────────────┤
│  ⚖️  480 kg Promedio         │     (ícono SVG personalizado + texto)
│  🐄  25 Cabezas              │
│  📍  Buenos Aires, Prov.    │     (puede wrappear si es largo)
│  📄  Mensaje extra           │     (solo si el usuario escribió algo, en negrita)
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │  $1.750.000/cabeza  │    │     (barra de precio, 80px arriba del borde)
│  └─────────────────────┘    │
└─────────────────────────────┘  ← 80px zona segura abajo (barra de texto de apps)
```

**Zonas seguras:**
- **Arriba:** 74px transparentes → la foto de perfil del usuario en WhatsApp/IG no tapa el logo
- **Abajo:** 80px vacíos → la barra de texto de WhatsApp/IG no tapa el precio

### 6. Los íconos de las filas
Los 4 íconos de las filas de datos son **imágenes SVG** cargadas como data-URIs al inicio:

| Ícono | Para | SVG |
|---|---|---|
| ⚖️ kg | Peso promedio | Custom SVG (rect + handle + texto "kg") |
| 🐄 vaca | Cantidad de cabezas | Custom SVG (cabeza con cuernos, hocico) |
| 📍 pin | Zona/ubicación | Font Awesome `fa-location-dot` |
| 📄 nota | Mensaje extra | Font Awesome `fa-file-lines` |

### 7. El usuario comparte
- En **móvil:** usa la Web Share API (`navigator.share`) para enviar la imagen directamente a WhatsApp, Instagram, etc.
- En **desktop:** descarga la imagen como PNG.

---

## Personalización disponible

| Opción | Descripción |
|---|---|
| **Tema de color** | 8 colores de fondo oscuros: Azul, Verde, Amarillo, Rojo, Naranja, Violeta, Negro, Celeste |
| **Mensaje extra** | Texto libre → aparece con ícono 📄 en **negrita**, solo si se completa |

---

## Temas de color disponibles

| ID | Label | Fondo | Acento | Barra |
|---|---|---|---|---|
| `cielo` | Azul ⭐ (default) | `#030c18 → #0b2038` | `#60b0ff` | `#1666a8` |
| `campo` | Verde | `#030f05 → #082010` | `#4ade80` | `#147a36` |
| `tierra` | Amarillo | `#100800 → #221200` | `#f0c030` | `#a05808` |
| `fuego` | Rojo | `#100303 → #1e0808` | `#f87171` | `#a81818` |
| `naranja` | Naranja | `#0e0500 → #1c0c00` | `#fb923c` | `#b83c08` |
| `noche` | Violeta | `#06060e → #0e0c1e` | `#c084fc` | `#5c18b8` |
| `negro` | Negro | `#000000 → #070707` | `#d0d0d0` | `#181818` |
| `celeste` | Celeste | `#000c1a → #00162e` | `#38bdf8` | `#0058a0` |

---

## Tipos de links soportados

### Link largo (directo)
```
https://www.decampoacampo.com/__dcac/25-Vacas-CUT-Prenadas-480kg-invernada-31667
```
El proxy fetchea directamente. El HTML de esa URL tiene todas las og:tags.

### Link corto
```
https://www.decampoacampo.com/cria/31667
```
El servidor de dcac devuelve un HTML con `<script>window.location.href = 'https://...__dcac/...'</script>`.
El proxy detecta este patrón JavaScript y hace un segundo fetch a la URL real.

---

## API Endpoints (Serverless Functions)

### `GET /api/proxy?url=<URL>`
Fetchea el HTML del lote desde decampoacampo.com, resolviendo redirects HTTP y JavaScript.

**Respuesta:**
- `Content-Type: text/plain; charset=utf-8`
- `X-Final-Url: <url final después de redirects>`
- Body: HTML completo de la página del lote

### `GET /api/image?url=<URL>`
Proxea cualquier imagen externa con CORS abierto.

**Respuesta:**
- `Content-Type: <tipo original>`
- `Cache-Control: public, max-age=86400`
- Body: bytes de la imagen

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JavaScript vanilla (sin frameworks) |
| Canvas | HTML5 Canvas API (1080×1920 px) |
| Backend | Node.js (Vercel Serverless Functions) |
| Deploy | Vercel (proyecto `links` — deploy manual con CLI) |
| Fuente | Google Fonts — Outfit |
| Repositorio | GitHub — jsineriz-commits/Links |

---

## Decisiones técnicas importantes

### ¿Por qué serverless functions?
El browser no puede hacer `fetch()` a `decampoacampo.com` por CORS. Las serverless functions actúan como proxy server-side que no tiene esas restricciones.

### ¿Por qué dos proxies (proxy.js e image.js)?
- `proxy.js` devuelve **texto HTML** para parsear
- `image.js` devuelve **bytes de imagen** con el Content-Type correcto para que el canvas pueda dibujarla sin CORS taint

### ¿Por qué canvas y no HTML/CSS?
La imagen debe poder descargarse como PNG y compartirse directamente con la Web Share API. Un canvas permite exportar píxeles; una página HTML no.

### ¿Por qué el logo está "blanqueado"?
El SVG original de deCampoaCampo tiene texto en azul `#3179a7`. Para que se vea sobre el fondo oscuro del header, se dibuja en un canvas temporal y se rellena de blanco con `globalCompositeOperation = 'source-in'`. El canvas temporal se hace de 800×130px para respetar la proporción natural del logo (~6.2:1).

### ¿Por qué 74px de margen arriba y 80px abajo?
- **Arriba:** En WhatsApp Status e Instagram Stories, la foto de perfil de quien publicó aparece en la esquina superior izquierda. Los 74px vacíos aseguran que el logo y el Lote# siempre sean visibles.
- **Abajo:** La barra de texto para responder en WhatsApp/IG aparece sobre los últimos ~60-70px. Con 80px de margen el precio siempre es visible.

### ¿Por qué íconos SVG en lugar de emoji?
Los emoji se renderizan diferente en cada sistema operativo (Android vs iOS vs Windows). Los SVG se renderizan igual en todos lados y se pueden hacer blancos sin problemas.

---

## Cómo hacer cambios

1. Editar los archivos en `c:\Users\Admin\.gemini\antigravity\scratch\premium-landing-page\Links\`
2. Probar localmente con `node dev-server.cjs` → abrir `http://localhost:3000`
   *(el dev server simula las serverless functions de Vercel)*
3. Subir con:
   ```bash
   git add -A
   git commit -m "descripción del cambio"
   git push origin main
   ```
4. Deployar en Vercel:
   ```bash
   npx vercel --prod --yes
   ```
