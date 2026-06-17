# Offline Inspection-OCR pipeline (Web)

Local-first OCR for quality-inspection sheets, running entirely in the
browser. The network is touched only to push parsed records.

```
Browser (offline):
  camera (getUserMedia) ─▶ Tesseract.js OCR ─▶ field extraction ─▶ validation ─▶ IndexedDB (local)
                                                                                      │
Online (when available):                                                            ▼
                                                       sync.ts ── POST parsed JSON ──▶ server
```

## Files

| File | Role |
|------|------|
| `types.ts` | Shared types (template, OCR result, record). |
| `ocr.ts` | Tesseract.js wrapper; normalizes line coords to 0..1. **Runs in-browser, WASM.** |
| `extract.ts` | Maps OCR blocks → fields via anchor labels + regions. **No LLM, no network.** |
| `validation.ts` | Parses/validates time, date, number, text; digit-confusion fixes. |
| `template.ts` | Example sheet definition (EN/PL/KR anchors) + spec limits. |
| `storage.ts` | Local IndexedDB store. Offline. |
| `sync.ts` | The only networked part. Pushes unsynced records when online. |
| `useInspectionScanner.ts` | Orchestration hook (capture → save). |
| `ScanScreen.tsx` | Minimal camera UI (getUserMedia) with a verify/confirm step. |

## Run

```bash
npm install
npm run dev
```

Opens a Vite dev server. Allow camera access when prompted (requires HTTPS
or `localhost` — browser security requirement for `getUserMedia`). The first
capture downloads the Tesseract `eng` language model (cached afterwards for
fully offline use).

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

## Use

```ts
import { startAutoSync } from './sync';

// On app start: flush pending records whenever connectivity returns.
const stop = startAutoSync({
  endpoint: 'https://api.yourserver.com/inspections',
  headers: { Authorization: `Bearer ${token}` },
});
// call stop() to unsubscribe
```

`ScanScreen` captures a photo, runs OCR, shows the parsed fields for
verification (low-confidence fields are flagged red), and saves locally on
confirm. Sync happens in the background.

## Why this design

- **Anchor + region extraction, not raw text.** For a fixed-layout sheet this
  is deterministic and auditable — important under IATF/audit. No LLM needed,
  so it works fully offline and you can explain exactly how every value was
  derived.
- **Verify-before-save.** Handwriting is the weak spot for OCR, so the
  operator confirms flagged fields. Each field keeps its OCR confidence and
  raw source text for traceability.
- **Sync is isolated.** All parsing is offline; only the small JSON record
  needs a connection. Records queue in IndexedDB and flush on reconnect.

## Adapting to your form

1. Photograph a blank sheet, note where each label/value sits.
2. Edit `template.ts`: set `label` anchors (multilingual ok), `direction`
   (`right`/`below`), and a `region` (fractions of the page) for any cell that's
   ambiguous or label-less.
3. Set `*_LIMITS` for spec tolerances you want range-checked.

## Notes / limits

- Tesseract.js groups text by line; if a label and its value sit on the same
  printed line with no separating cell, the anchor/direction match may not
  split them cleanly — keep labels and values in visually distinct
  cells/columns for best results, or constrain with a `region`.
- Tesseract's `eng` model covers Latin script; for Polish diacritics or other
  scripts, load the matching traineddata (`Tesseract.recognize(image, 'eng+pol')`)
  — note each additional language increases the model download size.
  Handwriting accuracy is lower than print — keep the verify step.
- Tune `REVIEW_CONFIDENCE` in `useInspectionScanner.ts` to control how often the
  operator is prompted to check a field.
- `getUserMedia` requires a secure context (HTTPS or `localhost`).
