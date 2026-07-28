# Integrando el OpenMerch Editor con Shopify

> **Estado:** Patrón de referencia — todavía no existe un paquete de plugin
> scaffolded (no hay `plugins/plugin-shopify` en este repo hoy). Este
> documento describe el patrón de integración validado en un despliegue de
> producción real, generalizado para que cualquier merchant o theme developer
> pueda implementarlo. Son bienvenidas las contribuciones que conviertan esto
> en un paquete `plugins/plugin-shopify` propiamente dicho.

Esta guía explica cómo embeber el editor de productos de OpenMerch
(`@openmerch/editor`, construido con React 19 y Konva) dentro de una tienda
Shopify para que los clientes puedan personalizar un producto y que esa
personalización se propague a través del checkout, el procesamiento de la
orden y la producción.

**No** asume ninguna tienda, theme o catálogo de productos en particular —
los patrones descritos abajo son agnósticos al storefront y aplican a
cualquier merchant que corra en Shopify.

## 1. Overview: Headless vs. Classic

Los storefronts de Shopify caen en dos formas de integración, y el enfoque
recomendado difiere para cada una:

| Tipo de storefront | Stack de ejemplo | Patrón recomendado |
|---|---|---|
| **Headless** | Hydrogen (basado en React Router), o cualquier storefront custom construido sobre la Storefront API | **Patrón A — Componente React embebido** |
| **Classic / con theme** | Themes Liquid (Online Store 2.0, basados en Dawn o custom) | **Patrón B — iframe + postMessage** |

El criterio es simple: si el storefront ya es una aplicación React (como lo
es Hydrogen), no hay razón para introducir una frontera de iframe. El editor
puede importarse y renderizarse como un componente de primera clase,
compartiendo el layout, los estilos y el state de la página. Si el
storefront es Liquid server-rendered sin runtime de React, un iframe es la
opción pragmática e independiente del framework — el mismo patrón conceptual
documentado para la integración de WooCommerce (ver
`plugins/plugin-woocommerce`, actualmente un scaffold).

## 2. Patrón A — Componente React embebido (Headless / Hydrogen)

Este es el **patrón preferido para cualquier storefront con capacidad
React**, incluyendo Shopify Hydrogen.

### 2.1 Instalar el paquete del editor

```bash
npm install @openmerch/editor
```

(El nombre del paquete y el canal de distribución dependen de cómo se
publique OpenMerch en tu workspace — este documento asume que está
disponible como dependencia de un npm workspace/package.)

### 2.2 Renderizar el editor y manejar el export

El storefront es dueño de la página que lo rodea (info del producto, botón
de add-to-cart, pricing) y monta `ProductEditor` para el paso de
personalización. El contrato entre el storefront y el editor es un único
callback: `onExport`.

```tsx
// app/routes/products.$handle.customize.tsx (ruta de Hydrogen / React Router)
import { ProductEditor } from '@openmerch/editor';
import { useFetcher } from 'react-router';

export default function CustomizeProduct({ product }: { product: EditorProduct }) {
  const cartFetcher = useFetcher();

  async function handleExport(pngBlob: Blob, meta: DesignExportMeta) {
    // 1. Subir el diseño renderizado a tu propio storage (Shopify Files API,
    //    S3, R2, etc.) y obtener una URL públicamente alcanzable.
    const designUrl = await uploadDesignToStorage(pngBlob, meta);

    // 2. Agregar el producto al carrito vía la Storefront API, adjuntando el
    //    diseño como custom attributes del line item (ver sección 5).
    cartFetcher.submit(
      {
        action: 'LinesAdd',
        lines: JSON.stringify([
          {
            merchandiseId: product.variantId,
            quantity: 1,
            attributes: [
              { key: '_design_url', value: designUrl },
              { key: '_design_key', value: meta.designKey },
              { key: '_design_filename', value: meta.filename },
              { key: '_design_dimensions', value: `${meta.widthMm}x${meta.heightMm}mm` },
            ],
          },
        ]),
      },
      { method: 'post', action: '/cart' } // ruta respaldada por CartForm
    );
  }

  return (
    <ProductEditor
      product={product}
      onExport={handleExport}
    />
  );
}
```

