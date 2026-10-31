export function EmptyState({
  title,
  hint,
  icon = '…',
  className = '',
}: {
  title: string;
  hint?: string;
  icon?: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-12 text-center ${className}`}>
      <span aria-hidden="true" className="text-4xl opacity-60">{icon}</span>
      <p className="text-base font-medium text-slate-700">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
