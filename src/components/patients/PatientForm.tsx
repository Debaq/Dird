import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/lib/db/schema';
import type { Patient } from '@/lib/db/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PatientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient;
  onSuccess?: () => void;
}

const PatientForm: React.FC<PatientFormProps> = ({
  open,
  onOpenChange,
  patient,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    name: '',
    dateOfBirth: '',
  });

  useEffect(() => {
    if (open) {
      if (patient) {
        setFormData({
          patientId: patient.patientId || '',
          name: patient.name || '',
          dateOfBirth: patient.dateOfBirth
            ? new Date(patient.dateOfBirth).toISOString().split('T')[0]
            : '',
        });
      } else {
        setFormData({
          patientId: '',
          name: '',
          dateOfBirth: '',
        });
      }
    }
  }, [open, patient]);

  const handleSubmit = async (e: React.FormEvent) => {
// ... rest of the component
    e.preventDefault();
    setLoading(true);

    try {
      const now = new Date();
      const patientData = {
        patientId: formData.patientId,
        name: formData.name,
        dateOfBirth: new Date(formData.dateOfBirth),
        status: (patient?.status || 'active') as 'active' | 'archived',
        createdAt: patient?.createdAt || now,
        updatedAt: now,
      };

      if (patient?.id) {
        await db.patients.update(patient.id, patientData);
      } else {
        await db.patients.add(patientData);
      }

      onSuccess?.();
      onOpenChange(false);
      setFormData({ patientId: '', name: '', dateOfBirth: '' });
    } catch (error) {
      console.error('Error saving patient:', error);
      alert('Error al guardar el paciente');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {patient ? t('patients.edit') : t('patients.create')}
          </DialogTitle>
          <DialogDescription>
            {patient
              ? 'Edita la información del paciente'
              : 'Completa los datos para crear un nuevo paciente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="patientId">{t('patients.id')}</Label>
            <Input
              id="patientId"
              value={formData.patientId}
              onChange={(e) =>
                setFormData({ ...formData, patientId: e.target.value })
              }
              placeholder="P-001"
              required
              disabled={!!patient}
            />
          </div>

          <div>
            <Label htmlFor="name">{t('patients.name')}</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Juan Pérez"
              required
            />
          </div>

          <div>
            <Label htmlFor="dateOfBirth">{t('patients.dateOfBirth')}</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) =>
                setFormData({ ...formData, dateOfBirth: e.target.value })
              }
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PatientForm;
