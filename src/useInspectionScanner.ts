// useInspectionScanner.ts
// Orchestrates the full offline pipeline:
//   photo -> OCR -> field extraction -> validation -> local IndexedDB save.
// Returns the parsed record so the UI can show a confirm screen BEFORE saving
// (recommended for handwriting, where the operator should verify low-confidence
// fields).

import { useCallback, useState } from 'react';
import { runOcr } from './ocr';
import { extractFields } from './extract';
import { rangeCheck } from './validation';
import { saveRecord } from './storage';
import type {
  InspectionTemplate,
  InspectionRecord,
  FieldResult,
} from './types';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Resolve the pixel dimensions of an image blob via a throwaway <img>. */
function getImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('failed to read image dimensions'));
    };
    img.src = url;
  });
}

/** Flag fields the operator should eyeball: low confidence or failed validation. */
const REVIEW_CONFIDENCE = 0.7;

export function needsReview(f: FieldResult): boolean {
  if (!f.valid) return true;
  if (f.confidence != null && f.confidence < REVIEW_CONFIDENCE) return true;
  return false;
}

interface ScanState {
  busy: boolean;
  record: InspectionRecord | null;
  error: string | null;
}

export function useInspectionScanner(
  template: InspectionTemplate,
  limits?: Record<string, { min?: number; max?: number }>,
) {
  const [state, setState] = useState<ScanState>({
    busy: false,
    record: null,
    error: null,
  });

  /** Process a captured photo into a draft record (NOT yet saved). */
  const process = useCallback(
    async (imageBlob: Blob) => {
      setState((s) => ({ ...s, busy: true, error: null }));
      try {
        const { width, height } = await getImageSize(imageBlob);
        const ocr = await runOcr(imageBlob, width, height);
        const { fields } = extractFields(template, ocr);

        // Apply optional spec-range checks on top of type validation.
        const checked = fields.map((f) => {
          if (f.valid && f.value && limits?.[f.key]) {
            const issue = rangeCheck(f.key, f.value, limits[f.key]);
            if (issue) return { ...f, valid: false, issue };
          }
          return f;
        });

        const record: InspectionRecord = {
          id: uuid(),
          templateId: template.id,
          capturedAt: new Date().toISOString(),
          fields: checked,
          rawText: ocr.rawText,
          imageUri: URL.createObjectURL(imageBlob),
          synced: false,
        };
        setState({ busy: false, record, error: null });
        return record;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'OCR failed';
        setState({ busy: false, record: null, error: msg });
        return null;
      }
    },
    [template, limits],
  );

  /** Persist a (possibly operator-corrected) record locally. */
  const commit = useCallback(async (record: InspectionRecord) => {
    await saveRecord(record);
    setState((s) => ({ ...s, record: null }));
  }, []);

  return { ...state, process, commit, needsReview };
}
