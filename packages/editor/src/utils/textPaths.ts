import type { TextEffect } from '@openmerch/core';

export function generateTextPath(
  effect: TextEffect,
  textWidth: number,
): string | null {
  if (effect.type === 'none') return null;

  const w = Math.max(textWidth, 80);
  const r = effect.radius;

  switch (effect.type) {
    case 'curved':
      return curvedPath(w, r);
    case 'bridge':
      return bridgePath(w, r);
    case 'wave':
      return obliquePath(w, r);
    default:
      return null;
  }
}

// CURVED: Circular arc — text follows a large arc from left to right
// Positive radius = arc bends upward (text curves up like a smile)
// Negative radius = arc bends downward (text curves down like a frown)
// Based on Lumise reference: wide, gentle arc
function curvedPath(width: number, radius: number): string {
  // The arc radius must be at least half the width to form a valid arc
  const absR = Math.max(Math.abs(radius), width * 0.4);

  // Calculate the sagitta (height of the arc) to position text properly
  const halfW = width / 2;
  const sagitta = absR - Math.sqrt(Math.max(0, absR * absR - halfW * halfW));

  if (radius >= 0) {
    // Arc upward: start and end are at the bottom, peak is at the top
    return `M 0,${sagitta} A ${absR},${absR} 0 0,1 ${width},${sagitta}`;
  } else {
    // Arc downward: start and end are at the top, dip is at the bottom
    return `M 0,0 A ${absR},${absR} 0 0,0 ${width},0`;
  }
}

// BRIDGE: Parabolic arch — center is high, edges are low
// Based on Lumise reference: smooth quadratic bezier forming a bridge/arch
function bridgePath(width: number, radius: number): string {
  const height = Math.abs(radius) * 0.6;
  const mid = width / 2;

  if (radius >= 0) {
    // Bridge up: center rises
    return `M 0,${height} Q ${mid},${-height * 0.2} ${width},${height}`;
  } else {
    // Bridge down: center dips
    return `M 0,0 Q ${mid},${height * 1.2} ${width},0`;
  }
}

// OBLIQUE: Diagonal ascending line with optional gentle curve
// Based on Lumise reference: text goes from bottom-left to top-right at an angle
function obliquePath(width: number, radius: number): string {
  // The "radius" here controls how steep the diagonal is
  const rise = Math.abs(radius) * 0.5;

  if (radius >= 0) {
    // Ascending: bottom-left to top-right
    return `M 0,${rise} L ${width},0`;
  } else {
    // Descending: top-left to bottom-right
    return `M 0,0 L ${width},${rise}`;
  }
}
