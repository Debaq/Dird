import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MainLayout from '@/components/layout/MainLayout';
import PatientList from '@/components/patients/PatientList';
import PatientDetails from '@/components/patients/PatientDetails';
import SessionView from '@/components/upload/SessionView';
import ImageAnalyzer from '@/components/canvas/ImageAnalyzer';
import { Settings } from '@/components/settings/Settings';

function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-ice flex items-center justify-center">
      <div className="text-center bg-snow p-8 rounded-lg shadow-lg max-w-2xl">
        <h1 className="text-4xl font-bold text-primary-500 mb-4">
          {t('app.name')}
        </h1>
        <p className="text-smoke-500 text-lg mb-6">
          {t('app.tagline')}
        </p>
        <p className="text-sm text-smoke-600 mb-8">
          Plataforma de análisis de imágenes oftalmológicas con IA edge-computing.
          Todos los datos permanecen en tu dispositivo.
        </p>
        <a
          href="/patients"
          className="inline-flex items-center justify-center rounded-md font-medium bg-primary-500 text-white hover:bg-primary-600 h-10 py-2 px-4"
        >
          Comenzar
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home page */}
        <Route path="/" element={<HomePage />} />

        {/* Patient management */}
        <Route
          path="/patients"
          element={
            <MainLayout>
              <PatientList />
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
            <MainLayout>
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
                <h2 className="text-2xl font-bold text-coal-800 mb-2">Comparación de Sesiones</h2>
                <p className="text-smoke-500">Próximamente...</p>
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

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
