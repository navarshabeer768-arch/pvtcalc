import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EvaluationError, evaluate, formatResult, tokenize } from './evaluator';

describe('tokenize', () => {
  it('splits numbers and operators', () => {
    expect(tokenize('37+28')).toEqual([
      { type: 'number', value: 37 },
      { type: 'operator', value: '+' },
      { type: 'number', value: 28 },
    ]);
  });

  it('handles decimals', () => {
    expect(tokenize('1.5*2')).toEqual([
      { type: 'number', value: 1.5 },
      { type: 'operator', value: '*' },
      { type: 'number', value: 2 },
    ]);
  });

  it('rejects invalid characters', () => {
    expect(() => tokenize('3+a')).toThrow(EvaluationError);
  });
});

describe('evaluate', () => {
  it('computes basic arithmetic', () => {
    expect(evaluate('37+28')).toBe(65);
    expect(evaluate('10-4')).toBe(6);
    expect(evaluate('6*7')).toBe(42);
    expect(evaluate('9/3')).toBe(3);
  });

  it('respects operator precedence', () => {
    expect(evaluate('2+3*4')).toBe(14);
    expect(evaluate('2*3+4')).toBe(10);
    expect(evaluate('10-2*3')).toBe(4);
  });

  it('chains multiple operators', () => {
    expect(evaluate('1+2+3+4')).toBe(10);
    expect(evaluate('100-10-10')).toBe(80);
  });

  it('throws on division by zero', () => {
    expect(() => evaluate('5/0')).toThrow(EvaluationError);
  });

  it('throws on malformed expressions', () => {
    expect(() => evaluate('')).toThrow(EvaluationError);
    expect(() => evaluate('3+')).toThrow(EvaluationError);
    expect(() => evaluate('+3')).toThrow(EvaluationError);
    expect(() => evaluate('3++4')).toThrow(EvaluationError);
  });

  it('never uses eval or Function', () => {
    const path = join(process.cwd(), 'src/calculator/evaluator.ts');
    const src = readFileSync(path, 'utf-8');
    expect(src).not.toMatch(/\beval\(/);
    expect(src).not.toMatch(/new Function\(/);
  });
});

describe('formatResult', () => {
  it('avoids floating point artifacts', () => {
    expect(formatResult(0.1 + 0.2)).toBe('0.3');
  });

  it('reports Infinity/NaN as Error', () => {
    expect(formatResult(Infinity)).toBe('Error');
    expect(formatResult(NaN)).toBe('Error');
  });
});
