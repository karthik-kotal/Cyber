import { useCallback } from 'react';
import { get, type Lang } from '../i18n/strings';
import { getAlerts } from '../services/api';
import type { AlertsResponse } from '../types/api';
import { useApiData } from '../hooks/useApiData';
import { Loading } from '../components/states/Loading';
import { ErrorState } from '../components/states/ErrorState';
import { EmptyState } from '../components/states/EmptyState';

export function AlertsPage({ lang }: { lang: Lang }): React.JSX.Element {
  const fetcher = useCallback(
    (signal: AbortSignal): Promise<AlertsResponse> => getAlerts({ signal }),
    [],
  );
  const { data, loading, error, refresh } = useApiData<AlertsResponse>(fetcher, []);

  if (loading) {
    return <Loading label={get(lang, 'loading')} />;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <ErrorState error={error} onRetry={refresh} retryLabel={get(lang, 'tryAgain')} />
      </div>
    );
  }
  if (!data || data.alerts.length === 0) {
    return (
      <EmptyState title={get(lang, 'empty')} hint={get(lang, 'alertsEmptyHint')} icon="📢" />
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{get(lang, 'alertsTitle')}</h2>
      {data.alerts.map((alert) => (
        <div key={alert.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {alert.type}
            </span>
            <span className="text-xs text-slate-400">{alert.pincode}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">{alert.title}</h3>
          <p className="mt-1 text-sm text-slate-600">{alert.body}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {alert.scam_type} \u00b7 {alert.created_at}
          </p>
        </div>
      ))}
    </section>
  );
}
