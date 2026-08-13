# Integración WooCommerce ↔ OpenMerch — Auditoría y Guía Completa

> Documento de cierre de la integración del plugin `plugins/plugin-woocommerce/openmerch-woocommerce` (v1.0.3) con el backend de OpenMerch Engine. Cubre arquitectura, instalación, sincronización de productos/variantes/colores, el flujo completo de compra, producción, moneda, manejo de reembolsos, automatización de cron, y cobertura de tests.
>
> El código (comentarios, nombres, mensajes de commit) está en inglés, siguiendo la convención del resto del repo. Este documento es la referencia en español.

---

## 1. Qué es esto y para qué sirve

El plugin es un **puente tonto** entre WooCommerce y OpenMerch Engine: toda la lógica de negocio (catálogo de productos, edición de diseños, generación de archivos de impresión) vive en el backend de OpenMerch (`packages/api`). El plugin solo:

1. Muestra un botón **"Customize"** junto al "Add to Cart" nativo en la página de producto de WooCommerce.
2. Abre el editor de OpenMerch en una **pestaña nueva** (no iframe) con el producto — y, si aplica, la variante/color — ya preseleccionados.
3. Recibe el diseño terminado vía `postMessage` y lo agrega al **carrito real de WooCommerce** (no a un carrito propio del plugin).
4. Registra un **webhook nativo de WooCommerce** que le avisa a OpenMerch cuándo una orden con diseño personalizado se pagó, para encolar la generación de archivos de producción (PNG 300 DPI, mockups).

---

## 2. Arquitectura del flujo completo

```
Cliente en WooCommerce
  → elige talla/color/modelo (si el producto tiene variaciones)
  → clic en "Customize" (bloqueado hasta que la selección esté completa)
  → se abre localhost:3000 (editor de OpenMerch) en pestaña nueva
    con ?product=<uuid>&variant=<id?>&color=<hex?>&source=woocommerce
  → cliente diseña, clic en "Agregar al Carrito" dentro del editor
  → el editor sube el PNG final y hace postMessage a la pestaña de WooCommerce
  → la pestaña de WooCommerce llama admin-ajax.php → WC()->cart->add_to_cart()
    (carrito REAL de WooCommerce, con el diseño como metadata del line item)
  → checkout normal de WooCommerce
  → al cambiar el status de la orden (pagada/completada/etc.), WooCommerce
    dispara su webhook nativo → POST /api/v1/orders/webhook/woocommerce
  → OpenMerch registra la orden + cada línea con diseño (order_designs)
    y encola la generación de archivos de producción si el status es
    "processing" o "completed"
```

El mapeo de qué producto/variante/color de WooCommerce corresponde a qué producto/variante de OpenMerch se configura **una sola vez por producto**, desde `wp-admin`, sin tocar código — es la parte de "sincronización" que se explica en la sección 4.

---

## 3. Instalación y arranque (entorno de desarrollo local)

Ya está montado en este repo vía Docker Compose. Para levantarlo desde cero:

```bash
docker compose --profile app up -d          # API + worker + infra
docker compose --profile woocommerce-dev up -d   # WordPress + WooCommerce + MySQL + cron
```

En `wp-admin → WooCommerce → OpenMerch` configura:
- **Editor URL**: `http://localhost:3000` (donde corre `apps/demo`)
- **API URL**: `http://api:3001` (nombre del servicio Docker, no `localhost` — ver nota de seguridad en la sección 8)
- Botón **"Recreate / repair webhook"** para registrar el webhook nativo de WooCommerce, y **"Test connection"** para confirmar que la firma coincide.

---

## 4. Sincronizar un producto — paso a paso

Usamos el **Dad Hat** como ejemplo real de esta sesión (es el único producto del catálogo de OpenMerch que se dejó para configurar a mano; los otros 12 se generaron por script).

