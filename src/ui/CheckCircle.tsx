import { Check } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

/** The round completion control used on every task. */
export function CheckCircle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
        checked ? 'border-done bg-done text-white' : 'border-line-strong text-transparent hover:border-done hover:text-done'
      }`}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}
