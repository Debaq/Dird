import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import PatientList from '@/components/patients/PatientList';
import PatientDetails from '@/components/patients/PatientDetails';
import SessionView from '@/components/upload/SessionView';
import ImageAnalyzer from '@/components/canvas/ImageAnalyzer';
import { Settings } from '@/components/settings/Settings';
import LanguageSync from '@/components/LanguageSync';
import GlobalReportsList from '@/components/reports/GlobalReportsList';

function App() {
  const { t } = useTranslation();
  const basename = import.meta.env.PROD ? '/dird' : '/';

  return (
    <BrowserRouter 
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <LanguageSync />
      <Routes>
        {/* Redirect root to patients */}
        <Route path="/" element={<Navigate to="/patients" replace />} />

        {/* Patient management */}
        <Route
          path="/patients"
          element={
            <MainLayout>
              <PatientList />
            </MainLayout>
          }
        />

        {/* Global reports list */}
        <Route
          path="/reports"
          element={
            <MainLayout>
              <GlobalReportsList />
            </MainLayout>
          }
        />

        {/* Patient details (shows sessions list) */}
        <Route
          path="/patients/:patientId"
          element={
            <MainLayout>
              <PatientDetails />
            </MainLayout>
          }
        />

        {/* Session view (upload images, view gallery, generate reports) */}
        <Route
          path="/patients/:patientId/sessions/:sessionId"
          element={
            <MainLayout>
              <SessionView />
            </MainLayout>
          }
        />

        {/* Image analyzer (canvas with annotations) */}
        <Route
          path="/patients/:patientId/sessions/:sessionId/images/:imageId"
          element={
            <MainLayout fullScreenOnMobile>
              <ImageAnalyzer />
            </MainLayout>
          }
        />

        {/* Session comparison */}
        <Route
          path="/patients/:patientId/compare"
          element={
            <MainLayout>
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-coal-800 mb-2">{t('sessions.compareTitle')}</h2>
                <p className="text-smoke-500">{t('ui.comingSoon.general')}</p>
              </div>
            </MainLayout>
          }
        />

        {/* Global settings */}
        <Route
          path="/settings"
          element={
            <MainLayout>
              <Settings />
            </MainLayout>
          }
        />

        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
