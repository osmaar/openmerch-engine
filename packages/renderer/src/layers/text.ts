/* eslint-disable @typescript-eslint/no-explicit-any */
import { promises as fs } from 'node:fs';
import { registerFont } from 'canvas';
import type { TextLayer } from '@openmerch/core';
import { computeEffectPositions } from './text-effects.js';

// Track which font families have been registered to avoid duplicate calls.
const registeredFonts = new Set<string>();

// Maps layer.fontFamily → internal font family name as stored in the font file.
// fontconfig registers fonts by their internal name (read by FreeType from the
// font file), NOT by whatever custom name we pass to registerFont(). Using the
// internal name ensures Pango can find the font when it queries fontconfig.
const fontInternalNameMap = new Map<string, string>();

/**
 * Reads the internal CSS family name from a TTF/OTF font binary.
 *
 * Parses the OpenType name table directly — no extra dependencies needed.
 * Prefers name ID 16 (Preferred Family, used when a typeface has multiple
 * weights that should share one CSS family) over name ID 1 (Family Name).
 * Platform 3 (Windows/Unicode UTF-16BE) is preferred over platform 1 (Mac).
 */
function readFontFamilyName(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  const numTables = buf.readUInt16BE(4);

  // Scan the table directory (starts at offset 12, 16 bytes per entry).
  let nameOff = -1;
  for (let i = 0; i < numTables; i++) {
    const e = 12 + i * 16;
    if (buf.length < e + 16) break;
    if (buf.toString('ascii', e, e + 4) === 'name') {
      nameOff = buf.readUInt32BE(e + 8);
      break;
    }
  }
  if (nameOff < 0 || buf.length < nameOff + 6) return null;

  const count = buf.readUInt16BE(nameOff + 2);
  const strBase = buf.readUInt16BE(nameOff + 4);

  // Collect best match for nameID 1 (Family) and 16 (Preferred Family).
  let family: string | null = null;
  let preferred: string | null = null;

  for (let i = 0; i < count; i++) {
    const r = nameOff + 6 + i * 12;
    if (buf.length < r + 12) break;
    const platformID = buf.readUInt16BE(r);
    const nameID = buf.readUInt16BE(r + 6);
    if (nameID !== 1 && nameID !== 16) continue;

    const len = buf.readUInt16BE(r + 8);
    const off = buf.readUInt16BE(r + 10);
    const start = nameOff + strBase + off;
    if (buf.length < start + len) continue;

    let value: string;
    if (platformID === 3) {
      // Windows platform: UTF-16BE — swap bytes for Node's UTF-16LE decoder.
      const tmp = Buffer.allocUnsafe(len);
      for (let j = 0; j < len; j += 2) {
        tmp[j] = buf[start + j + 1]!;
        tmp[j + 1] = buf[start + j]!;
      }
      value = tmp.toString('utf16le').trim();
    } else {
      value = buf.toString('latin1', start, start + len).trim();
    }

    if (nameID === 16 && !preferred) preferred = value;
    else if (nameID === 1 && !family) family = value;
  }

  return preferred ?? family;
}

/**
 * Pre-registers all fonts needed by the given text layers BEFORE any Konva
 * Stage is created. node-canvas requires registerFont() to be called before
 * the canvas/stage is instantiated — calling it afterwards has no effect.
 * Call this once per render, right before `new Konva.Stage(...)`.
 */
export async function registerFontsForTextLayers(
  textLayers: TextLayer[],
  resolveFont: (family: string) => Promise<string | null>,
  resolveFontById?: (id: string) => Promise<string | null>,
): Promise<void> {
  // Deduplicate by (family, style) requested by the layer.
  const variants = new Map<string, { family: string; style: string; fontId?: string }>();
  for (const l of textLayers) {
    const style = l.fontStyle ?? 'normal';
    const key = `${l.fontFamily}::${style}`;
    if (!variants.has(key)) variants.set(key, { family: l.fontFamily, style, fontId: l.fontId });
  }

  for (const [key, { family, fontId }] of variants) {
    if (registeredFonts.has(key)) continue;

    // Prefer UUID lookup — direct, no name-matching ambiguity.
    const fontPath = (fontId && resolveFontById)
      ? await resolveFontById(fontId)
      : await resolveFont(family);
    if (!fontPath) {
      console.warn(`[renderer] no font file for "${family}" — system fallback`);
      continue;
    }

    // Read the font file's internal family name so we can register AND use
    // it by the exact name that fontconfig will store. fontconfig reads the
    // internal name via FreeType when FcConfigAppFontAddFile is called — our
    // custom name parameter is only a JS-side alias. If we then pass a
    // different name to Pango, it won't find the font in fontconfig.
    let internalFamily: string;
    try {
      const buf = await fs.readFile(fontPath);
      internalFamily = readFontFamilyName(buf) ?? family;
    } catch {
      internalFamily = family;
    }

    try {
      registerFont(fontPath, { family: internalFamily, style: 'normal' });
      registeredFonts.add(key);
      fontInternalNameMap.set(family, internalFamily);
      console.log(`[renderer] registered "${family}" → internal: "${internalFamily}" (${fontPath})`);
    } catch (err) {
      console.warn(`[renderer] could not register "${family}":`, (err as Error).message);
    }
  }
}

