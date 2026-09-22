import { describe, expect, it } from 'vitest';
import { isCodeShaped, nextLockoutSeconds } from './lockState';

describe('isCodeShaped', () => {
  it('accepts 4-8 digit strings', () => {
    expect(isCodeShaped('1234')).toBe(true);
    expect(isCodeShaped('12345678')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isCodeShaped('123')).toBe(false);
    expect(isCodeShaped('123456789')).toBe(false);
    expect(isCodeShaped('12a4')).toBe(false);
    expect(isCodeShaped('37+28')).toBe(false);
    expect(isCodeShaped('')).toBe(false);
  });
});

describe('nextLockoutSeconds', () => {
  it('is null below the attempt threshold', () => {
    expect(nextLockoutSeconds(0)).toBeNull();
    expect(nextLockoutSeconds(4)).toBeNull();
  });

  it('escalates 30s -> 1m -> 5m -> 15m', () => {
    expect(nextLockoutSeconds(5)).toBe(30);
    expect(nextLockoutSeconds(6)).toBe(60);
    expect(nextLockoutSeconds(7)).toBe(300);
    expect(nextLockoutSeconds(8)).toBe(900);
    expect(nextLockoutSeconds(20)).toBe(900);
  });
});
