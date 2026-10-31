import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDemoLicenseStatus, resetDemoLicense } from '../services/api';

export function DemoBanner({ onSwitchPOV }: { onSwitchPOV: () => void }): React.JSX.Element | null {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [resetting, setResetting] = useState(false);

  const checkStatus = useCallback(() => {
    getDemoLicenseStatus()
      .then((res) => {
        setRemaining(res.remaining_seconds ?? null);
        setIsExpired(!res.active || (res.remaining_seconds ?? 0) <= 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const recheckInterval = window.setInterval(checkStatus, 15000);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(recheckInterval);
    };
  }, [checkStatus]);

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetDemoLicense();
      checkStatus();
    } finally {
      setResetting(false);
    }
  };

  const formatTimer = (seconds: number | null) => {
    if (seconds === null) return 'Checking...';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <aside
      aria-label="Demo Mode Notice"
      className={`border-b px-4 py-2 text-xs font-medium transition-colors ${
        isExpired
          ? 'bg-rose-950/90 border-rose-800 text-rose-200'
          : 'bg-amber-950/90 border-amber-800 text-amber-200'
      }`}
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <span className="h-2 w-2 rounded-full animate-pulse bg-current" />
          <span className="font-bold uppercase tracking-wider">Demo Sandbox</span>
          <span className="text-slate-400">|</span>
          <span className="font-mono">
            {isExpired ? 'EXPIRED (Use Gandadagudi)' : formatTimer(remaining)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/30 transition"
          >
            {resetting ? 'Resetting...' : 'Reset 5m'}
          </button>
          <Link
            to="/admin"
            className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 transition"
          >
            Console
          </Link>
          <button
            type="button"
            onClick={onSwitchPOV}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Exit POV
          </button>
        </div>
      </div>
    </aside>
  );
}