/**
 * Adds a text layer to a Konva node-side layer.
 *
 * Replicates the editor's TextLayerView (DesignLayer.tsx) — both the plain
 * `Konva.Text` path and the curved/bridge/wave effect path that renders one
 * `Konva.Text` per character inside a transformed Group.
 */
export function addTextLayer(
  konvaLayer: any,
  layer: TextLayer,
  fontPath: string | null,
  pxPerMM: number,
  Konva: any,
): void {
  // Use the internal family name that fontconfig knows. If the layer's
  // fontFamily wasn't pre-registered (shouldn't happen normally), fall back.
  const internalFamily = fontInternalNameMap.get(layer.fontFamily) ?? layer.fontFamily;

  // Safety: inline-register if somehow not pre-registered.
  const fontKey = `${layer.fontFamily}::${layer.fontStyle ?? 'normal'}`;
  if (fontPath && !registeredFonts.has(fontKey)) {
    // Synchronous read not possible here — best effort with family name as-is.
    // Pre-registration via registerFontsForTextLayers() should cover all cases.
    try {
      registerFont(fontPath, { family: layer.fontFamily, style: 'normal' });
      registeredFonts.add(fontKey);
      fontInternalNameMap.set(layer.fontFamily, layer.fontFamily);
      console.warn(`[renderer] inline-registered "${layer.fontFamily}" without internal name lookup — pre-register is preferred`);
    } catch (err) {
      console.warn(`[renderer] inline register failed for "${layer.fontFamily}":`, (err as Error).message);
    }
  }

  const x = layer.x * pxPerMM;
  const y = layer.y * pxPerMM;
  const fontSizePx = layer.fontSize * pxPerMM;
  const hasEffect = layer.textEffect && layer.textEffect.type !== 'none';

  const EDITOR_PX_PER_MM = 96 / 25.4;
  const spacingScale = pxPerMM / EDITOR_PX_PER_MM;

  if (!hasEffect) {
    const node = new Konva.Text({
      text: layer.text,
      x,
      y,
      fontSize: fontSizePx,
      fontFamily: internalFamily,
      fontStyle: 'normal',
      textDecoration: layer.textDecoration ?? '',
      fill: layer.fill,
      align: layer.align,
      letterSpacing: (layer.letterSpacing ?? 0) * spacingScale,
      lineHeight: layer.lineHeight ?? 1.2,
      rotation: layer.rotation,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      skewX: layer.skewX ?? 0,
      skewY: layer.skewY ?? 0,
      opacity: layer.opacity,
    });
    konvaLayer.add(node);
    return;
  }

  // Effect text — use internal names for measureCharWidths so glyph metrics
  // are accurate (same font the canvas will actually render).
  //
  // Effect parameters (spacing, radius, curve, height, offset) and letterSpacing
  // are stored as editor display pixels (96 DPI reference). fontSize is already
  // scaled to render pixels (pxPerMM * fontSizeMM). We must apply the same
  // scale to all spacing/geometry values so the render matches the mockup.
  // (EDITOR_PX_PER_MM and spacingScale declared above for plain text too.)
  const scaledEffect = layer.textEffect
    ? {
        ...layer.textEffect,
        spacing: (layer.textEffect.spacing ?? 0) * spacingScale,
        radius: (layer.textEffect.radius ?? 0) * spacingScale,
        curve: (layer.textEffect.curve ?? 0) * spacingScale,
        height: (layer.textEffect.height ?? 0) * spacingScale,
        offset: (layer.textEffect.offset ?? 0) * spacingScale,
      }
    : layer.textEffect;
  // Strip newlines — effect text positions each char along a path, so line
  // breaks have no visual meaning and would render as blank glyphs.
  const effectText = layer.text.replace(/[\r\n]+/g, ' ');
  const result = computeEffectPositions(
    effectText,
    scaledEffect,
    fontSizePx,
    internalFamily,
    'normal',
    (layer.letterSpacing ?? 0) * spacingScale,
  );
  if (!result) return;

  const group = new Konva.Group({
    x,
    y,
    rotation: layer.rotation,
    scaleX: layer.scaleX,
    scaleY: layer.scaleY,
    skewX: layer.skewX ?? 0,
    skewY: layer.skewY ?? 0,
    opacity: layer.opacity,
  });

  for (let i = 0; i < result.positions.length; i++) {
    const pos = result.positions[i]!;
    const charNode = new Konva.Text({
      text: pos.char,
      x: pos.x,
      y: pos.y,
      rotation: pos.rotation,
      fontSize: fontSizePx,
      fontFamily: internalFamily,
      fontStyle: 'normal',
      fill: layer.fill,
      offsetX: result.charWidths[i]! / 2,
      offsetY: fontSizePx / 2,
      listening: false,
    });
    group.add(charNode);
  }

  konvaLayer.add(group);
}
