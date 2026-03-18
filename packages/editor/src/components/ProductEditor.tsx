import { useEffect, useMemo } from 'react';
import { Stage, Layer, Image, Rect } from 'react-konva';
import type { Product, ProductZone } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useImage } from '../hooks/useImage.js';
import { ZoneSelector } from './ZoneSelector.js';

interface ProductEditorProps {
  product: Product;
  width?: number;
  height?: number;
}

export function ProductEditor({ product, width = 800, height = 700 }: ProductEditorProps) {
  const { setProduct, activeZoneId } = useEditorStore();

  useEffect(() => {
    setProduct(product);
  }, [product, setProduct]);

  const activeProductZone = product.zones.find((z) => z.id === activeZoneId);

  if (!activeProductZone) {
    return <div>No zone found</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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

function CanvasView({ zone, width, height }: CanvasViewProps) {
  const [baseImage, status] = useImage(zone.baseImageUrl);

  const layout = useMemo(() => {
    if (!baseImage) return null;

    // Fit the mockup image inside the canvas with some padding (85%)
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

    // Center the image on the canvas
    const imgX = (width - imgW) / 2;
    const imgY = (height - imgH) / 2;

    // Convert mm to screen px:
    // The full image represents baseImageWidthMM in real life.
    // pxPerMM tells us how many screen pixels = 1 real-world mm.
    const pxPerMM = imgW / zone.baseImageWidthMM;

    // Position the print zone relative to the image's top-left corner
    const printX = imgX + zone.printAreaXMM * pxPerMM;
    const printY = imgY + zone.printAreaYMM * pxPerMM;
    const printW = zone.printAreaWidthMM * pxPerMM;
    const printH = zone.printAreaHeightMM * pxPerMM;

    return { imgX, imgY, imgW, imgH, printX, printY, printW, printH };
  }, [baseImage, width, height, zone]);

  if (status === 'loading') {
    return (
      <Stage width={width} height={height}>
        <Layer />
      </Stage>
    );
  }

  if (status === 'error' || !baseImage || !layout) {
    return (
      <Stage width={width} height={height}>
        <Layer>
          <Rect x={0} y={0} width={width} height={height} fill="#f5f5f5" />
        </Layer>
      </Stage>
    );
  }

  return (
    <Stage width={width} height={height}>
      <Layer>
        <Rect x={0} y={0} width={width} height={height} fill="#f0f0f0" />

        <Image
          image={baseImage}
          x={layout.imgX}
          y={layout.imgY}
          width={layout.imgW}
          height={layout.imgH}
          listening={false}
        />

        <Rect
          x={layout.printX}
          y={layout.printY}
          width={layout.printW}
          height={layout.printH}
          stroke="#4A90D9"
          strokeWidth={1.5}
          dash={[6, 4]}
          listening={false}
        />
      </Layer>
    </Stage>
  );
}
