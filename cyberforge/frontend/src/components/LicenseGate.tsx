import { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { ApiError, resetDemoLicense } from '../services/api';
import { get, type Lang } from '../i18n/strings';

/**
 * Full-screen license gate.
 * - Normal User POV: Never shown (direct unrestricted access).
 * - Demo User POV: Shown only when the 5-minute demo license expires.
 * - Administrator POV: Shown only if the 365-day license expires.
 */
export function LicenseGate({ lang }: { lang: Lang }): React.JSX.Element | null {
  const pov = localStorage.getItem('cyberforge_pov') || 'normal';

  // Normal users are completely immune to license expiration
  if (pov === 'normal') {
    return null;
  }

  const { state, info, renew, recheck } = useLicense();

  if (state === 'checking') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 text-white">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-white"
        />
        <p className="mt-4 text-sm text-slate-300">Checking license status...</p>
      </div>
    );
  }

  if (state === 'valid' || state === 'degraded') {
    return null; // app continues
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 px-6 text-center text-white">
      <span aria-hidden="true" className="text-5xl">🔒</span>
      <h1 className="mt-4 text-lg font-bold">
        {pov === 'demo' ? 'Demo License Expired' : get(lang, 'licenseExpired')}
      </h1>

      <p className="mt-2 text-xs max-w-sm text-slate-300">
        {pov === 'demo'
          ? 'The 5-minute demo evaluation period has elapsed. Enter the master key "Gandadagudi" or restart demo to unblock.'
          : 'Your enterprise license has expired. Please renew your cryptographic license.'}
      </p>

      {state === 'expired' && info?.expires_at ? (
        <p className="mt-1 text-[11px] font-mono text-slate-400">Expired: {info.expires_at}</p>
      ) : null}

      <RenewalForm lang={lang} onRenewed={recheck} renewFn={renew} />

      <div className="mt-6 flex items-center gap-3">
        {pov === 'demo' && (
          <button
            type="button"
            onClick={async () => {
              await resetDemoLicense();
              recheck();
            }}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition"
          >
            Restart 5-Min Demo
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('cyberforge_pov');
            window.location.hash = '#/pov';
            window.location.reload();
          }}
          className="text-xs text-slate-400 underline hover:text-white"
        >
          Switch POV / Return to Selection
        </button>
      </div>
    </div>
  );
}

function RenewalForm({
  lang,
  onRenewed,
  renewFn,
}: {
  lang: Lang;
  onRenewed: () => void;
  renewFn: (key: string) => Promise<ApiError | null>;
}): React.JSX.Element {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await renewFn(key);
    setBusy(false);
    if (err === null) {
      setDone(true);
      onRenewed();
    } else {
      setError(err);
    }
  }

  if (done) {
    return (
      <p className="mt-6 rounded-xl bg-emerald-800/60 px-4 py-3 text-sm font-medium text-emerald-100">
        {get(lang, 'renewOk')}
      </p>
    );
  }

  return (
    <form noValidate onSubmit={(e) => void submit(e)} className="mt-6 w-full max-w-sm">
      <label htmlFor="license-key" className="mb-1 block text-sm font-medium text-slate-200">
        Enter Master Renewal Key: <strong className="text-amber-400">Gandadagudi</strong>
      </label>
      <input
        id="license-key"
        name="license-key"
        type="text"
        inputMode="text"
        autoComplete="off"
        spellCheck={false}
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Enter renewal key (e.g. Gandadagudi)"
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      />
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error.detail ?? error.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-slate-900 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        {busy ? 'Verifying...' : get(lang, 'renew')}
      </button>
    </form>
  );
}
