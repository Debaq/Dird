import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Search, Filter } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import PatientCard, { PatientReportStatus } from './PatientCard';
import PatientForm from './PatientForm';
import ExportImportControls from './ExportImportControls';
import { db, Patient } from '@/lib/db/schema';
import { deletePatient } from '@/lib/db/actions';
import { useConfirm } from '@/hooks/useConfirm';

const PatientList: React.FC = () => {
  const { t } = useTranslation();
  const { confirm, ConfirmDialogComponent } = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending'>('all');

  const patients = useLiveQuery(() => db.patients.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const reports = useLiveQuery(() => db.reports.toArray(), []);

  const getSessionCount = (patientId: number) => {
    return sessions?.filter((s) => s.patientId === patientId).length || 0;
  };

  const getPatientReportStatus = (patientId: number): PatientReportStatus => {
    const patientSessions = sessions?.filter(s => s.patientId === patientId) || [];
    if (patientSessions.length === 0) return 'none';

    const sessionIds = patientSessions.map(s => s.id!);
    const patientReports = reports?.filter(r => sessionIds.includes(r.sessionId));

    if (!patientReports || patientReports.length === 0) return 'no_report';

    // Sort by generatedAt descending
    const sortedReports = [...patientReports].sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
    const latest = sortedReports[0];

    return latest.type === 'final' ? 'final' : 'preliminary';
  };

  const filteredPatients = patients?.filter(patient => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchQuery.toLowerCase());

    const status = patient.status || 'active';
    const matchesArchiveStatus = showArchived ? status === 'archived' : status === 'active';

    const reportStatus = getPatientReportStatus(patient.id!);
    const matchesStatusFilter = statusFilter === 'all' 
      ? true 
      : (reportStatus === 'no_report' || reportStatus === 'preliminary');

    return matchesSearch && matchesArchiveStatus && matchesStatusFilter;
  });

  const handleDeletePatient = async (patientId: number) => {
    const confirmed = await confirm({
      title: t('confirmations.deletePatientTitle'),
      description: t('confirmations.deletePatient'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await deletePatient(patientId);
      toast.success(t('success.deletePatient'));
    } catch (error) {
      console.error('Error deleting patient:', error);
      toast.error(t('errors.deletePatient'));
    }
  };

  const handleArchivePatient = async (patient: Patient) => {
    const isArchiving = (patient.status || 'active') === 'active';
    const action = isArchiving ? 'archivar' : 'desarchivar';

    const confirmed = await confirm({
      title: isArchiving ? t('confirmations.archivePatientTitle') : t('confirmations.unarchivePatientTitle'),
      description: t('confirmations.archivePatient', { action }),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      variant: 'warning',
    });

    if (!confirmed) return;

    try {
      await db.patients.update(patient.id!, { status: isArchiving ? 'archived' : 'active' });
      toast.success(isArchiving ? t('success.archivePatient') : t('success.unarchivePatient'));
    } catch (error) {
      console.error(`Error ${action}ing patient:`, error);
      toast.error(t('errors.archivePatient', { action }));
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
        
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-auto">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smoke-400" />
             <select
                className="pl-9 h-10 w-full sm:w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending')}
             >
                <option value="all">{t('patients.filter.allStatus')}</option>
                <option value="pending">{t('patients.filter.pendingReport')}</option>
             </select>
          </div>

          <div className="flex items-center space-x-2 whitespace-nowrap">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <Label htmlFor="show-archived">{t('patients.showArchived')}</Label>
          </div>
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
              reportStatus={getPatientReportStatus(patient.id!)}
              onDelete={handleDeletePatient}
              onArchive={handleArchivePatient}
              onEdit={handleEditPatient}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-smoke-500">
            {searchQuery || showArchived || statusFilter !== 'all'
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

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </div>
  );
};

export default PatientList;
