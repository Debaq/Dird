import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { db, Session } from '@/lib/db/schema';

interface SessionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  sessionToEdit?: Session;
  onSuccess?: () => void;
}

const SessionForm: React.FC<SessionFormProps> = ({
  open,
  onOpenChange,
  patientId,
  sessionToEdit,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const isEditMode = sessionToEdit !== undefined;

  useEffect(() => {
    if (open) {
      if (isEditMode && sessionToEdit) {
        setFormData({
          name: sessionToEdit.name || '',
          date: new Date(sessionToEdit.date).toISOString().split('T')[0],
          notes: sessionToEdit.notes || '',
        });
      } else {
        const getNextSessionInfo = async () => {
          const existingSessions = await db.sessions
            .where('patientId')
            .equals(patientId)
            .toArray();
          const sessionNumber = existingSessions.length + 1;
          setFormData({
            name: `Sesión N° ${sessionNumber}`,
            date: new Date().toISOString().split('T')[0],
            notes: '',
          });
        };
        getNextSessionInfo();
      }
    }
  }, [open, patientId, sessionToEdit, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEditMode && sessionToEdit) {
        // Update existing session
        await db.sessions.update(sessionToEdit.id!, {
          name: formData.name,
          date: new Date(formData.date),
          notes: formData.notes,
          updatedAt: new Date(),
        });
      } else {
        // Create new session
        const existingSessions = await db.sessions
          .where('patientId')
          .equals(patientId)
          .toArray();
        const sessionNumber = existingSessions.length + 1;

        const now = new Date();
        const sessionData: Omit<Session, 'id'> = {
          patientId,
          name: formData.name,
          sessionNumber,
          date: new Date(formData.date),
          notes: formData.notes,
          modelVersions: {},
          locked: false,
          createdAt: now,
          updatedAt: now,
        };
        await db.sessions.add(sessionData as Session);
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error al guardar la sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Sesión' : t('sessions.create')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Modifica los detalles de esta sesión.'
              : 'Crea una nueva sesión de análisis para este paciente'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Nombre de la sesión</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="date">{t('sessions.date')}</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">{t('sessions.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionales sobre esta sesión..."
              rows={4}
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
              {loading
                ? isEditMode ? 'Guardando...' : 'Creando...'
                : isEditMode ? 'Guardar Cambios' : 'Crear Sesión'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SessionForm;

