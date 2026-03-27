import { useEffect, useMemo, useCallback, useState, useRef } from 'react';
import { Stage, Layer, Image, Rect } from 'react-konva';
import type { Product, ProductZone } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useImage } from '../hooks/useImage.js';
import { useColoredProduct } from '../hooks/useColoredProduct.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
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

export function ProductEditor({ product }: ProductEditorProps) {
  const { setProduct, activeZoneId, addImageLayer } = useEditorStore();
  useKeyboardShortcuts();

  useEffect(() => {
    setProduct(product);
  }, [product, setProduct]);

  const activeProductZone = product.zones.find((z) => z.id === activeZoneId);

  if (!activeProductZone) {
    return <div>No zone found</div>;
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      addImageLayer(url, img.width, img.height);
    };
    img.src = url;
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
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [_zoom, setZoom] = useState(1);
  const productColor = useEditorStore((s) => s.productColor);
  const [rawImage, status] = useImage(zone.baseImageUrl);
  const baseImage = useColoredProduct(rawImage, productColor);
  const design = useEditorStore((s) => s.design);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);

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

  // Sync canvas offset to store so Position popover can use it
  const setCanvasOffsetMM = useEditorStore((s) => s.setCanvasOffsetMM);
  useEffect(() => {
    if (layout) {
      setCanvasOffsetMM(layout.imgX / layout.pxPerMM, layout.imgY / layout.pxPerMM);
    }
  }, [layout, setCanvasOffsetMM]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage() || e.target.attrs.id === 'background') {
        selectLayer(null);
      }
    },
    [selectLayer],
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
    },
    [layout],
  );

  const handleDragEnd = useCallback(() => {
    setSnapGuides([]);
  }, []);

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
            {layers
              .filter((l) => l.visible)
              .map((layer) => (
                <DesignLayer
                  key={layer.id}
                  layer={{
                    ...layer,
                    x: layer.x + zone.printAreaXMM,
                    y: layer.y + zone.printAreaYMM,
                  }}
                  pxPerMM={layout.pxPerMM}
                  isSelected={selectedLayerId === layer.id}
                  printOriginXMM={zone.printAreaXMM}
                  printOriginYMM={zone.printAreaYMM}
                />
              ))}
          </Layer>

          <Layer listening={false}>
            <Rect
              x={layout.printX}
              y={layout.printY}
              width={layout.printW}
              height={layout.printH}
              stroke="#4A90D9"
              strokeWidth={1.5}
              dash={[6, 4]}
            />

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
