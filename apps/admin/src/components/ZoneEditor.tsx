import { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Image as KImage, Rect, Transformer } from 'react-konva';
import type Konva from 'konva';

interface ZoneEditorProps {
  baseImageUrl: string;
  baseImageWidthMM: number;
  baseImageHeightMM: number;
  printAreaWidthMM: number;
  printAreaHeightMM: number;
  printAreaXMM: number;
  printAreaYMM: number;
  overlayImageUrl?: string;
  onChange: (updates: {
    printAreaWidthMM?: number;
    printAreaHeightMM?: number;
    printAreaXMM?: number;
    printAreaYMM?: number;
  }) => void;
}

function useLoadImage(url: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) { setImg(null); return; }
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    image.src = url;
  }, [url]);
  return img;
}

export function ZoneEditor({
  baseImageUrl, baseImageWidthMM, baseImageHeightMM,
  printAreaWidthMM, printAreaHeightMM, printAreaXMM, printAreaYMM,
  overlayImageUrl, onChange,
}: ZoneEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ width: 400, height: 400 });

  const baseImg = useLoadImage(baseImageUrl);
  const overlayImg = useLoadImage(overlayImageUrl ?? '');

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0]!.contentRect.width);
      if (w > 0) {
        const aspect = baseImageWidthMM / baseImageHeightMM;
        setStageSize({ width: w, height: Math.round(w / aspect) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseImageWidthMM, baseImageHeightMM]);

  // Attach transformer
  useEffect(() => {
    if (trRef.current && rectRef.current) {
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  });

  const pxPerMM = stageSize.width / baseImageWidthMM;

  const rectX = printAreaXMM * pxPerMM;
  const rectY = printAreaYMM * pxPerMM;
  const rectW = printAreaWidthMM * pxPerMM;
  const rectH = printAreaHeightMM * pxPerMM;

  const handleDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange({
      printAreaXMM: Math.round(node.x() / pxPerMM),
      printAreaYMM: Math.round(node.y() / pxPerMM),
    });
  }, [pxPerMM, onChange]);

  const handleTransformEnd = useCallback(() => {
    const node = rectRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const newW = Math.round((node.width() * scaleX) / pxPerMM);
    const newH = Math.round((node.height() * scaleY) / pxPerMM);
    const newX = Math.round(node.x() / pxPerMM);
    const newY = Math.round(node.y() / pxPerMM);
    // Reset scale so Konva doesn't double-apply it
    node.scaleX(1);
    node.scaleY(1);
    node.width(newW * pxPerMM);
    node.height(newH * pxPerMM);
    onChange({ printAreaWidthMM: newW, printAreaHeightMM: newH, printAreaXMM: newX, printAreaYMM: newY });
  }, [pxPerMM, onChange]);

  const dragBound = useCallback((pos: { x: number; y: number }) => {
    const node = rectRef.current;
    const w = node ? node.width() * node.scaleX() : rectW;
    const h = node ? node.height() * node.scaleY() : rectH;
    return {
      x: Math.max(0, Math.min(pos.x, stageSize.width - w)),
      y: Math.max(0, Math.min(pos.y, stageSize.height - h)),
    };
  }, [stageSize, rectW, rectH]);

  return (
    <div ref={containerRef} style={{ width: '100%', maxWidth: 500 }}>
      <Stage width={stageSize.width} height={stageSize.height} style={{ borderRadius: 8, overflow: 'hidden', background: '#e8e8e8' }}>
        {/* Base product image */}
        <Layer listening={false}>
          {baseImg && (
            <KImage image={baseImg} x={0} y={0} width={stageSize.width} height={stageSize.height} />
          )}
        </Layer>

        {/* Interactive print zone rect */}
        <Layer>
          <Rect
            ref={rectRef}
            x={rectX}
            y={rectY}
            width={rectW}
            height={rectH}
            fill="rgba(74, 144, 217, 0.15)"
            stroke="#4A90D9"
            strokeWidth={2}
            dash={[6, 4]}
            draggable
            dragBoundFunc={dragBound}
            onDragEnd={handleDragEnd}
            onTransformEnd={handleTransformEnd}
          />
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            anchorSize={8}
            borderStroke="#4A90D9"
            anchorStroke="#4A90D9"
            anchorFill="#fff"
            anchorCornerRadius={2}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-left', 'middle-right', 'top-center', 'bottom-center']}
            boundBoxFunc={(_oldBox, newBox) => {
              // Prevent negative dimensions and keep within stage
              if (newBox.width < 10 || newBox.height < 10) return _oldBox;
              if (newBox.x < 0 || newBox.y < 0) return _oldBox;
              if (newBox.x + newBox.width > stageSize.width || newBox.y + newBox.height > stageSize.height) return _oldBox;
              return newBox;
            }}
          />
        </Layer>

        {/* Overlay preview (non-interactive, semi-transparent for reference) */}
        <Layer listening={false}>
          {overlayImg && (
            <KImage image={overlayImg} x={0} y={0} width={stageSize.width} height={stageSize.height} opacity={0.6} />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
