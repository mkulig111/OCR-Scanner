// extract.ts
// Map OCR blocks onto template fields using two strategies:
//   1. Anchor: find the label block, take the nearest value in a direction.
//   2. Region: constrain candidates to a normalized area of the page.
// For fixed-layout sheets this is deterministic and fully auditable —
// no LLM, no network.

import type {
  OcrResult,
  OcrBlock,
  FieldTemplate,
  FieldResult,
  InspectionTemplate,
  NormalizedRect,
} from './types';
import { parseField } from './validation';

/** Accent + case insensitive compare, for matching anchor labels. */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function centerOf(r: NormalizedRect): { cx: number; cy: number } {
  return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
}

function inRegion(r: NormalizedRect, region?: NormalizedRect): boolean {
  if (!region) return true;
  const { cx, cy } = centerOf(r);
  return (
    cx >= region.x &&
    cx <= region.x + region.width &&
    cy >= region.y &&
    cy <= region.y + region.height
  );
}

/** Find the block whose text contains any of the anchor labels. */
function findAnchor(blocks: OcrBlock[], labels: string[]): OcrBlock | null {
  const wanted = labels.map(fold);
  for (const b of blocks) {
    const t = fold(b.text);
    if (wanted.some((w) => t.includes(w))) return b;
  }
  return null;
}

/**
 * Among candidate blocks, pick the one nearest to the anchor in the given
 * direction. "right" = same row, to the right; "below" = same column, beneath.
 */
function nearestInDirection(
  anchor: OcrBlock,
  candidates: OcrBlock[],
  direction: 'right' | 'below',
): OcrBlock | null {
  const a = centerOf(anchor.rect);
  let best: OcrBlock | null = null;
  let bestDist = Infinity;

  for (const c of candidates) {
    if (c === anchor) continue;
    const cc = centerOf(c.rect);

    if (direction === 'right') {
      // must be to the right, roughly same row
      if (cc.cx <= a.cx) continue;
      const rowGap = Math.abs(cc.cy - a.cy);
      if (rowGap > anchor.rect.height * 1.5) continue;
      const dist = cc.cx - a.cx + rowGap; // prefer close + aligned
      if (dist < bestDist) { bestDist = dist; best = c; }
    } else {
      // below, roughly same column
      if (cc.cy <= a.cy) continue;
      const colGap = Math.abs(cc.cx - a.cx);
      if (colGap > anchor.rect.width * 1.5) continue;
      const dist = cc.cy - a.cy + colGap;
      if (dist < bestDist) { bestDist = dist; best = c; }
    }
  }
  return best;
}

function extractOne(field: FieldTemplate, ocr: OcrResult): FieldResult {
  const inRegionBlocks = ocr.blocks.filter((b) => inRegion(b.rect, field.region));

  let source: OcrBlock | null = null;

  if (field.label) {
    const labels = Array.isArray(field.label) ? field.label : [field.label];
    const anchor = findAnchor(ocr.blocks, labels);
    if (anchor) {
      source = nearestInDirection(
        anchor,
        inRegionBlocks,
        field.direction ?? 'right',
      );
    }
  }

  // Region-only fallback: single block in the region, or the densest one.
  if (!source && field.region) {
    source = inRegionBlocks.length === 1
      ? inRegionBlocks[0]
      : inRegionBlocks.sort((a, b) => b.text.length - a.text.length)[0] ?? null;
  }

  if (!source) {
    return {
      key: field.key,
      value: null,
      rawText: null,
      confidence: null,
      valid: !field.required,
      issue: field.required ? 'field not found on sheet' : undefined,
    };
  }

  const parsed = parseField(field.type, source.text);
  return {
    key: field.key,
    value: parsed.value,
    rawText: source.text,
    confidence: source.confidence ?? null,
    valid: parsed.value != null && !parsed.issue,
    issue: parsed.issue,
  };
}

export interface ExtractionResult {
  fields: FieldResult[];
  /** True only if every required field parsed and validated. */
  ok: boolean;
}

export function extractFields(
  template: InspectionTemplate,
  ocr: OcrResult,
): ExtractionResult {
  const fields = template.fields.map((f) => extractOne(f, ocr));
  const ok = fields.every((f) => f.valid);
  return { fields, ok };
}
