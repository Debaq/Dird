import { describe, it, expect } from 'vitest';
import { postprocessDetections } from './onnx-manager';
import type { ModelMetadata } from './model-metadata';

const metadata: ModelMetadata = {
  model_info: {
    version: '1.0.0',
    type: 'detection',
    date_trained: '2025',
    input_size: [640, 640],
  },
  classes: ['microaneurysm', 'hemorrhage'],
  confidence_threshold: 0.5,
} as any;

/**
 * Arma un tensor YOLO no transpuesto [1, 4+numClasses, numDets].
 * Layout: [cx..., cy..., w..., h..., score_cls0..., score_cls1...]
 */
function buildTensor(
  detections: Array<{ cx: number; cy: number; w: number; h: number; scores: number[] }>,
  numClasses: number
) {
  const numDets = detections.length;
  const rows = 4 + numClasses;
  const data = new Float32Array(rows * numDets);
  detections.forEach((d, i) => {
    data[0 * numDets + i] = d.cx;
    data[1 * numDets + i] = d.cy;
    data[2 * numDets + i] = d.w;
    data[3 * numDets + i] = d.h;
    for (let c = 0; c < numClasses; c++) {
      data[(4 + c) * numDets + i] = d.scores[c];
    }
  });
  return { data, dims: [1, rows, numDets] } as any;
}

describe('postprocessDetections', () => {
  it('filtra detecciones bajo el umbral de confianza', () => {
    const tensor = buildTensor(
      [
        { cx: 320, cy: 320, w: 100, h: 100, scores: [0.9, 0.1] },
        { cx: 100, cy: 100, w: 50, h: 50, scores: [0.3, 0.2] },
      ],
      2
    );
    const result = postprocessDetections(tensor, metadata, 640, 640, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeCloseTo(0.9);
    expect(result[0].class).toBe('microaneurysm');
  });

  it('convierte centro→esquina y escala a imagen original', () => {
    const tensor = buildTensor(
      [{ cx: 320, cy: 320, w: 100, h: 100, scores: [0.9, 0.0] }],
      2
    );
    const result = postprocessDetections(tensor, metadata, 1280, 1280, 0.5);
    expect(result).toHaveLength(1);
    const b = result[0].bbox;
    // centro (320,320) en modelo 640x640 → esquina (270,270) → scale ×2
    expect(b.x).toBeCloseTo(540);
    expect(b.y).toBeCloseTo(540);
    expect(b.width).toBeCloseTo(200);
    expect(b.height).toBeCloseTo(200);
  });

  it('elige la clase con mayor score', () => {
    const tensor = buildTensor(
      [{ cx: 100, cy: 100, w: 20, h: 20, scores: [0.4, 0.85] }],
      2
    );
    const result = postprocessDetections(tensor, metadata, 640, 640, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].class).toBe('hemorrhage');
    expect(result[0].classIndex).toBe(1);
  });

  it('usa threshold por parámetro sobre el de metadata', () => {
    const tensor = buildTensor(
      [{ cx: 100, cy: 100, w: 20, h: 20, scores: [0.6, 0.0] }],
      2
    );
    const low = postprocessDetections(tensor, metadata, 640, 640, 0.3);
    const high = postprocessDetections(tensor, metadata, 640, 640, 0.8);
    expect(low).toHaveLength(1);
    expect(high).toHaveLength(0);
  });

  it('lanza error con dimensiones inesperadas', () => {
    const tensor = { data: new Float32Array(4), dims: [4] } as any;
    expect(() => postprocessDetections(tensor, metadata, 640, 640)).toThrow();
  });
});
