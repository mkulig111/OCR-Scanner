// types.ts
// Shared types for the offline inspection-OCR pipeline.

/** A rectangle in pixel coordinates as returned by ML Kit. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A rectangle expressed as fractions (0..1) of the source image. */
export interface NormalizedRect {
  x: number;      // left edge,   0 = left of image,  1 = right
  y: number;      // top edge,    0 = top of image,   1 = bottom
  width: number;  // 0..1
  height: number; // 0..1
}

/** One recognized text block, with its position normalized to the image. */
export interface OcrBlock {
  text: string;
  rect: NormalizedRect;
  /** Mean confidence of the block's elements, 0..1. Undefined if unavailable. */
  confidence?: number;
}

/** Full OCR result after normalization. */
export interface OcrResult {
  rawText: string;
  blocks: OcrBlock[];
  imageWidth: number;
  imageHeight: number;
}

export type FieldType = 'time' | 'date' | 'number' | 'text';

/** Where the value sits relative to an anchor label on the form. */
export type AnchorDirection = 'right' | 'below';

/**
 * Definition of one field to pull off the sheet.
 *
 * Two location strategies, used together:
 *  - `label` + `direction`: find the anchor text, take the nearest value block
 *    in that direction. Robust to small layout shifts (preferred for forms).
 *  - `region`: constrain the search to a normalized area of the page.
 *    Use alone for label-less fixed cells, or to disambiguate repeated labels.
 */
export interface FieldTemplate {
  key: string;
  type: FieldType;
  /** Anchor text(s). First match wins. Case-insensitive, accent-insensitive. */
  label?: string | string[];
  direction?: AnchorDirection;
  /** Optional region constraint (fractions of the page). */
  region?: NormalizedRect;
  /** True if the field must be present for the record to be valid. */
  required?: boolean;
}

export interface InspectionTemplate {
  id: string;
  name: string;
  fields: FieldTemplate[];
}

export interface FieldResult {
  key: string;
  /** Cleaned, parsed string value (e.g. "08:42", "12.55"). Null if not found. */
  value: string | null;
  /** The raw OCR text the value came from, for audit. */
  rawText: string | null;
  /** OCR confidence for the source block, 0..1. */
  confidence: number | null;
  /** Validation outcome for this field. */
  valid: boolean;
  /** Human-readable reason when invalid. */
  issue?: string;
}

export interface InspectionRecord {
  id: string;            // local uuid
  templateId: string;
  capturedAt: string;    // ISO timestamp
  fields: FieldResult[];
  rawText: string;       // full OCR dump, kept for traceability/audit
  imageUri?: string;     // local path to the captured photo (optional)
  synced: boolean;
}
