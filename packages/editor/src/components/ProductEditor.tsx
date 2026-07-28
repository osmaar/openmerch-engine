import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { Stage, Layer, Image, Rect, Group, Transformer } from 'react-konva';
import type { Product, ProductZone } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useI18nStore, useT } from '../i18n/useTranslation.js';
import { useImage } from '../hooks/useImage.js';
import { useColoredProduct } from '../hooks/useColoredProduct.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useDisplacedDesignPreview } from '../hooks/useDisplacedDesignPreview.js';
import { DesignLayer } from './DesignLayer.js';
import { SnapGuides, calculateSnapGuides } from './SnapGuides.js';
import type { SnapGuide } from './SnapGuides.js';
import { NavBar } from './NavBar.js';
import { SidebarPanel } from './sidebar/SidebarPanel.js';
import { TopToolbar } from './TopToolbar.js';
import { UndoRedoControls } from './UndoRedoControls.js';
import { StageNavigator } from './StageNavigator.js';
import { ZoomControls } from './ZoomControls.js';
import type Konva from 'konva';

interface ProductEditorProps {
  product: Product;
  width?: number;
  height?: number;
}

/**
 * Full product design editor: canvas, sidebar, toolbars and footer in a single component.
 * Fills the viewport (100vw/100vh) — mount as the whole page; `width`/`height` props are currently unused.
 * Wrap with `ErrorBoundary` to catch render errors instead of a blank screen.
 */
