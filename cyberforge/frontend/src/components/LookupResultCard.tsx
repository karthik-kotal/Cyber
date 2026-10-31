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
  onDisputeReport,
}: {
  result: LookupResponse;
  lang: Lang;
  onDispute: () => void;
  onDisputeReport?: (reportId: string) => void;
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
        <Row label="Total Reports">
          {counts(result.report_count)} {get(lang, 'reports')}
        </Row>
        <Row label="Distinct Reporters">
          <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
            {counts(result.distinct_reporters)}{' '}
            {result.distinct_reporters === 1 ? 'person' : get(lang, 'reporters')}
            {typeof result.distinct_reporters === 'number' &&
             typeof result.report_count === 'number' &&
             result.report_count > 1 &&
             result.distinct_reporters === 1 ? (
              <span className="block w-full text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 mt-0.5 text-right">
                Single reporter — not independently confirmed
              </span>
            ) : null}
          </span>
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
                    <ul className="space-y-2 text-left text-xs">
                      {reports.slice(0, 8).map((item, i) => {
                        const reportId = item.report_id || item.id || item.reference_id;
                        return (
                          <li key={i} className="rounded-lg bg-slate-50 p-2 border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-800">{item.channel || 'Report'}</span>
                              {item.is_disputed ? (
                                <span className="rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                                  ⚠️ Disputed
                                </span>
                              ) : reportId && localStorage.getItem('cyberforge_pov') !== 'admin' ? (
                                <button
                                  type="button"
                                  onClick={() => onDisputeReport ? onDisputeReport(reportId) : onDispute()}
                                  className="rounded bg-white border border-slate-300 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-1"
                                >
                                  Dispute Report
                                </button>
                              ) : null}
                            </div>
                            <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-2">
                              {item.scam_type ? <span>Type: <b>{item.scam_type}</b></span> : null}
                              {item.pincode ? <span>PIN: <b>{item.pincode}</b></span> : null}
                              <span className="text-slate-400">{fmtDate(item.occurred_at)}</span>
                            </div>
                            {reportId ? (
                              <div className="text-[10px] text-slate-400 font-mono select-all">
                                Ref ID: {reportId}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </Row>
                ) : null}
              </>
            );
          }
          return null;
        })()}
      </dl>

      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-1 text-center">
        <p className="text-xs font-medium text-slate-600">
          🔒 Reports are anonymous. Reporter identities and exact locations are not displayed.
        </p>
        <p className="text-[11px] text-slate-400">
          ℹ️ Disputes apply to individual reports, not the entire phone number or identifier.
        </p>
      </div>

      {(verdict === KNOWN_SCAM || verdict === SUSPICIOUS) && localStorage.getItem('cyberforge_pov') !== 'admin' ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-center">
          <button
            type="button"
            onClick={onDispute}
            className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            {get(lang, 'navDispute')}
          </button>
        </div>
      ) : null}
    </section>
  );
}
