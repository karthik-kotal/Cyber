import { useLicense } from '../context/LicenseContext';
import { get, type Lang } from '../i18n/strings';

export function LicensePage({ lang }: { lang: Lang }): React.JSX.Element {
  const { state, info } = useLicense();

  let statusText: string;
  let statusIcon: string;
  switch (state) {
    case 'valid':
      statusText = get(lang, 'licenseValid');
      statusIcon = '✅';
      break;
    case 'expired':
      statusText = get(lang, 'licenseExpired');
      statusIcon = '🔒';
      break;
    case 'not_activated':
      statusText = 'License not activated yet.';
      statusIcon = '🔒';
      break;
    case 'invalid':
      statusText = 'The license is not valid.';
      statusIcon = '🔒';
      break;
    case 'checking':
      statusText = 'Checking license…';
      statusIcon = '⏳';
      break;
    case 'degraded':
    default:
      statusText = 'Could not verify license status right now.';
      statusIcon = '⚠️';
      break;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">{get(lang, 'navLicense')}</h2>
        <div className="mt-2 flex items-center gap-3">
          <span aria-hidden="true" className="text-2xl">{statusIcon}</span>
          <p className="text-sm text-slate-900">{statusText}</p>
        </div>
        {info && info.expires_at ? (
          <p className="mt-2 text-xs text-slate-500">Expires: {info.expires_at}</p>
        ) : null}
        {info && info.license_hint ? (
          <p className="mt-1 text-xs text-slate-400 truncate">Key hint: {info.license_hint}</p>
        ) : null}
      </div>
      <p className="text-xs text-slate-500">
        License enforcement is handled by the backend. This screen only reflects the backend\u2019s
        license response; no key is stored in the frontend.
      </p>
    </section>
  );
}
