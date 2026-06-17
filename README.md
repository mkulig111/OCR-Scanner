# Offline Inspection-OCR pipeline (React Native)

Local-first OCR for quality-inspection sheets. Everything except sync runs
on-device, offline. The network is touched only to push parsed records.

```
Phone (offline):
  camera ─▶ ML Kit OCR ─▶ field extraction ─▶ validation ─▶ SQLite (local)
                                                                │
Online (when available):                                        ▼
                                          sync.ts ── POST parsed JSON ──▶ server
```

## Files

| File | Role |
|------|------|
| `types.ts` | Shared types (template, OCR result, record). |
| `ocr.ts` | ML Kit wrapper; normalizes block coords to 0..1. **On-device.** |
| `extract.ts` | Maps OCR blocks → fields via anchor labels + regions. **On-device, no LLM.** |
| `validation.ts` | Parses/validates time, date, number, text; digit-confusion fixes. |
| `template.ts` | Example sheet definition (EN/PL/KR anchors) + spec limits. |
| `storage.ts` | Local SQLite store (expo-sqlite). Offline. |
| `sync.ts` | The only networked part. Pushes unsynced records when online. |
| `useInspectionScanner.ts` | Orchestration hook (capture → save). |
| `ScanScreen.tsx` | Minimal camera UI with a verify/confirm step. |

## Install

```bash
npm i @react-native-ml-kit/text-recognition
npx expo install react-native-vision-camera expo-sqlite @react-native-community/netinfo
```

(Not on Expo? Swap `expo-sqlite` for `op-sqlite` — only the three `db.*` calls
in `storage.ts` change. Camera permissions: follow the vision-camera setup.)

## Use

```ts
import { startAutoSync } from './sync';

// On app start: flush pending records whenever connectivity returns.
const stop = startAutoSync({
  endpoint: 'https://api.yourserver.com/inspections',
  headers: { Authorization: `Bearer ${token}` },
});
// call stop() on unmount
```

Drop `<ScanScreen />` into a route. It captures a photo, runs OCR, shows the
parsed fields for verification (low-confidence fields are flagged red), and
saves locally on confirm. Sync happens in the background.

## Why this design

- **Anchor + region extraction, not raw text.** For a fixed-layout sheet this
  is deterministic and auditable — important under IATF/audit. No LLM needed,
  so it works fully offline and you can explain exactly how every value was
  derived.
- **Verify-before-save.** Handwriting is the weak spot for on-device OCR, so
  the operator confirms flagged fields. Each field keeps its OCR confidence and
  raw source text for traceability.
- **Sync is isolated.** All parsing is offline; only the small JSON record
  needs a connection. Records queue in SQLite and flush on reconnect.

## Adapting to your form

1. Photograph a blank sheet, note where each label/value sits.
2. Edit `template.ts`: set `label` anchors (multilingual ok), `direction`
   (`right`/`below`), and a `region` (fractions of the page) for any cell that's
   ambiguous or label-less.
3. Set `*_LIMITS` for spec tolerances you want range-checked.

## Notes / limits

- ML Kit on-device base model covers Latin script (Polish diacritics included),
  plus CJK variants you enable. Handwriting accuracy is lower than print — keep
  the verify step.
- Tune `REVIEW_CONFIDENCE` in `useInspectionScanner.ts` to control how often the
  operator is prompted to check a field.
- For very free-form sheets, you can add an optional on-device Gemini Nano pass
  (ML Kit Prompt API) — but for fixed layouts the deterministic mapping above is
  faster and audit-friendlier.
