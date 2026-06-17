// template.ts
// Example: a quality-check sheet with time stamps and a measured value.
// Tune the `region` rectangles to your actual form layout — they are
// fractions of the page (0..1). Anchors handle small print shifts; regions
// disambiguate repeated labels or pin label-less cells.

import type { InspectionTemplate } from './types';

export const TIME_CHECK_SHEET: InspectionTemplate = {
  id: 'time-check-v1',
  name: 'Hourly Quality Time Check',
  fields: [
    {
      key: 'check_time',
      type: 'time',
      label: ['Time', 'Czas', 'Godz', '시간'], // EN / PL / KR anchors
      direction: 'right',
      required: true,
    },
    {
      key: 'date',
      type: 'date',
      label: ['Date', 'Data', '날짜'],
      direction: 'right',
      required: true,
    },
    {
      key: 'operator',
      type: 'text',
      label: ['Operator', 'Operator', '작업자'],
      direction: 'right',
      required: true,
    },
    {
      key: 'part_no',
      type: 'text',
      label: ['Part', 'Part No', 'Nr części', '품번'],
      direction: 'right',
    },
    {
      key: 'measured_value',
      type: 'number',
      label: ['Value', 'Wartość', 'Measured', '측정값'],
      direction: 'right',
      // constrain to the lower-right quadrant where the measurement cell sits
      region: { x: 0.4, y: 0.45, width: 0.6, height: 0.5 },
      required: true,
    },
    {
      key: 'result',
      type: 'text',
      label: ['Result', 'OK/NG', 'Wynik', '판정'],
      direction: 'right',
    },
  ],
};

// Optional spec limits, consumed by rangeCheck() during orchestration.
export const TIME_CHECK_LIMITS: Record<string, { min?: number; max?: number }> = {
  measured_value: { min: 12.4, max: 12.7 }, // example tolerance band
};