1. `wp-admin → Products → Add New`.
2. Nombre y precio regular (revisa el precio real en el catálogo de OpenMerch — el Dad Hat cuesta $19.99).
3. Si el producto va a tener colores/tallas en WooCommerce, cámbialo a **Variable product**, agrega el atributo (ej. "Color"), marca **"Used for variations"**, guarda, y en la pestaña **Variations** genera las variaciones — **ponle precio a cada una manualmente** (WooCommerce no lo hereda del producto padre variable; este fue justo un bug real que encontramos y corregimos en esta sesión).
4. En la caja lateral **"OpenMerch Customization"**: el campo "OpenMerch Product ID" es un `<select>` que jala el catálogo real de OpenMerch (cacheado 60s, vía `GET /api/v1/products`) — sin escribir nada a mano, cero riesgo de typo. Selecciona el producto correspondiente.
5. Si el producto de OpenMerch tiene **variantes con zona de impresión propia** (ej. iPhone Case, Mug, Poster — tamaños/modelos que cambian las dimensiones de impresión), cada variación de WooCommerce mostrará además un dropdown **"OpenMerch Variant"** para mapear cuál variante le corresponde. El Dad Hat no tiene variantes de OpenMerch (una sola zona de impresión fija), así que ese campo no aparece — solo el de color.
6. Cada variación también tiene un checkbox **"Preselect a product color for this variation"** + selector de color nativo — completamente opcional y **puramente visual** (no afecta el archivo de impresión). Si no lo marcas, el cliente elige su color libremente dentro del editor.
7. **Publish.**

**Lo importante:** desde este punto todo el comportamiento del plugin (mostrar el botón, bloquear "Customize" hasta selección completa, abrir el editor con la variante/color correctos, bloquear esos mismos selectores dentro del editor) se decide en tiempo real a partir de lo que guardaste — cero deploys, cero código nuevo por producto. El mismo código del plugin sirve para los 13 productos del catálogo.

### Reglas de qué se mapea y qué no

| Concepto | ¿Dónde se mapea? | ¿Afecta el archivo de impresión? |
|---|---|---|
| Producto WooCommerce → Producto OpenMerch | Meta box del producto | Sí — determina las zonas base |
| Variación WooCommerce → Variante OpenMerch | Por variación, solo si el producto tiene variantes en OpenMerch | Sí — cambia dimensiones/zona |
| Color de variación → tinte del editor | Por variación, checkbox opcional | No — solo visual |
| Talla (S/M/L/XL) en ropa | No se mapea a nada — no existe como concepto en OpenMerch | No aplica |

---

## 5. Producción, órdenes con múltiples diseños, y moneda

- Un **pedido puede tener varios productos personalizados** (ej. 2 playeras con diseños distintos + 1 producto sin personalizar en la misma orden). OpenMerch registra **una fila en `order_designs` por cada línea con diseño** — el producto sin personalizar simplemente no se registra en OpenMerch (se queda enteramente del lado de WooCommerce, que es donde vive su fulfillment/envío).
- La **moneda es real**, no hardcodeada: se captura del campo `currency` que WooCommerce siempre manda en el payload del webhook (ej. `"USD"`, `"MXN"`), se guarda en `orders.currency`, y el Admin Panel la formatea con `Intl.NumberFormat` en vez de un símbolo `$` fijo.
- **Limpieza de líneas huérfanas al editar una orden ya creada.** Encontrado probando en vivo: si un admin edita una orden en `wp-admin` y quita una línea personalizada (o WooCommerce re-entrega el webhook con menos líneas que antes), la fila correspondiente en `order_designs` se quedaba para siempre apuntando a un diseño que ya no forma parte de la orden. `orders-webhook-woocommerce.ts` ahora borra, en cada entrega, cualquier fila de `order_designs` de esa orden cuyo `designKey` ya no aparezca en las líneas actuales del payload — acotado a órdenes que todavía tienen al menos un diseño (una orden sin ninguno ya sale antes por el guard existente). Cubierto por un test nuevo en `orders-webhook-woocommerce.test.ts`.

---

## 6. Reembolsos y cancelaciones — decisión de diseño

**Decisión tomada:** OpenMerch **no cancela activamente** jobs de producción en BullMQ cuando una orden se reembolsa o cancela en WooCommerce. Cancelar un job a medias es una funcionalidad grande (BullMQ no tiene cancelación limpia de jobs en progreso) y es una decisión de negocio que le corresponde al merchant revisar, no algo para automatizar a ciegas.

