# OpenMerch Engine — Referencia de API

Este documento describe la API REST expuesta por `packages/api` (Fastify). Todos los endpoints
están montados bajo el prefijo `/api/v1/`. Salvo que se indique lo contrario, los cuerpos de
request y response son JSON (`Content-Type: application/json`).

URL base en desarrollo local: `http://localhost:3001` (puerto configurable vía la variable de
entorno `PORT`).

## Autenticación

**Hoy no existe autenticación ni autorización en ningún endpoint.** Cualquier persona que pueda
alcanzar el servidor puede acceder a todas las rutas listadas abajo, incluyendo los endpoints de
settings/proxy que tocan API keys de terceros. Este es un gap conocido y rastreado — ver
`ARCHITECTURE.md` para la postura de seguridad actual y el plan para agregarla. No expongas esta
API directamente a internet público sin un reverse proxy / capa de auth por delante.

## Validación de schema

Fastify soporta validación por ruta con JSON Schema (`schema: { body, params, querystring,
response }`), que es también lo que impulsa la documentación auto-generada de OpenAPI/Swagger.
**A la fecha de este escrito, ninguno de los 12 archivos de rutas define un `schema` de Fastify.**
El tipado de requests se hace solo a nivel TypeScript (parámetros de tipo genéricos en
`app.get<...>`, `app.post<...>`, etc.), lo cual da seguridad en el editor/compile-time pero **no
realiza validación en runtime** — el servidor va a aceptar bodies malformados y o bien lanzar un
error en runtime o insertar datos incorrectos. Esto se señala por recurso más abajo y debe
tratarse como un gap, no como una decisión de diseño.

## Convenciones

- Todas las tablas de recursos usan una llave primaria `uuid` `id`, más timestamps `createdAt` /
  `updatedAt` (ver `packages/api/src/db/schema.ts` para las definiciones exactas de columnas).
- Los campos tipados `jsonb` en Postgres (ej. `categories`, `tags`, `zones`) se almacenan como JSON
  y se devuelven como JSON en las responses; al escribir, los route handlers hacen
  `JSON.stringify` de lo que envíes, así que manda arrays/objetos reales, no strings
  pre-serializados.
- Los campos monetarios (`price`, `total`) son enteros en **centavos**.
- El cuerpo de una respuesta 404 tiene la forma `{ "error": string, "code": string }`.
- Ningún endpoint pagina actualmente; los endpoints `GET` de listado devuelven la tabla completa.

---

## Health

### `GET /api/v1/health`

Liveness check. Sin params.

**Response `200`**
```json
{
  "status": "ok",
  "timestamp": "2026-07-27T12:00:00.000Z",
  "version": "0.0.1"
}
```

```bash
curl http://localhost:3001/api/v1/health
```

Sin schema de Fastify definido.

---

## Products

Respaldado por la tabla `products`. `zones` describe las áreas imprimibles de un producto (usado
por el editor de diseño); `variants` / `variantLabel` describen variantes comprables (ej.
color/talla).

### `GET /api/v1/products`
Devuelve todos los productos, sin filtrado ni paginación.

### `GET /api/v1/products/:id`
Path param: `id` (uuid). `404 { error: "Product not found", code: "PRODUCT_NOT_FOUND" }` si no
existe.

### `POST /api/v1/products`
**Body**
```json
{
  "name": "string (requerido)",
  "slug": "string (requerido, único)",
  "description": "string (opcional)",
  "price": "entero, centavos (opcional, default 0)",
  "categories": "string[] (opcional, default [])",
  "printingTechniques": "string[] (opcional, default [])",
  "active": "boolean (opcional, default true)",
  "zones": "unknown[] (requerido)"
}
```
Devuelve el producto creado (`201` no se define explícitamente — el handler devuelve la fila con
el default `200`).

### `PUT /api/v1/products/:id`
Actualización parcial — todos los campos son opcionales; solo se actualizan los campos presentes
en el body. Acepta los mismos campos que `POST` más `variants` (`unknown[]`) y `variantLabel`
(`string | null`). `404` con `PRODUCT_NOT_FOUND` si el id no existe.

