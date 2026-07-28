# OpenMerch Engine — API Reference

This document describes the REST API exposed by `packages/api` (Fastify). All endpoints are
mounted under the `/api/v1/` prefix. Unless noted otherwise, request and response bodies are
JSON (`Content-Type: application/json`).

Base URL in local development: `http://localhost:3001` (port configurable via the `PORT` env var).

## Authentication

**There is no authentication or authorization on any endpoint today.** Every route listed below
is reachable by anyone who can reach the server, including the settings/proxy endpoints that
touch third-party API keys. This is a known, tracked gap — see `ARCHITECTURE.md` for the current
security posture and the plan to add it. Do not expose this API directly to the public internet
without a reverse proxy / auth layer in front of it.

## Schema validation

Fastify supports per-route JSON Schema validation (`schema: { body, params, querystring,
response }`), which is also what powers auto-generated OpenAPI/Swagger documentation. **As of
this writing, none of the 12 route files define a Fastify `schema`.** Request typing is done only
at the TypeScript level (generic type parameters on `app.get<...>`, `app.post<...>`, etc.), which
gives editor/compile-time safety but performs **no runtime validation** — the server will accept
malformed bodies and either throw a runtime error or insert bad data. This is called out
per-resource below and should be treated as a gap, not a design choice.

## Conventions

- All resource tables use a `uuid` primary key `id`, plus `createdAt` / `updatedAt` timestamps
  (see `packages/api/src/db/schema.ts` for exact column definitions).
- Fields typed `jsonb` in Postgres (e.g. `categories`, `tags`, `zones`) are stored as JSON and
  returned as JSON in responses; on write, route handlers `JSON.stringify` whatever you send, so
  send actual arrays/objects, not pre-stringified strings.
- Monetary fields (`price`, `total`) are integers in **cents**.
- A 404 response body has the shape `{ "error": string, "code": string }`.
- No endpoint currently paginates; `GET` list endpoints return the full table.

---

## Health

### `GET /api/v1/health`

Liveness check. No params.

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

No Fastify schema defined.

---

## Products

Backed by the `products` table. `zones` describes the printable areas of a product (used by the
design editor); `variants` / `variantLabel` describe purchasable variants (e.g. color/size).

### `GET /api/v1/products`
Returns all products, no filtering or pagination.

### `GET /api/v1/products/:id`
Path param: `id` (uuid). `404 { error: "Product not found", code: "PRODUCT_NOT_FOUND" }` if missing.

### `POST /api/v1/products`
**Body**
```json
{
  "name": "string (required)",
  "slug": "string (required, unique)",
  "description": "string (optional)",
  "price": "integer, cents (optional, default 0)",
  "categories": "string[] (optional, default [])",
  "printingTechniques": "string[] (optional, default [])",
  "active": "boolean (optional, default true)",
  "zones": "unknown[] (required)"
}
```
Returns the created product (`201` is not set explicitly — handler returns the row with default `200`).

### `PUT /api/v1/products/:id`
Partial update — every field is optional; only fields present in the body are updated. Accepts the
same fields as `POST` plus `variants` (`unknown[]`) and `variantLabel` (`string | null`).
`404` with `PRODUCT_NOT_FOUND` if the id doesn't exist.

### `DELETE /api/v1/products/:id`
Returns `{ "success": true }`, or `404 PRODUCT_NOT_FOUND`.

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

No Fastify schema defined on any of these routes — request bodies are validated only by TypeScript
types at compile time, not at runtime.

---

## Designs

Backed by the `designs` table. A design belongs to a `productId` and stores the editor's
`designData` blob (layers, positions, image URLs, etc. — opaque JSON as far as the API is
concerned) plus per-size quantities and production status.

### `POST /api/v1/designs`
**Body**
```json
{
  "productId": "uuid (required)",
  "name": "string (optional — auto-generated as \"{ProductName} - Design #NNN\" if omitted)",
  "designData": "unknown (required, opaque JSON blob)",
  "status": "string (optional, default \"draft\")",
  "sizes": "object, e.g. { \"S\": 2, \"M\": 1 } (optional, default {})",
  "productColor": "string (optional)"
}
```
When `name` is omitted, the handler looks up the product's name and counts existing designs for
that `productId` to build a sequential label, e.g. `Classic T-Shirt - Design #003`.

### `GET /api/v1/designs`
Returns all designs.

### `GET /api/v1/designs/:id`
`404 { error: "Design not found", code: "DESIGN_NOT_FOUND" }` if missing.

### `PUT /api/v1/designs/:id`
Partial update. Accepted fields: `name`, `designData`, `thumbnailUrl`, `status`, `sizes`,
`productColor`. Unlike other resources, `sizes` is stored as-is (not `JSON.stringify`d in the
handler — the `jsonb` column driver handles serialization). `404 DESIGN_NOT_FOUND` if missing.

