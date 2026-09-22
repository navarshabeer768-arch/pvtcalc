interface ActionSheetOption {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  options: ActionSheetOption[];
  onClose: () => void;
}

export function ActionSheet({ options, onClose }: ActionSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="mb-4 w-[90%] max-w-sm overflow-hidden rounded-2xl bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {options.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => {
              opt.onSelect();
              onClose();
            }}
            className={`block w-full px-4 py-3 text-center text-base ${
              i > 0 ? 'border-t border-black/5' : ''
            } ${opt.destructive ? 'text-red-500' : 'text-[var(--text)]'}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