### `DELETE /api/v1/products/:id`
Devuelve `{ "success": true }`, o `404 PRODUCT_NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Classic T-Shirt",
    "slug": "classic-tshirt",
    "price": 1999,
    "zones": [{ "id": "front", "label": "Front" }]
  }'

curl http://localhost:3001/api/v1/products/<id>

curl -X PUT http://localhost:3001/api/v1/products/<id> \
  -H "Content-Type: application/json" \
  -d '{ "active": false }'

curl -X DELETE http://localhost:3001/api/v1/products/<id>
```

Sin schema de Fastify definido en ninguna de estas rutas — los request bodies se validan solo con
tipos de TypeScript en compile-time, no en runtime.

---

## Designs

Respaldado por la tabla `designs`. Un design pertenece a un `productId` y almacena el blob
`designData` del editor (layers, posiciones, URLs de imágenes, etc. — JSON opaco desde el punto de
vista de la API) más cantidades por talla y estado de producción.

### `POST /api/v1/designs`
**Body**
```json
{
  "productId": "uuid (requerido)",
  "name": "string (opcional — se auto-genera como \"{ProductName} - Design #NNN\" si se omite)",
  "designData": "unknown (requerido, blob JSON opaco)",
  "status": "string (opcional, default \"draft\")",
  "sizes": "object, ej. { \"S\": 2, \"M\": 1 } (opcional, default {})",
  "productColor": "string (opcional)"
}
```
Cuando se omite `name`, el handler busca el nombre del producto y cuenta los designs existentes
para ese `productId` para construir una etiqueta secuencial, ej. `Classic T-Shirt - Design #003`.

### `GET /api/v1/designs`
Devuelve todos los designs.

### `GET /api/v1/designs/:id`
`404 { error: "Design not found", code: "DESIGN_NOT_FOUND" }` si no existe.

### `PUT /api/v1/designs/:id`
Actualización parcial. Campos aceptados: `name`, `designData`, `thumbnailUrl`, `status`, `sizes`,
`productColor`. A diferencia de otros recursos, `sizes` se almacena tal cual (no se le hace
`JSON.stringify` en el handler — el driver de la columna `jsonb` maneja la serialización). `404
DESIGN_NOT_FOUND` si no existe.

### `DELETE /api/v1/designs/:id`
Devuelve `{ "success": true }`, o `404 DESIGN_NOT_FOUND`.

### `POST /api/v1/designs/:id/generate-files`
Dispara el renderizado de archivos de producción. Verifica que el design exista (`404
DESIGN_NOT_FOUND` si no), pone el `productionStatus` del design en `"queued"` y `productionError`
en `null`, y luego encola un job de BullMQ (`enqueueProductionFiles`, ver
`packages/api/src/jobs/queues.ts`). El renderizado real (un PNG por zona de impresión a 300 DPI,
subido a MinIO bajo `production/{designId}/{zoneId}.png`) ocurre de forma asíncrona en un proceso
worker separado (`pnpm worker`) — este endpoint no espera a que termine.

**Response `200`**
```json
{ "jobId": "string", "status": "queued", "designId": "<uuid>" }
```

