import { describe, it, expect } from 'vitest';
import { applyNMS, type Detection } from './onnx-manager';

const mkDet = (
  x: number,
  y: number,
  w: number,
  h: number,
  confidence: number,
  cls = 'microaneurysm',
  classIndex = 0
): Detection => ({
  bbox: { x, y, width: w, height: h },
  class: cls,
  confidence,
  classIndex,
});

describe('applyNMS', () => {
  it('devuelve array vacío si no hay detecciones', () => {
    expect(applyNMS([], 0.5)).toEqual([]);
  });

  it('mantiene detecciones sin solapamiento', () => {
    const detections = [
      mkDet(0, 0, 10, 10, 0.9),
      mkDet(100, 100, 10, 10, 0.8),
      mkDet(200, 200, 10, 10, 0.7),
    ];
    const result = applyNMS(detections, 0.5);
    expect(result).toHaveLength(3);
  });

  it('descarta caja solapada con menor confianza', () => {
    const high = mkDet(0, 0, 100, 100, 0.95);
    const lowOverlap = mkDet(10, 10, 100, 100, 0.60); // IoU alto con high
    const result = applyNMS([high, lowOverlap], 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.95);
  });

  it('ordena por confianza y preserva la de mayor score', () => {
    const detections = [
      mkDet(0, 0, 100, 100, 0.5),
      mkDet(5, 5, 100, 100, 0.9),
      mkDet(10, 10, 100, 100, 0.7),
    ];
    const result = applyNMS(detections, 0.5);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9);
  });

  it('threshold IoU alto conserva cajas con solapamiento moderado', () => {
    const a = mkDet(0, 0, 100, 100, 0.9);
    const b = mkDet(50, 0, 100, 100, 0.8); // IoU ≈ 0.33
    const resultStrict = applyNMS([a, b], 0.5);
    expect(resultStrict).toHaveLength(2);

    const resultLoose = applyNMS([a, b], 0.2);
    expect(resultLoose).toHaveLength(1);
  });

  it('no muta el array de entrada', () => {
    const detections = [mkDet(0, 0, 10, 10, 0.9), mkDet(0, 0, 10, 10, 0.8)];
    const snapshot = [...detections];
    applyNMS(detections, 0.5);
    expect(detections).toEqual(snapshot);
  });
});
