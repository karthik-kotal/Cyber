import { useState, useEffect } from 'react';
import { useLicense } from '../context/LicenseContext';
import { get, type Lang } from '../i18n/strings';

export function LicensePage({ lang }: { lang: Lang }): React.JSX.Element {
  const { state, info, renew, recheck } = useLicense();
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Live countdown timer for license expiry
  useEffect(() => {
    function updateCountdown() {
      if (!info?.expires_at) {
        setTimeLeft('');
        return;
      }
      try {
        const expTime = new Date(info.expires_at).getTime();
        const now = Date.now();
        const diffMs = expTime - now;

        if (diffMs <= 0) {
          setTimeLeft('Expired');
        } else {
          const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
          const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
          const seconds = Math.floor((diffMs / 1000) % 60);

          if (days > 0) {
            setTimeLeft(`${days}d ${hours}h remaining`);
          } else if (hours > 0) {
            setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`);
          } else {
            setTimeLeft(`${minutes}m ${seconds}s remaining`);
          }
        }
      } catch {
        setTimeLeft('');
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [info?.expires_at]);

  async function handleActivate(keyToUse?: string): Promise<void> {
    const targetKey = (keyToUse !== undefined ? keyToUse : licenseKeyInput).trim();
    if (!targetKey) {
      setErrorMessage('Please enter or select a license key to activate.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const err = await renew(targetKey);
    setBusy(false);

    if (err === null) {
      setSuccessMessage('License successfully activated! Valid without server restart.');
      setLicenseKeyInput('');
      recheck();
    } else {
      setErrorMessage(err.message || 'License activation failed. Please check key format.');
    }
  }

  let statusBadge: React.JSX.Element;
  switch (state) {
    case 'valid':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
          <span aria-hidden="true">✅</span> {get(lang, 'licenseValid')}
        </span>
      );
      break;
    case 'expired':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-300">
          <span aria-hidden="true">🔒</span> {get(lang, 'licenseExpired')}
        </span>
      );
      break;
    case 'not_activated':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300">
          <span aria-hidden="true">🔒</span> License Not Activated
        </span>
      );
      break;
    case 'invalid':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 border border-rose-300">
          <span aria-hidden="true">❌</span> Invalid License
        </span>
      );
      break;
    case 'checking':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-300">
          <span aria-hidden="true">⏳</span> Checking License…
        </span>
      );
      break;
    case 'degraded':
    default:
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300">
          <span aria-hidden="true">⚠️</span> Degraded / Offline
        </span>
      );
      break;
  }

  return (
    <section className="space-y-6">
      {/* Card 1: Active License Status */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-slate-900">{get(lang, 'navLicense')} Status</h2>
          {statusBadge}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-slate-100 pt-3">
          <div>
            <span className="text-xs font-medium text-slate-500">Licensee / Organization</span>
            <p className="font-semibold text-slate-800 mt-0.5">{info?.licensee || info?.license_hint || 'Demo Bank'}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Expiration Timestamp</span>
            <p className="font-mono text-xs text-slate-800 mt-0.5 break-all">
              {info?.expires_at ? new Date(info.expires_at).toLocaleString() : '—'}
            </p>
          </div>
          {timeLeft ? (
            <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">Remaining Time</span>
              <span className={`text-xs font-bold font-mono ${state === 'expired' ? 'text-rose-600' : 'text-blue-600'}`}>
                {timeLeft}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={recheck}
            className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
          >
            ↻ Refresh Status
          </button>
        </div>
      </div>

      {/* Card 2: Hackathon Demo Quick Switcher */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
            <span>⚡</span> Quick Demo Switcher (Hackathon Judging)
          </h3>
          <p className="text-xs text-indigo-700 mt-0.5">
            Switch between short (5-minute) and long (1-year) licenses live with zero server restarts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => handleActivate('DEMO:SHORT_5M')}
            className="flex flex-col items-start p-3 bg-white border border-indigo-200 rounded-xl hover:bg-indigo-50/80 hover:border-indigo-300 transition-colors text-left shadow-sm disabled:opacity-50"
          >
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1">
              ⏱️ 5-Minute License
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              Expires in 5 minutes for the live hackathon demo
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => handleActivate('DEMO:LONG_1Y')}
            className="flex flex-col items-start p-3 bg-white border border-emerald-200 rounded-xl hover:bg-emerald-50/80 hover:border-emerald-300 transition-colors text-left shadow-sm disabled:opacity-50"
          >
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
              🛡️ 1-Year Long License
            </span>
            <span className="text-[11px] text-slate-500 mt-1">
              Restores full active status
            </span>
          </button>
        </div>
      </div>

      {/* Card 3: Manual License Activation / Renewal Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Activate / Renew License Key</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter your license key string (`licensee:expires_at:signature`) or JSON payload.
          </p>
        </div>

        {successMessage ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium flex items-center justify-between">
            <span>✅ {successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium flex items-center justify-between">
            <span>❌ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-700 hover:text-rose-900 text-sm font-bold ml-2"
            >
              ×
            </button>
          </div>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleActivate();
          }}
          className="space-y-3"
        >
          <div>
            <label htmlFor="licenseKeyInput" className="block text-xs font-semibold text-slate-700 mb-1">
              License Key
            </label>
            <textarea
              id="licenseKeyInput"
              rows={3}
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.target.value)}
              placeholder="Enter renewal key (e.g. Gandadagudi) or paste license key string"
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[11px] text-slate-400">
              Zero downtime: reloads dynamically in memory without restarting uvicorn.
            </span>
            <button
              type="submit"
              disabled={busy || !licenseKeyInput.trim()}
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {busy ? 'Activating…' : 'Activate License'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
