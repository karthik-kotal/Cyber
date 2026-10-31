import { useApiData, type AsyncState } from '../hooks/useApiData';
import { getHealth } from '../services/api';
import { get } from '../i18n/strings';
import type { HealthResponse } from '../types/api';

/**
 * Proves the backend responds. Shown as a small banner on every screen so
 * deploy checks (Phase B1) are visible in the UI itself.
 */
export function BackendStatusBanner({ lang }: { lang: 'en' | 'hi' }): React.JSX.Element {
  const state: AsyncState<HealthResponse | null> = useApiData<HealthResponse | null>(
    async (signal) => {
      const health = await getHealth({ signal, timeoutMs: 5000 });
      return health;
    },
    []
  );

  const { data, loading, error } = state;

  let tone = 'bg-slate-200 text-slate-700';
  let text = loading ? get(lang, 'backendChecking') : get(lang, 'backendDown');
  if (loading) tone = 'bg-slate-200 text-slate-700';
  if (!loading && data) {
    tone = 'bg-emerald-100 text-emerald-800';
    text = get(lang, 'backendOk');
  }
  if (!loading && error && data === null) {
    tone = 'bg-amber-100 text-amber-900';
    text = get(lang, 'backendDown');
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="backend-status"
      className={`px-4 py-1.5 text-center text-xs font-medium ${tone}`}
    >
      {text}
    </div>
  );
}
