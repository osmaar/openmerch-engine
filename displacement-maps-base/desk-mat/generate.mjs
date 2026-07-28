import sharp from 'sharp';
import { writeFileSync } from 'fs';

const WIDTH = 560, HEIGHT = 280;
const AMPLITUDE = 30;
const FREQ_X = 45, FREQ_Y = 32;
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
writeFileSync('displacement-desk-mat.png', buffer);
console.log('wrote', WIDTH + 'x' + HEIGHT);