### 2.3 ¿Por qué no usar iframe aquí?

Envolver un componente React en un iframe cuando el host ya es React agrega:

- Un bus de mensajes cross-origin (o same-origin-pero-aislado) sin ningún
  beneficio.
- Bundling duplicado de React/React-DOM dentro del iframe.
- Pérdida del flujo natural de props/callbacks, de la herencia de variables
  CSS y de los design tokens compartidos con el resto del storefront.

Dado que los storefronts de Hydrogen son aplicaciones React de punta a
punta, importar `@openmerch/editor` directamente y conectar `onExport` a la
Storefront API es estrictamente más simple y mantiene el paso de
personalización dentro del mismo árbol de React que el resto del funnel de
checkout.

## 3. Patrón B — iframe + postMessage (Classic / Themes Liquid)

Para themes sin runtime de React, embebe el editor como una página hosteada
independiente dentro de un `<iframe>` y comunícate con `window.postMessage`.

### 3.1 Sección del theme (Liquid)

```html
<!-- sections/openmerch-editor.liquid -->
<div id="openmerch-editor-container">
  <iframe
    id="openmerch-editor-frame"
    src="https://editor.example.com/embed?product={{ product.id }}&variant={{ product.selected_or_first_available_variant.id }}"
    style="width: 100%; height: 720px; border: 0;"
    allow="clipboard-write"
  ></iframe>
</div>

<script>
  (function () {
    var ALLOWED_ORIGIN = 'https://editor.example.com';
    var frame = document.getElementById('openmerch-editor-frame');

    window.addEventListener('message', function (event) {
      if (event.origin !== ALLOWED_ORIGIN) return;
      if (event.data?.type !== 'openmerch:export') return;

      var meta = event.data.meta;
      var designUrl = event.data.designUrl; // el editor hosteado ya lo subió

      // Agregar al carrito vía la Shopify AJAX Cart API, adjuntando la
      // metadata del diseño como line item properties (el equivalente en
      // classic theme de los custom attributes de Hydrogen).
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: meta.variantId,
              quantity: 1,
              properties: {
                _design_url: designUrl,
                _design_key: meta.designKey,
                _design_filename: meta.filename,
                _design_dimensions: meta.widthMm + 'x' + meta.heightMm + 'mm',
              },
            },
          ],
        }),
      }).then(function () {
        window.location.href = '/cart';
      });
    });
  })();
</script>
```

### 3.2 Lado del editor (página embed hosteada)

La página del editor hosteada (una página servida internamente que renderiza
`ProductEditor` con `onExport` conectado a `postMessage` de vuelta al
parent) envía el resultado una vez que el export/upload se completa:

```ts
function handleExport(pngBlob: Blob, meta: DesignExportMeta) {
  uploadDesignToStorage(pngBlob, meta).then((designUrl) => {
    window.parent.postMessage(
      { type: 'openmerch:export', designUrl, meta },
      'https://storefront.example.com' // origin exacto del parent, nunca '*'
    );
  });
}
```

**Nota de seguridad:** siempre valida `event.origin` en el extremo receptor
(en ambas direcciones) y nunca uses `'*'` como target origin en producción.
Trata la URL de embed del iframe y el origin del storefront parent como un
par fijo y explícitamente allow-listed.

Este es el mismo patrón conceptual pensado para plataformas de e-commerce
no-React en general — por ejemplo, se espera que la integración de
WooCommerce (`plugins/plugin-woocommerce`) siga este mismo contrato de
iframe + postMessage una vez implementada, ya que una página classic de
WordPress/WooCommerce tampoco tiene runtime de React.

## 4. Contrato: qué exporta el Editor

Sin importar el patrón (A o B), el contrato de salida del editor es el
mismo: dos valores pasados a `onExport(pngBlob, meta)`:

- **`pngBlob: Blob`** — el diseño renderizado como PNG (desde el stage de
  Konva), en resolución lista para producción.
- **`meta: DesignExportMeta`** — un objeto de metadata que describe el
  export:

```ts
interface DesignExportMeta {
  designKey: string;       // identificador opaco de este diseño (usado para
                            // volver a obtener el design document / layers
                            // completos más adelante si hace falta)
  filename: string;        // filename sugerido, ej. "design-<designKey>.png"
  widthMm: number;         // ancho físico de impresión en milímetros
  heightMm: number;        // alto físico de impresión en milímetros
  productId: string;       // el producto para el que se creó este diseño
  variantId?: string;      // la variante seleccionada, si aplica
}
```

El storefront (o la página embed hosteada, en el Patrón B) es responsable
de:

1. Persistir el PNG en algún lugar públicamente accesible (storage propio,
   CDN, o un endpoint de archivos que controles).
2. Obtener una URL pública estable para ese PNG.
3. Adjuntar esa URL — más el resto de `meta` — a la línea del carrito como
   line-item properties / custom attributes.

El editor en sí nunca habla directamente con la API de Shopify. Esto
mantiene a `@openmerch/editor` agnóstico de plataforma: el mismo componente
funciona detrás de Hydrogen, WooCommerce o cualquier otro sistema de
carrito, porque la integración con el carrito vive enteramente en el
callback `onExport`.

## 5. Mapeo de Cart Attributes

Ya sea agregado vía Storefront API `CartForm` (Hydrogen) o el endpoint AJAX
classic `/cart/add.js`, las attribute keys recomendadas son:

| Attribute key | Valor | Propósito |
|---|---|---|
| `_design_url` | URL pública del PNG exportado | Archivo fuente para producción y revisión de la orden |
| `_design_key` | Identificador opaco del diseño | Correlaciona la línea del carrito con el design record para regeneración o auditoría |
| `_design_filename` | Filename sugerido | Usado al generar archivos de producción o resúmenes de orden de cara al cliente |
| `_design_dimensions` | `"<width>x<height>mm"` | Dimensiones físicas de impresión para el pipeline de producción |

Prefijar las keys con un guion bajo (`_design_url`, etc.) sigue la
convención de Shopify para line item properties que deben ocultarse del
cliente en la UI de cart/checkout pero permanecer legibles vía la Admin API
y los webhooks — apropiado aquí porque son referencias internas de
producción y no opciones de cara al cliente.

Estos attributes se pueden leer después desde:

- La Admin API, en `order.line_items[].properties` (classic) o
  `order.lineItems[].customAttributes` (forma de la GraphQL Admin API /
  Storefront API), y
- Webhook payloads como `orders/paid`, que incluyen las mismas line item
  properties/custom attributes.

## 6. Disparar la Producción (Opcional)

Una vez que una orden está pagada, un webhook handler para `orders/paid`
puede leer los attributes `_design_url` / `_design_key` de cada line item y
encolar un job de producción. Este repositorio ya incluye un worker basado
en BullMQ para generar archivos listos para producción a partir de un
design record — ver `packages/api/src/jobs/workers/production-files.worker.ts`
y el setup de queue circundante en `packages/api/src/jobs/`.

Un flujo típico:

1. Shopify envía `orders/paid` a un webhook endpoint que hosteas.
2. El handler extrae `_design_key` (y/o `_design_url`) de cada line item
   relevante.
3. El handler encola un job de production-file (por ejemplo vía la queue de
   BullMQ existente) referenciando ese design key.
4. El worker genera el output listo para imprimir (vector/raster de alta
   resolución, según tu pipeline de producción) y lo almacena para
   fulfillment.

Este paso es completamente opcional y está desacoplado de la integración
editor/carrito descrita arriba — un merchant puede adoptar el Patrón A o B
para el paso de editor y carrito sin conectar la generación automatizada de
archivos de producción, y agregarla después.

## 7. Estado

Este documento describe un **patrón de referencia**, validado contra una
integración de producción real de Shopify Hydrogen y generalizado aquí sin
nombres, dominios ni datos específicos de ningún merchant. Actualmente no
existe un paquete `plugins/plugin-shopify` scaffolded en este monorepo — el
directorio del plugin de WooCommerce (`plugins/plugin-woocommerce`) sigue
siendo, de igual manera, un scaffold vacío.

Son bienvenidas las contribuciones que conviertan este patrón en un paquete
de plugin mantenido e instalable (Shopify o WooCommerce).