**Lo que sí se implementó:** el Admin Panel muestra una **advertencia visual clara** — un banner naranja en el detalle de la orden, más un ícono de alerta en la fila de la tabla — cuando el status de la orden es `cancelled` o `refunded` **y** al menos uno de sus diseños vinculados ya tiene archivos de producción generados o en curso (`queued`/`processing`/`completed`). El mensaje: *"This order was cancelled or refunded, but production files were already generated or are in progress — check before shipping."* Así el merchant lo nota y decide manualmente si detener el envío, sin que el sistema le oculte la situación.

También se agregó `refunded` como status reconocido explícito (antes solo existían pending/processing/completed/cancelled, y un reembolso se veía indistinguible de una cancelación).

---

## 7. Cron / Action Scheduler — por qué importa y cómo se resolvió

WooCommerce entrega su webhook nativo de forma **asíncrona** vía Action Scheduler (una cola interna basada en WP-Cron), no en el momento. Si nada procesa esa cola, la entrega del webhook se queda pendiente para siempre — este fue uno de los bugs más importantes de toda la sesión (junto con el bloqueo de SSRF de WordPress hacia hosts privados, ver sección 8).

### En este entorno Docker (ya resuelto, automático)

Se agregó un nuevo servicio `wordpress-cron` en `docker-compose.yml` (perfil `woocommerce-dev`) que corre en loop `wp cron event run --due-now` cada 60 segundos. Ya no hace falta correr nada a mano — se probó en vivo: se cambió el status de una orden y, sin ninguna intervención manual, se sincronizó sola en OpenMerch a los ~35 segundos.

```bash
docker compose --profile woocommerce-dev up -d wordpress-cron
```

### En hosting real (producción, sin Docker)

**Opción A — si el host tiene WP-CLI (recomendada, más ligera, no depende de tráfico al sitio):**
```
* * * * * wp cron event run --due-now --path=/ruta/a/tu/wordpress >/dev/null 2>&1
```

**Opción B — sin WP-CLI (hosting compartido tipo cPanel):**

En `wp-config.php`:
```php
define('DISABLE_WP_CRON', true);
```
Y en el crontab del servidor:
```
* * * * * wget -q -O /dev/null "https://tudominio.com/wp-cron.php?doing_wp_cron" >/dev/null 2>&1
```

La Opción A es más eficiente (no depende de una petición HTTP real cada minuto); la Opción B funciona en cualquier hosting con acceso a crontab, sin necesidad de SSH/WP-CLI.

---

## 8. Bug encontrado en vivo: "Imprimir" en el editor embebido no descargaba nada

Reportado por el usuario probando en vivo un Desk Mat (`variant=16x32`) embebido en un producto de WooCommerce: al hacer clic en **Imprimir** dentro del editor, nunca se generaba ninguna descarga.

**Causa raíz:** `packages/editor/src/utils/exportDesign.ts` tiene una sola función de entrega (`deliverExportBlob`) compartida por los **cuatro** disparadores de exportación: el botón "Agregar al carrito", el menú Imprimir/Descargar, y dos atajos de teclado (Ctrl+Shift+S, Ctrl+P). Los cuatro llamaban a la misma ruta incondicional: si el editor está embebido (`onExportCallback` seteado), siempre se sube el diseño y se dispara el `postMessage` que el host (`openmerch-embed.js`, evento `openmerch:export`) interpreta como **"agregar al carrito"** — nunca se descargaba el archivo al dispositivo del cliente, y además se agregaba al carrito de WooCommerce un producto que el cliente nunca pidió agregar (solo quería imprimir/descargar una copia).

**Fix:** se agregó una bandera `forHost?: boolean` a `ExportOptions`, que solo el llamado de "Agregar al carrito" en `NavBar.tsx` pasa como `true`. `deliverExportBlob()` ahora solo hace el hand-off al host si `forHost` es verdadero; en cualquier otro caso (Imprimir/Descargar, ambos atajos de teclado) siempre descarga localmente al dispositivo, incluso estando embebido — que es el comportamiento que un botón llamado "Imprimir" siempre debió tener.

Verificado: `npx vitest run` en `packages/editor` (11/11, sin regresión), build limpio (`pnpm --filter @openmerch/editor build`), y **confirmado por el usuario en un clic real en navegador**: Imprimir descarga el archivo y ya no agrega nada al carrito.

