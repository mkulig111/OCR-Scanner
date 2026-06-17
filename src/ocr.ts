// ocr.ts
// Wraps Google ML Kit on-device text recognition and normalizes block
// coordinates to 0..1 so downstream mapping is resolution-independent.
//
// install: npm i @react-native-ml-kit/text-recognition
// ML Kit runs fully on-device. No network call is made here.

import TextRecognition from '@react-native-ml-kit/text-recognition';
import type { OcrBlock, OcrResult, NormalizedRect, PixelRect } from './types';

function normalizeRect(r: PixelRect, w: number, h: number): NormalizedRect {
  return {
    x: r.x / w,
    y: r.y / h,
    width: r.width / w,
    height: r.height / h,
  };
}

/**
 * Run OCR on an image file.
 *
 * @param imageUri  Local file URI of the captured photo (e.g. file:///...).
 * @param imageWidth  Pixel width of that image (from the camera/photo metadata).
 * @param imageHeight Pixel height of that image.
 *
 * The width/height are required because ML Kit returns absolute pixel frames;
 * we need the source dimensions to normalize them.
 */
export async function runOcr(
  imageUri: string,
  imageWidth: number,
  imageHeight: number,
): Promise<OcrResult> {
  const result = await TextRecognition.recognize(imageUri);

  const blocks: OcrBlock[] = (result.blocks ?? []).map((b) => {
    const frame = b.frame as PixelRect | undefined;
    const rect: NormalizedRect = frame
      ? normalizeRect(frame, imageWidth, imageHeight)
      : { x: 0, y: 0, width: 0, height: 0 };

    // ML Kit element-level confidence isn't always exposed; average what we can.
    const confidences: number[] = [];
    for (const line of b.lines ?? []) {
      for (const el of (line as any).elements ?? []) {
        if (typeof el.confidence === 'number') confidences.push(el.confidence);
      }
    }
    const confidence =
      confidences.length > 0
        ? confidences.reduce((a, c) => a + c, 0) / confidences.length
        : undefined;

    return { text: (b.text ?? '').trim(), rect, confidence };
  });

  return {
    rawText: result.text ?? '',
    blocks: blocks.filter((b) => b.text.length > 0),
    imageWidth,
    imageHeight,
  };
}
