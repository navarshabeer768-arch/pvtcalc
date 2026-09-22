import { useCallback, useEffect, useRef, useState } from 'react';
import { evaluate, EvaluationError, formatResult, tokenize } from './evaluator';
import { generatePracticeQuestion, type PracticeQuestion } from './questionGenerator';
import { isCodeShaped, nextLockoutSeconds } from '../app/lockState';
import { checkUnlockCode } from '../services/unlockService';

export type CalculatorEvent =
  | { type: 'unlocked' }
  | { type: 'login_required' }
  | { type: 'locked'; retryAfterSeconds: number };

interface UseCalculatorOptions {
  onEvent: (event: CalculatorEvent) => void;
}

export function useCalculator({ onEvent }: UseCalculatorOptions) {
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [practiceQuestion, setPracticeQuestion] = useState<PracticeQuestion>(() => generatePracticeQuestion());
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const failedAttempts = useRef(0);

  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) setLockedUntil(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && remainingSeconds > 0;

  const regeneratePractice = useCallback(() => {
    setPracticeQuestion(generatePracticeQuestion());
  }, []);

  const pressDigit = useCallback(
    (digit: string) => {
      if (isLocked || checking) return;
      setExpression((prev) => {
        const next = justEvaluated ? digit : prev + digit;
        setDisplay(next || '0');
        return next;
      });
      setJustEvaluated(false);
    },
    [isLocked, checking, justEvaluated]
  );

  const pressOperator = useCallback(
    (op: '+' | '-' | '*' | '/') => {
      if (isLocked || checking) return;
      setExpression((prev) => {
        if (prev === '') return prev;
        const lastChar = prev[prev.length - 1];
        const next = '+-*/'.includes(lastChar) ? prev.slice(0, -1) + op : prev + op;
        setDisplay(next);
        return next;
      });
      setJustEvaluated(false);
    },
    [isLocked, checking]
  );

  const pressDecimal = useCallback(() => {
    if (isLocked || checking) return;
    setExpression((prev) => {
      const next = justEvaluated ? '0.' : prev + '.';
      setDisplay(next);
      return next;
    });
    setJustEvaluated(false);
  }, [isLocked, checking, justEvaluated]);

  const pressBackspace = useCallback(() => {
    if (isLocked || checking) return;
    setExpression((prev) => {
      const next = prev.slice(0, -1);
      setDisplay(next || '0');
      return next;
    });
  }, [isLocked, checking]);

  const clear = useCallback(() => {
    if (isLocked) return;
    setExpression('');
    setDisplay('0');
    setJustEvaluated(false);
  }, [isLocked]);

  const pressEquals = useCallback(async () => {
    if (isLocked || checking || expression === '') return;

    // Digits-only, 4-8 long: this is code-shaped input. Check it silently
    // before treating it as arithmetic.
    if (isCodeShaped(expression)) {
      setChecking(true);
      try {
        const result = await checkUnlockCode(expression);

        if (result.status === 'unlocked') {
          onEvent({ type: 'unlocked' });
          return;
        }
        if (result.status === 'login_required') {
          onEvent({ type: 'login_required' });
          return;
        }
        if (result.status === 'locked') {
          setLockedUntil(Date.now() + result.retryAfter * 1000);
          onEvent({ type: 'locked', retryAfterSeconds: result.retryAfter });
          return;
        }

        // no_match: behave exactly like ordinary arithmetic input.
        failedAttempts.current += 1;
        const localLockout = nextLockoutSeconds(failedAttempts.current);
        if (localLockout) {
          setLockedUntil(Date.now() + localLockout * 1000);
        }
        setDisplay(expression);
        setJustEvaluated(true);
        regeneratePractice();
      } finally {
        setChecking(false);
      }
      return;
    }

    // Not code-shaped: pure arithmetic.
    try {
      tokenize(expression);
      const value = evaluate(expression);
      setDisplay(formatResult(value));
      setExpression(formatResult(value));
      setJustEvaluated(true);
    } catch (err) {
      if (err instanceof EvaluationError) {
        setDisplay('Error');
        setExpression('');
        setJustEvaluated(true);
      }
    }
  }, [expression, isLocked, checking, onEvent, regeneratePractice]);

  return {
    display,
    expression,
    practiceQuestion,
    isLocked,
    remainingSeconds,
    checking,
    pressDigit,
    pressOperator,
    pressDecimal,
    pressBackspace,
    clear,
    pressEquals,
    regeneratePractice,
  };
}
