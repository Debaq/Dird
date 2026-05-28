import { describe, it, expect } from 'vitest';
import { validateModelCard, validateModelCardJson } from './model-card-validator';

const VALID_CARD = {
  schema_version: '2.0',
  name: 'Test',
  version: '0.1.0',
  license: 'AGPL-3.0',
  input: {
    tensor_name: 'images',
    shape: [1, 3, 640, 640],
    layout: 'NCHW',
    dtype: 'float32',
    preprocessing: {
      resize_to: [640, 640],
      letterbox: true,
      letterbox_color: [114, 114, 114],
      normalize: 'divide_by_255',
      color_order: 'RGB',
    },
  },
  output: { tensor_name: 'output', format: 'yolo_end2end_v2' },
  classes: [{ id: 0, name: 'lesion', severity: 'moderate' }],
};

describe('validateModelCard', () => {
  it('acepta un card válido completo', () => {
    const r = validateModelCard(VALID_CARD);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.card?.name).toBe('Test');
  });

  it('rechaza schema_version distinto a "2.0"', () => {
    const r = validateModelCard({ ...VALID_CARD, schema_version: '1.0' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'schema_version')).toBe(true);
  });

  it('rechaza si falta name', () => {
    const c: any = { ...VALID_CARD };
    delete c.name;
    const r = validateModelCard(c);
    expect(r.ok).toBe(false);
  });

  it('rechaza batch ≠ 1', () => {
    const c = { ...VALID_CARD, input: { ...VALID_CARD.input, shape: [2, 3, 640, 640] } };
    const r = validateModelCard(c);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'input.shape[0]')).toBe(true);
  });

  it('rechaza channels ≠ 3', () => {
    const c = { ...VALID_CARD, input: { ...VALID_CARD.input, shape: [1, 1, 640, 640] } };
    const r = validateModelCard(c);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'input.shape[1]')).toBe(true);
  });

  it('detecta shape[H,W] que no coincide con resize_to', () => {
    const c = {
      ...VALID_CARD,
      input: {
        ...VALID_CARD.input,
        shape: [1, 3, 320, 320],
        preprocessing: { ...VALID_CARD.input.preprocessing, resize_to: [640, 640] },
      },
    };
    const r = validateModelCard(c);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path === 'input.shape')).toBe(true);
  });

  it('rechaza formato de output desconocido', () => {
    const c = { ...VALID_CARD, output: { tensor_name: 'output', format: 'inventado' } };
    const r = validateModelCard(c);
    expect(r.ok).toBe(false);
  });

  it('rechaza classes vacío', () => {
    const r = validateModelCard({ ...VALID_CARD, classes: [] });
    expect(r.ok).toBe(false);
  });

  it('rechaza class ids duplicados', () => {
    const r = validateModelCard({
      ...VALID_CARD,
      classes: [
        { id: 0, name: 'a' },
        { id: 0, name: 'b' },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.message.includes('duplicado'))).toBe(true);
  });

  it('rechaza per_class_thresholds que referencian clases inexistentes', () => {
    const r = validateModelCard({
      ...VALID_CARD,
      per_class_thresholds: { ghost_class: 0.5 },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.includes('ghost_class'))).toBe(true);
  });

  it('rechaza umbrales fuera de [0,1]', () => {
    const r = validateModelCard({
      ...VALID_CARD,
      per_class_thresholds: { lesion: 1.5 },
    });
    expect(r.ok).toBe(false);
  });

  it('rechaza default_confidence_threshold fuera de [0,1]', () => {
    const r = validateModelCard({ ...VALID_CARD, default_confidence_threshold: -0.1 });
    expect(r.ok).toBe(false);
  });
});

describe('validateModelCardJson', () => {
  it('rechaza JSON malformado', () => {
    const r = validateModelCardJson('{ not json');
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toBe('$');
  });

  it('acepta JSON válido', () => {
    const r = validateModelCardJson(JSON.stringify(VALID_CARD));
    expect(r.ok).toBe(true);
  });
});
