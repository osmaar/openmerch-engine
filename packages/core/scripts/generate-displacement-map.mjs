// One-off generator for the "displacement maps" feature's procedural
// placeholder test asset (Etapa A). Produces a low-frequency sine/cosine
// wave pattern as a two-channel (R=horizontal, G=vertical) displacement map
// PNG in the classic Photoshop "Displace" filter format — NOT Perlin noise,
// just enough visible waviness to exercise/validate the displacement pipeline
// end to end before a real fabric-scan-based map is designed in Photoshop.
//
// Run from packages/api (the only workspace with `sharp` installed):
//   node ../core/scripts/generate-displacement-map.mjs
//
// Sized to roughly match the aspect ratio of the classic-tshirt "front" print
// area (200mm x 280mm, see packages/api/seeds/products/catalog.json) scaled
// up 2x, with frequencies tuned to show ~2.5 visible waves across each axis.
import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 400;
const HEIGHT = 560;
const AMPLITUDE = 40;
const FREQ_X = 25;
const FREQ_Y = 36;
const CENTER = 128;

const data = Buffer.alloc(WIDTH * HEIGHT * 4);

for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const idx = (y * WIDTH + x) * 4;
    const r = CENTER + AMPLITUDE * Math.sin(x / FREQ_X);
    const g = CENTER + AMPLITUDE * Math.sin(y / FREQ_Y);
    data[idx] = Math.round(r);
    data[idx + 1] = Math.round(g);
    data[idx + 2] = CENTER; // unused
    data[idx + 3] = 255;
  }
}

const outPath = join(__dirname, 'displacement-front.png');

const image = sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } });
const buffer = await image.png().toBuffer();
writeFileSync(outPath, buffer);

console.log(`Wrote ${outPath} (${WIDTH}x${HEIGHT}, amplitude=${AMPLITUDE}, freqX=${FREQ_X}, freqY=${FREQ_Y})`);