---

## 8.1 Bug encontrado en vivo: "agrego al carrito y al volver a WooCommerce el carrito no se actualizó"

**Causa raíz:** el editor embebido (`apps/demo/src/App.tsx`) mostraba el modal de "¡Listo!" apenas terminaba de subir el diseño y mandar el `postMessage` — **sin esperar ninguna confirmación** de que la pestaña de WooCommerce (que corre en segundo plano, y puede estar limitada por el navegador por estar oculta) hubiera terminado realmente su propia llamada a `admin-ajax.php` para agregar al carrito. Si el cliente cerraba el editor o volvía a la tienda antes de que esa llamada terminara, veía "éxito" sin que el carrito se hubiera actualizado de verdad.

**Fix — protocolo de confirmación (ack) entre las dos pestañas:**
- `openmerch-embed.js` ahora guarda la referencia a la pestaña del editor (`editorTab`) y, cuando termina su llamada a `add_to_cart` (con éxito o con error), le manda un mensaje de vuelta: `openmerch:added-to-cart` o `openmerch:add-to-cart-error`.
- `apps/demo/src/App.tsx` (`waitForHostAck`) espera ese mensaje antes de mostrar el modal de éxito — si el host reporta un error, se muestra el toast de error real en vez del falso "¡Listo!". Si el host nunca responde (compatibilidad con integraciones futuras, p. ej. Shopify, que aún no implementan este ack — ver `docs/integrations/shopify.md` 3.2), espera 12 segundos y sigue igual que antes de este fix.

Verificado: `npx vitest run` en `packages/editor` (11/11, sin regresión), `tsc --noEmit` limpio en `apps/demo` y `packages/editor`, y **confirmado por el usuario en vivo**.

---

## 8.2 Bug encontrado en vivo: productos con variantes no se podían agregar al carrito ("Por favor, elige las opciones del producto...")

Este bug estaba oculto por el de la sección 8.1 — antes del ack, este error real quedaba silenciado en la pestaña de fondo, y el cliente veía "éxito" igual. En cuanto se arregló 8.1, este error empezó a verse (correctamente).

**Causa raíz:** `class-openmerch-cart.php`'s `ajax_add_to_cart()` llamaba `WC()->cart->add_to_cart($wc_product_id, 1)` **sin el `variation_id`** — para un producto variable (tallas/colores, la mayoría de los 12 productos sincronizados: playeras, iPhone case, taza, cojín, tapete, poster), WooCommerce siempre rechaza esa llamada porque el producto padre no es comprable por sí mismo sin especificar cuál variación exacta.

**Fix:**
- `openmerch-embed.js` ahora también guarda el **ID real de la variación de WooCommerce** seleccionada (`currentWcVariationId`, vía el evento `found_variation`) — distinto del ID de variante de OpenMerch (que solo determina la zona de impresión).
- Se manda como `wc_variation_id` en el POST a `admin-ajax.php`, y `class-openmerch-cart.php` lo pasa como tercer argumento a `add_to_cart()`.

Verificado en vivo dentro del contenedor de WordPress simulando la llamada exacta con y sin `variation_id` contra un producto real (`Custom Classic T-Shirt`): sin el fix, falla con el mismo mensaje que reportó el usuario; con el fix, se agrega correctamente al carrito. Ambas suites del plugin siguen en 25/25 + 4/4.

---

## 9. Notas de seguridad importantes (encontradas y corregidas en esta sesión)

