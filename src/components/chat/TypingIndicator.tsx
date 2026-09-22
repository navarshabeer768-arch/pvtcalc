interface TypingIndicatorProps {
  label: string;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-[var(--text-muted)]">
      <span>{label}</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1 w-1 animate-bounce rounded-full bg-[var(--text-muted)]"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </span>
    </div>
  );
}
