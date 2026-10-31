import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useCallback } from 'react';
import { Layout } from './components/Layout';
import { LicenseGate } from './components/LicenseGate';
import { useLang } from './hooks/useLang';
import { get } from './i18n/strings';
import { ReportPage } from './pages/ReportPage';
import { LookupPage } from './pages/LookupPage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { ChallengePage } from './pages/ChallengePage';
import { LicensePage } from './pages/LicensePage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App(): React.JSX.Element {
  const [lang, setLang] = useLang();

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLang]);

  return (
    <HashRouter>
      <LayoutWithRoutes lang={lang} onToggleLang={toggleLang} />
    </HashRouter>
  );
}

function LayoutWithRoutes({
  lang,
  onToggleLang,
}: {
  lang: ReturnType<typeof useLang>[0];
  onToggleLang: () => void;
}): React.JSX.Element {
  return (
    <>
      <LicenseGate lang={lang} />
      <Routes>
      <Route path="/" element={<Navigate to="/report" replace />} />
      <Route
        path="/report"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'reportTitle')}>
            <ReportPage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="/lookup"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'lookupTitle')}>
            <LookupPage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="/map"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'mapTitle')}>
            <MapPage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="/alerts"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'alertsTitle')}>
            <AlertsPage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="/dispute"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'challengeTitle')}>
            <ChallengePage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="/license"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'navLicense')}>
            <LicensePage lang={lang} />
          </Layout>
        }
      />
      <Route
        path="*"
        element={
          <Layout lang={lang} onToggleLang={onToggleLang} title="Not found">
            <NotFoundPage lang={lang} />
          </Layout>
        }
      />
    </Routes>
    </>
  );
}
