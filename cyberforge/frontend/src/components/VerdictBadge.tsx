import { get, type Lang } from '../i18n/strings';
import { KNOWN_SCAM, NO_REPORTS, SUSPICIOUS, VERIFIED_BUSINESS, type Verdict } from '../types/api';

const STYLES: Record<string, string> = {
  [KNOWN_SCAM]: 'bg-rose-100 text-rose-800 border-rose-300',
  [SUSPICIOUS]: 'bg-amber-100 text-amber-900 border-amber-300',
  [NO_REPORTS]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  [VERIFIED_BUSINESS]: 'bg-blue-100 text-blue-800 border-blue-300',
};

const ICONS: Record<string, string> = {
  [KNOWN_SCAM]: '🚫',
  [SUSPICIOUS]: '❓',
  [NO_REPORTS]: '✅',
  [VERIFIED_BUSINESS]: '🏢',
};

const LABEL_KEYS = {
  [KNOWN_SCAM]: 'verdictKnownScam',
  [SUSPICIOUS]: 'verdictSuspicious',
  [NO_REPORTS]: 'verdictNoReports',
  [VERIFIED_BUSINESS]: 'verdictVerifiedBusiness',
} as const;

/**
 * Verdict badge straight from the backend response. Unknown/extra verdict
 * values are shown neutrally with the raw backend value - we never classify
 * in the frontend.
 */
export function VerdictBadge({
  verdict,
  lang,
  className = '',
}: {
  verdict: Verdict | string | null | undefined;
  lang: Lang;
  className?: string;
}): React.JSX.Element {
  const key = verdict ?? '';
  const style = STYLES[key] ?? 'bg-slate-100 text-slate-800 border-slate-300';
  const icon = ICONS[key] ?? 'ℹ️';
  const label = key in LABEL_KEYS ? get(lang, LABEL_KEYS[key as keyof typeof LABEL_KEYS]) : String(verdict);

  return (
    <span
      data-testid="verdict-badge"
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${style} ${className}`}
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}
