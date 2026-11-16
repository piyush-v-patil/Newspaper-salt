import { Check } from 'lucide-react';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 'md' | 'sm';
}

/** The round completion control used on every task. */
export function CheckCircle({ checked, onChange, label, size = 'md' }: Props) {
  const box = size === 'md' ? 'h-[18px] w-[18px]' : 'h-[14px] w-[14px]';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`grid ${box} shrink-0 place-items-center rounded-full border transition-colors duration-200 ${
        checked ? 'animate-check border-done bg-done text-white' : 'border-line-strong text-transparent hover:border-done hover:text-done'
      }`}
    >
      <Check size={size === 'md' ? 12 : 9} strokeWidth={3} />
    </button>
  );
}
