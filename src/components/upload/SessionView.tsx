import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Upload, Play, Lock, ChevronRight, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageDropzone from './ImageDropzone';
import ImageGallery from './ImageGallery';
import ReportGenerator from '../reports/ReportGenerator';
import { db } from '@/lib/db/schema';
import { exportSession, downloadDirdFile } from '@/lib/export/dird-exporter';

const SessionView: React.FC = () => {
  const { patientId, sessionId } = useParams<{ patientId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('images');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  const session = useLiveQuery(
    () => (sessionId ? db.sessions.get(parseInt(sessionId)) : undefined),
    [sessionId]
  );

  const patient = useLiveQuery(
    () => (patientId ? db.patients.get(parseInt(patientId)) : undefined),
    [patientId]
  );

  const images = useLiveQuery(
    () => (sessionId ? db.images.where('sessionId').equals(parseInt(sessionId)).toArray() : []),
    [sessionId, refreshKey]
  );

  const handleExportSession = async () => {
    if (!sessionId) return;
    setIsExporting(true);
    try {
      const blob = await exportSession(parseInt(sessionId));
      const sessionName = session?.name?.replace(/ /g, '_') || session?.sessionNumber;
      downloadDirdFile(blob, `dird_export_${patient?.patientId}_session_${sessionName}`);
    } catch (error) {
      console.error('Error exporting session:', error);
      alert('Error al exportar la sesión.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar esta imagen?')) {
      try {
        await db.images.delete(imageId);
        setRefreshKey((prev) => prev + 1);
      } catch (error) {
        console.error('Error deleting image:', error);
        alert('Error al eliminar la imagen');
      }
    }
  };

  const handleUploadComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (!session || !patient) {
    return <div>Cargando...</div>;
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-smoke-600">
        <Link to="/patients" className="hover:text-primary-600 transition-colors">
          Pacientes
        </Link>
        <ChevronRight className="w-4 h-4" />
        <Link
          to={`/patients/${patientId}`}
          className="hover:text-primary-600 transition-colors"
        >
          {patient.name}
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-coal-800 font-medium">
          {session.name || `Sesión ${session.sessionNumber}`}
        </span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(`/patients/${patientId}`)}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-coal-800">
              {session.name || `${t('sessions.sessionNumber')} ${session.sessionNumber}`}
            </h1>
            <p className="text-smoke-500 mt-1">
              {patient.name} - {formatDate(session.date)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExportSession} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar Sesión'}
          </Button>
          {session.locked ? (
            <span className="flex items-center text-sm text-accent-600 bg-accent-50 px-3 py-1 rounded-full">
              <Lock className="w-4 h-4 mr-1" />
              {t('sessions.locked')}
            </span>
          ) : (
            <ReportGenerator sessionId={parseInt(sessionId!)} onReportGenerated={() => setRefreshKey((prev) => prev + 1)} />
          )}
        </div>
      </div>

      {/* Session Info */}
      {session.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas de la Sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-smoke-700">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Upload Section - Always visible when unlocked */}
      {!session.locked && (
        <Card className="border-2 border-dashed border-primary-300 bg-primary-50/30">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-primary-700">
              <Upload className="w-6 h-6" />
              <span>Subir Imágenes de Fondo de Ojo</span>
            </CardTitle>
            <p className="text-sm text-smoke-600 mt-2">
              Arrastra archivos aquí o haz click para seleccionar. Formatos soportados: JPG, PNG
            </p>
          </CardHeader>
          <CardContent>
            <ImageDropzone
              sessionId={parseInt(sessionId!)}
              onUploadComplete={handleUploadComplete}
            />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="images">
            Imágenes ({images?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="analysis">Análisis AI</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-6">

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Galería de Imágenes</CardTitle>
                {images && images.length > 0 && !session.locked && (
                  <Button className="flex items-center space-x-2">
                    <Play className="w-4 h-4" />
                    <span>Procesar con IA</span>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ImageGallery
                images={images || []}
                patientId={patientId!}
                sessionId={sessionId!}
                onDelete={!session.locked ? handleDeleteImage : undefined}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-smoke-500">
                El análisis AI estará disponible próximamente
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-smoke-500">
                La generación de reportes estará disponible próximamente
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SessionView;
