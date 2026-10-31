import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, type Lang } from '../i18n/strings';
import { lookup } from '../services/api';
import type { LookupResponse } from '../types/api';
import { useApiData } from '../hooks/useApiData';
import { Loading } from '../components/states/Loading';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';
import { LookupResultCard } from '../components/LookupResultCard';

export function LookupPage({ lang }: { lang: Lang }): React.JSX.Element {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const { data, loading, error, refresh } = useApiData<LookupResponse>(
    useCallback(
      (signal: AbortSignal): Promise<LookupResponse> => lookup(identifier, { signal }),
      [identifier],
    ),
    [identifier],
  );

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    refresh();
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label htmlFor="lookup-identifier" className="mb-2 block text-sm font-semibold text-slate-900">
          {get(lang, 'lookupLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="lookup-identifier"
            name="identifier"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
            required
            aria-required="true"
          />
          <button
            type="submit"
            disabled={loading || !identifier.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
          >
            {get(lang, 'lookupButton')}
          </button>
        </div>
      </div>

      {loading ? (
        <Loading label={get(lang, 'loading')} />
      ) : error ? (
        <ErrorState error={error} onRetry={refresh} retryLabel={get(lang, 'tryAgain')} />
      ) : data ? (
        <section>
          <LookupResultCard
            result={data}
            lang={lang}
            onDispute={() => navigate('/dispute')}
            onDisputeReport={(repId) => navigate(`/dispute?reportId=${encodeURIComponent(repId)}`)}
          />
        </section>
      ) : (
        <EmptyState title={get(lang, 'empty')} hint="Enter an identifier above to check." icon="🔍" />
      )}
    </form>
  );
}
