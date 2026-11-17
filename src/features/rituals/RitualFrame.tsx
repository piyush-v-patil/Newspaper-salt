import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  /** e.g. "Daily planning" */
  name: string;
  /** e.g. "Tuesday, November 17" */
  detail: string;
  steps: number;
  step: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  onExit: () => void;
  children: ReactNode;
}

/** The full-window layout every ritual shares: progress along the top, one step in the middle, Back and Next below. */
export function RitualFrame({ name, detail, steps, step, onBack, onNext, nextLabel = 'Next', onExit, children }: Props) {
  const latest = useRef({ onBack, onNext, onExit });
  latest.current = { onBack, onNext, onExit };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowRight') latest.current.onNext?.();
      else if (e.key === 'ArrowLeft') latest.current.onBack?.();
      else if (e.key === 'Escape') latest.current.onExit();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-line px-6">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[14px] font-semibold tracking-tight">{name}</span>
          <span className="text-[12.5px] text-ink-3">{detail}</span>
        </div>
        <ol aria-label={`Step ${step + 1} of ${steps}`} className="absolute left-1/2 flex -translate-x-1/2 gap-1.5">
          {Array.from({ length: steps }, (_, i) => (
            <li key={i} className={`h-1 w-8 rounded-full transition-colors duration-300 ${i <= step ? 'bg-accent' : 'bg-hover'}`} />
          ))}
        </ol>
        <button type="button" onClick={onExit} aria-label={`Exit ${name.toLowerCase()}`} title="Save and exit  Esc" className="grid h-7 w-7 place-items-center rounded-md text-ink-2 hover:bg-hover">
          <X size={16} />
        </button>
      </header>
      <div key={step} className="flex min-h-0 flex-1 animate-fade">
        {children}
      </div>
      <footer className="flex h-14 shrink-0 items-center justify-end gap-2 border-t border-line px-6">
        {onBack && (
          <button type="button" onClick={onBack} className="h-8 rounded-md px-3 text-[13px] text-ink-2 hover:bg-hover">
            Back
          </button>
        )}
        {onNext && (
          <button type="button" onClick={onNext} className="h-8 rounded-md bg-ink px-3.5 text-[13px] font-medium text-canvas">
            {nextLabel}
          </button>
        )}
      </footer>
    </div>
  );
}

/** The left-hand column of a ritual step: the question being asked and how to answer it. */
export function Guidance({ prompt, children }: { prompt: string; children?: ReactNode }) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col gap-3 px-6 py-8">
      <h1 className="text-[22px] font-semibold leading-tight tracking-tight">{prompt}</h1>
      <div className="flex flex-col gap-3 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </aside>
  );
}

/** A titled column inside a ritual step. */
export function Column({ title, hint, width, children }: { title: string; hint?: ReactNode; width: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-h-0 shrink-0 flex-col border-l border-line" style={{ width }}>
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 px-4">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-6">{children}</div>
    </section>
  );
}
