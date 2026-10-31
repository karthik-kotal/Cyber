import { Link, NavLink } from 'react-router-dom';
import { get, type Lang } from '../i18n/strings';
import { BottomNav } from './BottomNav';
import { BackendStatusBanner } from './BackendStatusBanner';

export interface LayoutProps {
  lang: Lang;
  onToggleLang: () => void;
  title: string;
  children: React.ReactNode;
}

/** App shell: header (title + language toggle + secondary links) + content +
 *  primary bottom navigation. Mobile-first; max width on desktop. */
export function Layout({ lang, onToggleLang, title, children }: LayoutProps): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-50 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">
              {get(lang, 'app')}
              <span aria-hidden="true" className="ml-1.5 text-xs opacity-70">🛡️</span>
            </p>
            <p className="truncate text-[11px] text-slate-300">{get(lang, 'appTagline')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/license"
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              {get(lang, 'navLicense')}
            </Link>
            <button
              type="button"
              onClick={onToggleLang}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Switch language"
            >
              {lang === 'en' ? <span lang="hi">हिं</span> : 'EN'}
            </button>
          </div>
        </div>
        {/* Secondary links: Alerts and Dispute */}
        <nav
          aria-label="Secondary"
          className="mx-auto flex max-w-lg gap-4 px-4 pb-1.5 text-xs text-slate-300"
        >
          <NavLink
            to="/alerts"
            className={({ isActive }) =>
              `hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                isActive ? 'font-semibold text-white' : ''
              }`
            }
          >
            {get(lang, 'navAlerts')}
          </NavLink>
          <NavLink
            to="/dispute"
            className={({ isActive }) =>
              `hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${
                isActive ? 'font-semibold text-white' : ''
              }`
            }
          >
            {get(lang, 'navDispute')}
          </NavLink>
        </nav>
      </header>

      <BackendStatusBanner lang={lang} />

      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 pb-24 pt-4">
        <h1 className="mb-4 text-xl font-extrabold tracking-tight">{title || get(lang, 'app')}</h1>
        {children}
      </main>

      <BottomNav lang={lang} />
    </div>
  );
}
