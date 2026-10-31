import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, type Lang } from '../i18n/strings';
import { challengeReport, ApiError } from '../services/api';
import { ErrorState } from '../components/states/ErrorState';

export function ChallengePage({ lang }: { lang: Lang }): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const [reportId, setReportId] = useState(searchParams.get('reportId') || searchParams.get('ref') || '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);
  const [confirmedId, setConfirmedId] = useState('');

  useEffect(() => {
    const qId = searchParams.get('reportId') || searchParams.get('ref');
    if (qId && !reportId) {
      setReportId(qId);
    }
  }, [searchParams, reportId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);
      setDone(false);

      const cleanId = reportId.trim();
      const cleanReason = reason.trim();

      if (!cleanId || !cleanReason) {
        setError(new ApiError('VALIDATION', get(lang, 'challengeInvalid')));
        return;
      }

      // Validate that user didn't enter a phone number or identifier
      const digitsOnly = cleanId.replace(/[\s\-\(\)\.]+/g, '');
      if (
        (digitsOnly.length >= 10 && digitsOnly.length <= 13 && /^[0-9]+$/.test(digitsOnly)) ||
        cleanId.toUpperCase().startsWith('ACC:') ||
        cleanId.toUpperCase().startsWith('IFSC:') ||
        cleanId.includes('@') ||
        cleanId.startsWith('http://') ||
        cleanId.startsWith('https://') ||
        cleanId.includes('wa.me')
      ) {
        setError(
          new ApiError(
            'VALIDATION',
            'Disputes must target an individual report Reference ID, not a phone number, bank account, UPI ID, or URL.',
          ),
        );
        return;
      }

      setBusy(true);
      try {
        await challengeReport(cleanId, { reason: cleanReason });
        setConfirmedId(cleanId);
        setDone(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('UNKNOWN', 'Dispute could not be submitted. Please verify the report Reference ID.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [reportId, reason, lang],
  );

  if (done) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
        <span aria-hidden="true" className="text-4xl">✅</span>
        <h2 className="mt-2 text-lg font-bold text-emerald-900">{get(lang, 'challengeOk')}</h2>
        <p className="text-xs text-emerald-800">
          Dispute registered for report Reference ID: <br />
          <span className="font-mono font-bold text-sm select-all">{confirmedId}</span>
        </p>
        <p className="text-xs text-slate-600">
          The individual report is now marked as under review. The original report and evidence are safely preserved.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setReportId('');
            setReason('');
            setError(null);
            setConfirmedId('');
          }}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
        >
          {get(lang, 'tryAgain')}
        </button>
      </section>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900">
        <p className="font-semibold mb-1">ℹ️ Dispute Individual Report</p>
        <p className="text-slate-700 leading-relaxed">
          Disputes apply to individual reports, not the entire phone number or identifier.
          Enter the exact <strong>Report Reference ID</strong> generated upon submission or found in the Lookup report details.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="challenge-report-id" className="mb-2 block text-sm font-semibold text-slate-900">
          Report Reference ID
        </label>
        <input
          id="challenge-report-id"
          name="reportId"
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={reportId}
          onChange={(e) => setReportId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          placeholder="e.g. 863ac3e0-8c31-4589-82d8-05208ae83f4a"
          required
          aria-required="true"
        />
        <p className="mt-1.5 text-[11px] text-slate-500">
          Do not enter phone numbers, bank accounts, or URLs here.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="challenge-reason" className="mb-2 block text-sm font-semibold text-slate-900">
          {get(lang, 'reasonLabel')}
        </label>
        <textarea
          id="challenge-reason"
          name="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          placeholder="Why is this specific report incorrect?"
          required
          aria-required="true"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => setError(null)} retryLabel={get(lang, 'tryAgain')} />
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
      >
        {busy ? get(lang, 'submitting') : get(lang, 'navDispute')}
      </button>
    </form>
  );
}
