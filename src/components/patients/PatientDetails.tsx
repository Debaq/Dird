import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Calendar, Lock, Unlock, Download, Pencil, Trash2, Copy, ArrowRightLeft, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionForm from './SessionForm';
import PatientForm from './PatientForm';
import { db, Session, Patient } from '@/lib/db/schema';
import { exportPatient, downloadDirdFile } from '@/lib/export/dird-exporter';
import { duplicateSession } from '@/lib/db/actions';
import { createCombinedSession } from '@/lib/db/combinedSessions';

const PatientDetails: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<number | null>(null);
  const [sessionToEdit, setSessionToEdit] = useState<Session | undefined>();
  const [patientToEdit, setPatientToEdit] = useState<Patient | undefined>();

  // Comparison Mode State
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<number[]>([]);

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
      alert(t('errors.exportPatient'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (window.confirm(t('confirmations.deleteSession'))) {
      try {
        await db.transaction('rw', [db.sessions, db.images, db.detections, db.segmentations, db.reports], async () => {
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
        alert(t('errors.deleteSession'));
      }
    }
  };

  const handleEditSession = (session: Session) => {
    setSessionToEdit(session);
    setShowSessionForm(true);
  };

  const handleDuplicateSession = async (sessionId: number) => {
    if (window.confirm(t('confirmations.duplicateSession'))) {
      setIsDuplicating(sessionId);
      try {
        await duplicateSession(sessionId);
      } catch (error) {
        console.error('Error duplicating session:', error);
        alert(t('errors.duplicateSession'));
      } finally {
        setIsDuplicating(null);
      }
    }
  };

  const toggleSessionSelection = (sessionId: number) => {
    if (selectedSessions.includes(sessionId)) {
      setSelectedSessions(selectedSessions.filter(id => id !== sessionId));
    } else {
      setSelectedSessions([...selectedSessions, sessionId]);
    }
  };

  const handleCompareSessions = async () => {
    if (selectedSessions.length < 2 || !patientId) return;

    try {
      // Crear la sesión combinada
      const combinedSessionId = await createCombinedSession(
        parseInt(patientId),
        selectedSessions
      );

      // Salir del modo de comparación
      setIsCompareMode(false);
      setSelectedSessions([]);

      // Navegar a la nueva sesión combinada
      navigate(`/patients/${patientId}/sessions/${combinedSessionId}`);
    } catch (error) {
      console.error('Error al crear sesión combinada:', error);
      alert(t('errors.sessionCreation'));
    }
  };

  if (!patient) {
    return <div>{t('ui.loading')}</div>;
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/patients')} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-coal-800 truncate" title={patient.name}>
              {patient.name}
            </h1>
            <p className="text-smoke-500 mt-1">{t('patients.idLabel')}{patient.patientId}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPatientToEdit(patient);
              setShowPatientForm(true);
            }}
            className="flex-1 md:flex-none"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {t('patients.edit')}
          </Button>
          <Button 
            onClick={handleExportPatient} 
            disabled={isExporting}
            className="flex-1 md:flex-none"
          >
            <Download className="w-4 h-4 mr-2" />
            {isExporting ? t('export.exporting') : t('export.patient')}
          </Button>
        </div>
      </div>

      {/* Patient Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t('patients.infoTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-smoke-500">{t('patients.dateOfBirth')}</p>
                <p className="text-coal-800 font-medium">
                  {formatDate(patient.dateOfBirth)}
                </p>
              </div>
              <div>
                <p className="text-sm text-smoke-500">{t('patients.registeredOn')}</p>
                <p className="text-coal-800 font-medium">{formatDate(patient.createdAt)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-smoke-500">{t('patients.form.diabetes')}</p>
                <p className="text-coal-800 font-medium">
                  {patient.diabetes ? t('ui.yes') : t('ui.no')}
                  {patient.diabetes && patient.diabetesType && (
                    <span className="ml-2 text-sm text-primary-600">
                      ({t(`patients.form.types.${patient.diabetesType}`)})
                      {patient.diabetesDuration && `, ${patient.diabetesDuration} ${t('patients.years')}`}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-smoke-500">{t('patients.form.hta')}</p>
                <p className="text-coal-800 font-medium">{patient.hta ? t('ui.yes') : t('ui.no')}</p>
              </div>
              <div>
                <p className="text-sm text-smoke-500">{t('patients.form.dlp')}</p>
                <p className="text-coal-800 font-medium">{patient.dlp ? t('ui.yes') : t('ui.no')}</p>
              </div>
              {patient.medications && patient.medications.length > 0 && (
                <div>
                  <p className="text-sm text-smoke-500">{t('patients.fields.medications')}</p>
                  <p className="text-coal-800 font-medium">{patient.medications.join(', ')}</p>
                </div>
              )}
              {patient.otherConditions && (
                <div>
                  <p className="text-sm text-smoke-500">{t('patients.form.otherConditions')}</p>
                  <p className="text-coal-800 font-medium">{patient.otherConditions}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-coal-800">{t('sessions.title')}</h2>
          <div className="flex gap-2 w-full sm:w-auto">
             <Button
                variant={isCompareMode ? "secondary" : "outline"}
                onClick={() => {
                    setIsCompareMode(!isCompareMode);
                    setSelectedSessions([]);
                }}
                className="flex items-center justify-center space-x-2 flex-1 sm:flex-none"
             >
                {isCompareMode ? <CheckSquare className="w-4 h-4 text-primary-600" /> : <ArrowRightLeft className="w-4 h-4" />}
                <span>{isCompareMode ? t('ui.cancel') : t('sessions.compareTitle')}</span>
             </Button>

             {!isCompareMode && (
                <Button
                    onClick={() => {
                    setSessionToEdit(undefined);
                    setShowSessionForm(true);
                    }}
                    className="flex items-center justify-center space-x-2 flex-1 sm:flex-none"
                >
                    <Plus className="w-4 h-4" />
                    <span>{t('sessions.create')}</span>
                </Button>
             )}
          </div>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="grid gap-4">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className={`transition-shadow cursor-pointer ${
                    isCompareMode && selectedSessions.includes(session.id!) 
                        ? 'ring-2 ring-primary-500 bg-primary-50' 
                        : 'hover:shadow-strong'
                }`}
                onClick={() => {
                    if (isCompareMode) {
                        toggleSessionSelection(session.id!);
                    } else {
                        navigate(`/patients/${patientId}/sessions/${session.id}`);
                    }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4 flex-grow min-w-0">
                      {isCompareMode && (
                          <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                              selectedSessions.includes(session.id!) ? 'bg-primary-600 border-primary-600' : 'border-smoke-400 bg-white'
                          }`}>
                              {selectedSessions.includes(session.id!) && <div className="w-2.5 h-2.5 bg-white rounded-sm" />}
                          </div>
                      )}
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-6 h-6 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-coal-800 truncate">
                          {session.name ||
                            `${t('sessions.session')} ${
                              session.sessionNumber
                            }`}
                        </h3>
                        <p className="text-sm text-smoke-500">
                          {formatDate(session.date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:pl-4 justify-end">
                      {session.locked ? (
                        <span className="flex items-center text-sm text-accent-600 mr-2">
                          <Lock className="w-4 h-4 mr-1" />
                          {t('sessions.locked')}
                        </span>
                      ) : (
                        <span className="flex items-center text-sm text-smoke-500 mr-2">
                          <Unlock className="w-4 h-4 mr-1" />
                          {t('sessions.status.active')}
                        </span>
                      )}
                      {!isCompareMode && (
                          <>
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
                            {!session.locked && ( // Solo mostrar editar y eliminar si no está bloqueado
                              <>
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
                {t('sessions.empty')}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating Action Button for Comparison */}
      {isCompareMode && selectedSessions.length >= 2 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
              <Button 
                size="lg" 
                className="shadow-strong rounded-full px-8 animate-in fade-in slide-in-from-bottom-4"
                onClick={handleCompareSessions}
              >
                  {t('sessions.compareAction', { count: selectedSessions.length })}
                  <ArrowRightLeft className="w-4 h-4 ml-2" />
              </Button>
          </div>
      )}

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

      {/* Patient Form Dialog */}
      <PatientForm
        open={showPatientForm}
        onOpenChange={setShowPatientForm}
        patient={patientToEdit}
        onSuccess={() => {
          setShowPatientForm(false);
          setPatientToEdit(undefined);
        }}
      />
    </div>
  );
};

export default PatientDetails;

