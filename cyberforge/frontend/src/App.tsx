import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useCallback } from 'react';
import { Layout } from './components/Layout';
import { LicenseGate } from './components/LicenseGate';
import { useLang } from './hooks/useLang';
import { usePOV } from './hooks/usePOV';
import { get } from './i18n/strings';
import { EntryPage } from './pages/EntryPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ReportPage } from './pages/ReportPage';
import { LookupPage } from './pages/LookupPage';
import { MapPage } from './pages/MapPage';
import { AlertsPage } from './pages/AlertsPage';
import { ChallengePage } from './pages/ChallengePage';
import { LicensePage } from './pages/LicensePage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App(): React.JSX.Element {
  const [lang, setLang] = useLang();
  const { pov, setPOV } = usePOV();

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'hi' : 'en');
  }, [lang, setLang]);

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <LayoutWithRoutes
        lang={lang}
        onToggleLang={toggleLang}
        pov={pov}
        onSelectPOV={setPOV}
      />
    </HashRouter>
  );
}

function LayoutWithRoutes({
  lang,
  onToggleLang,
  pov,
  onSelectPOV,
}: {
  lang: ReturnType<typeof useLang>[0];
  onToggleLang: () => void;
  pov: ReturnType<typeof usePOV>['pov'];
  onSelectPOV: ReturnType<typeof usePOV>['setPOV'];
}): React.JSX.Element {
  // If no POV is selected yet, show the Three POV Entry Screen
  if (!pov) {
    return <EntryPage onSelectPOV={onSelectPOV} />;
  }

  return (
    <>
      <LicenseGate lang={lang} />
      <Routes>
        <Route path="/pov" element={<EntryPage onSelectPOV={onSelectPOV} />} />
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
            pov === 'admin' ? (
              <Navigate to="/admin" replace />
            ) : (
              <Layout lang={lang} onToggleLang={onToggleLang} title={get(lang, 'challengeTitle')}>
                <ChallengePage lang={lang} />
              </Layout>
            )
          }
        />
        <Route
          path="/admin"
          element={
            <Layout lang={lang} onToggleLang={onToggleLang} title="Administrator Console">
              <AdminDashboardPage pov={pov} />
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
