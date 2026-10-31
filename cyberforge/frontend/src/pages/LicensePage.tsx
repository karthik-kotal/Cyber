import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useLicense } from '../context/LicenseContext';
import { resetDemoLicense } from '../services/api';
import { get, type Lang } from '../i18n/strings';
import type { UserPOV } from '../types/api';

export function LicensePage({ lang }: { lang: Lang }): React.JSX.Element {
  const currentPov = (localStorage.getItem('cyberforge_pov') || 'normal') as UserPOV;

  // Normal users do not have a license page
  if (currentPov === 'normal') {
    return <Navigate to="/report" replace />;
  }

  const { state, info, recheck } = useLicense();
  const [busy, setBusy] = useState(false);
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

  const handleRestartDemo = async () => {
    setBusy(true);
    try {
      await resetDemoLicense();
      recheck();
    } finally {
      setBusy(false);
    }
  };

  let statusBadge: React.JSX.Element;
  switch (state) {
    case 'valid':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
          <span aria-hidden="true">✓</span> {get(lang, 'licenseValid')}
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
          <span aria-hidden="true">⚠️</span> Invalid License
        </span>
      );
      break;
    case 'checking':
      statusBadge = (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-300">
          <span aria-hidden="true">⏳</span> Checking License...
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
      {/* Active License Status Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {currentPov === 'demo' ? 'Demo Sandbox License' : 'Enterprise License Status'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentPov === 'demo'
                ? 'Evaluation environment • Strictly 5-minute sandbox duration'
                : 'Production environment • Backed by 365-day HMAC-SHA256 license'}
            </p>
          </div>
          {statusBadge}
        </div>

        <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block font-medium">Licensee / Organization</span>
            <span className="font-bold text-slate-900 text-sm">
              {info?.licensee || (currentPov === 'demo' ? 'Demo User' : 'Demo Bank')}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block font-medium">Expiration Timestamp</span>
            <span className="font-mono text-slate-800 text-xs">
              {info?.expires_at ? new Date(info.expires_at).toLocaleString() : '—'}
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 border border-slate-100 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">Remaining Time</span>
          <span className="text-xs font-mono font-bold text-blue-700">
            {timeLeft || 'Calculating...'}
          </span>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={recheck}
            className="text-xs text-slate-600 hover:text-slate-900 underline font-medium"
          >
            ↻ Refresh Status
          </button>
        </div>
      </div>

      {/* Demo Actions (Only for Demo User, with NO 365-day switch) */}
      {currentPov === 'demo' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm space-y-3">
          <div>
            <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
              <span>⏱️</span> Demo Timer Controls
            </h3>
            <p className="text-xs text-amber-800 mt-0.5">
              Demo evaluation is strictly constrained to 5 minutes. When expired, the system locks and can be renewed by entering <strong className="text-amber-950">Gandadagudi</strong>.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleRestartDemo}
              className="rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50 transition shadow-sm"
            >
              {busy ? 'Resetting...' : '⏱️ Restart 5-Minute Evaluation'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