1. **Bloqueo SSRF de WordPress hacia la API.** `WC_Webhook::deliver()` usa `wp_safe_remote_request()`, que por diseño rechaza conectarse a hosts que resuelvan a una IP privada (como `api` en la red de Docker) y a puertos fuera de `[80, 443, 8080]` (como `3001`). Sin los filtros `http_request_host_is_external` / `http_allowed_safe_ports` que agregamos en `class-openmerch-webhook.php` — acotados exactamente al host/puerto configurado en `api_url`, no una excepción general — **ninguna entrega de webhook llegaba nunca a la API**, sin ningún error visible. Esto afecta a cualquier despliegue self-hosted de OpenMerch (que es justo el modelo del proyecto), no solo a este entorno de dev.
2. **Verificación de firma HMAC-SHA256** del webhook (`X-WC-Webhook-Signature`) contra `WOOCOMMERCE_WEBHOOK_SECRET`, con comparación en tiempo constante (`timingSafeEqual`) para evitar timing attacks.
3. **Nonces de WordPress** en el guardado del meta box del producto y en el puente de agregar al carrito (`admin-ajax.php`).
4. **Sanitización/escape consistente**: `sanitize_text_field`, `esc_attr`, `esc_html`, `esc_url` en todo output/input del plugin.
5. **`current_user_can('edit_product', ...)`** verificado antes de guardar cualquier meta.

---

## 10. Tests automatizados

### `packages/api` (Vitest) — 97/97 pasando

Incluye: verificación de firma del webhook, upsert idempotente de órdenes, múltiples diseños por orden, resolución de moneda (con fallback a USD), limpieza de líneas huérfanas en `order_designs` (sección 5), registro de entregas de webhook (sección 10.1), la política de limpieza de diseños abandonados (sección 10.2), y toda la suite previa de designs/settings/remove-background.

```bash
cd packages/api && npx vitest run
```

### Plugin de WooCommerce — dos suites independientes, 29/29 pasando

El plugin no tenía **ningún** test automatizado antes de esta sesión. Ahora tiene dos suites deliberadamente separadas, cada una cubriendo lo que la otra no puede:

**a) PHPUnit + Brain Monkey (`tests/`) — 25/25 pasando.** Mockea funciones de WordPress/WooCommerce en runtime, sin instalación real de WP ni base de datos — rápida, ideal para lógica pura.

```bash
cd plugins/plugin-woocommerce/openmerch-woocommerce
composer install
vendor/bin/phpunit
```

Cubre: los 4 getters de `Openmerch_Product_Meta`; los filtros `allow_api_host()` / `allow_api_port()` (el fix de seguridad de la sección 9); `build_variant_map()` / `build_color_map()`; `get_product_variants()` con catálogo cacheado; `Openmerch_Webhook::get_health()` en sus 4 estados (sección 10.1).

**b) WP core PHPUnit integration suite (`tests-integration/`) — 4/4 pasando, nuevo esta sesión.** Corre contra una instalación real de WordPress, WooCommerce real, y una base de datos real (desechable) — usando `WP_UnitTestCase`, la misma clase base que usa el propio WordPress core. Cubre exactamente lo que Brain Monkey no puede probar por diseño (al mockear todo, nunca toca una base de datos real):

- Que los campos por-variación (`openmerch_variant_id`, `openmerch_color`) **persistan de verdad** en `wp_postmeta` tras guardar y recargar — incluyendo que desmarcar el checkbox de color sí lo borre.
- El **HTML real** que renderiza `render_variation_fields()` — con y sin variantes configuradas en el producto padre.
- Que `Openmerch_Webhook::activate()` cree un **`WC_Webhook` real y activo** apuntando a la URL configurada, y que una segunda llamada actualice el mismo webhook en vez de duplicarlo (la idempotencia que promete su docblock).

El obstáculo real para esto era de infraestructura, no de código: el flujo estándar (`wp scaffold plugin-tests` → `install-wp-tests.sh`) depende de `svn`, que no existe en las imágenes Docker `wordpress` ni `wordpress-cli` de este proyecto (solo tienen `curl`, `php` y, en `wordpress-cli`, `wp`-cli). Se resolvió sustituyendo cada paso por su equivalente vía `curl`+`tar`: la librería de tests de WP core se descarga de un tag de GitHub en vez de vía `svn co`, `phpunit.phar` se descarga directo (9.6.35 — WP core aún no soporta PHPUnit 10, la versión que ya usa la suite Brain Monkey vía composer; se confirmó el error real al intentarlo), y `yoast/phpunit-polyfills` se descarga como tarball usando su autoloader propio (no necesita composer). Todo esto queda automatizado en `tests-integration/install.sh` — un dev nuevo o un servidor de CI solo necesita correrlo una vez. Detalles completos en `tests-integration/README.md`.

