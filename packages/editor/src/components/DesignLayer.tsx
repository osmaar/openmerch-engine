import { useRef, useEffect, useMemo } from 'react';
import { Image, Text, Rect as KRect, Circle, RegularPolygon, Star, Line, Group, Transformer } from 'react-konva';
import type { DesignLayer as DesignLayerType } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useImage } from '../hooks/useImage.js';
import { useTintedImage } from '../hooks/useTintedImage.js';
import { CurvedText } from './CurvedText.js';
import type Konva from 'konva';


interface DesignLayerProps {
  layer: DesignLayerType;
  pxPerMM: number;
  isSelected: boolean;
  /** When true, Transformer is rendered externally (outside clipped group) */
  hideTransformer?: boolean;
}

// Layer coordinates (layer.x, layer.y) are PRINT-AREA-LOCAL in MM. The parent
// in ProductEditor wraps these in a Konva Group anchored at (printX, printY),
// so layer.x === 0 lands the layer at the top-left of the print area, and
// Konva drag events give us positions already relative to the Group origin.
export function DesignLayer({ layer, pxPerMM, isSelected, hideTransformer }: DesignLayerProps) {
  if (layer.type === 'image') {
    return <ImageLayerView layer={layer} pxPerMM={pxPerMM} isSelected={isSelected} hideTransformer={hideTransformer} />;
  }
  if (layer.type === 'text') {
    return <TextLayerView layer={layer} pxPerMM={pxPerMM} isSelected={isSelected} hideTransformer={hideTransformer} />;
  }
  if (layer.type === 'shape') {
    return <ShapeLayerView layer={layer} pxPerMM={pxPerMM} isSelected={isSelected} hideTransformer={hideTransformer} />;
  }
  return null;
}

// Shared transformer config
const TRANSFORMER_CONFIG = {
  rotateEnabled: true,
  rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
  rotationSnapTolerance: 8,
  anchorSize: 8,
  borderStroke: '#4A90D9',
  anchorStroke: '#4A90D9',
  anchorFill: '#fff',
  anchorCornerRadius: 2,
  rotateAnchorOffset: 25,
  rotateAnchorCursor: 'grab',
  anchorStyleFunc: (anchor: Konva.Shape) => {
    if (anchor.hasName('rotater')) {
      anchor.setAttrs({
        width: 16,
        height: 16,
        offsetX: 8,
        offsetY: 8,
        fill: '#4A90D9',
        stroke: '#fff',
        strokeWidth: 2,
        cornerRadius: 8,
      });
    }
  },
};

interface ImageLayerViewProps {
  layer: DesignLayerType & { type: 'image' };
  pxPerMM: number;
  isSelected: boolean;
  hideTransformer?: boolean;
}

