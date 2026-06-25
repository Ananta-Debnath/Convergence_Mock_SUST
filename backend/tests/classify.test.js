import { describe, it, expect } from 'vitest';
import { classify } from '../src/classify/rules.js';
import { PUBLIC_CASES } from '../src/lib/sampleCases.js';

describe('rules classifier', () => {
  for (const c of PUBLIC_CASES) {
    it(`maps ${c.id} to expected case_type/severity/department`, () => {
      const r = classify(c.message);
      expect(r.case_type).toBe(c.expected.case_type);
      expect(r.severity).toBe(c.expected.severity);
      expect(r.department).toBe(c.expected.department);
      if (c.expected.human_review_required !== undefined) {
        expect(r.human_review_required).toBe(c.expected.human_review_required);
      }
      expect(r.confidence).toBeGreaterThan(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    });
  }

  it('flags large-amount wrong transfers as critical', () => {
    const r = classify('I mistakenly sent 6000 taka to a wrong number, please help.');
    expect(r.case_type).toBe('wrong_transfer');
    expect(r.severity).toBe('critical');
  });

  it('downgrades small-amount wrong transfers to high', () => {
    const r = classify('I sent 200 taka to the wrong person, can you reverse it?');
    expect(r.case_type).toBe('wrong_transfer');
    expect(r.severity).toBe('high');
  });

  it('escalates refund + urgent + fraud claim', () => {
    const r = classify(
      'I want a refund immediately, this was an unauthorized transaction on my card.',
    );
    expect(r.case_type).toBe('refund_request');
    expect(r.severity).toBe('high');
    expect(r.department).toBe('dispute_resolution');
    expect(r.human_review_required).toBe(true);
  });
});
