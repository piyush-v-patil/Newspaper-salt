interface Props {
  title: string;
  phase: number;
  summary: string;
}

/** Stands in for a view that a later build phase delivers. */
export function ComingSoon({ title, phase, summary }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
      <p className="max-w-sm text-[14px] text-ink-2">{summary}</p>
      <p className="text-[12px] text-ink-3">Built in phase {phase}</p>
    </div>
  );
}
