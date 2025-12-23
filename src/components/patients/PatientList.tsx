import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import PatientCard from './PatientCard';
import PatientForm from './PatientForm';
import ExportImportControls from './ExportImportControls';
import { db, Patient } from '@/lib/db/schema';
import { deletePatient } from '@/lib/db/actions';

const PatientList: React.FC = () => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const patients = useLiveQuery(() => db.patients.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);

  const filteredPatients = patients?.filter(patient => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchQuery.toLowerCase());

    const status = patient.status || 'active';
    const matchesArchiveStatus = showArchived ? status === 'archived' : status === 'active';

    return matchesSearch && matchesArchiveStatus;
  });

  const getSessionCount = (patientId: number) => {
    return sessions?.filter((s) => s.patientId === patientId).length || 0;
  };

  const handleDeletePatient = async (patientId: number) => {
    if (window.confirm(t('confirmations.deletePatient'))) {
      try {
        await deletePatient(patientId);
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert(t('errors.deletePatient'));
      }
    }
  };

  const handleArchivePatient = async (patient: Patient) => {
    const isArchiving = (patient.status || 'active') === 'active';
    const action = isArchiving ? 'archivar' : 'desarchivar';
    if (window.confirm(t('confirmations.archivePatient', { action }))) {
      try {
        await db.patients.update(patient.id!, { status: isArchiving ? 'archived' : 'active' });
      } catch (error) {
        console.error(`Error ${action}ing patient:`, error);
        alert(t('errors.archivePatient', { action }));
      }
    }
  };
  
  const handleEditPatient = (patient: Patient) => {
    setPatientToEdit(patient);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-coal-800">{t('patients.title')}</h1>
          <p className="text-smoke-500 mt-1">
            {t('patients.description')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <ExportImportControls onImportComplete={() => {/* Refresh handled by useLiveQuery */}} />
          <Button
            onClick={() => {
              setPatientToEdit(undefined);
              setShowForm(true);
            }}
            className="flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t('patients.create')}</span>
          </Button>
        </div>
      </div>

      {/* Search and Toggles */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smoke-400" />
          <Input
            className="pl-10"
            placeholder={t('patients.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <Label htmlFor="show-archived">{t('patients.showArchived')}</Label>
        </div>
      </div>


      {/* Patient Grid */}
      {filteredPatients && filteredPatients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              sessionCount={getSessionCount(patient.id!)}
              onDelete={handleDeletePatient}
              onArchive={handleArchivePatient}
              onEdit={handleEditPatient}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-smoke-500">
            {searchQuery || showArchived
              ? t('patients.notFound')
              : t('patients.empty')}
          </p>
        </div>
      )}

      {/* Patient Form Dialog */}
      <PatientForm
        open={showForm}
        onOpenChange={setShowForm}
        patient={patientToEdit}
        onSuccess={() => {
          setShowForm(false);
          setPatientToEdit(undefined);
        }}
      />
    </div>
  );
};

export default PatientList;
