import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectOption } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { classManager, ClassDefinition } from '@/lib/classes/class-manager';
import { getClassName } from '@/lib/ai/class-translations';

interface ClassSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClassSelected: (className: string) => void;
  onCancel: () => void;
  imageId: number;
}

const ClassSelectionModal: React.FC<ClassSelectionModalProps> = ({
  open,
  onOpenChange,
  onClassSelected,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const [availableClasses, setAvailableClasses] = useState<ClassDefinition[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [customClassName, setCustomClassName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Cargar clases disponibles cuando se abre el modal
  useEffect(() => {
    if (open) {
      loadClasses();
      // Resetear estado
      setSelectedClass('');
      setCustomClassName('');
    }
  }, [open]);

  const loadClasses = async () => {
    setLoading(true);
    try {
      // Asegurar que el metadata del modelo esté cargado
      await classManager.ensureMetadataLoaded();

      const classes = await classManager.getAllClasses();
      setAvailableClasses(classes);
    } catch (error) {
      console.error('Error al cargar clases:', error);
    } finally {
      setLoading(false);
    }
  };

  // Convertir ClassDefinition[] a SelectOption[]
  const getSelectOptions = (): SelectOption[] => {
    const options: SelectOption[] = availableClasses.map(cls => ({
      value: cls.name,
      label: `${getClassName(cls.name, i18n.language)} ${cls.source === 'ai' ? '(IA)' : '(Custom)'}`
    }));

    // Agregar opción "Otra..."
    options.push({
      value: '__custom__',
      label: t('canvas.classSelection.other')
    });

    return options;
  };

  const handleConfirm = () => {
    let finalClassName: string;

    if (selectedClass === '__custom__') {
      // Usuario eligió crear clase personalizada
      finalClassName = customClassName.trim();
    } else {
      // Usuario eligió clase existente
      finalClassName = selectedClass;
    }

    // Validar que no esté vacío
    if (!finalClassName || finalClassName.length === 0) {
      toast.error(t('canvas.classSelection.alert'));
      return;
    }

    // Llamar callback con el nombre de la clase
    onClassSelected(finalClassName);
  };

  const handleCancel = () => {
    onCancel();
  };

  // Determinar si el botón confirmar debe estar habilitado
  const isConfirmDisabled = () => {
    if (!selectedClass) return true;
    if (selectedClass === '__custom__' && customClassName.trim().length === 0) return true;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('canvas.classSelection.title')}</DialogTitle>
          <DialogDescription>
            {t('canvas.classSelection.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-4 text-smoke-500">
              {t('canvas.classSelection.loading')}
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="class-select">{t('canvas.classSelection.label')}</Label>
                <Select
                  value={selectedClass}
                  onValueChange={setSelectedClass}
                  options={getSelectOptions()}
                  placeholder={t('canvas.classSelection.placeholder')}
                  className="mt-1"
                />
              </div>

              {selectedClass === '__custom__' && (
                <div>
                  <Label htmlFor="custom-class-input">{t('canvas.classSelection.customLabel')}</Label>
                  <Input
                    id="custom-class-input"
                    value={customClassName}
                    onChange={(e) => setCustomClassName(e.target.value)}
                    placeholder={t('canvas.classSelection.customPlaceholder')}
                    className="mt-1"
                    autoFocus
                  />
                </div>
              )}
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
            >
              {t('ui.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirmDisabled()}
            >
              {t('canvas.classSelection.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClassSelectionModal;
