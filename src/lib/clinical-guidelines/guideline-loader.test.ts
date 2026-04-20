import { describe, it, expect } from 'vitest';
import { validateGuideline } from './guideline-loader';
import type { ClinicalGuideline } from '@/types/clinical-guidelines';

const validGuideline: ClinicalGuideline = {
  guideline_id: 'icdr',
  metadata: {
    name: 'ICDR',
    version: '1.0.0',
    country: 'International',
  },
  severity_levels: [
    { id: 'no_dr', name: 'No DR', order: 0, color: '#0f0', description: '' } as any,
    { id: 'mild', name: 'Mild', order: 1, color: '#ff0', description: '' } as any,
    { id: 'severe', name: 'Severe', order: 4, color: '#f00', description: '' } as any,
  ],
  classification_rules: [
    {
      severity: 'mild',
      logic: 'AND',
      priority: 1,
      conditions: [{ field: 'microaneurysms', operator: '>=', value: 1 }],
    } as any,
  ],
  rule_421: {
    enabled: true,
    criteria: [
      {
        name: '4+ quadrants hemorrhages',
        field: 'hemorrhages',
        min_quadrants: 4,
        min_per_quadrant: 1,
      },
    ],
  } as any,
  treatment_protocols: [
    {
      severity: 'mild',
      urgency: 'routine',
      actions: ['Anual follow-up'],
      followup_interval_days: 365,
    } as any,
  ],
  emcs_criteria: {} as any,
  class_mapping: { microaneurysms: ['microaneurysm'] } as any,
};

describe('validateGuideline', () => {
  it('acepta guideline completa y válida', () => {
    const result = validateGuideline(validGuideline);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reporta falta de guideline_id', () => {
    const bad = { ...validGuideline, guideline_id: '' };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'guideline_id')).toBe(true);
  });

  it('reporta severity_levels vacío', () => {
    const bad = { ...validGuideline, severity_levels: [] };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'severity_levels')).toBe(true);
  });

  it('reporta severity_levels con ids duplicados', () => {
    const bad = {
      ...validGuideline,
      severity_levels: [
        { id: 'dup', name: 'A', order: 0, color: '#000', description: '' } as any,
        { id: 'dup', name: 'B', order: 1, color: '#000', description: '' } as any,
      ],
    };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.message.toLowerCase().includes('duplicate'))
    ).toBe(true);
  });

  it('reporta regla sin conditions', () => {
    const bad = {
      ...validGuideline,
      classification_rules: [
        { severity: 'mild', logic: 'AND', priority: 1, conditions: [] } as any,
      ],
    };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.field.includes('conditions'))
    ).toBe(true);
  });

  it('reporta logic inválida (distinta de AND/OR)', () => {
    const bad = {
      ...validGuideline,
      classification_rules: [
        {
          severity: 'mild',
          logic: 'XOR' as any,
          priority: 1,
          conditions: [{ field: 'microaneurysms', operator: '>=', value: 1 }],
        } as any,
      ],
    };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('logic'))).toBe(true);
  });

  it('reporta treatment_protocol con urgency inválida', () => {
    const bad = {
      ...validGuideline,
      treatment_protocols: [
        {
          severity: 'mild',
          urgency: 'asap' as any,
          actions: ['X'],
          followup_interval_days: 30,
        } as any,
      ],
    };
    const result = validateGuideline(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.includes('urgency'))).toBe(true);
  });

  it('warnings no invalidan la guía', () => {
    const noCountry = {
      ...validGuideline,
      metadata: { name: 'X', version: '1.0' } as any,
    };
    const result = validateGuideline(noCountry);
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
