import { Group, Text } from 'react-konva';
import type { TextEffect } from '@openmerch/core';

interface CurvedTextProps {
  text: string;
  effect: TextEffect;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  fill: string;
  letterSpacing: number;
}

interface CharPosition {
  char: string;
  x: number;
  y: number;
  rotation: number;
}

function measureCharWidths(text: string, fontSize: number, fontFamily: string, fontStyle: string): number[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.split('').map(() => fontSize * 0.6);
  ctx.font = `${fontStyle} ${fontSize}px ${fontFamily}`;
  return text.split('').map((ch) => ctx.measureText(ch).width);
}

// CURVED: Text follows a circular arc (like the CURVED.svg reference)
// Text sits on top of a circle, letters rotate to follow the tangent
function curvedPositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  // Radius controls the circle size, curve modifies it
  const absR = Math.max(Math.abs(radius) + curve, 50);
  const up = radius >= 0;

  const totalWidth = charWidths.reduce((sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0), 0);
  const totalAngle = totalWidth / absR;

  // Start angle: center the text on the arc
  let angle = -Math.PI / 2 - totalAngle / 2;

  const positions: CharPosition[] = [];

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    angle += (charW / 2) / absR;

    const cx = Math.cos(angle) * absR;
    const cy = Math.sin(angle) * absR;

    if (up) {
      positions.push({
        char: text[i]!,
        x: cx + xOffset,
        y: cy + absR + heightOffset,
        rotation: (angle + Math.PI / 2) * (180 / Math.PI),
      });
    } else {
      positions.push({
        char: text[i]!,
        x: -cx + xOffset,
        y: -cy - absR + heightOffset,
        rotation: -(angle + Math.PI / 2) * (180 / Math.PI),
      });
    }

    angle += (charW / 2 + extraSpacing) / absR;
  }

  // Center horizontally
  if (positions.length > 0) {
    const minX = Math.min(...positions.map((p) => p.x));
    const maxX = Math.max(...positions.map((p) => p.x));
    const midX = (minX + maxX) / 2;
    for (const pos of positions) {
      pos.x -= midX;
    }
  }

  return positions;
}

// BRIDGE: Steep parabolic arch — center very high, edges at bottom (like BRIDGE.svg)
// The reference shows a very pronounced arch where center letters are much higher
function bridgePositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  const totalWidth = charWidths.reduce((sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0), 0);
  // Arch height proportional to radius
  const archHeight = (Math.abs(radius) + curve) * 0.8;
  const up = radius >= 0;

  const positions: CharPosition[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    const centerX = currentX + charW / 2;

    // Normalized position (-1 to 1) centered at 0
    const t = totalWidth > 0 ? (centerX / totalWidth) * 2 - 1 : 0;
    // Parabola: 1 at center (t=0), 0 at edges (t=-1, t=1)
    const parabola = 1 - t * t;
    const y = up ? -archHeight * parabola : archHeight * parabola;

    // Tangent for rotation: d/dt of -(1-t²) = 2t, scaled
    const slopeRaw = up ? 2 * t * archHeight : -2 * t * archHeight;
    // Scale slope by totalWidth to get proper angle
    const slope = slopeRaw / (totalWidth / 2);
    const angleDeg = Math.atan(slope) * (180 / Math.PI);

    positions.push({
      char: text[i]!,
      x: centerX - totalWidth / 2 + xOffset,
      y: y + (up ? archHeight : 0) + heightOffset,
      rotation: angleDeg,
    });

    currentX += charW + extraSpacing;
  }

  return positions;
}

// OBLIQUE: Steep diagonal line (like Oblique.svg) — ascending from bottom-left to top-right
// Each letter is placed along the diagonal and rotated to follow the angle
function obliquePositions(
  text: string,
  charWidths: number[],
  radius: number,
  extraSpacing: number,
  curve: number,
  heightOffset: number,
  xOffset: number,
): CharPosition[] {
  const totalWidth = charWidths.reduce((sum, w, i) => sum + w + (i < charWidths.length - 1 ? extraSpacing : 0), 0);
  // Rise proportional to radius
  const rise = (Math.abs(radius) + curve) * 0.6;
  const up = radius >= 0;

  const angleDeg = Math.atan((up ? -rise : rise) / (totalWidth || 1)) * (180 / Math.PI);

  const positions: CharPosition[] = [];
  let currentX = 0;

  for (let i = 0; i < text.length; i++) {
    const charW = charWidths[i]!;
    const centerX = currentX + charW / 2;

    // Position along diagonal
    const t = totalWidth > 0 ? centerX / totalWidth : 0.5;
    const y = up ? rise * (1 - t) : rise * t;

    positions.push({
      char: text[i]!,
      x: centerX - totalWidth / 2 + xOffset,
      y: y + heightOffset,
      rotation: angleDeg,
    });

    currentX += charW + extraSpacing;
  }

  return positions;
}

export function CurvedText({ text, effect, fontSize, fontFamily, fontStyle, fill, letterSpacing }: CurvedTextProps) {
  if (!text || effect.type === 'none') return null;

  const charWidths = measureCharWidths(text, fontSize, fontFamily, fontStyle);
  const spacing = letterSpacing + effect.spacing;

  let positions: CharPosition[];

  switch (effect.type) {
    case 'curved':
      positions = curvedPositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    case 'bridge':
      positions = bridgePositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    case 'wave':
      positions = obliquePositions(text, charWidths, effect.radius, spacing, effect.curve, effect.height, effect.offset);
      break;
    default:
      return null;
  }

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
