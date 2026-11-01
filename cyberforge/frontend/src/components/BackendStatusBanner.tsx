import { useState } from 'react';
import { useApiData, type AsyncState } from '../hooks/useApiData';
import { getHealth, apiBaseUrl, setCustomApiBaseUrl, DEFAULT_DEVICE_API_BASE_URL } from '../services/api';
import { get } from '../i18n/strings';
import type { HealthResponse } from '../types/api';

/**
 * Proves the backend responds. Shown as a small banner on every screen so
 * deploy checks (Phase B1) are visible in the UI itself.
 * Supports tap-to-configure server host for mobile APK testing.
 */
export function BackendStatusBanner({ lang }: { lang: 'en' | 'hi' }): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const currentBase = apiBaseUrl();
  const [inputUrl, setInputUrl] = useState(currentBase || DEFAULT_DEVICE_API_BASE_URL);

  const state: AsyncState<HealthResponse | null> = useApiData<HealthResponse | null>(
    async (signal) => {
      const health = await getHealth({ signal, timeoutMs: 5000 });
      return health;
    },
    [currentBase]
  );

  const { data, loading, error, refresh } = state;

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

  const handleSave = () => {
    setCustomApiBaseUrl(inputUrl.trim());
    setEditing(false);
    refresh();
  };

  const handleReset = () => {
    setCustomApiBaseUrl(null);
    setInputUrl(DEFAULT_DEVICE_API_BASE_URL);
    setEditing(false);
    refresh();
  };

  return (
    <div className="w-full">
      <div
        role="status"
        aria-live="polite"
        data-testid="backend-status"
        onClick={() => setEditing(!editing)}
        className={`flex items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-medium cursor-pointer transition select-none ${tone}`}
        title="Tap to view or change backend server URL"
      >
        <span>{text}</span>
        {currentBase ? (
          <span className="font-mono text-[10px] opacity-75">({currentBase})</span>
        ) : null}
        <span className="text-[10px] underline ml-1">{editing ? '▲ Close' : '⚙ Server'}</span>
      </div>

      {editing ? (
        <div className="border-b border-slate-300 bg-slate-50 px-4 py-3 text-xs shadow-inner">
          <div className="mx-auto max-w-md space-y-2">
            <p className="font-semibold text-slate-800">Configure Backend Server Address:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://192.168.x.x:8000"
                className="flex-1 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900 focus:border-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSave}
                className="rounded bg-slate-800 px-3 py-1 font-semibold text-white hover:bg-slate-900"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-100"
              >
                Reset
              </button>
            </div>
            {error ? (
              <p className="text-[11px] text-rose-600 font-mono break-all">
                {error.detail || error.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
