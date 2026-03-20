import { useEffect, useMemo, useCallback, useState } from 'react';
import { Stage, Layer, Image, Rect } from 'react-konva';
import type { Product, ProductZone } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useImage } from '../hooks/useImage.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { DesignLayer } from './DesignLayer.js';
import { SnapGuides, calculateSnapGuides } from './SnapGuides.js';
import type { SnapGuide } from './SnapGuides.js';
import { ZoneSelector } from './ZoneSelector.js';
import { Toolbar } from './Toolbar.js';
import type Konva from 'konva';

interface ProductEditorProps {
  product: Product;
  width?: number;
  height?: number;
}

export function ProductEditor({ product, width = 800, height = 700 }: ProductEditorProps) {
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
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <ZoneSelector zones={product.zones} />
      <CanvasView zone={activeProductZone} width={width} height={height} />
    </div>
  );
}

interface CanvasViewProps {
  zone: ProductZone;
  width: number;
  height: number;
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

function CanvasView({ zone, width, height }: CanvasViewProps) {
  const [baseImage, status] = useImage(zone.baseImageUrl);
  const design = useEditorStore((s) => s.design);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const selectLayer = useEditorStore((s) => s.selectLayer);

  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  const designZone = design?.zones[activeZoneId];
  const layers = designZone?.layers ?? [];

  const layout: CanvasLayout | null = useMemo(() => {
    if (!baseImage) return null;

    const imgAspect = baseImage.width / baseImage.height;
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
  }, [baseImage, width, height, zone]);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      if (e.target === e.target.getStage() || e.target.attrs.id === 'background') {
        selectLayer(null);
      }
    },
    [selectLayer],
  );

  // Handle drag move for snap guides
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

      // Apply snap
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

  if (status === 'loading' || !baseImage || !layout) {
    return (
      <Stage width={width} height={height}>
        <Layer>
          <Rect x={0} y={0} width={width} height={height} fill="#f0f0f0" />
        </Layer>
      </Stage>
    );
  }

  return (
    <>
      <Toolbar />
      <Stage
        width={width}
        height={height}
        onClick={handleStageClick}
        onTap={handleStageClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {/* Background + mockup image (not interactive) */}
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

        {/* Design layers — NO clip, so user can grab elements outside the print zone */}
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

        {/* Print zone border + snap guides */}
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
    </>
  );
}