```bash
docker compose --profile woocommerce-dev exec wordpress \
  sh wp-content/plugins/openmerch-woocommerce/tests-integration/install.sh
docker compose --profile woocommerce-dev exec wordpress sh -c \
  "cd wp-content/plugins/openmerch-woocommerce && php tests-integration/.wp-tests/phpunit.phar \
     --bootstrap tests-integration/bootstrap.php -c tests-integration/phpunit.xml.dist"
```

---

## 10.1 Monitoreo de webhooks fallidos (nuevo esta sesión)

Antes de esto no había ninguna forma de enterarse de una entrega de webhook fallida sin ir a buscar logs del servidor a mano. Se cubrieron **los dos casos distintos** en los que una entrega puede fallar — cada uno solo es visible desde un lado distinto de la integración:

**a) La entrega SÍ llega a la API de OpenMerch, pero se rechaza** (firma inválida, `WOOCOMMERCE_WEBHOOK_SECRET` sin configurar del lado de OpenMerch) — visible desde OpenMerch:
- Tabla nueva `webhook_deliveries` (`packages/api/src/db/schema.ts`, migración `0007_graceful_cerise.sql`) — una fila por cada request entrante a `POST /api/v1/orders/webhook/woocommerce`, exitosa o no, con su `reasonCode` (`INVALID_SIGNATURE`, `NOT_CONFIGURED`, etc.), el `orderId` si se pudo extraer, y timestamp.
- Endpoint nuevo `GET /api/v1/orders/webhook/woocommerce/log` — las últimas 50 entregas, más reciente primero.
- Admin Panel de OpenMerch (`Orders.tsx`): al cargar la página consulta ese log y, si hay entregas rechazadas, muestra un **banner** con el conteo, la razón traducida (ej. *"La firma no coincide (revisa el secreto del webhook tanto en WooCommerce como en OpenMerch)"*) y la fecha del rechazo más reciente.

**b) La entrega NUNCA llega a la API de OpenMerch** (host/puerto bloqueado, la API está caída, falla DNS) — este caso es invisible para el lado de OpenMerch por definición (nunca recibió nada que registrar), así que la única señal confiable es la que ya lleva **WooCommerce mismo**: `WC_Webhook::deliver()` incrementa un contador de fallos consecutivos en su propio objeto `WC_Webhook` y lo **desactiva automáticamente tras 5 fallos seguidos** (`woocommerce_max_webhook_delivery_failures`). Visible desde `wp-admin`:
- `Openmerch_Webhook::get_health()` (`includes/class-openmerch-webhook.php`) lee ese estado/contador directo del `WC_Webhook` registrado — no depende de nada que OpenMerch pueda haber perdido.
- `Openmerch_Settings::render_webhook_health_notice()` lo muestra en la página de ajustes del plugin (`WooCommerce > OpenMerch`): un aviso de **error** si WooCommerce ya desactivó el webhook, o de **advertencia** si hay fallos consecutivos pero todavía no llegó al límite — ambos con un link directo a `WooCommerce > Status > Logs` (fuente `webhooks-delivery`) para el detalle exacto del error de red.

Ambos lados son necesarios porque cada uno ve una mitad distinta del problema — un merchant que solo tuviera el banner de OpenMerch nunca se enteraría de que la API está completamente inalcanzable, y uno que solo tuviera el aviso de `wp-admin` nunca vería un rechazo por firma inválida (esa entrega sí llegó, WooCommerce la ve como "exitosa" a nivel de transporte).

Traducciones ES/FR agregadas y sembradas en la base de datos para el lado de OpenMerch; el aviso de `wp-admin` usa el sistema de i18n nativo del plugin (`.pot`/`.po`).

Verificado en vivo/independientemente:
- Un POST con firma inválida contra la API real devuelve 401 y queda registrado; `GET .../log` lo devuelve correctamente.
- `WebhookHealthTest.php` (5 tests, Brain Monkey) cubre `get_health()` en sus 4 estados: no registrado, `wc_get_webhook()` no encuentra nada, activo sin fallos, activo con fallos consecutivos, y desactivado por WooCommerce — re-ejecutado de forma independiente (`vendor/bin/phpunit`): **25/25 tests del plugin (Brain Monkey) pasando**, más 4/4 de la suite de integración WP core (sección 10).
- Suite de `packages/api` completa: **97/97 pasando** (incluye esto + el resto de la sesión), `tsc --noEmit` limpio en `packages/api` y en `apps/admin`.

