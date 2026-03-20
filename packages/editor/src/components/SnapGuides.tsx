import { Line } from 'react-konva';

interface SnapGuidesProps {
  guides: { orientation: 'horizontal' | 'vertical'; position: number }[];
  printX: number;
  printY: number;
  printW: number;
  printH: number;
}

export function SnapGuides({ guides, printX, printY, printW, printH }: SnapGuidesProps) {
  return (
    <>
      {guides.map((guide, i) => {
        if (guide.orientation === 'vertical') {
          return (
            <Line
              key={`v-${i}`}
              points={[guide.position, printY, guide.position, printY + printH]}
              stroke="#FF4081"
              strokeWidth={1}
              dash={[4, 4]}
              listening={false}
            />
          );
        }
        return (
          <Line
            key={`h-${i}`}
            points={[printX, guide.position, printX + printW, guide.position]}
            stroke="#FF4081"
            strokeWidth={1}
            dash={[4, 4]}
            listening={false}
          />
        );
      })}
    </>
  );
}

const SNAP_THRESHOLD_PX = 6;

export interface SnapGuide {
  orientation: 'horizontal' | 'vertical';
  position: number;
}

// Calculate snap guides for the dragging element relative to the print zone center
export function calculateSnapGuides(
  nodeRect: { x: number; y: number; width: number; height: number },
  printX: number,
  printY: number,
  printW: number,
  printH: number,
): { guides: SnapGuide[]; snapX: number | null; snapY: number | null } {
  const guides: SnapGuide[] = [];
  let snapX: number | null = null;
  let snapY: number | null = null;

  const nodeCenterX = nodeRect.x + nodeRect.width / 2;
  const nodeCenterY = nodeRect.y + nodeRect.height / 2;
  const printCenterX = printX + printW / 2;
  const printCenterY = printY + printH / 2;

  // Snap to horizontal center
  if (Math.abs(nodeCenterX - printCenterX) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'vertical', position: printCenterX });
    snapX = printCenterX - nodeRect.width / 2;
  }

  // Snap to vertical center
  if (Math.abs(nodeCenterY - printCenterY) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'horizontal', position: printCenterY });
    snapY = printCenterY - nodeRect.height / 2;
  }

  // Snap to left edge
  if (Math.abs(nodeRect.x - printX) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'vertical', position: printX });
    snapX = printX;
  }

  // Snap to right edge
  if (Math.abs(nodeRect.x + nodeRect.width - (printX + printW)) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'vertical', position: printX + printW });
    snapX = printX + printW - nodeRect.width;
  }

  // Snap to top edge
  if (Math.abs(nodeRect.y - printY) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'horizontal', position: printY });
    snapY = printY;
  }

  // Snap to bottom edge
  if (Math.abs(nodeRect.y + nodeRect.height - (printY + printH)) < SNAP_THRESHOLD_PX) {
    guides.push({ orientation: 'horizontal', position: printY + printH });
    snapY = printY + printH - nodeRect.height;
  }

  return { guides, snapX, snapY };
}
