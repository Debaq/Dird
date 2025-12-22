import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Calendar, Lock, Unlock, Download, Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionForm from './SessionForm';
import { db, Session } from '@/lib/db/schema';
import { exportPatient, downloadDirdFile } from '@/lib/export/dird-exporter';
import { duplicateSession } from '@/lib/db/actions';

const PatientDetails: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<Session | undefined>();

  const patient = useLiveQuery(
    () => (patientId ? db.patients.get(parseInt(patientId)) : undefined),
    [patientId]
  );

  const sessions = useLiveQuery(
    () => (patientId ? db.sessions.where('patientId').equals(parseInt(patientId)).toArray() : []),
    [patientId]
  );

  const handleExportPatient = async () => {
    if (!patient) return;
    setIsExporting(true);
    try {
      const blob = await exportPatient(patient.id!);
      downloadDirdFile(blob, `dird_export_patient_${patient.patientId}`);
    } catch (error) {
      console.error('Error exporting patient:', error);
      alert('Error al exportar el paciente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta sesión y todos sus datos? Esta acción es irreversible.')) {
      try {
        await db.transaction('rw', db.sessions, db.images, db.detections, db.segmentations, async () => {
          const imagesToDelete = await db.images.where('sessionId').equals(sessionId).toArray();
          const imageIds = imagesToDelete.map(img => img.id!);

          if (imageIds.length > 0) {
            await db.detections.where('imageId').anyOf(imageIds).delete();
            await db.segmentations.where('imageId').anyOf(imageIds).delete();
          }

          await db.images.where('sessionId').equals(sessionId).delete();
          await db.reports.where('sessionId').equals(sessionId).delete();
          await db.sessions.delete(sessionId);
        });
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('Error al eliminar la sesión.');
      }
    }
  };

  const handleEditSession = (session: Session) => {
    setSessionToEdit(session);
    setShowSessionForm(true);
  };

  const handleDuplicateSession = async (sessionId: number) => {
    if (window.confirm('¿Estás seguro de que quieres duplicar esta sesión?')) {
      setIsDuplicating(sessionId);
      try {
        await duplicateSession(sessionId);
      } catch (error) {
        console.error('Error duplicating session:', error);
        alert('Error al duplicar la sesión.');
      } finally {
        setIsDuplicating(null);
      }
    }
  };

  if (!patient) {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/patients')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-coal-800">{patient.name}</h1>
            <p className="text-smoke-500 mt-1">ID: {patient.patientId}</p>
          </div>
        </div>
        <div>
          <Button onClick={handleExportPatient} disabled={isExporting}>
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? 'Exportando...' : 'Exportar Paciente'}
          </Button>
        </div>
      </div>

      {/* Patient Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Paciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-smoke-500">Fecha de Nacimiento</p>
              <p className="text-coal-800 font-medium">
                {formatDate(patient.dateOfBirth)}
              </p>
            </div>
            <div>
              <p className="text-sm text-smoke-500">Registrado el</p>
              <p className="text-coal-800 font-medium">{formatDate(patient.createdAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-coal-800">{t('sessions.title')}</h2>
          <Button
            onClick={() => {
              setSessionToEdit(undefined);
              setShowSessionForm(true);
            }}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('sessions.create')}</span>
          </Button>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="hover:shadow-strong transition-shadow"
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center space-x-4 flex-grow cursor-pointer"
                      onClick={() => navigate(`/patients/${patientId}/sessions/${session.id}`)}
                    >
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-coal-800">
                          {session.name ||
                            `${t('sessions.sessionNumber')} ${
                              session.sessionNumber
                            }`}
                        </h3>
                        <p className="text-sm text-smoke-500">
                          {formatDate(session.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 pl-4">
                      {session.locked ? (
                        <span className="flex items-center text-sm text-accent-600 mr-2">
                          <Lock className="w-4 h-4 mr-1" />
                          {t('sessions.locked')}
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center text-sm text-smoke-500 mr-2">
                            <Unlock className="w-4 h-4 mr-1" />
                            Activa
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={isDuplicating === session.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateSession(session.id!);
                            }}
                          >
                            {isDuplicating === session.id ? <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-primary-500 animate-spin" /> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSession(session);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id!);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-error-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-smoke-500">
                No hay sesiones registradas. Crea una para comenzar el análisis.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Session Form Dialog */}
      <SessionForm
        open={showSessionForm}
        onOpenChange={setShowSessionForm}
        patientId={patient.id!}
        sessionToEdit={sessionToEdit}
        onSuccess={() => {
          setShowSessionForm(false);
          setSessionToEdit(undefined);
        }}
      />
    </div>
  );
};

export default PatientDetails;