`webhook_deliveries` tiene purga automática diaria — ver sección 10.3.

---

## 10.2 Limpieza de diseños abandonados (nuevo esta sesión)

Cada vez que un cliente abre el editor embebido desde WooCommerce se crea un diseño con `status: 'draft'` (pasa a `'cart'` en cuanto hace clic en "Agregar al carrito"). Si cierra la pestaña sin terminar la compra, ese diseño y sus archivos asociados se quedaban en la base de datos y en MinIO **para siempre** — la tabla `designs` crecía indefinidamente con contenido que nadie va a reclamar nunca.

**Política implementada:**

- Un diseño es candidato a borrado si su `status` es `draft` o `cart`, y `updatedAt` no cambió en más de **7 días** (draft) o **30 días** (cart) — configurable vía `ABANDONED_DRAFT_RETENTION_DAYS` / `ABANDONED_CART_RETENTION_DAYS` en `.env`. `cart` tiene más gracia que `draft` porque un diseño que el cliente sí llegó a meter al carrito representa más intención de compra que uno que apenas empezó a bocetar.
- **Nunca se borra un diseño vinculado a una orden real** — se verifica contra `order_designs.designId` antes de considerar cualquier candidato, sin importar qué diga `designs.status` (que hoy no se actualiza automáticamente a `'paid'` — ver sección 11). Como defensa adicional, `order_designs.designId` no tiene `ON DELETE CASCADE`: si por cualquier motivo un diseño vinculado llegara a intentar borrarse, Postgres rechaza la operación en vez de dejar una orden con una referencia rota.
- El borrado también limpia sus archivos en MinIO (`thumbnailUrl` y cada `productionFiles[zona].{print,mockup}`) — best-effort: un error de MinIO no revierte el borrado de la fila (un archivo huérfano en storage es solo espacio desperdiciado; una fila de DB que nunca se puede borrar sí sería un problema).
- Corre como un **job repetible de BullMQ** en el proceso `worker` (`pnpm worker` / `docker compose --profile worker up`), una vez al día — se registra automáticamente al arrancar el worker, sin necesidad de cron externo.
- Dos endpoints de administración: `GET /api/v1/designs/cleanup-abandoned/preview` (solo lectura — qué borraría el próximo sweep) y `POST /api/v1/designs/cleanup-abandoned/run` (encola un sweep inmediato, fuera del horario diario).
- Desactivable por completo con `ABANDONED_DESIGNS_CLEANUP_ENABLED=false`.

Verificado en vivo contra el Postgres real de este entorno: se insertó un diseño `draft` de 10 días de antigüedad, el preview lo detectó, `run` lo encoló, y el worker lo borró (`1 deleted, 0 error(s)`). Por separado, se insertó otro diseño `draft` de 20 días **vinculado a una orden real** vía `order_designs` — el preview lo excluyó correctamente (`count: 0`) y el sweep no lo tocó.

Archivos: `packages/api/src/jobs/queues.ts` (cola + scheduler), `packages/api/src/jobs/workers/abandoned-designs-cleanup.{logic,worker}.ts` (+ tests), `packages/api/src/routes/designs.ts` (endpoints de preview/run), `packages/api/src/config.ts` (retención configurable), `packages/api/src/worker.ts` (arranque del scheduler).

---

## 10.3 Purga automática de `webhook_deliveries` (nuevo esta sesión)

Mismo problema que la sección 10.2 pero para la tabla de auditoría de webhooks (sección 10.1): es un log puro, nadie lee una fila de más de unos días en la práctica, así que se purga con la misma cadencia.

- Borra filas de `webhook_deliveries` con más de **30 días** (configurable vía `WEBHOOK_DELIVERIES_RETENTION_DAYS`).
- Job repetible de BullMQ independiente (`webhook-deliveries-cleanup`), corre diario junto con la limpieza de diseños abandonados — se registra solo al arrancar el worker.
- Sin chequeo de FK/vinculación (a diferencia de 10.2) — una fila de `webhook_deliveries` es un registro de auditoría puro, nada más la referencia, así que no hay nada que pueda quedar huérfano al borrarla.
- Desactivable con `WEBHOOK_DELIVERIES_CLEANUP_ENABLED=false`.

