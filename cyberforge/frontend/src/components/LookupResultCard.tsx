import { get, type Lang } from '../i18n/strings';
import { KNOWN_SCAM, SUSPICIOUS, type LookupResponse } from '../types/api';
import { VerdictBadge } from './VerdictBadge';

/** Detail row used on the result card. */
function Row({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element | null {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-900 break-all">{children}</dd>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

/**
 * Renders the backend lookup response exactly as returned.
 *
 * - display_value is shown verbatim: the backend masks; this UI never unmasks.
 * - NO_REPORTS is shown as a friendly all-clear (never as a scam warning).
 * - VERIFIED_BUSINESS is shown as a business identity (never as a scam).
 * - challenged=true shows the dispute indicator.
 */
export function LookupResultCard({
  result,
  lang,
  onDispute,
}: {
  result: LookupResponse;
  lang: Lang;
  onDispute: () => void;
}): React.JSX.Element {
  const { verdict } = result;
  const counts = (n: number | null | undefined): string => (typeof n === 'number' ? String(n) : '—');

  return (
    <section
      data-testid="lookup-result"
      aria-label="Lookup result"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-col items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-5">
        <p
          data-testid="display-value"
          className="max-w-full truncate text-xl font-bold tracking-tight text-slate-900"
        >
          {result.display_value}
        </p>
        <VerdictBadge verdict={verdict} lang={lang} />
        {result.challenged ? (
          <p
            data-testid="challenge-indicator"
            className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800"
          >
            ⚠️ {get(lang, 'challenged')}
          </p>
        ) : null}
      </div>

      <dl className="divide-y divide-slate-100 px-4 py-2">
        <Row label={get(lang, 'reports')}>
          {counts(result.report_count)} {get(lang, 'reports')} · {counts(result.distinct_reporters)}{' '}
          {get(lang, 'reporters')}
        </Row>
        {result.scam_type ? (
          <Row label="Type">{result.scam_type}</Row>
        ) : null}
        <Row label={get(lang, 'firstSeen')}>{fmtDate(result.first_seen)}</Row>
        <Row label={get(lang, 'lastSeen')}>{fmtDate(result.last_seen)}</Row>
        {/* Render evidence summary or legacy list */}
        {(() => {
          if (!result.evidence) return null;

          if (Array.isArray(result.evidence) && result.evidence.length > 0) {
            return (
              <Row label={get(lang, 'evidence')}>
                <ul className="list-disc pl-4 text-left">
                  {result.evidence.map((item, i) => (
                    <li key={i}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
                  ))}
                </ul>
              </Row>
            );
          }

          if (typeof result.evidence === 'object' && !Array.isArray(result.evidence)) {
            const ev = result.evidence;
            const reports = ev.reports || [];
            const hasLoss = typeof ev.total_reported_loss_inr === 'number' && ev.total_reported_loss_inr > 0;
            const hasReports = reports.length > 0;
            const isVerified = ev.verified || Boolean(ev.business_name);

            if (!hasLoss && !hasReports && !isVerified) return null;

            return (
              <>
                {hasLoss ? (
                  <Row label="Reported Loss">
                    ₹{ev.total_reported_loss_inr?.toLocaleString('en-IN')}
                  </Row>
                ) : null}
                {isVerified && ev.business_name ? (
                  <Row label="Entity">
                    {ev.business_name} {ev.category ? `(${ev.category})` : ''}
                  </Row>
                ) : null}
                {hasReports ? (
                  <Row label={get(lang, 'evidence')}>
                    <ul className="space-y-1.5 text-left text-xs">
                      {reports.slice(0, 5).map((item, i) => (
                        <li key={i} className="rounded bg-slate-50 p-1.5 border border-slate-100">
                          <span className="font-semibold text-slate-800">{item.channel || 'Report'}</span>
                          {item.scam_type ? <span className="ml-1 text-slate-600">• {item.scam_type}</span> : null}
                          {item.pincode ? <span className="ml-1 text-slate-500">({item.pincode})</span> : null}
                          <span className="ml-1 text-slate-400">• {fmtDate(item.occurred_at)}</span>
                        </li>
                      ))}
                    </ul>
                  </Row>
                ) : null}
              </>
            );
          }
          return null;
        })()}
      </dl>

      {verdict === KNOWN_SCAM || verdict === SUSPICIOUS ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-center">
          <button
            type="button"
            onClick={onDispute}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            {get(lang, 'navDispute')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
