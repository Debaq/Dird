import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import PatientList from '@/components/patients/PatientList';
import PatientDetails from '@/components/patients/PatientDetails';
import SessionView from '@/components/upload/SessionView';
import ImageAnalyzer from '@/components/canvas/ImageAnalyzer';
import { Settings } from '@/components/settings/Settings';
import LanguageSync from '@/components/LanguageSync';
import DocumentTitleSync from '@/components/DocumentTitleSync';
import GlobalReportsList from '@/components/reports/GlobalReportsList';
import SessionComparison from '@/components/patients/SessionComparison';
import ContributionMenu from '@/components/contribution/ContributionMenu';
import { initializeDemoPatient, demoPatientExists, type LoadingProgress } from '@/lib/db/demoPatient';
import { DemoLoadingScreen } from '@/components/demo/DemoLoadingScreen';

function App() {
  const { t } = useTranslation();
  const basename = import.meta.env.PROD ? '/dird' : '/';
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    step: 'init',
    current: 0,
    total: 1,
    message: t('demo.loading.steps.init'),
  });

  // Inicializar paciente demo al cargar la aplicación
  useEffect(() => {
    let cancelled = false; // Para evitar race conditions

    const setupDemoPatient = async () => {
      const exists = await demoPatientExists();

      if (cancelled) return; // Si el componente se desmontó, salir

      if (!exists) {
        await initializeDemoPatient((progress) => {
          if (!cancelled) {
            setLoadingProgress(progress);
          }
        });
      }

      if (!cancelled) {
        setIsInitializing(false);
      }
    };

    setupDemoPatient().catch(() => {
      console.error('❌ Error al inicializar paciente demo');
      if (!cancelled) {
        setIsInitializing(false);
      }
    });

    // Cleanup function para evitar actualizaciones en componente desmontado
    return () => {
      cancelled = true;
    };
  }, []);

  // Mostrar pantalla de carga mientras se inicializa
  if (isInitializing) {
    return <DemoLoadingScreen progress={loadingProgress} />;
  }

  return (
    <BrowserRouter
      basename={basename}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <LanguageSync />
      <DocumentTitleSync />
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
              <SessionComparison />
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

        {/* Contribution menu */}
        <Route
          path="/contribute"
          element={
            <MainLayout>
              <ContributionMenu />
            </MainLayout>
          }
        />

        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
