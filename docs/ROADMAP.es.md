# Roadmap

> Roadmap público de OpenMerch Engine — plataforma de personalización de productos open-source y self-hosted.

Este documento registra en qué punto está el proyecto y qué sigue, organizado según las mismas fases usadas en [README.md](../README.md). Se actualiza a medida que el trabajo avanza — no se prometen fechas fijas salvo donde se indique explícitamente.

**Estado actual:** La Fase 1 (Canvas Editor Core) está completa. La Fase 2 (Backend & Admin Panel) está funcionalmente completa; quedan algunos puntos por cerrar antes de que el proyecto esté listo para un lanzamiento público más amplio. La validación por técnica/bordado, los plugins de WooCommerce/Shopify, el checkout nativo y el preview 3D quedan explícitamente **fuera de alcance para el push de v1** — ver [Post-MVP](#post-mvp--explícitamente-fuera-de-alcance-por-ahora) más abajo para el porqué.

---

## Fase 1 — Canvas Editor Core

**Estado: Completa**

- [x] Editor de canvas visual (Konva.js) — imágenes, texto, formas, cliparts; mover, escalar, rotar con guías de alineación
- [x] Soporte multi-zona (diseño de frente y espalda de forma independiente)
- [x] Herramientas de imagen — subida, recorte, filtros, relleno/tinte, remoción de fondo (basada en umbral)
- [x] Herramientas de texto — fuentes, efectos (curvado, oblicuo), barra de estilos completa
- [x] 9 formas geométricas con barra de herramientas contextual
- [x] Cliparts (200,000+ vía Iconify), fotos y fondos (Unsplash), 120+ Google Fonts
- [x] Generación de imágenes con IA (Pollinations.ai — 5 modelos, 8 estilos)
- [x] Generador de códigos QR
- [x] Tinte de color de producto (en tiempo real, detecta automáticamente el tipo de fondo)
- [x] Panel de capas (reordenar, mostrar/ocultar, bloquear, renombrar)
- [x] Atajos de teclado completos (20+) y undo/redo completo
- [x] Exportación PNG/SVG a 600 DPI, con o sin base de mockup

---

## Fase 2 — Backend & Admin Panel

**Estado: Casi completa — últimos puntos en progreso**

- [x] API REST con Fastify + PostgreSQL (Drizzle ORM) + almacenamiento MinIO, infraestructura con Docker Compose
- [x] Panel de administración completo — productos, plantillas, cliparts, fuentes, tipos de impresión, pedidos, idiomas, configuración
- [x] Integración editor ↔ API (cargar/guardar diseños, sincronización de recursos del comerciante)
- [x] Flujo de carrito (agregar al carrito, gestionar cantidades, persistencia en base de datos)
- [x] Cola de trabajos de producción con BullMQ (archivos de impresión a 300 DPI + mockups a 96 DPI, fuentes personalizadas + Google Fonts)
- [x] API de configuración con almacenamiento cifrado para API keys de terceros
- [x] Sistema de overlays/máscaras de producto (21 overlays en 7 tipos de producto)
- [x] Editor de zonas interactivo (Konva) para calibrar visualmente las áreas de impresión en el admin
- [x] i18n completo en editor y admin (inglés, español y francés ya disponibles; más idiomas importables)
- [ ] Mejora de remoción de fondo con IA (ver [Futuro — IA Avanzada](#futuro--ia-avanzada))
- [ ] Mapas de desplazamiento / mezcla de texturas — mockups realistas de tela (el diseño sigue las arrugas/pliegues de la prenda). **Confirmado en el alcance** — esto es lo que hace que el preview se vea como tela real en vez de una estampa plana, directamente para el push de v1.
- [x] Revisión de hardening de seguridad — auditoría interna completa cerrada (seguridad, frontend, backend, cobertura de tests, calidad de código — 54 hallazgos entre P0/P1/P2), verificada con build/lint/test + smoke tests en vivo. Documentación por módulo (README + JSDoc de cada paquete) y docs de CONTRIBUTING/setup local cerrados junto con esto.

---

## Post-MVP — Explícitamente Fuera de Alcance por Ahora

Estos ítems estaban en versiones anteriores de este roadmap como fases activas. Ahora quedan explícitamente despriorizados para el push de v1 — no porque sean malas ideas, sino porque cada uno es un alcance grande y abierto que retrasaría lanzar un v1 pulido y self-hostable. Se aceptan contribuciones en cualquiera de estos; simplemente no los está construyendo el maintainer ahora mismo.

- [ ] **Validación por técnica y microservicio de bordado** (antes "Fase 3") — aplicar automáticamente las reglas de sublimación/serigrafía/bordado en el pipeline de producción, más el microservicio Python de DST/PES (`packages/embroidery`, sigue siendo un placeholder). Demasiado extenso para meter en este push; además, validar la salida del bordado requiere acceso a hardware real (Tajima, Brother, Barudan) que el maintainer no tiene. Los contribuidores con ese acceso son especialmente bienvenidos — ver [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] **Plugin de WooCommerce** (`plugins/plugin-woocommerce`) — no se construye para v1. El patrón de puente iframe + postMessage sigue siendo el enfoque pensado si alguien lo retoma, pero ya no está en el roadmap activo del maintainer.
- [ ] **Integración con Shopify** — mismo estado que WooCommerce: hay un *patrón* genérico de embebido documentado en [docs/integrations/shopify.es.md](integrations/shopify.es.md) (embeber `@openmerch/editor` como componente React, contrato `onExport`, mapeo a `customAttributes` del carrito), pero no hay un paquete de plugin planeado ahora mismo.
- [ ] **Flujo de checkout / pago nativo** — decisión deliberada de **no** construir procesamiento de pagos dentro de OpenMerch. El propio principio del proyecto ("editor + API primero, los plugins son puentes tontos, toda la lógica vive en la API") va en contra de reimplementar lo que Shopify/WooCommerce ya hacen bien. El endpoint de generación de archivos de producción (`POST /api/v1/designs/:id/generate-files`) ya existe y funciona de forma independiente — cualquier integración externa (un webhook del CMS, un storefront custom, una acción manual del admin) puede llamarlo directo una vez confirmada la orden, sin que OpenMerch necesite ser dueño del flujo de pago.
- [ ] **Preview 3D** — no está planeado. El compositing 2D (incluyendo el trabajo de displacement maps de arriba) cubre la vara de realismo que este proyecto busca; 3D agrega un alcance grande de motor de render (Three.js/WebGL) para un caso de uso que la mayoría de los comerciantes no necesita.

---

## Futuro — IA Avanzada

**Post-v1 — exploratorio, sin fechas comprometidas.** Son direcciones que queremos explorar una vez que el producto core y las integraciones anteriores estén estables, no compromisos para el próximo release.

- [ ] **Remoción de fondo con IA** — reemplazar/complementar la herramienta actual basada en umbral con un modelo de IA propiamente dicho (p. ej. rembg), a la altura de la calidad de los editores comerciales.
- [ ] **Generative fill / completado de imágenes con IA** — permitir a los comerciantes extender o completar un diseño de forma inteligente, similar a herramientas como Kittl.
- [ ] **Upscaling de IA en alta resolución** — mejorar la calidad de salida de imágenes generadas por IA y de imágenes subidas en baja resolución, más allá de lo que se produce hoy.

---

## Contribuir

Ver [CONTRIBUTING.md](../CONTRIBUTING.md) para saber cómo participar. Áreas donde la ayuda es especialmente valiosa en este momento: validación de bordado (acceso a máquina), assets de producto (mapas de desplazamiento, máscaras de zona de impresión para productos nuevos), el plugin de WooCommerce (PHP) y traducciones.
