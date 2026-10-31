import { get, type Lang } from '../i18n/strings';
import { Link } from 'react-router-dom';

export function NotFoundPage({ lang }: { lang: Lang }): React.JSX.Element {
  return (
    <section className="flex flex-col items-center justify-center py-12 text-center">
      <span aria-hidden="true" className="text-6xl opacity-40">404</span>
      <h2 className="mt-4 text-lg font-bold text-slate-900">Not found</h2>
      <p className="mt-1 text-sm text-slate-500">The page you are looking for does not exist.</p>
      <Link
        to="/report"
        className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"
      >
        {get(lang, 'tryAgain')}
      </Link>
    </section>
  );
}
