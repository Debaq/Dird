import { describe, it, expect } from 'vitest';
import {
  getMaximumSeverity,
  getMostUrgentRecommendation,
} from './multi-guideline-classifier';
import type { GuidelineClassificationResult } from '@/types/clinical-guidelines';

const mkResult = (
  severity_order: number,
  urgency: 'urgent' | 'accelerated' | 'routine',
  severity = `level_${severity_order}`
): GuidelineClassificationResult => ({
  severity,
  severity_order,
  urgency,
  guideline_id: 'test',
  guideline_name: 'Test',
  severity_name: severity,
  severity_description: '',
  color: '#000',
  treatment_protocol: null as any,
  matched_rule: null as any,
  confidence: 'moderate',
  criteria_met: [],
  emcs: null as any,
  rule_421_details: [],
  rule_421_criteria_met: 0,
  lesions: null as any,
});

describe('getMaximumSeverity', () => {
  it('devuelve null si no hay resultados', () => {
    expect(getMaximumSeverity([])).toBeNull();
  });

  it('devuelve el único resultado si sólo hay uno', () => {
    const r = mkResult(2, 'accelerated');
    expect(getMaximumSeverity([r])).toBe(r);
  });

  it('elige el de mayor severity_order', () => {
    const mild = mkResult(1, 'routine');
    const moderate = mkResult(3, 'accelerated');
    const severe = mkResult(5, 'urgent');
    expect(getMaximumSeverity([mild, moderate, severe])).toBe(severe);
    expect(getMaximumSeverity([moderate, mild])).toBe(moderate);
  });
});

describe('getMostUrgentRecommendation', () => {
  it('devuelve null si no hay resultados', () => {
    expect(getMostUrgentRecommendation([])).toBeNull();
  });

  it('urgent > accelerated > routine', () => {
    const routine = mkResult(1, 'routine');
    const accelerated = mkResult(2, 'accelerated');
    const urgent = mkResult(3, 'urgent');
    expect(getMostUrgentRecommendation([routine, accelerated, urgent])).toBe(urgent);
    expect(getMostUrgentRecommendation([routine, accelerated])).toBe(accelerated);
    expect(getMostUrgentRecommendation([routine])).toBe(routine);
  });

  it('independiente del severity_order, solo importa urgency', () => {
    const highSeverityRoutine = mkResult(9, 'routine');
    const lowSeverityUrgent = mkResult(1, 'urgent');
    expect(getMostUrgentRecommendation([highSeverityRoutine, lowSeverityUrgent]))
      .toBe(lowSeverityUrgent);
  });
});
