import sharp from 'sharp';
import { writeFileSync } from 'fs';

// Softer, bigger waves than the t-shirt/desk-mat placeholders — a stuffed
// pillow has broad, gentle puffiness rather than sharp taut-fabric wrinkles.
const WIDTH = 480, HEIGHT = 480; // square-ish, matches pillow's roughly-square zones
const AMPLITUDE = 55;
const FREQ_X = 70, FREQ_Y = 70; // low frequency = fewer, larger/gentler waves
const CENTER = 128;

const data = Buffer.alloc(WIDTH * HEIGHT * 4);
for (let y = 0; y < HEIGHT; y++) {
  for (let x = 0; x < WIDTH; x++) {
    const idx = (y * WIDTH + x) * 4;
    data[idx] = Math.round(CENTER + AMPLITUDE * Math.sin(x / FREQ_X));
    data[idx + 1] = Math.round(CENTER + AMPLITUDE * Math.sin(y / FREQ_Y));
    data[idx + 2] = CENTER;
    data[idx + 3] = 255;
  }
}
const buffer = await sharp(data, { raw: { width: WIDTH, height: HEIGHT, channels: 4 } }).png().toBuffer();
writeFileSync('displacement-pillow.png', buffer);
console.log('wrote', WIDTH + 'x' + HEIGHT);