```bash
curl -X POST http://localhost:3001/api/v1/designs \
  -H "Content-Type: application/json" \
  -d '{ "productId": "<product-id>", "designData": { "layers": [] } }'

curl http://localhost:3001/api/v1/designs/<id>

curl -X PUT http://localhost:3001/api/v1/designs/<id> \
  -H "Content-Type: application/json" \
  -d '{ "status": "cart" }'

curl -X POST http://localhost:3001/api/v1/designs/<id>/generate-files

curl -X DELETE http://localhost:3001/api/v1/designs/<id>
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Assets

Subida/servido de archivos, respaldado por almacenamiento de objetos MinIO y la tabla `assets`
(solo metadata — el binario vive en MinIO, no en Postgres). Este es el único recurso que usa
`multipart/form-data`.

### `POST /api/v1/assets/upload`
Sube un solo archivo. **Multipart form-data**, no JSON — envía el archivo como un campo del form
(manejado vía `@fastify/multipart`, `req.file()`).

**Query param** `category` (opcional): uno de `clipart | font | template | product | upload |
production`. Determina el subfolder de almacenamiento en MinIO (`assets/cliparts/`,
`assets/fonts/`, `assets/templates/`, `assets/products/`, `uploads/`, `production/`). Cualquier
otro valor, o si se omite, cae en `assets/general/`.

Si no hay ningún file part presente: `400 { error: "No file uploaded", code: "NO_FILE" }`.

**Response `200`** — la fila insertada en `assets`:
```json
{
  "id": "<uuid>",
  "filename": "logo.png",
  "mimeType": "image/png",
  "size": 12345,
  "url": "/api/v1/assets/assets/general/<uuid>.png",
  "storageKey": "assets/general/<uuid>.png",
  "createdAt": "..."
}
```

### `GET /api/v1/assets/*`
Sirve el archivo crudo desde MinIO en la key dada (es decir, todo lo que va después de
`/api/v1/assets/`, que normalmente es el `storageKey` devuelto por el endpoint de upload de
arriba). El `Content-Type` se infiere de la extensión del archivo (`png`, `jpg`/`jpeg`, `gif`,
`svg`, `webp`, `ico`, `ttf`, `otf`, `woff`, `woff2`, `pdf`, `json` están mapeados explícitamente).
`404 { error: "Asset not found", code: "ASSET_NOT_FOUND" }` si el objeto no existe en el bucket.
Key vacía: `400 { error: "Missing key", code: "MISSING_KEY" }`.

```bash
curl -X POST "http://localhost:3001/api/v1/assets/upload?category=clipart" \
  -F "file=@/path/to/star.svg"

curl http://localhost:3001/api/v1/assets/assets/cliparts/<uuid>.svg -o star.svg
```

Sin schema de Fastify definido en ninguna de las dos rutas (y las subidas de archivos usan
`@fastify/multipart`, que tampoco está validado por schema aquí).

---

## Templates

Respaldado por la tabla `templates` — designs pre-armados de los que los usuarios pueden partir.

### `GET /api/v1/templates`
Devuelve todos los templates.

### `GET /api/v1/templates/:id`
`404 { error: "Template not found", code: "NOT_FOUND" }` si no existe.

### `POST /api/v1/templates`
**Body**
```json
{
  "name": "string (requerido)",
  "categories": "string[] (opcional, default [])",
  "tags": "string[] (opcional, default [])",
  "fileUrl": "string (opcional)",
  "fileName": "string (opcional)",
  "price": "entero, centavos (opcional, default 0)",
  "featured": "boolean (opcional, default false)",
  "active": "boolean (opcional, default true)"
}
```

### `PUT /api/v1/templates/:id`
Mismos campos que `POST`, todos opcionales (actualización parcial). `404 NOT_FOUND` si no existe.

### `DELETE /api/v1/templates/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{ "name": "Birthday Card", "price": 0 }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Cliparts

Respaldado por la tabla `cliparts` — biblioteca de clip-art usada por el editor de diseño. Misma
forma que Templates, más un endpoint de creación masiva.

### `GET /api/v1/cliparts`
Devuelve todos los cliparts.

### `GET /api/v1/cliparts/:id`
`404 { error: "Clipart not found", code: "NOT_FOUND" }` si no existe.

### `POST /api/v1/cliparts`
**Body**
```json
{
  "name": "string (requerido)",
  "categories": "string[] (opcional, default [])",
  "tags": "string[] (opcional, default [])",
  "fileUrl": "string (opcional)",
  "price": "entero, centavos (opcional, default 0)",
  "featured": "boolean (opcional, default false)",
  "active": "boolean (opcional, default true)"
}
```

### `POST /api/v1/cliparts/bulk`
Inserta muchos cliparts en una sola llamada.

**Body**
```json
{
  "cliparts": [
    { "name": "string (requerido)", "categories": ["..."], "tags": ["..."], "fileUrl": "...", "price": 0 }
  ]
}
```
Devuelve el array de filas insertadas. Nota: a diferencia del endpoint de creación individual, los
items de bulk no aceptan `featured` / `active` — toman los defaults de columna (`featured: false`,
`active: true`).

### `PUT /api/v1/cliparts/:id`
Actualización parcial, mismos campos que `POST`. `404 NOT_FOUND` si no existe.

### `DELETE /api/v1/cliparts/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/cliparts/bulk \
  -H "Content-Type: application/json" \
  -d '{ "cliparts": [{ "name": "Star" }, { "name": "Heart" }] }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Shapes

Respaldado por la tabla `shapes` — formas SVG ofrecidas en el editor de diseño.

### `GET /api/v1/shapes`
Devuelve todas las shapes, incluyendo el `svgContent` crudo.

### `POST /api/v1/shapes`
**Body**
```json
{
  "name": "string (requerido)",
  "svgContent": "string (opcional, default \"\")",
  "sortOrder": "entero (opcional, default 0)",
  "active": "boolean (opcional, default true)"
}
```

### `PUT /api/v1/shapes/:id`
Actualización parcial, mismos campos que `POST`. `404 { error: "Shape not found", code:
"NOT_FOUND" }` si no existe.

### `DELETE /api/v1/shapes/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/shapes \
  -H "Content-Type: application/json" \
  -d '{ "name": "Circle", "svgContent": "<svg>...</svg>", "sortOrder": 1 }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Fonts

Respaldado por la tabla `fonts` — fuentes disponibles para el editor de diseño.

### `GET /api/v1/fonts`
Devuelve todas las fonts.

### `POST /api/v1/fonts`
**Body**
```json
{
  "name": "string (requerido)",
  "description": "string (opcional, default \"The quick brown fox jumps over the lazy dog\")",
  "fileUrl": "string (opcional)",
  "isGoogle": "boolean (opcional, default false)",
  "active": "boolean (opcional, default true)"
}
```
`description` funciona a la vez como el texto de muestra del preview de la fuente mostrado en la
UI.

### `PUT /api/v1/fonts/:id`
Actualización parcial, mismos campos que `POST`. `404 { error: "Font not found", code:
"NOT_FOUND" }` si no existe.

### `DELETE /api/v1/fonts/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/fonts \
  -H "Content-Type: application/json" \
  -d '{ "name": "Roboto", "isGoogle": true }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Printing Types

Respaldado por la tabla `printing_types` — configura cómo se calcula el pricing/layout por técnica
de impresión (ej. DTG, bordado).

### `GET /api/v1/printing-types`
Devuelve todos los printing types.

### `POST /api/v1/printing-types`
**Body**
```json
{
  "title": "string (requerido)",
  "description": "string (opcional)",
  "thumbnailUrl": "string (opcional)",
  "active": "boolean (opcional, default true)",
  "calculationMethod": "string (opcional, default \"elements\")",
  "pricingConfig": "object (opcional, default {})",
  "resourcePermissions": "object (opcional, default {})",
  "layoutConfig": "object (opcional, default {})"
}
```
`pricingConfig`, `resourcePermissions`, y `layoutConfig` son JSON opaco — la API no valida su forma
interna.

### `PUT /api/v1/printing-types/:id`
Actualización parcial, mismos campos que `POST`. `404 { error: "Printing type not found", code:
"NOT_FOUND" }` si no existe.

### `DELETE /api/v1/printing-types/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/printing-types \
  -H "Content-Type: application/json" \
  -d '{ "title": "DTG Print", "calculationMethod": "elements" }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Orders

Respaldado por la tabla `orders`. Según un comentario en el código, el endpoint `POST` está pensado
**solo para dev/testing** — en producción, se espera que las orders se originen desde el
storefront (no documentado/implementado en este paquete).

### `GET /api/v1/orders`
Devuelve todas las orders.

### `GET /api/v1/orders/:id`
`404 { error: "Order not found", code: "NOT_FOUND" }` si no existe.

### `POST /api/v1/orders`
**Body**
```json
{
  "orderId": "string (requerido, único)",
  "customerName": "string (requerido)",
  "productName": "string (requerido)",
  "designId": "uuid (opcional)",
  "status": "string (opcional, default \"pending\")",
  "total": "entero, centavos (opcional, default 0)"
}
```

### `PATCH /api/v1/orders/:id/status`
Actualiza solo el status de la order.

**Body**
```json
{ "status": "string (requerido)" }
```
`404 NOT_FOUND` si no existe.

### `DELETE /api/v1/orders/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{ "orderId": "ORD-1001", "customerName": "Jane Doe", "productName": "Classic T-Shirt" }'

curl -X PATCH http://localhost:3001/api/v1/orders/<id>/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "shipped" }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Languages

Respaldado por las tablas `languages` y `translations` — impulsa el i18n de la UI del
storefront/editor.

### `GET /api/v1/languages`
Devuelve todos los idiomas configurados (activos e inactivos).

### `POST /api/v1/languages`
**Body**
```json
{
  "code": "string (requerido, único, ej. \"es\")",
  "name": "string (requerido, ej. \"Español\")",
  "flag": "string (requerido, ej. \"🇪🇸\")",
  "active": "boolean (opcional, default false)"
}
```

### `PUT /api/v1/languages/:id`
Solo `active` (boolean) se puede togglear a través de esta ruta. `404 { error: "Language not
found", code: "NOT_FOUND" }` si no existe.

### `DELETE /api/v1/languages/:id`
Devuelve `{ "success": true }`, o `404 NOT_FOUND`.

### `GET /api/v1/languages/active`
Endpoint de cara al público: devuelve cada idioma **activo** como un mapa indexado por código de
idioma, cada entrada incluyendo su tabla de traducciones completa.

**Response `200`**
```json
{
  "es": {
    "code": "es",
    "name": "Español",
    "flag": "🇪🇸",
    "translations": { "Add to cart": "Añadir al carrito" }
  }
}
```

### `GET /api/v1/languages/:code/translations`
Devuelve la lista cruda de filas de traducción para el `code` de idioma dado.

### `PUT /api/v1/languages/:code/translations`
Upsert masivo: para cada entrada, actualiza la traducción si ya existe una entrada con el mismo
par `(languageCode, originalText)`, si no la inserta. Devuelve la lista completa y actualizada de
traducciones para ese idioma.

**Body**
```json
{
  "entries": [
    { "originalText": "Add to cart", "translatedText": "Añadir al carrito" }
  ]
}
```

```bash
curl -X POST http://localhost:3001/api/v1/languages \
  -H "Content-Type: application/json" \
  -d '{ "code": "es", "name": "Español", "flag": "🇪🇸", "active": true }'

curl http://localhost:3001/api/v1/languages/active

curl -X PUT http://localhost:3001/api/v1/languages/es/translations \
  -H "Content-Type: application/json" \
  -d '{ "entries": [{ "originalText": "Add to cart", "translatedText": "Añadir al carrito" }] }'
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Settings

Respaldado por la tabla `settings` (almacén `key`/`value`) más dos endpoints proxy de salida que
mantienen las API keys de terceros fuera del navegador. **Estos endpoints son los más sensibles de
la API y, dado que hoy no hay capa de autenticación, son efectivamente públicos** — ver la sección
de Autenticación arriba.

### `GET /api/v1/settings`
Orientado a admin: devuelve cada fila de settings, con `value` reemplazado por `"••••••••"` para
cualquier fila donde `isSecret` sea true. Los valores no-secretos se devuelven tal cual.

### `GET /api/v1/settings/public`
Subconjunto seguro para el público, para el frontend/editor. Solo devuelve las keys presentes en
la allowlist hardcodeada `PUBLIC_KEYS = ["store_name", "show_branding", "favicon_url"]`, como un
objeto plano `{ key: value }`. Si `favicon_url` es una ruta relativa (empieza con `/`), se
reescribe como una URL absoluta usando el protocolo/host del request.

**Response `200`** ejemplo:
```json
{ "store_name": "My Store", "show_branding": "true", "favicon_url": "http://localhost:3001/favicon.png" }
```

### `PUT /api/v1/settings`
Upsert masivo orientado a admin.

**Body**
```json
{
  "entries": [
    { "key": "store_name", "value": "My Store", "isSecret": false },
    { "key": "unsplash_key", "value": "abc123", "isSecret": true }
  ]
}
```
Notas de comportamiento:
- Si `isSecret: true`, el valor se encripta (`encrypt()` de `utils/crypto.ts`) antes de
  almacenarse.
- Si una entrada secreta existente se envía de vuelta con el valor placeholder `"••••••••"`, esa
  entrada se **omite** (protege contra sobrescribir accidentalmente un secreto real con el
  placeholder enmascarado que se recibió de vuelta de un `GET` previo).
- Devuelve la lista completa y actualizada de settings, con los secretos enmascarados de la misma
  forma que `GET /settings`.

### `GET /api/v1/proxy/unsplash/search`
Proxy del lado del servidor hacia la API de Unsplash para que la `unsplash_key` nunca llegue al
navegador. La key se resuelve desde la tabla `settings` (desencriptada) y, si no está configurada
ahí, cae en la variable de entorno `VITE_UNSPLASH_ACCESS_KEY`.

**Query params**: `query` (opcional, default `"nature"`), `page` (opcional, default `"1"`),
`per_page` (opcional, default `"20"`).

Si no hay ninguna key configurada: `503 { error: "Unsplash API key not configured" }`. En caso de
éxito, devuelve el JSON que sea que devuelva el endpoint de búsqueda de Unsplash (pasado sin
modificar).

### `GET /api/v1/proxy/pollinations/image`
Proxy del lado del servidor que transmite una imagen generada por IA desde Pollinations, evitando
CORS/exponer la `pollinations_key`.

**Query params**: `prompt` (**requerido**), `model`, `width`, `height`, `seed` (todos opcionales y
se reenvían tal cual a Pollinations si están presentes).

- Falta `prompt`: `400 { error: "prompt is required" }`.
- El request a Pollinations expira después de 2 minutos: `502 { error: "Pollinations timeout
  (>2min)" }`.
- Response no-OK del upstream: `502 { error: "Pollinations returned <status>" }`.
- En caso de éxito: transmite los bytes de la imagen de vuelta con el `Content-Type` del upstream
  (default `image/jpeg`) y `Cache-Control: public, max-age=86400`.

```bash
curl http://localhost:3001/api/v1/settings/public

curl -X PUT http://localhost:3001/api/v1/settings \
  -H "Content-Type: application/json" \
  -d '{ "entries": [{ "key": "store_name", "value": "My Store" }] }'

curl "http://localhost:3001/api/v1/proxy/unsplash/search?query=mountains&page=1"

curl "http://localhost:3001/api/v1/proxy/pollinations/image?prompt=a%20red%20fox&width=512&height=512" \
  -o fox.jpg
```

Sin schema de Fastify definido en ninguna de estas rutas.

---

## Documentación interactiva

Más allá de este documento, la API expone una **Swagger UI en `/api/v1/docs`**, auto-generada a
partir de los schemas de rutas de Fastify. Ese es el lugar para explorar la superficie de la API
en vivo y probar requests directamente contra un servidor corriendo. Este documento es la
referencia narrativa complementaria — explica el *por qué* y los gaps (como los schemas faltantes
y la auth faltante señalados arriba) que la UI auto-generada no te va a contar por sí sola. A
medida que las rutas vayan ganando definiciones `schema` de Fastify propias, la Swagger UI se va a
volver la fuente más completa y confiable para las formas exactas de request/response; hasta
entonces, trata este documento y el código fuente en `packages/api/src/routes/*.ts` como la fuente
de verdad.
