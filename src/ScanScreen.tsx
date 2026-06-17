// ScanScreen.tsx
// Minimal, unstyled scan screen: capture -> review low-confidence fields ->
// confirm. Style it to taste; the logic is what matters here.
// Uses the browser's getUserMedia camera API + a canvas to grab a frame.

import React, { useEffect, useRef, useState } from 'react';
import { useInspectionScanner, needsReview } from './useInspectionScanner';
import { TIME_CHECK_SHEET, TIME_CHECK_LIMITS } from './template';
import type { InspectionRecord, FieldResult } from './types';

export default function ScanScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draft, setDraft] = useState<InspectionRecord | null>(null);

  const { busy, error, process, commit } = useInspectionScanner(
    TIME_CHECK_SHEET,
    TIME_CHECK_LIMITS,
  );

  useEffect(() => {
    if (draft) return; // camera not needed on the review screen
    let stream: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => setCameraError(e instanceof Error ? e.message : 'camera access denied'));

    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [draft]);

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) return;

    const rec = await process(blob);
    if (rec) setDraft(rec);
  };

  if (cameraError) {
    return (
      <Centered>
        <p>Camera error: {cameraError}</p>
      </Centered>
    );
  }

  // Review/confirm screen
  if (draft) {
    return (
      <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Verify reading</h2>
        {draft.fields.map((f, i) => (
          <FieldRow
            key={f.key}
            field={f}
            onChange={(value) => {
              const fields = [...draft.fields];
              fields[i] = { ...f, value, valid: value.trim().length > 0 };
              setDraft({ ...draft, fields });
            }}
          />
        ))}
        <button
          style={btn}
          onClick={async () => {
            await commit(draft);
            setDraft(null);
          }}
        >
          Save record
        </button>
        <button style={{ ...btn, backgroundColor: '#888' }} onClick={() => setDraft(null)}>
          Retake
        </button>
        {error ? <p style={{ color: '#c0392b' }}>{error}</p> : null}
      </div>
    );
  }

  // Camera screen
  return (
    <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button
        style={{ ...btn, position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)' }}
        onClick={capture}
        disabled={busy}
      >
        {busy ? 'Reading…' : 'Capture'}
      </button>
    </div>
  );
}

function FieldRow({ field, onChange }: { field: FieldResult; onChange: (v: string) => void }) {
  const flag = needsReview(field);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: flag ? '#c0392b' : '#555' }}>
        {field.key}
        {flag ? '  ⚠ check' : ''}
        {field.confidence != null ? `  (${Math.round(field.confidence * 100)}%)` : ''}
      </div>
      <input
        value={field.value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: flag ? '#c0392b' : '#ccc',
          borderRadius: 6,
          padding: 8,
        }}
      />
      {field.issue ? <div style={{ color: '#c0392b', fontSize: 11 }}>{field.issue}</div> : null}
    </div>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
    {children}
  </div>
);

const btn: React.CSSProperties = {
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  paddingTop: 12,
  paddingBottom: 12,
  paddingLeft: 20,
  paddingRight: 20,
  borderRadius: 8,
  marginTop: 8,
  display: 'block',
  width: '100%',
  cursor: 'pointer',
};