### `DELETE /api/v1/designs/:id`
Returns `{ "success": true }`, or `404 DESIGN_NOT_FOUND`.

### `POST /api/v1/designs/:id/generate-files`
Triggers production-file rendering. Verifies the design exists (`404 DESIGN_NOT_FOUND` otherwise),
sets the design's `productionStatus` to `"queued"` and `productionError` to `null`, then enqueues a
BullMQ job (`enqueueProductionFiles`, see `packages/api/src/jobs/queues.ts`). The actual rendering
(one PNG per print zone at 300 DPI, uploaded to MinIO under `production/{designId}/{zoneId}.png`)
happens asynchronously in a separate worker process (`pnpm worker`) — this endpoint does not wait
for it to finish.

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

No Fastify schema defined on any of these routes.

---

## Assets

File upload/serving, backed by MinIO object storage and the `assets` table (metadata only — the
binary lives in MinIO, not Postgres). This is the only resource using `multipart/form-data`.

### `POST /api/v1/assets/upload`
Uploads a single file. **Multipart form-data**, not JSON — send the file as a form field (handled
via `@fastify/multipart`, `req.file()`).

**Query param** `category` (optional): one of `clipart | font | template | product | upload |
production`. Determines the storage subfolder in MinIO (`assets/cliparts/`, `assets/fonts/`,
`assets/templates/`, `assets/products/`, `uploads/`, `production/`). Any other/missing value falls
back to `assets/general/`.

If no file part is present: `400 { error: "No file uploaded", code: "NO_FILE" }`.

**Response `200`** — the inserted `assets` row:
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
Serves the raw file from MinIO at the given key (i.e. everything after `/api/v1/assets/`, which is
normally the `storageKey` returned by the upload endpoint above). `Content-Type` is inferred from
the file extension (`png`, `jpg`/`jpeg`, `gif`, `svg`, `webp`, `ico`, `ttf`, `otf`, `woff`,
`woff2`, `pdf`, `json` are mapped explicitly). `404 { error: "Asset not found", code:
"ASSET_NOT_FOUND" }` if the object doesn't exist in the bucket. Empty key: `400 { error: "Missing
key", code: "MISSING_KEY" }`.

```bash
curl -X POST "http://localhost:3001/api/v1/assets/upload?category=clipart" \
  -F "file=@/path/to/star.svg"

curl http://localhost:3001/api/v1/assets/assets/cliparts/<uuid>.svg -o star.svg
```

No Fastify schema defined on either route (and file uploads use `@fastify/multipart`, which isn't
schema-validated here either).

---

## Templates

Backed by the `templates` table — pre-made designs users can start from.

### `GET /api/v1/templates`
Returns all templates.

### `GET /api/v1/templates/:id`
`404 { error: "Template not found", code: "NOT_FOUND" }` if missing.

### `POST /api/v1/templates`
**Body**
```json
{
  "name": "string (required)",
  "categories": "string[] (optional, default [])",
  "tags": "string[] (optional, default [])",
  "fileUrl": "string (optional)",
  "fileName": "string (optional)",
  "price": "integer, cents (optional, default 0)",
  "featured": "boolean (optional, default false)",
  "active": "boolean (optional, default true)"
}
```

### `PUT /api/v1/templates/:id`
Same fields as `POST`, all optional (partial update). `404 NOT_FOUND` if missing.

### `DELETE /api/v1/templates/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/templates \
  -H "Content-Type: application/json" \
  -d '{ "name": "Birthday Card", "price": 0 }'
```

No Fastify schema defined on any of these routes.

---

## Cliparts

Backed by the `cliparts` table — clip-art library used by the design editor. Same shape as
Templates, plus a bulk-create endpoint.

### `GET /api/v1/cliparts`
Returns all cliparts.

### `GET /api/v1/cliparts/:id`
`404 { error: "Clipart not found", code: "NOT_FOUND" }` if missing.

### `POST /api/v1/cliparts`
**Body**
```json
{
  "name": "string (required)",
  "categories": "string[] (optional, default [])",
  "tags": "string[] (optional, default [])",
  "fileUrl": "string (optional)",
  "price": "integer, cents (optional, default 0)",
  "featured": "boolean (optional, default false)",
  "active": "boolean (optional, default true)"
}
```

### `POST /api/v1/cliparts/bulk`
Insert many cliparts in one call.

**Body**
```json
{
  "cliparts": [
    { "name": "string (required)", "categories": ["..."], "tags": ["..."], "fileUrl": "...", "price": 0 }
  ]
}
```
Returns the array of inserted rows. Note: unlike the single-create endpoint, bulk items don't
accept `featured` / `active` — they take the column defaults (`featured: false`, `active: true`).

### `PUT /api/v1/cliparts/:id`
Partial update, same fields as `POST`. `404 NOT_FOUND` if missing.

### `DELETE /api/v1/cliparts/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/cliparts/bulk \
  -H "Content-Type: application/json" \
  -d '{ "cliparts": [{ "name": "Star" }, { "name": "Heart" }] }'
