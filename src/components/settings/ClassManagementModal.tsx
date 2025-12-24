import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { classManager, type ClassDefinition } from '@/lib/classes/class-manager';
import { useConfigStore } from '@/stores/config-store';
import { RefreshCw, Save } from 'lucide-react';

interface ClassManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ClassManagementModal: React.FC<ClassManagementModalProps> = ({
  open,
  onOpenChange
}) => {
  const { t } = useTranslation();
  const { config, updateAppearance } = useConfigStore();
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, { translation: string, color: string }>>({});

  // Cargar clases cuando se abre el modal
  useEffect(() => {
    if (open) {
      loadClasses();
    }
  }, [open]);

  const loadClasses = async () => {
    setIsLoading(true);
    try {
      const all = await classManager.getAllClasses();
      setClasses(all);
      
      // Inicializar el estado de edición con los valores actuales
      const initialEdits: Record<string, { translation: string, color: string }> = {};
      all.forEach(cls => {
        initialEdits[cls.name] = {
          translation: cls.customName || '', // Solo mostrar si hay una custom
          color: cls.color
        };
      });
      setEdits(initialEdits);
    } catch (error) {
      console.error('Error loading classes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = () => {
    // Guardar cambios en translations y colores
    Object.entries(edits).forEach(([className, data]) => {
      // Guardar traducción personalizada
      classManager.saveCustomTranslation(className, data.translation);
      // Guardar color personalizado
      classManager.saveColorPreference(className, data.color);
    });

    // Recargar para confirmar visualmente (opcional) o cerrar
    loadClasses();
    onOpenChange(false);
    
    // Forzar recarga de la página o notificar cambios si es necesario para que otros componentes se actualicen
    // Como classManager no es reactivo, los componentes que usan getClassName o getColorForClass
    // se actualizarán en su próximo render.
    window.location.reload(); // Manera bruta de asegurar que todo se actualice (labels, colores en canvas, etc)
    // Una alternativa mejor sería un evento global o usar el store para triggerear updates, pero por ahora esto asegura consistencia.
  };

  const handleColorChange = (className: string, newColor: string) => {
    setEdits(prev => ({
      ...prev,
      [className]: {
        ...prev[className],
        color: newColor
      }
    }));
  };

  const handleTranslationChange = (className: string, newTranslation: string) => {
    setEdits(prev => ({
      ...prev,
      [className]: {
        ...prev[className],
        translation: newTranslation
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('settings.classes.title') || 'Gestión de Clases del Modelo'}</DialogTitle>
          <DialogDescription>
            {t('settings.classes.description') || 'Personaliza los nombres y colores de las clases detectadas.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Rainbow Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-secondary/10 rounded-lg border border-secondary/20">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">
                {t('settings.classes.rainbowMode') || 'Modo Arcoiris'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.classes.rainbowModeDesc') || 'Si está activado, cada clase tendrá su propio color. Si no, se usará el color principal.'}
              </p>
            </div>
            <Switch
              checked={config.appearance.rainbowMode}
              onCheckedChange={(checked) => updateAppearance({ rainbowMode: checked })}
            />
          </div>

          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t('settings.classes.list') || 'Lista de Clases'}
            </h3>
            <Button variant="ghost" size="sm" onClick={loadClasses} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {t('ui.refresh')}
            </Button>
          </div>

          <div className="flex-1 border rounded-md overflow-hidden bg-background">
            <div className="grid grid-cols-12 gap-4 p-3 border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-3">ID (JSON)</div>
              <div className="col-span-5">Nombre (Traducción)</div>
              <div className="col-span-3 text-center">Color</div>
            </div>
            
            <div className="h-[400px] overflow-y-auto border rounded-md">
              <div className="divide-y">
                {classes.map((cls, index) => (
                  <div key={cls.name} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-muted/30">
                    <div className="col-span-1 text-center text-sm font-mono text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="col-span-3 text-sm font-mono truncate" title={cls.name}>
                      {cls.name}
                    </div>
                    <div className="col-span-5">
                      <Input
                        value={edits[cls.name]?.translation || ''}
                        onChange={(e) => handleTranslationChange(cls.name, e.target.value)}
                        placeholder={cls.displayName !== cls.name ? cls.displayName : 'Nombre personalizado...'}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-3 flex justify-center items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded-full border shadow-sm cursor-pointer relative overflow-hidden"
                        style={{ backgroundColor: edits[cls.name]?.color }}
                      >
                        <input
                          type="color"
                          value={edits[cls.name]?.color}
                          onChange={(e) => handleColorChange(cls.name, e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-16 text-right">
                        {edits[cls.name]?.color.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('ui.cancel')}
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {t('ui.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassManagementModal;
