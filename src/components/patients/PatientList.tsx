import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PatientCard from './PatientCard';
import PatientForm from './PatientForm';
import ExportImportControls from './ExportImportControls';
import { db } from '@/lib/db/schema';

const PatientList: React.FC = () => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const patients = useLiveQuery(() => db.patients.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);

  const filteredPatients = patients?.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.patientId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSessionCount = (patientId: number) => {
    return sessions?.filter((s) => s.patientId === patientId).length || 0;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-coal-800">{t('patients.title')}</h1>
          <p className="text-smoke-500 mt-1">
            Gestiona los pacientes y sus sesiones de análisis
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <ExportImportControls onImportComplete={() => {/* Refresh handled by useLiveQuery */}} />
          <Button onClick={() => setShowForm(true)} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>{t('patients.create')}</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smoke-400" />
        <Input
          className="pl-10"
          placeholder="Buscar por nombre o ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Patient Grid */}
      {filteredPatients && filteredPatients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((patient) => (
            <PatientCard
              key={patient.id}
              patient={patient}
              sessionCount={getSessionCount(patient.id!)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-smoke-500">
            {searchQuery
              ? 'No se encontraron pacientes'
              : 'No hay pacientes registrados. Crea uno para comenzar.'}
          </p>
        </div>
      )}

      {/* Patient Form Dialog */}
      <PatientForm
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => setShowForm(false)}
      />
    </div>
  );
};

export default PatientList;
