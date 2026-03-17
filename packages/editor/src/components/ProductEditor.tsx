import { Stage, Layer, Rect, Text } from 'react-konva';

interface ProductEditorProps {
  width?: number;
  height?: number;
}

export function ProductEditor({ width = 800, height = 600 }: ProductEditorProps) {
  return (
    <Stage width={width} height={height}>
      <Layer>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#f5f5f5"
        />
        <Text
          x={width / 2 - 100}
          y={height / 2 - 10}
          text="OpenMerch Editor"
          fontSize={20}
          fill="#999"
        />
      </Layer>
    </Stage>
  );
}
