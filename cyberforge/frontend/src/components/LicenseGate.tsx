import { useState } from 'react';
import { useLicense } from '../context/LicenseContext';
import { ApiError } from '../services/api';
import { get, type Lang } from '../i18n/strings';

/**
 * Full-screen license gate. Backend remains the enforcement point; this screen
 * only reflects backend license responses and offers the documented renewal
 * flow (no restart required).
 */
export function LicenseGate({ lang }: { lang: Lang }): React.JSX.Element | null {
  const { state, info, renew, recheck } = useLicense();

  if (state === 'checking') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 text-white">
        <div
          aria-hidden="true"
          className="h-10 w-10 animate-spin rounded-full border-4 border-slate-600 border-t-white"
        />
        <p className="mt-4 text-sm text-slate-300">License check…</p>
      </div>
    );
  }

  if (state === 'valid' || state === 'degraded') {
    return null; // app continues; degraded errors surface via normal error UIs
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900 px-6 text-center text-white">
      <span aria-hidden="true" className="text-5xl">🔒</span>
      <h1 className="mt-4 text-lg font-bold">{get(lang, 'licenseExpired')}</h1>
      {state === 'expired' && info?.expires_at ? (
        <p className="mt-1 text-xs text-slate-400">Expired: {info.expires_at}</p>
      ) : null}
      {state === 'not_activated' ? (
        <p className="mt-1 text-xs text-slate-400">License not activated yet.</p>
      ) : null}
      {state === 'invalid' ? (
        <p className="mt-1 text-xs text-slate-400">The license is not valid.</p>
      ) : null}

      <RenewalForm lang={lang} onRenewed={recheck} renewFn={renew} />
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
        {get(lang, 'enterKey')}
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
        {busy ? '…' : get(lang, 'renew')}
      </button>
    </form>
  );
}
