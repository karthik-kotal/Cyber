export function Loading({ label, className = '' }: { label: string; className?: string }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`}
    >
      <div
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700"
      />
      <p className="text-sm text-slate-600">{label}</p>
    </div>
  );
}
