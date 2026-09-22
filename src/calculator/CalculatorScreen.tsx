import { useCalculator, type CalculatorEvent } from './useCalculator';

interface CalculatorScreenProps {
  onEvent: (event: CalculatorEvent) => void;
}

const KEYS: Array<{ label: string; kind: 'digit' | 'op' | 'clear' | 'equals' | 'decimal' }> = [
  // 4 columns x 5 rows: digits/ops on top, then 0 . C + = spanning the last two rows.
  { label: '7', kind: 'digit' },
  { label: '8', kind: 'digit' },
  { label: '9', kind: 'digit' },
  { label: '÷', kind: 'op' },
  { label: '4', kind: 'digit' },
  { label: '5', kind: 'digit' },
  { label: '6', kind: 'digit' },
  { label: '×', kind: 'op' },
  { label: '1', kind: 'digit' },
  { label: '2', kind: 'digit' },
  { label: '3', kind: 'digit' },
  { label: '−', kind: 'op' },
  { label: '0', kind: 'digit' },
  { label: '.', kind: 'decimal' },
  { label: 'C', kind: 'clear' },
  { label: '+', kind: 'op' },
  { label: '=', kind: 'equals' },
];

const OP_MAP: Record<string, '+' | '-' | '*' | '/'> = {
  '÷': '/',
  '×': '*',
  '−': '-',
  '+': '+',
};

export function CalculatorScreen({ onEvent }: CalculatorScreenProps) {
  const calc = useCalculator({ onEvent });

  const handleKey = (label: string, kind: string) => {
    if (kind === 'digit') calc.pressDigit(label);
    else if (kind === 'op') calc.pressOperator(OP_MAP[label]);
    else if (kind === 'decimal') calc.pressDecimal();
    else if (kind === 'clear') calc.clear();
    else if (kind === 'equals') void calc.pressEquals();
  };

  return (
    <div className="flex h-full w-full flex-col justify-end bg-[#1c1c1e] text-white select-none">
      <div className="flex flex-col items-end gap-2 px-6 pb-6 pt-16">
        <div className="min-h-[1.5rem] text-sm text-white/40" data-testid="practice-line">
          {calc.practiceQuestion.text}
        </div>
        <button
          type="button"
          onClick={calc.pressBackspace}
          disabled={calc.isLocked || calc.checking}
          aria-label="Backspace"
          className="w-full truncate text-right text-6xl font-light tabular-nums disabled:opacity-40"
          data-testid="main-display"
        >
          {calc.checking ? '…' : calc.display}
        </button>
        {calc.isLocked && (
          <div className="text-sm text-white/60">Please try again later.</div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-px bg-white/10 p-px">
        {KEYS.map((key) => (
          <button
            key={key.label}
            type="button"
            disabled={calc.isLocked || calc.checking}
            onClick={() => handleKey(key.label, key.kind)}
            className={`flex h-20 items-center justify-center text-2xl font-medium transition-colors active:brightness-125 disabled:opacity-40 ${
              key.kind === 'equals' ? 'col-span-4' : ''
            } ${
              key.kind === 'op' || key.kind === 'equals'
                ? 'bg-[#ff9f0a] text-white'
                : key.kind === 'clear'
                  ? 'bg-[#a5a5a5] text-black'
                  : key.kind === 'decimal'
                    ? 'bg-[#333333] text-white'
                    : 'bg-[#333333] text-white'
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>
    </div>
  );
}
