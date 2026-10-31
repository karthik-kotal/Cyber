import { Link, NavLink, useNavigate } from 'react-router-dom';
import { get, type Lang } from '../i18n/strings';
import { BottomNav } from './BottomNav';
import { BackendStatusBanner } from './BackendStatusBanner';
import { DemoBanner } from './DemoBanner';
import type { UserPOV } from '../types/api';

export interface LayoutProps {
  lang: Lang;
  onToggleLang: () => void;
  title: string;
  children: React.ReactNode;
}

/** App shell: header (title + language toggle + POV switch) + content +
 *  primary bottom navigation. Mobile-first; max width on desktop. */
export function Layout({ lang, onToggleLang, title, children }: LayoutProps): React.JSX.Element {
  const navigate = useNavigate();
  const currentPov = (localStorage.getItem('cyberforge_pov') || 'normal') as UserPOV;

  const handleSwitchPOV = () => {
    localStorage.removeItem('cyberforge_pov');
    localStorage.removeItem('cyberforge_admin_token');
    navigate('/pov');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
      {/* Demo Timer Banner if in Demo POV */}
      {currentPov === 'demo' && <DemoBanner onSwitchPOV={handleSwitchPOV} />}

      <header className="sticky top-0 z-50 bg-slate-900 text-white shadow">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold leading-tight">
                {get(lang, 'app')}
              </p>
              <span
                className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                  currentPov === 'admin'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : currentPov === 'demo'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                {currentPov}
              </span>
            </div>
            <p className="truncate text-[11px] text-slate-300">{get(lang, 'appTagline')}</p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Admin Console shortcut for admin or demo */}
            {(currentPov === 'admin' || currentPov === 'demo') && (
              <Link
                to="/admin"
                className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700"
              >
                Console
              </Link>
            )}

            {/* License management: Only visible to Administrator and Demo User */}
            {(currentPov === 'admin' || currentPov === 'demo') && (
              <Link
                to="/license"
                className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                {get(lang, 'navLicense')}
              </Link>
            )}

            {/* Switch POV Button */}
            <button
              type="button"
              onClick={handleSwitchPOV}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
              title="Switch between Administrator, Normal User, and Demo User"
            >
              POV ▾
            </button>

            {/* Language toggle */}
            <button
              type="button"
              onClick={onToggleLang}
              className="rounded-lg border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              aria-label="Switch language"
            >
              {lang === 'en' ? 'हिन्दी' : 'EN'}
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
