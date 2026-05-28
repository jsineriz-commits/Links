# CONTEXTO DEL PROYECTO — deCampoaCampo Story Generator

## ¿Qué es?

Una web app desplegada en **Vercel** que toma el link de una publicación del sitio [decampoacampo.com](https://www.decampoacampo.com/) y genera automáticamente una imagen (story) lista para compartir en **WhatsApp Status** o **Instagram Stories**.

El usuario solo pega el link, toca un botón, y obtiene una imagen profesional con todos los datos del lote (foto, categoría, cantidad de cabezas, peso, raza, ubicación y precio) sobre un fondo de color personalizable.

---

## URLs

- **Producción (Vercel):** https://links-wine-xi.vercel.app
- **Repositorio GitHub:** https://github.com/jsineriz-commits/Links.git
- **Sitio origen de los datos:** https://www.decampoacampo.com/

---

## Estructura de archivos

```
Links/
├── index.html        ← Toda la UI y lógica del cliente (canvas, parsing, share)
├── vercel.json       ← Config de rutas y build de Vercel
├── dev-server.cjs    ← Servidor local de desarrollo (Node.js, sin npm install)
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
- Categoría, cabezas, peso promedio, raza: del título y de la descripción

### 4. La imagen se carga via proxy (`/api/image.js`)
El canvas HTML5 no puede dibujar imágenes de otros dominios (CORS taint). La función `/api/image` fetchea la imagen y la devuelve con header `Access-Control-Allow-Origin: *`, permitiendo dibujarla en el canvas sin problemas.

### 5. Se dibuja el canvas (1080×1920 px)
La función `drawStory()` dibuja en un canvas de formato story vertical:

```
┌─────────────────────────────┐  ← y=0 (zona segura: 80px vacíos)
│                             │
├─────────────────────────────┤  ← y=80: barra superior
│  [LOGO deCampoaCampo]  #ID │     (logo en blanco + pill con Lote #XXXXX)
├─────────────────────────────┤  ← y=190: foto del lote
│                             │
│        📷 IMAGEN            │     (36% del alto total, cover-fit)
│                             │
│   ┌──────────────────┐      │
│   │   VACAS CUT      │      │     (badge de categoría sobre la foto)
│   └──────────────────┘      │
├─────────────────────────────┤
│  ┌──────────┐ ┌──────────┐  │
│  │   25     │ │  480 kg  │  │     (cards: cabezas y peso)
│  │ CABEZAS  │ │ PESO PROM│  │
│  └──────────┘ └──────────┘  │
│  Raza (bold, wraps)         │
│  📍 Zona (más grande)       │
│  ┌─────────────────────┐    │
│  │  $1.750.000/cabeza  │    │     (barra de precio)
│  └─────────────────────┘    │
│  *MENSAJE EXTRA* (opcional) │     (bold italic, si el usuario lo completa)
└─────────────────────────────┘
```

Los primeros **80px son transparentes** (zona segura) para que la foto de perfil del usuario en WhatsApp/Instagram no tape el contenido.

### 6. El usuario comparte
- En **móvil:** usa la Web Share API (`navigator.share`) para enviar la imagen directamente a WhatsApp, Instagram, etc.
- En **desktop:** descarga la imagen como PNG.

---

## Personalización disponible

| Opción | Descripción |
|---|---|
| **Tema de color** | 8 colores de fondo: Azul, Verde, Amarillo, Rojo, Naranja, Violeta, Negro, Celeste |
| **Mensaje extra** | Texto libre que aparece debajo del precio, en **negrita cursiva** |

---

## Temas de color disponibles

| ID | Label | Fondo | Acento | Barra |
|---|---|---|---|---|
| `cielo` | Azul ⭐ (default) | `#0a1628 → #1a3a5c` | `#60b0ff` | `#2980b9` |
| `campo` | Verde | `#0d2b0f → #1a4d1a` | `#4ade80` | `#27ae60` |
| `tierra` | Amarillo | `#2b1a0a → #4d3010` | `#f0c030` | `#c87820` |
| `fuego` | Rojo | `#2b0a0a → #4d1010` | `#f87171` | `#dc2626` |
| `naranja` | Naranja | `#1a0e00 → #3d2200` | `#fb923c` | `#ea580c` |
| `noche` | Violeta | `#0d0d14 → #1a1a2e` | `#c084fc` | `#7c3aed` |
| `negro` | Negro | `#000000 → #111111` | `#ffffff` | `#222222` |
| `celeste` | Celeste | `#001a2e → #003a5c` | `#38bdf8` | `#0284c7` |

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
| Deploy | Vercel (auto-deploy desde GitHub main) |
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
El SVG original de deCampoaCampo tiene texto en azul `#3179a7`. Para que se vea sobre el fondo oscuro del header, se dibuja en un canvas temporal y se rellena de blanco con `globalCompositeOperation = 'source-in'`.

### ¿Por qué 80px de margen arriba?
En WhatsApp Status e Instagram Stories, la foto de perfil de quien publicó aparece en la esquina superior izquierda. Si el contenido empieza desde y=0, tapa el logo y el ID del lote. Los 80px vacíos aseguran que el contenido siempre sea visible.

### ¿Por qué wrapText devuelve el Y final?
La descripción de raza y zona puede ser larga y ocupar 2+ líneas. Si `wrapText` no devuelve la posición Y del último texto dibujado, el siguiente elemento se posiciona de más y se superpone. El retorno del Y final permite acumular el offset correctamente.

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
4. Vercel detecta el push y despliega automáticamente en ~1-2 minutos.
