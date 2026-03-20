import { useRef, useEffect } from 'react';
import { Image, Text, Transformer } from 'react-konva';
import type { DesignLayer as DesignLayerType } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useImage } from '../hooks/useImage.js';
import type Konva from 'konva';

interface DesignLayerProps {
  layer: DesignLayerType;
  pxPerMM: number;
  isSelected: boolean;
  printOriginXMM: number;
  printOriginYMM: number;
}

export function DesignLayer({ layer, pxPerMM, isSelected, printOriginXMM, printOriginYMM }: DesignLayerProps) {
  if (layer.type === 'image') {
    return (
      <ImageLayerView
        layer={layer}
        pxPerMM={pxPerMM}
        isSelected={isSelected}
        printOriginXMM={printOriginXMM}
        printOriginYMM={printOriginYMM}
      />
    );
  }
  if (layer.type === 'text') {
    return (
      <TextLayerView
        layer={layer}
        pxPerMM={pxPerMM}
        isSelected={isSelected}
        printOriginXMM={printOriginXMM}
        printOriginYMM={printOriginYMM}
      />
    );
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
  printOriginXMM: number;
  printOriginYMM: number;
}

function ImageLayerView({ layer, pxPerMM, isSelected, printOriginXMM, printOriginYMM }: ImageLayerViewProps) {
  const [image] = useImage(layer.src);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { selectLayer, updateLayer } = useEditorStore();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  if (!image) return null;

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;
  const w = layer.originalWidthMM * pxPerMM;
  const h = layer.originalHeightMM * pxPerMM;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.target.getStage()!.container().style.cursor = 'pointer';
    updateLayer(layer.id, {
      x: e.target.x() / pxPerMM - printOriginXMM,
      y: e.target.y() / pxPerMM - printOriginYMM,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    updateLayer(layer.id, {
      x: node.x() / pxPerMM - printOriginXMM,
      y: node.y() / pxPerMM - printOriginYMM,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  };

  return (
    <>
      <Image
        ref={shapeRef}
        image={image}
        x={x}
        y={y}
        width={w}
        height={h}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
        onDragStart={(e) => { e.target.getStage()!.container().style.cursor = 'grabbing'; }}
        onClick={() => selectLayer(layer.id)}
        onTap={() => selectLayer(layer.id)}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
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
  printOriginXMM: number;
  printOriginYMM: number;
}

function TextLayerView({ layer, pxPerMM, isSelected, printOriginXMM, printOriginYMM }: TextLayerViewProps) {
  const shapeRef = useRef<Konva.Text>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const { selectLayer, updateLayer } = useEditorStore();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.target.getStage()!.container().style.cursor = 'pointer';
    updateLayer(layer.id, {
      x: e.target.x() / pxPerMM - printOriginXMM,
      y: e.target.y() / pxPerMM - printOriginYMM,
    });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;

    updateLayer(layer.id, {
      x: node.x() / pxPerMM - printOriginXMM,
      y: node.y() / pxPerMM - printOriginYMM,
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
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
    input.style.fontSize = `${layer.fontSize * layer.scaleX}px`;
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

  return (
    <>
      <Text
        ref={shapeRef}
        text={layer.text}
        x={x}
        y={y}
        fontSize={layer.fontSize}
        fontFamily={layer.fontFamily}
        fill={layer.fill}
        align={layer.align}
        scaleX={layer.scaleX}
        scaleY={layer.scaleY}
        rotation={layer.rotation}
        opacity={layer.opacity}
        draggable={!layer.locked}
        onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = 'pointer'; }}
        onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = 'default'; }}
        onDragStart={(e) => { e.target.getStage()!.container().style.cursor = 'grabbing'; }}
        onClick={() => selectLayer(layer.id)}
        onTap={() => selectLayer(layer.id)}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      />
      {isSelected && (
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
