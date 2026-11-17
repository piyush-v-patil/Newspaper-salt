import { useEffect } from 'react';
import { create } from 'zustand';

const useCelebration = create<{ burst: number }>(() => ({ burst: 0 }));

/** Plays a short burst of confetti. */
export function celebrate(): void {
  useCelebration.setState((s) => ({ burst: s.burst + 1 }));
}

const COLORS = ['#f5a623', '#2e9f68', '#2f7de1', '#d0507a', '#3aa6a0', '#e0b400'];
const PIECES = 36;
const DURATION_MS = 1500;

/** Mounted once; draws confetti whenever `celebrate()` is called. Skipped for reduced motion. */
export function Celebration() {
  const burst = useCelebration((s) => s.burst);

  useEffect(() => {
    if (burst === 0) return;
    const timer = setTimeout(() => useCelebration.setState({ burst: 0 }), DURATION_MS);
    return () => clearTimeout(timer);
  }, [burst]);

  if (burst === 0 || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return null;

  return (
    <div key={burst} aria-hidden data-testid="celebration" className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => {
        // Spread deterministically so the burst looks the same every time.
        const angle = (i / PIECES) * Math.PI * 2;
        const distance = 160 + ((i * 53) % 220);
        return (
          <span
            key={i}
            className="confetti absolute left-1/2 top-[38%] h-2.5 w-1.5 rounded-[1px]"
            style={
              {
                background: COLORS[i % COLORS.length],
                '--dx': `${Math.cos(angle) * distance}px`,
                '--dy': `${Math.sin(angle) * distance - 120}px`,
                '--spin': `${(i % 2 ? 1 : -1) * (360 + i * 20)}deg`,
                animationDelay: `${(i % 6) * 18}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
