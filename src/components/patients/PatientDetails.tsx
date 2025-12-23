import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Calendar, Lock, Unlock, Download, Pencil, Trash2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionForm from './SessionForm';
import PatientForm from './PatientForm';
import { db, Session, Patient } from '@/lib/db/schema';
import { exportPatient, downloadDirdFile } from '@/lib/export/dird-exporter';
import { duplicateSession } from '@/lib/db/actions';

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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/patients')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-coal-800">{patient.name}</h1>
            <p className="text-smoke-500 mt-1">{t('patients.idLabel')}{patient.patientId}</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => {
              setPatientToEdit(patient);
              setShowPatientForm(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-2" />
            {t('patients.edit')}
          </Button>
          <Button onClick={handleExportPatient} disabled={isExporting}>
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
                <p className="text-sm text-smoke-500">Diabetes</p>
                <p className="text-coal-800 font-medium">
                  {patient.diabetes ? 'Sí' : 'No'}
                  {patient.diabetes && patient.diabetesType && (
                    <span className="ml-2 text-sm text-primary-600">
                      ({patient.diabetesType.replace('type', 'Tipo ')})
                      {patient.diabetesDuration && `, ${patient.diabetesDuration} años`}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-smoke-500">Hipertensión Arterial (HTA)</p>
                <p className="text-coal-800 font-medium">{patient.hta ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="text-sm text-smoke-500">Dislipidemia (DLP)</p>
                <p className="text-coal-800 font-medium">{patient.dlp ? 'Sí' : 'No'}</p>
              </div>
              {patient.medications && patient.medications.length > 0 && (
                <div>
                  <p className="text-sm text-smoke-500">Medicamentos</p>
                  <p className="text-coal-800 font-medium">{patient.medications.join(', ')}</p>
                </div>
              )}
              {patient.otherConditions && (
                <div>
                  <p className="text-sm text-smoke-500">Otros Antecedentes</p>
                  <p className="text-coal-800 font-medium">{patient.otherConditions}</p>
                </div>
              )}
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
                            `${t('sessions.session')} ${
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
                            {t('sessions.status.active')}
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
                {t('sessions.empty')}
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

