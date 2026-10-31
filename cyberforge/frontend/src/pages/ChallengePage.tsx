import { useCallback, useState } from 'react';
import { get, type Lang } from '../i18n/strings';
import { challengeReport, ApiError } from '../services/api';
import { ErrorState } from '../components/states/ErrorState';

export function ChallengePage({ lang }: { lang: Lang }): React.JSX.Element {
  const [reportId, setReportId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent): Promise<void> => {
      e.preventDefault();
      setError(null);
      setDone(false);
      if (!reportId.trim() || !reason.trim()) {
        setError(new ApiError('VALIDATION', get(lang, 'challengeInvalid')));
        return;
      }
      setBusy(true);
      try {
        // Frontend never alters the verdict; the backend decides the outcome.
        await challengeReport(reportId.trim(), { reason: reason.trim() });
        setDone(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err
            : new ApiError('UNKNOWN', 'Dispute could not be submitted. Please try again.'),
        );
      } finally {
        setBusy(false);
      }
    },
    [reportId, reason, lang],
  );

  if (done) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <span aria-hidden="true" className="text-4xl">✅</span>
        <h2 className="mt-2 text-lg font-bold text-emerald-900">{get(lang, 'challengeOk')}</h2>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setReportId('');
            setReason('');
            setError(null);
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
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="challenge-report-id" className="mb-2 block text-sm font-semibold text-slate-900">
          Report ID
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
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          placeholder="Paste the report ID"
          required
          aria-required="true"
        />
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
          placeholder="Why is this report wrong?"
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
