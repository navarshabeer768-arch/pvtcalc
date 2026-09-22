export interface PracticeQuestion {
  text: string;
  result: number;
}

type Op = '+' | '-' | '×' | '÷';

const MAX_DIGITS = 3;
const MAX_OPERAND = 10 ** MAX_DIGITS - 1; // 999
const MAX_RESULT = 10 ** MAX_DIGITS - 1; // 999

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function applyOp(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/**
 * Generates a random, decorative arithmetic question whose operands and
 * result are all at most 3 digits. This is a display-only distraction line;
 * it never participates in unlock-code comparison.
 */
export function generatePracticeQuestion(): PracticeQuestion {
  const ops: Op[] = ['+', '-', '×', '÷'];

  for (let attempt = 0; attempt < 200; attempt++) {
    const op = ops[randInt(0, ops.length - 1)];
    let a: number;
    let b: number;

    if (op === '÷') {
      b = randInt(1, 99);
      const quotient = randInt(1, 9);
      a = b * quotient;
    } else if (op === '×') {
      a = randInt(2, 99);
      b = randInt(2, 9);
    } else {
      a = randInt(1, MAX_OPERAND);
      b = randInt(1, MAX_OPERAND);
    }

    if (a > MAX_OPERAND || b > MAX_OPERAND) continue;

    const result = applyOp(a, op, b);
    if (result === null) continue;
    if (!Number.isInteger(result)) continue;
    if (Math.abs(result) > MAX_RESULT) continue;
    if (op === '-' && result < 0) continue;

    return { text: `${a} ${op} ${b}`, result };
  }

  // Fallback (should be unreachable given the ranges above).
  return { text: '2 + 2', result: 4 };
}