Verificado en vivo: se insertó una fila de 40 días de antigüedad, se encoló un sweep manual, se borró (`1 deleted`); una corrida anterior sobre datos reales (todos recientes) reportó `0 deleted` sin tocar nada.

Archivos: `packages/api/src/jobs/queues.ts`, `packages/api/src/jobs/workers/webhook-deliveries-cleanup.worker.ts` (+ test), `packages/api/src/config.ts`, `packages/api/src/worker.ts`.

---

## 11. Limitaciones conocidas / trabajo futuro (decisiones explícitas, no descuidos)

- **Shopify**: el campo `source` en la base de datos ya soporta `'shopify'` además de `'woocommerce'`, pero no existe todavía un plugin de Shopify — solo WooCommerce está construido.
- **Editar un diseño ya agregado al carrito/orden**: decidido explícitamente que se omite por ahora. Hoy, si un cliente quiere cambiar su diseño después de agregarlo al carrito, tiene que quitar la línea y volver a personalizar desde cero.
- **Cancelación activa de jobs de producción en reembolsos**: decisión explícita de no construirlo (sección 6) — se avisa visualmente en vez de automatizar.
- **`designs.status` nunca pasa a `'paid'` automáticamente**: el webhook de órdenes actualiza `orders.status` y encola producción, pero no existe hoy un paso que marque el `designs.status` correspondiente como `'paid'`. La limpieza de diseños abandonados (sección 10.2) no depende de esto — se protege vía `order_designs.designId`, no vía `designs.status` — pero es una inconsistencia de datos real que valdría la pena cerrar.
- **La página de Órdenes del Admin Panel no se refresca sola** — carga los datos una vez al entrar; si un webhook llega después, hay que recargar la página a mano para verlo.
- **Quedaron 3 productos de prueba de sesiones anteriores** en el catálogo de WooCommerce ("Custom T-Shirt (OpenMerch)", "Mousepad XXL", "iPhone Case Test") mezclados con los 12 productos reales del catálogo de OpenMerch — no se borraron porque uno de ellos (Mousepad XXL) quedó referenciado por una orden real de prueba durante esta sesión.

---

## 12. Resumen de archivos relevantes

| Área | Archivos clave |
|---|---|
| Plugin WooCommerce | `plugins/plugin-woocommerce/openmerch-woocommerce/includes/class-openmerch-{settings,product-meta,editor-embed,cart,webhook}.php` |
| Tests del plugin (Brain Monkey) | `plugins/plugin-woocommerce/openmerch-woocommerce/tests/` |
| Tests del plugin (WP core, integración real) | `plugins/plugin-woocommerce/openmerch-woocommerce/tests-integration/` |
| Webhook de órdenes (API) | `packages/api/src/routes/orders-webhook-woocommerce.ts` (+ test) — incluye el log de entregas (`GET .../log`) |
| Órdenes (API) | `packages/api/src/routes/orders.ts`, `packages/api/src/db/schema.ts` (tablas `orders`, `order_designs`, `webhook_deliveries`) |
| Admin Panel — Pedidos | `apps/admin/src/pages/Orders.tsx` (incluye el banner de webhooks rechazados) |
| Admin Panel — Diseños | `apps/admin/src/pages/Designs.tsx` |
| Exportación del editor (Agregar al carrito vs. Imprimir/Descargar) | `packages/editor/src/utils/exportDesign.ts`, `packages/editor/src/components/NavBar.tsx` |
| Editor — bloqueos en modo embebido | `packages/editor/src/components/sidebar/tabs/ProductTab.tsx`, `packages/editor/src/store/editorStore.ts` |
| Cron de producción (Docker) | `docker-compose.yml` (servicio `wordpress-cron`) |
| Limpieza de diseños abandonados | `packages/api/src/jobs/queues.ts`, `packages/api/src/jobs/workers/abandoned-designs-cleanup.*.ts`, `packages/api/src/routes/designs.ts` |
