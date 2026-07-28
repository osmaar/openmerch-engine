import { Group, Text } from 'react-konva';
import { computeEffectPositions, type TextEffect } from '@openmerch/core';

interface CurvedTextProps {
  text: string;
  effect: TextEffect;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  letterSpacing: number;
}

// The curved/bridge/wave placement math lives in @openmerch/core
// (computeEffectPositions) so the editor and the server renderer
// (packages/renderer/src/layers/text-effects.ts) share the exact same
// algorithm. Only glyph-width measurement stays here — it needs the browser
// canvas API, which differs from the renderer's node-canvas.
function measureCharWidths(text: string, fontSize: number, fontFamily: string, fontStyle: string): number[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.split('').map(() => fontSize * 0.6);
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  return text.split('').map((ch) => ctx.measureText(ch).width);
}

export function CurvedText({ text: rawText, effect, fontSize, fontFamily, fontStyle, fill, letterSpacing }: CurvedTextProps) {
  // Strip newlines — effect text positions each char along a path.
  const text = rawText.replace(/[\r\n]+/g, ' ');
  if (!text || effect.type === 'none') return null;

  const charWidths = measureCharWidths(text, fontSize, fontFamily, fontStyle);
  const positions = computeEffectPositions(text, effect, charWidths, letterSpacing);
  if (!positions) return null;

  return (
    <Group>
      {positions.map((pos, i) => (
        <Text
          key={i}
          text={pos.char}
          x={pos.x}
          y={pos.y}
          rotation={pos.rotation}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fontStyle={fontStyle}
          fill={fill}
          offsetX={charWidths[i]! / 2}
          offsetY={fontSize / 2}
          listening={false}
        />
      ))}
    </Group>
  );
}
