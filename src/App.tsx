import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'sonner';
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
import AcademyView from '@/components/academy/AcademyView';
import { initializeDemoPatient, demoPatientExists, type LoadingProgress } from '@/lib/db/demoPatient';
import { DemoLoadingScreen } from '@/components/demo/DemoLoadingScreen';
import { useTokenStore } from '@/stores/token-store';
import { fetchTokens } from '@/lib/api/token-service';
import AdminDashboard from '@/pages/AdminDashboard';
import { ProtectedRoute } from '@/components/admin/ProtectedRoute';
import { useMessagePolling } from '@/hooks/useMessagePolling';

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
  const setTokens = useTokenStore((state) => state.setTokens);

  // Message polling hook for admin broadcast messages
  const { ConfirmDialogComponent } = useMessagePolling({
    intervalMs: 120000, // 2 minutes
    enabled: !isInitializing, // Only start polling after initialization
  });

  // Inicializar paciente demo y cargar tokens al inicio
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

    const loadTokens = async () => {
      try {
        const tokenCount = await fetchTokens();
        if (!cancelled) {
          setTokens(tokenCount);
        }
      } catch (error) {
        console.error('❌ Error al cargar tokens:', error);
      }
    };

    // Ejecutar en paralelo
    Promise.all([setupDemoPatient(), loadTokens()]).catch(() => {
      console.error('❌ Error al inicializar aplicación');
      if (!cancelled) {
        setIsInitializing(false);
      }
    });

    // Cleanup function para evitar actualizaciones en componente desmontado
    return () => {
      cancelled = true;
    };
  }, [setTokens]);

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
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        duration={4000}
      />
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

        {/* Academy */}
        <Route
          path="/academy"
          element={
            <MainLayout>
              <AcademyView />
            </MainLayout>
          }
        />

        {/* Admin Dashboard */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>

      {/* Message Polling Confirm Dialog */}
      {ConfirmDialogComponent}
    </BrowserRouter>
  );
}

export default App;