```

No Fastify schema defined on any of these routes.

---

## Shapes

Backed by the `shapes` table — SVG shapes offered in the design editor.

### `GET /api/v1/shapes`
Returns all shapes, including raw `svgContent`.

### `POST /api/v1/shapes`
**Body**
```json
{
  "name": "string (required)",
  "svgContent": "string (optional, default \"\")",
  "sortOrder": "integer (optional, default 0)",
  "active": "boolean (optional, default true)"
}
```

### `PUT /api/v1/shapes/:id`
Partial update, same fields as `POST`. `404 { error: "Shape not found", code: "NOT_FOUND" }` if
missing.

### `DELETE /api/v1/shapes/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/shapes \
  -H "Content-Type: application/json" \
  -d '{ "name": "Circle", "svgContent": "<svg>...</svg>", "sortOrder": 1 }'
```

No Fastify schema defined on any of these routes.

---

## Fonts

Backed by the `fonts` table — fonts available to the design editor.

### `GET /api/v1/fonts`
Returns all fonts.

### `POST /api/v1/fonts`
**Body**
```json
{
  "name": "string (required)",
  "description": "string (optional, default \"The quick brown fox jumps over the lazy dog\")",
  "fileUrl": "string (optional)",
  "isGoogle": "boolean (optional, default false)",
  "active": "boolean (optional, default true)"
}
```
`description` doubles as the font-preview sample text shown in the UI.

### `PUT /api/v1/fonts/:id`
Partial update, same fields as `POST`. `404 { error: "Font not found", code: "NOT_FOUND" }` if
missing.

### `DELETE /api/v1/fonts/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/fonts \
  -H "Content-Type: application/json" \
  -d '{ "name": "Roboto", "isGoogle": true }'
```

No Fastify schema defined on any of these routes.

---

## Printing Types

Backed by the `printing_types` table — configures how pricing/layout is calculated per printing
technique (e.g. DTG, embroidery).

### `GET /api/v1/printing-types`
Returns all printing types.

### `POST /api/v1/printing-types`
**Body**
```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "thumbnailUrl": "string (optional)",
  "active": "boolean (optional, default true)",
  "calculationMethod": "string (optional, default \"elements\")",
  "pricingConfig": "object (optional, default {})",
  "resourcePermissions": "object (optional, default {})",
  "layoutConfig": "object (optional, default {})"
}
```
`pricingConfig`, `resourcePermissions`, and `layoutConfig` are opaque JSON — the API does not
validate their internal shape.

### `PUT /api/v1/printing-types/:id`
Partial update, same fields as `POST`. `404 { error: "Printing type not found", code: "NOT_FOUND" }`
if missing.

### `DELETE /api/v1/printing-types/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/printing-types \
  -H "Content-Type: application/json" \
  -d '{ "title": "DTG Print", "calculationMethod": "elements" }'
```

No Fastify schema defined on any of these routes.

---

## Orders

Backed by the `orders` table. Per an in-code comment, the `POST` endpoint is meant for
**dev/testing only** — in production, orders are expected to originate from the storefront (not
documented/implemented in this package).

### `GET /api/v1/orders`
Returns all orders.

### `GET /api/v1/orders/:id`
`404 { error: "Order not found", code: "NOT_FOUND" }` if missing.

### `POST /api/v1/orders`
**Body**
```json
{
  "orderId": "string (required, unique)",
  "customerName": "string (required)",
  "productName": "string (required)",
  "designId": "uuid (optional)",
  "status": "string (optional, default \"pending\")",
  "total": "integer, cents (optional, default 0)"
}
```

### `PATCH /api/v1/orders/:id/status`
Updates only the order's status.

**Body**
```json
{ "status": "string (required)" }
```
`404 NOT_FOUND` if missing.

### `DELETE /api/v1/orders/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

```bash
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{ "orderId": "ORD-1001", "customerName": "Jane Doe", "productName": "Classic T-Shirt" }'

curl -X PATCH http://localhost:3001/api/v1/orders/<id>/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "shipped" }'
```

No Fastify schema defined on any of these routes.

---

## Languages

Backed by the `languages` and `translations` tables — drives i18n for the storefront/editor UI.

### `GET /api/v1/languages`
Returns all configured languages (active and inactive).

### `POST /api/v1/languages`
**Body**
```json
{
  "code": "string (required, unique, e.g. \"es\")",
  "name": "string (required, e.g. \"Español\")",
  "flag": "string (required, e.g. \"🇪🇸\")",
  "active": "boolean (optional, default false)"
}
```