export function ProductEditor({ product: initialProduct }: ProductEditorProps) {
  const setProduct = useEditorStore((s) => s.setProduct);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const product = useEditorStore((s) => s.product) ?? initialProduct;
  const loadLanguages = useI18nStore((s) => s.loadLanguages);
  const t = useT();
  const [showBranding, setShowBranding] = useState(true);
  useKeyboardShortcuts();

  useEffect(() => {
    setProduct(initialProduct);
  }, [initialProduct, setProduct]);

  useEffect(() => {
    const apiBase = (typeof window !== 'undefined' && window.location.port === '3000')
      ? 'http://localhost:3001'
      : '';
    loadLanguages(apiBase);
    // Load public settings (branding, store name)
    fetch(`${apiBase}/api/v1/settings/public`)
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        if (data.show_branding === 'false') setShowBranding(false);
        if (data.store_name) {
          document.title = `${data.store_name} — Editor`;
          useEditorStore.setState({ storeName: data.store_name });
        }
        if (data.favicon_url) {
          let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
          link.href = data.favicon_url;
        }
      })
      .catch(() => { /* settings unavailable — keep defaults */ });
  }, [loadLanguages]);

  const activeProductZone = product.zones.find((z) => z.id === activeZoneId);

  if (!activeProductZone) {
    return <div>No zone found</div>;
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const blobUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const { width, height } = img;
      URL.revokeObjectURL(blobUrl);
      try {
        const { uploadAsset } = await import('../services/api.js');
        const asset = await uploadAsset(file);
        addImageLayer(asset.url, width, height);
      } catch {
        addImageLayer(blobUrl, width, height);
      }
    };
    img.src = blobUrl;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#f5f5f5',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Global navigation bar */}
      <NavBar />

      {/* Main content: sidebar + canvas area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar */}
      <SidebarPanel />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top toolbar — contextual only */}
        <TopToolbar />

        {/* Canvas area — fills remaining space */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <CanvasView zone={activeProductZone} />
          </div>

          {/* Floating zone navigator — right side */}
          <StageNavigator product={product} />

          {/* Floating undo/redo — top right */}
          <UndoRedoControls />
        </div>

        {/* Disclaimer + branding footer */}
        <div style={{
          padding: '6px 12px',
          fontSize: 11,
          color: '#999',
          textAlign: 'center',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: '#eee',
          background: '#fafafa',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <span>{t('Preview is approximate. Colors and proportions may vary on the final product.')}</span>
          {showBranding && (
            <span style={{ fontSize: 10, color: '#bbb' }}>
              © {new Date().getFullYear()} <a href="https://github.com/osmaar/openmerch-engine" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', textDecoration: 'none' }}>OpenMerch Engine</a> · Open Source · MIT
            </span>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

interface CanvasViewProps {
  zone: ProductZone;
}

interface CanvasLayout {
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  printX: number;
  printY: number;
  printW: number;
  printH: number;
  pxPerMM: number;
}

function CanvasView({ zone }: CanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const designGroupRef = useRef<Konva.Group>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [_zoom, setZoom] = useState(1);
  // Suppresses the distorted preview layer while a drag/transform gesture is
  // in progress, so the user sees the real interactive layer move without
  // distortion; the preview recomputes (debounced) and covers it again once
  // the gesture ends.
  const [isDragging, setIsDragging] = useState(false);
  const productColor = useEditorStore((s) => s.productColor);
  const [rawImage, status] = useImage(zone.baseImageUrl);
  const baseImage = useColoredProduct(rawImage, productColor);
  const [overlayImage] = useImage(zone.overlayImageUrl ?? '');
  const design = useEditorStore((s) => s.design);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);
  const showPrintZone = useEditorStore((s) => s.showPrintZone);

  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Auto-resize canvas to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { width, height } = size;
  const designZone = design?.zones[activeZoneId];
  const layers = designZone?.layers ?? [];

  const layout: CanvasLayout | null = useMemo(() => {
    if (!rawImage || !baseImage) return null;

    const imgAspect = rawImage.width / rawImage.height;
    const canvasAspect = width / height;

    let imgW: number;
    let imgH: number;

    if (imgAspect > canvasAspect) {
      imgW = width * 0.85;
      imgH = imgW / imgAspect;
    } else {
      imgH = height * 0.85;
      imgW = imgH * imgAspect;
    }

    const imgX = (width - imgW) / 2;
    const imgY = (height - imgH) / 2;
    const pxPerMM = imgW / zone.baseImageWidthMM;

    const printX = imgX + zone.printAreaXMM * pxPerMM;
    const printY = imgY + zone.printAreaYMM * pxPerMM;
    const printW = zone.printAreaWidthMM * pxPerMM;
    const printH = zone.printAreaHeightMM * pxPerMM;

    return { imgX, imgY, imgW, imgH, printX, printY, printW, printH, pxPerMM };
  }, [rawImage, baseImage, width, height, zone]);

  // Expose stage ref and layout to store for export
  useEffect(() => {
    useEditorStore.setState({ stageRef: stageRef as { current: unknown } });
  }, []);

  useEffect(() => {
    if (layout) {
      useEditorStore.setState({
        canvasLayout: {
          printX: layout.printX,
          printY: layout.printY,
          printW: layout.printW,
          printH: layout.printH,
          pxPerMM: layout.pxPerMM,
        },
      });
    }
  }, [layout]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage() || e.target.attrs.id === 'background') {
        selectLayer(null);
      }
    },
    [selectLayer, layout],
  );

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (!layout) return;

      const node = e.target;
      const rect = node.getClientRect({ relativeTo: node.getStage() ?? undefined });

      const { guides, snapX, snapY } = calculateSnapGuides(
        rect,
        layout.printX,
        layout.printY,
        layout.printW,
        layout.printH,
      );

      setSnapGuides(guides);

      if (snapX !== null) {
        node.x(node.x() + (snapX - rect.x));
      }
      if (snapY !== null) {
        node.y(node.y() + (snapY - rect.y));
      }

      // If dragged completely outside, constrain to keep at least part visible
      if (layout) {
        const node = e.target;
        const nodeRect = node.getClientRect({ relativeTo: node.getStage() ?? undefined });
        const fullyOutside =
          nodeRect.x + nodeRect.width < layout.printX ||
          nodeRect.x > layout.printX + layout.printW ||
          nodeRect.y + nodeRect.height < layout.printY ||
          nodeRect.y > layout.printY + layout.printH;
        if (fullyOutside) {
          // Snap back: center in print area (coordinates relative to parent Group)
          node.x(layout.printW / 2 - nodeRect.width / 2);
          node.y(layout.printH / 2 - nodeRect.height / 2);
        }
      }
    },
    [layout],
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setSnapGuides([]);
    setIsDragging(false);
  }, []);

  const handleTransformStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleTransformEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const displacedPreviewCanvas = useDisplacedDesignPreview({
    groupRef: designGroupRef,
    zone,
    layers,
    layout,
    isDragging,
  });

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.08;
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.3, Math.min(5, newScale));

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
    setZoom(newScale);
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {(status === 'loading' || !baseImage || !layout) ? (
        <Stage width={width} height={height}>
          <Layer>
            <Rect x={0} y={0} width={width} height={height} fill="#f0f0f0" />
          </Layer>
        </Stage>
      ) : (
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onWheel={handleWheel}
          draggable={_zoom > 1}
        >
          <Layer listening={false}>
            <Rect id="background" x={0} y={0} width={width} height={height} fill="#f0f0f0" />
            <Image
              image={baseImage}
              x={layout.imgX}
              y={layout.imgY}
              width={layout.imgW}
              height={layout.imgH}
            />
          </Layer>

          <Layer>
            {/*
              Design layers live inside a Group anchored at the print area.
              This makes layer.x/y print-area-local in MM (Konva positions
              children relative to their parent), so the saved coordinates
              are screen-independent and reusable by the production renderer.
            */}
            <Group
              ref={designGroupRef}
              x={layout.printX}
              y={layout.printY}
              clipX={0}
              clipY={0}
              clipWidth={layout.printW}
              clipHeight={layout.printH}
            >
              {layers
                .filter((l) => l.visible)
                .map((layer) => (
                  <DesignLayer
                    key={layer.id}
                    layer={layer}
                    pxPerMM={layout.pxPerMM}
                    isSelected={selectedLayerId === layer.id}
                  />
                ))}
            </Group>
          </Layer>

          {/*
            Distorted "fabric follows the design" preview — a snapshot of the
            Group above, run through the displacement map, drawn as a flat
            image directly over it. Non-listening so clicks/drags still reach
            the real interactive Group underneath. Hidden mid-gesture so the
            user sees the undistorted layer move live; see useDisplacedDesignPreview.
          */}
          {zone.displacementMapUrl && (
            <Layer listening={false} visible={!isDragging}>
              {displacedPreviewCanvas && (
                <Image
                  name="displacement-preview"
                  image={displacedPreviewCanvas}
                  x={layout.printX}
                  y={layout.printY}
                  width={layout.printW}
                  height={layout.printH}
                />
              )}
            </Layer>
          )}

          {/* Transformer layer — OUTSIDE the clip so handles are always visible, and rendered
              above the distorted preview so selection handles stay visible over it. */}
          <Layer>
            <SharedTransformer
              stageRef={stageRef}
              selectedLayerId={selectedLayerId}
              onTransformStart={handleTransformStart}
              onTransformEnd={handleTransformEnd}
            />
          </Layer>

          <Layer listening={false}>
            {/* Product overlay — renders ON TOP of designs (camera cutout, edges, bumper) */}
            {zone.overlayImageUrl && overlayImage && (
              <Image
                image={overlayImage}
                x={layout.imgX}
                y={layout.imgY}
                width={layout.imgW}
                height={layout.imgH}
              />
            )}

            {showPrintZone && (
              <Rect
                x={layout.printX}
                y={layout.printY}
                width={layout.printW}
                height={layout.printH}
                stroke="#4A90D9"
                strokeWidth={1.5}
                dash={[6, 4]}
              />
            )}

            <SnapGuides
              guides={snapGuides}
              printX={layout.printX}
              printY={layout.printY}
              printW={layout.printW}
              printH={layout.printH}
            />
          </Layer>
        </Stage>
      )}

      {/* Zoom controls */}
      <ZoomControls stageRef={stageRef} zoom={_zoom} setZoom={setZoom} />
    </div>
  );
}

