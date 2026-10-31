import { useCallback, useState } from 'react';
import type { Lang } from '../i18n/strings';

const STORAGE_KEY = 'csm.lang';

/** Language preference hook. Defaults to English, remembers choice. */
export function useLang(): [Lang, (lang: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'hi' || saved === 'en') return saved;
    } catch {
      // storage unavailable (private mode); ignore
    }
    return 'en';
  });

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  return [lang, setLang];
}
