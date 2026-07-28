import type { Canvas as NodeCanvas, Image as NodeCanvasImage } from 'canvas';

/**
 * Minimal typed surface for the slice of Konva's API this package actually
 * calls. Konva ships full `.d.ts` typings, but they model the browser build
 * (`lib/index.d.ts`); this package dynamically imports the node-canvas build
 * (`konva/lib/index-node.js`) instead, whose runtime shape isn't
 * contractually guaranteed to line up with those browser typings. Hand
 * rolling the handful of constructors/methods we use avoids depending on
 * typings for a build we don't import, and keeps the interop surface honest
 * about what's actually exercised. Extend this file if the renderer starts
 * calling more of Konva's API.
 */

/** Whatever an Image/Canvas layer can draw — matches node-canvas's own types. */
export type KonvaImageSource = NodeCanvas | NodeCanvasImage;

export interface KonvaNodeConfig {
  x?: number;
  y?: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  skewX?: number;
  skewY?: number;
  opacity?: number;
  listening?: boolean;
}

/** Opaque handle for a constructed Konva node — this package only ever adds
 *  nodes to a container, it never reads properties back off them. */
export interface KonvaNode {
  readonly __konvaNode?: never;
}

export interface KonvaContainer extends KonvaNode {
  add(...children: KonvaNode[]): void;
}

export interface KonvaLayer extends KonvaContainer {
  draw(): void;
  /**
   * `_canvas` is Konva's private, undocumented handle to the underlying
   * node-canvas Canvas — not part of Konva's public API, but stable across
   * versions and used here only as a fallback when `Stage.toCanvas()` isn't
   * available (see getNodeCanvas in konva-node.ts).
   */
  getCanvas(): { _canvas: NodeCanvas };
}

export interface KonvaStage extends KonvaContainer {
  toCanvas?(): NodeCanvas;
  getLayers(): KonvaLayer[];
}

export interface KonvaGroupConfig extends KonvaNodeConfig {
  clipX?: number;
  clipY?: number;
  clipWidth?: number;
  clipHeight?: number;
}

export interface KonvaShapeConfig extends KonvaNodeConfig {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface KonvaRectConfig extends KonvaShapeConfig {
  width?: number;
  height?: number;
  cornerRadius?: number;
}

export interface KonvaCircleConfig extends KonvaShapeConfig {
  radius?: number;
}

export interface KonvaRegularPolygonConfig extends KonvaShapeConfig {
  sides?: number;
  radius?: number;
}

export interface KonvaStarConfig extends KonvaShapeConfig {
  numPoints?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export interface KonvaLineConfig extends KonvaShapeConfig {
  points?: number[];
  closed?: boolean;
}

export interface KonvaArrowConfig extends KonvaLineConfig {
  pointerLength?: number;
  pointerWidth?: number;
}

export interface KonvaImageConfig extends KonvaNodeConfig {
  image: KonvaImageSource;
  width?: number;
  height?: number;
}

export interface KonvaTextConfig extends KonvaNodeConfig {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
  fill?: string;
  align?: string;
  letterSpacing?: number;
  lineHeight?: number;
  offsetX?: number;
  offsetY?: number;
}

/** The subset of Konva's namespace this package constructs. */
export interface KonvaModule {
  Stage: new (config: { width: number; height: number }) => KonvaStage;
  Layer: new () => KonvaLayer;
  Group: new (config?: KonvaGroupConfig) => KonvaContainer;
  Rect: new (config: KonvaRectConfig) => KonvaNode;
  Circle: new (config: KonvaCircleConfig) => KonvaNode;
  RegularPolygon: new (config: KonvaRegularPolygonConfig) => KonvaNode;
  Star: new (config: KonvaStarConfig) => KonvaNode;
  Line: new (config: KonvaLineConfig) => KonvaNode;
  Arrow: new (config: KonvaArrowConfig) => KonvaNode;
  Image: new (config: KonvaImageConfig) => KonvaNode;
  Text: new (config: KonvaTextConfig) => KonvaNode;
}
