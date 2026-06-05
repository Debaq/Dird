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
import { db } from '@/lib/db/schema';
import {type LoadingProgress } from '@/lib/db/demoPatient';
import { DemoLoadingScreen } from '@/components/demo/DemoLoadingScreen';
import { useTokenStore } from '@/stores/token-store';
import { fetchTokens } from '@/lib/api/token-service';
import { classManager } from '@/lib/classes/class-manager';
import { waitForOpenCV } from '@/lib/ai/optic-disc-refiner';
import { AppGate } from '@/components/auth/AppGate';

function App() {
  const { t } = useTranslation();
  const basename = typeof document !== 'undefined'
    ? new URL('.', document.baseURI).pathname
    : '/';
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadingProgress] = useState<LoadingProgress>({
    step: 'init',
    current: 0,
    total: 1,
    message: t('demo.loading.steps.init'),
  });
  const setTokens = useTokenStore((state) => state.setTokens);

  // Inicializar paciente demo y cargar tokens al inicio
  useEffect(() => {
    let cancelled = false; // Para evitar race conditions

    // Handle database blocked event (version upgrade stuck)
    const handleDbBlocked = () => {
      console.warn('Database upgrade blocked');
      // Only show alert if we are stuck initializing
      if (isInitializing) {
        alert(t('common.error.dbBlocked') || 'Please close other tabs of this application to allow the database update.');
      }
    };

    db.on('blocked', handleDbBlocked);

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

    const loadModelMetadata = async () => {
      try {
        // Cargar metadata del modelo desde GitHub
        await classManager.ensureMetadataLoaded();
      } catch (error) {
        console.error('❌ Error al cargar metadata del modelo:', error);
      }
    };

    const initOpenCV = async () => {
      try {
        // Esperar a que OpenCV esté listo (máximo 10 segundos)
        const ready = await waitForOpenCV(10000);
        if (!ready) {
          console.warn('⚠️ OpenCV failed to initialize within timeout');
        } else {
          console.log('✅ OpenCV is ready');
        }
      } catch (error) {
        console.error('❌ Error initializing OpenCV:', error);
      }
    };

    // Ejecutar en paralelo
    Promise.all([loadTokens(), loadModelMetadata(), initOpenCV()]).then(() => {
      if (!cancelled) {
        setIsInitializing(false);
      }
    }).catch((error) => {
      console.error('❌ Error al inicializar aplicación:', error);
      if (!cancelled) {
        setIsInitializing(false);
      }
    });

    // Cleanup function para evitar actualizaciones en componente desmontado
    return () => {
      cancelled = true;
      // db.on('blocked') does not need to be removed as db is a singleton and long-lived, 
      // but strictly we should unsubscribe if we could. Dexie doesn't provide easy off().
    };
  }, [setTokens, isInitializing, t]);

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
      <AppGate>
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

        <Route path="*" element={<Navigate to="/patients" replace />} />
      </Routes>
      </AppGate>
    </BrowserRouter>
  );
}

export default App;