### `PUT /api/v1/languages/:id`
Only `active` (boolean) can be toggled through this route. `404 { error: "Language not found",
code: "NOT_FOUND" }` if missing.

### `DELETE /api/v1/languages/:id`
Returns `{ "success": true }`, or `404 NOT_FOUND`.

### `GET /api/v1/languages/active`
Public-facing endpoint: returns every **active** language as a map keyed by language code, each
entry including its full translation table.

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
Returns the raw list of translation rows for the given language `code`.

### `PUT /api/v1/languages/:code/translations`
Bulk upsert: for each entry, updates the translation if an entry with the same `(languageCode,
originalText)` pair already exists, otherwise inserts it. Returns the full, updated list of
translations for that language.

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

No Fastify schema defined on any of these routes.

---

## Settings

Backed by the `settings` table (`key`/`value` store) plus two outbound proxy endpoints that keep
third-party API keys off the browser. **These endpoints are the most sensitive in the API and,
given there is no authentication layer today, are effectively public** — see the Authentication
section above.

### `GET /api/v1/settings`
Admin-oriented: returns every setting row, with `value` replaced by `"••••••••"` for any row where
`isSecret` is true. Non-secret values are returned as-is.

### `GET /api/v1/settings/public`
Public-safe subset for the frontend/editor. Only returns keys present in the hardcoded allowlist
`PUBLIC_KEYS = ["store_name", "show_branding", "favicon_url"]`, as a flat `{ key: value }` object.
If `favicon_url` is a relative path (starts with `/`), it's rewritten to an absolute URL using the
request's protocol/host.

**Response `200`** example:
```json
{ "store_name": "My Store", "show_branding": "true", "favicon_url": "http://localhost:3001/favicon.png" }
```

### `PUT /api/v1/settings`
Admin-oriented bulk upsert.

**Body**
```json
{
  "entries": [
    { "key": "store_name", "value": "My Store", "isSecret": false },
    { "key": "unsplash_key", "value": "abc123", "isSecret": true }
  ]
}
```
Behavior notes:
- If `isSecret: true`, the value is encrypted (`encrypt()` from `utils/crypto.ts`) before being
  stored.
- If an existing secret entry is sent back with the placeholder value `"••••••••"`, that entry is
  **skipped** (protects against accidentally overwriting a real secret with the masked
  placeholder echoed back from a previous `GET`).
- Returns the full updated settings list, secrets masked the same way as `GET /settings`.

### `GET /api/v1/proxy/unsplash/search`
Server-side proxy to the Unsplash API so the `unsplash_key` never reaches the browser. The key is
resolved from the `settings` table (decrypted) and, if not set there, falls back to the
`VITE_UNSPLASH_ACCESS_KEY` env var.

**Query params**: `query` (optional, default `"nature"`), `page` (optional, default `"1"`),
`per_page` (optional, default `"20"`).

If no key is configured: `503 { error: "Unsplash API key not configured" }`. On success, returns
whatever JSON the Unsplash search endpoint returns (passed through unmodified).

### `GET /api/v1/proxy/pollinations/image`
Server-side proxy that streams an AI-generated image from Pollinations, avoiding CORS/exposing the
`pollinations_key`.

**Query params**: `prompt` (**required**), `model`, `width`, `height`, `seed` (all optional and
forwarded as-is to Pollinations if present).

- Missing `prompt`: `400 { error: "prompt is required" }`.
- Request to Pollinations times out after 2 minutes: `502 { error: "Pollinations timeout (>2min)" }`.
- Upstream non-OK response: `502 { error: "Pollinations returned <status>" }`.
- On success: streams the image bytes back with the upstream `Content-Type` (default
  `image/jpeg`) and `Cache-Control: public, max-age=86400`.

```bash
curl http://localhost:3001/api/v1/settings/public

curl -X PUT http://localhost:3001/api/v1/settings \
  -H "Content-Type: application/json" \
  -d '{ "entries": [{ "key": "store_name", "value": "My Store" }] }'

curl "http://localhost:3001/api/v1/proxy/unsplash/search?query=mountains&page=1"

curl "http://localhost:3001/api/v1/proxy/pollinations/image?prompt=a%20red%20fox&width=512&height=512" \
  -o fox.jpg
```

No Fastify schema defined on any of these routes.

---

## Interactive Docs

Beyond this document, the API exposes a **Swagger UI at `/api/v1/docs`**, auto-generated from the
Fastify route schemas. That's the place to explore the live API surface and try requests directly
against a running server. This document is the complementary narrative reference — it explains the
*why* and the gaps (like the missing schemas and missing auth called out above) that the
auto-generated UI won't tell you on its own. As routes gain proper Fastify `schema` definitions,
the Swagger UI will become the more complete and trustworthy source for exact request/response
shapes; until then, treat this document and the source in `packages/api/src/routes/*.ts` as the
ground truth.
