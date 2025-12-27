import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
            name: t('sessions.session') + ` N° ${sessionNumber}`,
            date: new Date().toISOString().split('T')[0],
            notes: '',
          });
        };
        getNextSessionInfo();
      }
    }
  }, [open, patientId, sessionToEdit, isEditMode, t]);

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
      toast.error(t('errors.saveSession'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? t('sessions.form.update') : t('sessions.form.create')}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t('sessions.form.editDescription')
              : t('sessions.form.createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">{t('sessions.form.name')}</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="date">{t('sessions.form.date')}</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="notes">{t('sessions.form.notes')}</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder={t('sessions.form.notesPlaceholder')}
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
              {t('ui.cancel')}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEditMode ? t('ui.saving') : t('ui.creating')
                : isEditMode ? t('ui.saveChanges') : t('ui.createSession')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SessionForm;