function ImageLayerView({ layer, pxPerMM, isSelected, hideTransformer }: ImageLayerViewProps) {
  const [baseImage] = useImage(layer.src);
  const image = useTintedImage(baseImage ?? undefined, layer.tint, layer.tintOpacity);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { selectLayer, updateLayer } = useEditorStore();

  useEffect(() => {
    const attach = () => {
      if (isSelected && trRef.current && shapeRef.current) {
        trRef.current.nodes([shapeRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    };
    attach();
    // Retry after a frame in case the node wasn't mounted yet
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [isSelected]);

  if (!image) return null;

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;
  const w = layer.originalWidthMM * pxPerMM;
  const h = layer.originalHeightMM * pxPerMM;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.target.getStage()!.container().style.cursor = 'pointer';
    // Konva returns position relative to the parent Group, which is anchored
    // at the print area top-left, so dividing by pxPerMM gives print-area-local mm.
    updateLayer(layer.id, {
      x: e.target.x() / pxPerMM,
      y: e.target.y() / pxPerMM,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    updateLayer(layer.id, {
      x: node.x() / pxPerMM,
      y: node.y() / pxPerMM,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  };

  return (
    <>
      <Image
        ref={shapeRef}
        id={layer.id}
        name="design-element"
        image={image}
        x={x}
        y={y}
        width={w}
        height={h}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        skewX={layer.skewX ?? 0}
        skewY={layer.skewY ?? 0}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={isSelected && !layer.locked}
        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
        onDragStart={(e) => { e.target.getStage()!.container().style.cursor = 'grabbing'; }}
        onClick={() => selectLayer(layer.id)}
        onTap={() => selectLayer(layer.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && !hideTransformer && (
        <Transformer
          ref={trRef}
          keepRatio={true}
          {...TRANSFORMER_CONFIG}
        />
      )}
    </>
  );
}

interface TextLayerViewProps {
  layer: DesignLayerType & { type: 'text' };
  pxPerMM: number;
  isSelected: boolean;
  hideTransformer?: boolean;
}

function TextLayerView({ layer, pxPerMM, isSelected, hideTransformer }: TextLayerViewProps) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { selectLayer, updateLayer } = useEditorStore();

  useEffect(() => {
    const attach = () => {
      if (isSelected && trRef.current && shapeRef.current) {
        trRef.current.nodes([shapeRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    };
    attach();
    // Retry after a frame in case the node wasn't mounted yet
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [isSelected]);

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.target.getStage()!.container().style.cursor = 'pointer';
    updateLayer(layer.id, {
      x: e.target.x() / pxPerMM,
      y: e.target.y() / pxPerMM,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    // For text, bake the resize handle's scale into fontSize so the saved
    // value always reflects the real visual size in MM. The numeric font size
    // input in the toolbar then shows the truth, and the renderer doesn't
    // need to multiply scale × fontSize separately.
    const scale = (node.scaleX() + node.scaleY()) / 2;
    const newFontSize = layer.fontSize * scale;

    updateLayer(layer.id, {
      x: node.x() / pxPerMM,
      y: node.y() / pxPerMM,
      fontSize: newFontSize,
      scaleX: 1,
      scaleY: 1,
      rotation: node.rotation(),
    });

    node.scaleX(1);
    node.scaleY(1);
  };

  const handleDblClick = () => {
    const node = shapeRef.current;
    if (!node) return;

    const stage = node.getStage();
    if (!stage) return;

    const textPosition = node.getClientRect();
    const container = stage.container();
    const containerRect = container.getBoundingClientRect();

    const input = document.createElement('textarea');
    input.value = layer.text;
    input.style.position = 'absolute';
    input.style.top = `${containerRect.top + textPosition.y}px`;
    input.style.left = `${containerRect.left + textPosition.x}px`;
    input.style.width = `${Math.max(textPosition.width, 100)}px`;
    input.style.fontSize = `${layer.fontSize * pxPerMM * layer.scaleX}px`;
    input.style.fontFamily = layer.fontFamily;
    input.style.color = layer.fill;
    input.style.border = '2px solid #4A90D9';
    input.style.padding = '4px';
    input.style.background = 'rgba(255,255,255,0.95)';
    input.style.outline = 'none';
    input.style.resize = 'none';
    input.style.zIndex = '1000';

    document.body.appendChild(input);
    input.focus();
    input.select();

    const handleBlur = () => {
      updateLayer(layer.id, { text: input.value });
      document.body.removeChild(input);
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        input.blur();
      }
    });
  };

  const effect = layer.textEffect;
  const hasEffect = effect && effect.type !== 'none';

  const interactionProps = {
    draggable: isSelected && !layer.locked,
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => { e.target.getStage()!.container().style.cursor = 'pointer'; },
    onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => { e.target.getStage()!.container().style.cursor = 'default'; },
    onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => { e.target.getStage()!.container().style.cursor = 'grabbing'; },
    onClick: () => selectLayer(layer.id),
    onTap: () => selectLayer(layer.id),
    onDblClick: handleDblClick,
    onDblTap: handleDblClick,
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
  };

  // Estimate hit area for curved text group
  const hitArea = useMemo(() => {
    if (!hasEffect) return { w: 0, h: 0 };
    const estW = layer.text.length * layer.fontSize * 0.7;
    const estH = layer.fontSize * 3;
    return { w: estW, h: estH };
  }, [hasEffect, layer.text, layer.fontSize]);

  return (
    <>
      {hasEffect ? (
        <Group
          ref={shapeRef as unknown as React.RefObject<Konva.Group>}
          id={layer.id}
          name="design-element"
          x={x}
          y={y}
          scaleX={layer.scaleX}
          scaleY={layer.scaleY}
          skewX={layer.skewX ?? 0}
          skewY={layer.skewY ?? 0}
          rotation={layer.rotation}
          opacity={layer.opacity}
          {...interactionProps}
        >
          {/* Invisible hit area so the group is always clickable */}
          <KRect
            x={-hitArea.w / 2}
            y={-hitArea.h / 2}
            width={hitArea.w}
            height={hitArea.h}
            fill="transparent"
          />
          <CurvedText
            text={layer.text}
            // Scale effect parameters proportionally to fontSize so the visual
            // result is independent of the display pxPerMM. Both the editor and
            // the server renderer use 96/25.4 as the reference scale.
            effect={effect ? {
              ...effect,
              spacing: (effect.spacing ?? 0) * pxPerMM / (96 / 25.4),
              radius: (effect.radius ?? 0) * pxPerMM / (96 / 25.4),
              curve: (effect.curve ?? 0) * pxPerMM / (96 / 25.4),
              height: (effect.height ?? 0) * pxPerMM / (96 / 25.4),
              offset: (effect.offset ?? 0) * pxPerMM / (96 / 25.4),
            } : effect}
            // layer.fontSize is in MM — convert to pixels for Konva display.
            fontSize={layer.fontSize * pxPerMM}
            fontFamily={layer.fontFamily}
            fontStyle={layer.fontStyle ?? 'normal'}
            fill={layer.fill}
            letterSpacing={(layer.letterSpacing ?? 0) * pxPerMM / (96 / 25.4)}
          />
        </Group>
      ) : (
        <Text
          ref={shapeRef}
          id={layer.id}
          text={layer.text}
          x={x}
          y={y}
          // layer.fontSize is in MM — convert to pixels for Konva display.
          fontSize={layer.fontSize * pxPerMM}
          fontFamily={layer.fontFamily}
          fontStyle={layer.fontStyle ?? 'normal'}
          textDecoration={layer.textDecoration ?? ''}
          fill={layer.fill}
          align={layer.align}
          letterSpacing={(layer.letterSpacing ?? 0) * pxPerMM / (96 / 25.4)}
          lineHeight={layer.lineHeight ?? 1.2}
          scaleX={layer.scaleX}
          scaleY={layer.scaleY}
          skewX={layer.skewX ?? 0}
          skewY={layer.skewY ?? 0}
          rotation={layer.rotation}
          opacity={layer.opacity}
          {...interactionProps}
        />
      )}
      {isSelected && !hideTransformer && (
        <Transformer
          ref={trRef}
          keepRatio={false}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          {...TRANSFORMER_CONFIG}
        />
      )}
    </>
  );
}

// === Shape Layer ===
interface ShapeLayerViewProps {
  layer: DesignLayerType & { type: 'shape' };
  pxPerMM: number;
  isSelected: boolean;
  hideTransformer?: boolean;
}

function ShapeLayerView({ layer, pxPerMM, isSelected, hideTransformer }: ShapeLayerViewProps) {
  const shapeRef = useRef<Konva.Shape>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { selectLayer, updateLayer } = useEditorStore();

  useEffect(() => {
    const attach = () => {
      if (isSelected && trRef.current && shapeRef.current) {
        trRef.current.nodes([shapeRef.current]);
        trRef.current.getLayer()?.batchDraw();
      }
    };
    attach();
    // Retry after a frame in case the node wasn't mounted yet
    const raf = requestAnimationFrame(attach);
    return () => cancelAnimationFrame(raf);
  }, [isSelected]);

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;
  const w = layer.widthMM * pxPerMM;
  const h = layer.heightMM * pxPerMM;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    updateLayer(layer.id, {
      x: e.target.x() / pxPerMM,
      y: e.target.y() / pxPerMM,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
    updateLayer(layer.id, {
      x: node.x() / pxPerMM,
      y: node.y() / pxPerMM,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  };

  const commonProps = {
    id: layer.id,
    name: 'design-element',
    x, y,
    fill: layer.fill,
    stroke: layer.stroke,
    strokeWidth: layer.strokeWidth,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    rotation: layer.rotation,
    opacity: layer.opacity,
    draggable: isSelected && !layer.locked,
    onClick: () => selectLayer(layer.id),
    onTap: () => selectLayer(layer.id),
    onDragEnd: handleDragEnd,
    onTransformEnd: handleTransformEnd,
  };

  const renderShape = () => {
    switch (layer.shapeType) {
      case 'rect':
        return <KRect ref={shapeRef as unknown as React.RefObject<Konva.Rect>} width={w} height={h} {...commonProps} />;
      case 'rounded-rect':
        return <KRect ref={shapeRef as unknown as React.RefObject<Konva.Rect>} width={w} height={h} cornerRadius={w * 0.15} {...commonProps} />;
      case 'circle':
        return <Circle ref={shapeRef as unknown as React.RefObject<Konva.Circle>} radius={w / 2} {...commonProps} />;
      case 'triangle':
        return <RegularPolygon ref={shapeRef as unknown as React.RefObject<Konva.RegularPolygon>} sides={3} radius={w / 2} {...commonProps} />;
      case 'pentagon':
        return <RegularPolygon ref={shapeRef as unknown as React.RefObject<Konva.RegularPolygon>} sides={5} radius={w / 2} {...commonProps} />;
      case 'hexagon':
        return <RegularPolygon ref={shapeRef as unknown as React.RefObject<Konva.RegularPolygon>} sides={6} radius={w / 2} {...commonProps} />;
      case 'star':
        return <Star ref={shapeRef as unknown as React.RefObject<Konva.Star>} numPoints={5} innerRadius={w * 0.38} outerRadius={w / 2} {...commonProps} />;
      case 'diamond':
        return <RegularPolygon ref={shapeRef as unknown as React.RefObject<Konva.RegularPolygon>} sides={4} radius={w / 2} {...commonProps} />;
      case 'arrow':
        return <Line ref={shapeRef as unknown as React.RefObject<Konva.Line>} points={[0, 0, w, 0]} {...commonProps} hitStrokeWidth={20} pointerLength={w * 0.2} pointerWidth={w * 0.15} />;
      case 'cross': {
        const t = w * 0.3;
        const cx = w / 2;
        const cy = h / 2;
        return <Line ref={shapeRef as unknown as React.RefObject<Konva.Line>} points={[
          cx - t / 2, 0, cx + t / 2, 0,
          cx + t / 2, cy - t / 2, w, cy - t / 2,
          w, cy + t / 2, cx + t / 2, cy + t / 2,
          cx + t / 2, h, cx - t / 2, h,
          cx - t / 2, cy + t / 2, 0, cy + t / 2,
          0, cy - t / 2, cx - t / 2, cy - t / 2,
        ]} closed {...commonProps} />;
      }
      case 'line':
        return <Line ref={shapeRef as unknown as React.RefObject<Konva.Line>} points={[0, 0, w, 0]} hitStrokeWidth={20} {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <>
      {renderShape()}
      {isSelected && !hideTransformer && (
        <Transformer
          ref={trRef}
          keepRatio={false}
          {...TRANSFORMER_CONFIG}
        />
      )}
    </>
  );
}
