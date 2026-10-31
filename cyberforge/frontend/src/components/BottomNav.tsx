import { NavLink } from 'react-router-dom';
import { get, type Lang, type StringKey } from '../i18n/strings';

export interface NavItem {
  to: string;
  labelKey: StringKey;
  icon: string;
  end?: boolean;
}

/** Primary mobile bottom navigation: Report / Check / Map. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/report', labelKey: 'navReport', icon: '⚠️' },
  { to: '/lookup', labelKey: 'navLookup', icon: '🔍', end: true },
  { to: '/map', labelKey: 'navMap', icon: '🗺️' },
];

export function BottomNav({ lang }: { lang: Lang }): React.JSX.Element {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto flex max-w-lg">
        {PRIMARY_NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 ${
                  isActive ? 'text-slate-900' : 'text-slate-500'
                }`
              }
            >
              <span aria-hidden="true" className="text-lg leading-none">{item.icon}</span>
              {get(lang, item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
