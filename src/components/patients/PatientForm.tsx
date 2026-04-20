import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
    diabetes: false,
    diabetesType: '',
    diabetesDuration: '',
    hta: false,
    dlp: false,
    medications: '',
    otherConditions: '',
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
          diabetes: patient.diabetes || false,
          diabetesType: patient.diabetesType || '',
          diabetesDuration: patient.diabetesDuration ? patient.diabetesDuration.toString() : '',
          hta: patient.hta || false,
          dlp: patient.dlp || false,
          medications: patient.medications ? patient.medications.join(', ') : '',
          otherConditions: patient.otherConditions || '',
        });
      } else {
        setFormData({
          patientId: '',
          name: '',
          dateOfBirth: '',
          diabetes: false,
          diabetesType: '',
          diabetesDuration: '',
          hta: false,
          dlp: false,
          medications: '',
          otherConditions: '',
        });
      }
    }
  }, [open, patient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const now = new Date();
      const medicationsArray = formData.medications
        ? formData.medications.split(',').map(med => med.trim()).filter(med => med)
        : [];

      const patientData = {
        patientId: formData.patientId,
        name: formData.name,
        dateOfBirth: new Date(formData.dateOfBirth),
        diabetes: formData.diabetes,
        diabetesType: formData.diabetesType ? formData.diabetesType as 'type1' | 'type2' | 'gestational' | 'other' : undefined,
        diabetesDuration: formData.diabetesDuration ? parseInt(formData.diabetesDuration) : undefined,
        hta: formData.hta,
        dlp: formData.dlp,
        medications: medicationsArray,
        otherConditions: formData.otherConditions || undefined,
        status: (patient?.status || 'active') as 'active' | 'archived',
        createdAt: patient?.createdAt || now,
        updatedAt: now,
      };

      if (patient?.id) {
        await db.patients.update(patient.id, patientData as any);
      } else {
        await db.patients.add(patientData as any);
      }

      onSuccess?.();
      onOpenChange(false);
      setFormData({
        patientId: '',
        name: '',
        dateOfBirth: '',
        diabetes: false,
        diabetesType: '',
        diabetesDuration: '',
        hta: false,
        dlp: false,
        medications: '',
        otherConditions: '',
      });
    } catch (error) {
      console.error('Error saving patient:', error);
      toast.error(t('errors.savePatient'));
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
              ? t('patients.form.editDescription')
              : t('patients.form.createDescription')}
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
              placeholder={t('patients.placeholders.id')}
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
              placeholder={t('patients.placeholders.name')}
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

          {/* Campos médicos para retinopatía diabética */}
          <div className="space-y-4 pt-4 border-t border-coal-200">
            <h3 className="font-medium text-coal-700">{t('patients.form.medicalHistory')}</h3>

            <div className="space-y-5">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="diabetes"
                  checked={formData.diabetes}
                  onChange={(e) => setFormData({ ...formData, diabetes: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-coal-300 focus:ring-primary-500"
                />
                <Label htmlFor="diabetes">{t('patients.form.diabetes')}</Label>
              </div>

              {formData.diabetes && (
                <div className="space-y-2">
                  <Label htmlFor="diabetesType">{t('patients.form.diabetesType')}</Label>
                  <select
                    id="diabetesType"
                    value={formData.diabetesType}
                    onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
                    className="w-full rounded-md border border-coal-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">{t('patients.form.selectType')}</option>
                    <option value="type1">{t('patients.form.types.type1')}</option>
                    <option value="type2">{t('patients.form.types.type2')}</option>
                    <option value="gestational">{t('patients.form.types.gestational')}</option>
                    <option value="other">{t('patients.form.types.other')}</option>
                  </select>
                </div>
              )}

              {formData.diabetes && (
                <div className="space-y-2">
                  <Label htmlFor="diabetesDuration">{t('patients.form.diabetesDuration')}</Label>
                  <Input
                    id="diabetesDuration"
                    type="number"
                    value={formData.diabetesDuration}
                    onChange={(e) => setFormData({ ...formData, diabetesDuration: e.target.value })}
                    placeholder={t('patients.form.diabetesDurationPlaceholder')}
                    min="0"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hta"
                  checked={formData.hta}
                  onChange={(e) => setFormData({ ...formData, hta: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-coal-300 focus:ring-primary-500"
                />
                <Label htmlFor="hta">{t('patients.form.hta')}</Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="dlp"
                  checked={formData.dlp}
                  onChange={(e) => setFormData({ ...formData, dlp: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-coal-300 focus:ring-primary-500"
                />
                <Label htmlFor="dlp">{t('patients.form.dlp')}</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="medications">{t('patients.fields.medications')}</Label>
              <Input
                id="medications"
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                placeholder={t('patients.form.medicationsPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="otherConditions">{t('patients.form.otherConditions')}</Label>
              <textarea
                id="otherConditions"
                value={formData.otherConditions}
                onChange={(e) => setFormData({ ...formData, otherConditions: e.target.value })}
                placeholder={t('patients.form.otherConditionsPlaceholder')}
                rows={2}
                className="w-full rounded-md border border-coal-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t('ui.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t('ui.saving') : t('ui.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PatientForm;
