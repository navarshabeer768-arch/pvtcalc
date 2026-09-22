export type Token =
  | { type: 'number'; value: number }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' };

const OPERATORS = new Set(['+', '-', '*', '/']);
const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export class EvaluationError extends Error {}

/** Tokenizes a calculator expression like "37+28-4" into numbers and operators. */
export function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = expression.length;

  while (i < n) {
    const ch = expression[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if (OPERATORS.has(ch)) {
      tokens.push({ type: 'operator', value: ch as '+' | '-' | '*' | '/' });
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let start = i;
      let sawDot = false;
      while (i < n && /[0-9.]/.test(expression[i])) {
        if (expression[i] === '.') {
          if (sawDot) throw new EvaluationError('Invalid number');
          sawDot = true;
        }
        i++;
      }
      const raw = expression.slice(start, i);
      const value = Number(raw);
      if (Number.isNaN(value)) throw new EvaluationError('Invalid number');
      tokens.push({ type: 'number', value });
      continue;
    }

    throw new EvaluationError(`Unexpected character: ${ch}`);
  }

  return tokens;
}

/** Shunting-yard: converts infix tokens to postfix (RPN) order. */
function toPostfix(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token);
    } else {
      while (
        opStack.length > 0 &&
        PRECEDENCE[opStack[opStack.length - 1].value] >= PRECEDENCE[token.value]
      ) {
        output.push(opStack.pop()!);
      }
      opStack.push(token);
    }
  }

  while (opStack.length > 0) {
    output.push(opStack.pop()!);
  }

  return output;
}

function evalPostfix(postfix: Token[]): number {
  const stack: number[] = [];

  for (const token of postfix) {
    if (token.type === 'number') {
      stack.push(token.value);
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();
    if (a === undefined || b === undefined) {
      throw new EvaluationError('Malformed expression');
    }

    switch (token.value) {
      case '+':
        stack.push(a + b);
        break;
      case '-':
        stack.push(a - b);
        break;
      case '*':
        stack.push(a * b);
        break;
      case '/':
        if (b === 0) throw new EvaluationError('Division by zero');
        stack.push(a / b);
        break;
    }
  }

  if (stack.length !== 1) throw new EvaluationError('Malformed expression');
  return stack[0];
}

/**
 * Safely evaluates a calculator expression string. Never uses eval/Function.
 * Throws EvaluationError for divide-by-zero or malformed input.
 */
export function evaluate(expression: string): number {
  const trimmed = expression.trim();
  if (trimmed === '') throw new EvaluationError('Empty expression');

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new EvaluationError('Empty expression');

  // Validate alternation: number, operator, number, operator, ... number
  // (leading unary minus is not supported by this simple calculator UI).
  for (let i = 0; i < tokens.length; i++) {
    const expectNumber = i % 2 === 0;
    const token = tokens[i];
    if (expectNumber && token.type !== 'number') {
      throw new EvaluationError('Expected a number');
    }
    if (!expectNumber && token.type !== 'operator') {
      throw new EvaluationError('Expected an operator');
    }
  }
  if (tokens.length % 2 === 0) {
    throw new EvaluationError('Expression ends with an operator');
  }

  const postfix = toPostfix(tokens);
  return evalPostfix(postfix);
}

/** Rounds to avoid floating point artifacts (e.g. 0.1 + 0.2) in the display. */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Math.round(value * 1e9) / 1e9;
  return String(rounded);
}
