// ScanScreen.tsx
// Minimal, unstyled scan screen: capture -> review low-confidence fields ->
// confirm. Style it to taste; the logic is what matters here.
//
// install: npx expo install react-native-vision-camera
// (and configure camera permissions per the vision-camera docs)

import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { useInspectionScanner, needsReview } from './useInspectionScanner';
import { TIME_CHECK_SHEET, TIME_CHECK_LIMITS } from './template';
import type { InspectionRecord, FieldResult } from './types';

export default function ScanScreen() {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const camera = useRef<Camera>(null);
  const [draft, setDraft] = useState<InspectionRecord | null>(null);

  const { busy, process, commit } = useInspectionScanner(
    TIME_CHECK_SHEET,
    TIME_CHECK_LIMITS,
  );

  if (!hasPermission) {
    return (
      <Centered>
        <Pressable onPress={requestPermission}>
          <Text>Grant camera access</Text>
        </Pressable>
      </Centered>
    );
  }
  if (!device) return <Centered><Text>No camera device</Text></Centered>;

  const capture = async () => {
    const photo = await camera.current?.takePhoto();
    if (!photo) return;
    const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
    const rec = await process(uri, photo.width, photo.height);
    if (rec) setDraft(rec);
  };

  // Review/confirm screen
  if (draft) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12 }}>
          Verify reading
        </Text>
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
        <Pressable
          style={btn}
          onPress={async () => { await commit(draft); setDraft(null); }}
        >
          <Text style={{ color: 'white' }}>Save record</Text>
        </Pressable>
        <Pressable style={[btn, { backgroundColor: '#888' }]} onPress={() => setDraft(null)}>
          <Text style={{ color: 'white' }}>Retake</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Camera screen
  return (
    <View style={{ flex: 1 }}>
      <Camera ref={camera} style={{ flex: 1 }} device={device} isActive photo />
      <Pressable style={[btn, { position: 'absolute', bottom: 40, alignSelf: 'center' }]}
                 onPress={capture} disabled={busy}>
        <Text style={{ color: 'white' }}>{busy ? 'Reading…' : 'Capture'}</Text>
      </Pressable>
    </View>
  );
}

function FieldRow({ field, onChange }:
  { field: FieldResult; onChange: (v: string) => void }) {
  const flag = needsReview(field);
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, color: flag ? '#c0392b' : '#555' }}>
        {field.key}{flag ? '  ⚠ check' : ''}
        {field.confidence != null ? `  (${Math.round(field.confidence * 100)}%)` : ''}
      </Text>
      <TextInput
        value={field.value ?? ''}
        onChangeText={onChange}
        style={{
          borderWidth: 1,
          borderColor: flag ? '#c0392b' : '#ccc',
          borderRadius: 6,
          padding: 8,
        }}
      />
      {field.issue ? <Text style={{ color: '#c0392b', fontSize: 11 }}>{field.issue}</Text> : null}
    </View>
  );
}

const Centered = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
);

const btn = {
  backgroundColor: '#2563eb',
  paddingVertical: 12,
  paddingHorizontal: 20,
  borderRadius: 8,
  alignItems: 'center' as const,
  marginTop: 8,
};
