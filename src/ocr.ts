// ocr.ts
// Wraps Tesseract.js (WASM, runs fully in-browser/on-device — no network
// call is made once the language model is cached) and normalizes line
// bounding boxes to 0..1 so downstream mapping is resolution-independent.
//
// install: npm i tesseract.js

import Tesseract from 'tesseract.js';
import type { OcrBlock, OcrResult } from './types';

/**
 * Run OCR on an image.
 *
 * @param image  A Blob/File (e.g. a captured camera frame) or an image URL.
 * @param imageWidth  Pixel width of that image.
 * @param imageHeight Pixel height of that image.
 *
 * Tesseract reports bounding boxes in absolute pixels; we need the source
 * dimensions to normalize them the same way the extraction logic expects.
 */
export async function runOcr(
  image: Blob | string,
  imageWidth: number,
  imageHeight: number,
): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(image, 'eng');

  const blocks: OcrBlock[] = (data.lines ?? [])
    .map((line) => {
      const { x0, y0, x1, y1 } = line.bbox;
      const block: OcrBlock = {
        text: (line.text ?? '').trim(),
        rect: {
          x: x0 / imageWidth,
          y: y0 / imageHeight,
          width: (x1 - x0) / imageWidth,
          height: (y1 - y0) / imageHeight,
        },
        confidence: typeof line.confidence === 'number' ? line.confidence / 100 : undefined,
      };
      return block;
    })
    .filter((b) => b.text.length > 0);

  return {
    rawText: data.text ?? '',
    blocks,
    imageWidth,
    imageHeight,
  };
}
