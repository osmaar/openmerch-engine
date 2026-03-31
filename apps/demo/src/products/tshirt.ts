import type { Product } from '@openmerch/core';

/**
 * T-shirt product configuration.
 *
 * How the coordinate system works:
 * - baseImageWidthMM / baseImageHeightMM: the real-world dimensions that the
 *   entire mockup image represents (edge to edge, including margins).
 * - printAreaXMM / printAreaYMM: offset from the top-left corner of the image
 *   to the top-left corner of the printable zone, in mm.
 * - printAreaWidthMM / printAreaHeightMM: the real printable area size in mm.
 *   These are the dimensions used for production file generation (e.g. at 300 DPI).
 *
 * On screen the print zone is a visual guide (dashed rectangle).
 * In production, the mm values determine the actual output file size.
 *
 * To calibrate: adjust printAreaXMM/YMM until the dashed rectangle
 * visually aligns with the printable area on the mockup image.
 */
export const tshirtProduct: Product = {
  id: 'tshirt-basic',
  name: 'Basic T-Shirt',
  slug: 'basic-tshirt',
  zones: [
    {
      id: 'front',
      name: 'Front',
      // Full image maps to these real-world dimensions (mm) — square image
      baseImageWidthMM: 500,
      baseImageHeightMM: 500,
      // Printable zone: real production size (mm) — standard 20x30cm
      printAreaWidthMM: 200,
      printAreaHeightMM: 300,
      // Printable zone: position relative to image top-left (mm)
      // Adjust these to align the dashed rectangle with the mockup
      printAreaXMM: 150,
      printAreaYMM: 105,
      baseImageUrl: '/products/tshirt/basic_tshirt_front.png',
    },
    {
      id: 'back',
      name: 'Back',
      baseImageWidthMM: 500,
      baseImageHeightMM: 500,
      printAreaWidthMM: 200,
      printAreaHeightMM: 300,
      printAreaXMM: 150,
      printAreaYMM: 90,
      baseImageUrl: '/products/tshirt/basic_tshirt_back.png',
    },
  ],
};
