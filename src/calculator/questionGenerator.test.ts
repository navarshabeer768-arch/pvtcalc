import { describe, expect, it } from 'vitest';
import { generatePracticeQuestion } from './questionGenerator';

describe('generatePracticeQuestion', () => {
  it('produces operands and results with at most 3 digits, many times over', () => {
    for (let i = 0; i < 2000; i++) {
      const q = generatePracticeQuestion();
      expect(Math.abs(q.result)).toBeLessThanOrEqual(999);

      const operandMatches = q.text.match(/\d+/g) ?? [];
      for (const operand of operandMatches) {
        expect(Number(operand)).toBeLessThanOrEqual(999);
      }
    }
  });

  it('never produces a result that could be mistaken for a valid unlock code', () => {
    // Unlock codes are 4-8 digits; practice results are capped at 3 digits,
    // so a question result can never collide with a code length-wise.
    for (let i = 0; i < 2000; i++) {
      const q = generatePracticeQuestion();
      const digits = String(Math.abs(q.result)).length;
      expect(digits).toBeLessThanOrEqual(3);
    }
  });

  it('returns a well-formed "a op b" string', () => {
    const q = generatePracticeQuestion();
    expect(q.text).toMatch(/^\d+ [+\-×÷] \d+$/);
  });
});
