import { describe, it, expect, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyWithGuideline } from './multi-guideline-classifier';
import { clearGuidelineCache } from './guideline-loader';
import type { LesionCounts, QuadrantLesionCounts } from '@/types/clinical-guidelines';

const guidelinesDir = resolve(__dirname, '../../../public/clinical-guidelines');

beforeAll(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const file = url.split('clinical-guidelines/').pop();
    if (!file) throw new Error(`Unexpected URL: ${url}`);
    const body = readFileSync(resolve(guidelinesDir, file), 'utf-8');
    return {
      ok: true,
      statusText: 'OK',
      json: async () => JSON.parse(body),
    } as Response;
  }) as any;
  clearGuidelineCache();
});

const emptyLesions = (): LesionCounts => ({
  microaneurysms: 0,
  hemorrhages: 0,
  hardExudates: 0,
  softExudates: 0,
  neovascularization: 0,
  venous_beading: 0,
  irma: 0,
  total_lesions: 0,
  lesion_types_count: 0,
});

const lesions = (partial: Partial<LesionCounts>): LesionCounts => {
  const base = emptyLesions();
  const merged = { ...base, ...partial };
  merged.total_lesions =
    merged.microaneurysms +
    merged.hemorrhages +
    merged.hardExudates +
    merged.softExudates +
    merged.neovascularization +
    merged.venous_beading +
    merged.irma;
  merged.lesion_types_count = [
    merged.microaneurysms,
    merged.hemorrhages,
    merged.hardExudates,
    merged.softExudates,
    merged.neovascularization,
    merged.venous_beading,
    merged.irma,
  ].filter((c) => c > 0).length;
  return merged;
};

const fourQuadrantsWith = (field: keyof LesionCounts, perQuadrant: number): QuadrantLesionCounts => {
  const quadrant = { ...emptyLesions(), [field]: perQuadrant };
  return {
    'superior-temporal': quadrant,
    'inferior-temporal': quadrant,
    'superior-nasal': quadrant,
    'inferior-nasal': quadrant,
  } as any;
};

describe('classifyWithGuideline - ICDR 2024', () => {
  it('sin lesiones → no_dr', async () => {
    const result = await classifyWithGuideline('icdr_2024', emptyLesions());
    expect(result.severity).toBe('no_dr');
    expect(result.severity_order).toBe(0);
  });

  it('microaneurismas aislados → mild NPDR', async () => {
    const result = await classifyWithGuideline('icdr_2024', lesions({ microaneurysms: 3 }));
    expect(['mild_npdr', 'mild']).toContain(result.severity);
    expect(result.severity_order).toBeGreaterThanOrEqual(1);
  });

  it('neovascularización → PDR (máxima severidad)', async () => {
    const result = await classifyWithGuideline('icdr_2024', lesions({ neovascularization: 1 }));
    expect(result.severity.toLowerCase()).toContain('pdr');
    expect(result.severity_order).toBeGreaterThanOrEqual(4);
  });

  it('regla 4-2-1: hemorragias en 4 cuadrantes → severe NPDR', async () => {
    const result = await classifyWithGuideline(
      'icdr_2024',
      lesions({ hemorrhages: 80 }),
      fourQuadrantsWith('hemorrhages', 20)
    );
    expect(result.severity_order).toBeGreaterThanOrEqual(3);
    expect(result.rule_421_criteria_met).toBeGreaterThanOrEqual(1);
  });

  it('el tratamiento viene con urgency válida', async () => {
    const result = await classifyWithGuideline('icdr_2024', lesions({ neovascularization: 1 }));
    expect(['urgent', 'accelerated', 'routine']).toContain(result.urgency);
  });
});