interface SharedTransformerProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedLayerId: string | null;
  onTransformStart: () => void;
  onTransformEnd: () => void;
}

/** Transformer rendered OUTSIDE the clipped design Group so handles stay visible */
function SharedTransformer({ stageRef, selectedLayerId, onTransformStart, onTransformEnd }: SharedTransformerProps) {
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const attach = () => {
      const tr = trRef.current;
      const stage = stageRef.current;
      if (!tr || !stage) return;
      if (!selectedLayerId) { tr.nodes([]); tr.getLayer()?.batchDraw(); return; }

      const node = stage.findOne(`#${selectedLayerId}`);
      if (node) {
        tr.nodes([node as Konva.Node]);
      } else {
        tr.nodes([]);
      }
      tr.getLayer()?.batchDraw();
    };
    attach();
    // Retry after a frame in case the node wasn't mounted yet
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [selectedLayerId, stageRef]);

  return (
    <Transformer
      ref={trRef}
      onTransformStart={onTransformStart}
      onTransformEnd={onTransformEnd}
      rotateEnabled
      rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
      rotationSnapTolerance={8}
      anchorSize={8}
      borderStroke="#4A90D9"
      anchorStroke="#4A90D9"
      anchorFill="#fff"
      anchorCornerRadius={2}
      rotateAnchorOffset={25}
      keepRatio={false}
      enabledAnchors={['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']}
    />
  );
}
