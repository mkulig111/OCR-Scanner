// validation.ts
// Parse + validate raw OCR strings into clean typed values.
// Each parser returns { value, issue }: value is the cleaned string (or null),
// issue is a reason when parsing/validation failed.

import type { FieldType } from './types';

export interface ParseOutcome {
  value: string | null;
  issue?: string;
}

/** Strip common OCR noise around a candidate value. */
function clean(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * OCR frequently confuses these on dot-matrix / handwritten sheets.
 * Applied only inside numeric/time/date parsers, never to free text.
 */
function fixDigitConfusions(s: string): string {
  return s
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
}

function parseTime(raw: string): ParseOutcome {
  const s = fixDigitConfusions(clean(raw));
  // Accept 8:42, 08:42, 08.42, 0842
  const m = s.match(/\b(\d{1,2})[:.\s]?(\d{2})\b/);
  if (!m) return { value: null, issue: 'no HH:MM pattern found' };
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh > 23) return { value: null, issue: `hour out of range: ${hh}` };
  if (mm > 59) return { value: null, issue: `minute out of range: ${mm}` };
  return { value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

function parseDate(raw: string): ParseOutcome {
  const s = fixDigitConfusions(clean(raw));
  // Accept dd-mm-yyyy, dd.mm.yyyy, dd/mm/yyyy, yyyy-mm-dd
  let m = s.match(/\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/);
  if (m) {
    const [, y, mo, d] = m;
    return normDate(+y, +mo, +d);
  }
  m = s.match(/\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + +y : +y;
    return normDate(year, +mo, +d);
  }
  return { value: null, issue: 'no date pattern found' };
}

function normDate(y: number, mo: number, d: number): ParseOutcome {
  if (mo < 1 || mo > 12) return { value: null, issue: `month out of range: ${mo}` };
  if (d < 1 || d > 31) return { value: null, issue: `day out of range: ${d}` };
  return {
    value: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  };
}

function parseNumber(raw: string): ParseOutcome {
  let s = fixDigitConfusions(clean(raw));
  // Normalize decimal comma -> dot, keep sign.
  s = s.replace(',', '.');
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return { value: null, issue: 'no numeric value found' };
  return { value: m[0] };
}

function parseText(raw: string): ParseOutcome {
  const v = clean(raw);
  return v.length > 0 ? { value: v } : { value: null, issue: 'empty' };
}

export function parseField(type: FieldType, raw: string): ParseOutcome {
  switch (type) {
    case 'time':   return parseTime(raw);
    case 'date':   return parseDate(raw);
    case 'number': return parseNumber(raw);
    case 'text':   return parseText(raw);
  }
}

/**
 * Optional cross-field / range checks. Extend per inspection type, e.g.
 * measured value within spec limits. Returns null if all good.
 */
export function rangeCheck(
  key: string,
  value: string,
  limits?: { min?: number; max?: number },
): string | null {
  if (!limits) return null;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return null;
  if (limits.min != null && n < limits.min) return `${key} below min (${limits.min})`;
  if (limits.max != null && n > limits.max) return `${key} above max (${limits.max})`;
  return null;
}
