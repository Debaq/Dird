import { useEffect, useState } from 'react';
import { 
  Save, Key, Cpu, MessageSquare, Play, RefreshCw, Trash2, Edit2, Check 
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { 
  getAIConfig, 
  saveAIConfig, 
  testAIConfig, 
  type AIConfig, 
  type AIModel 
} from '@/lib/api/ai-config-service';

export function AIConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [activeTab, setActiveTab] = useState('prompt');

  // Test State
  const [testResult, setTestResult] = useState<any>(null);

  // Model Editing State
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel>({ id: '', name: '', description: '' });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getAIConfig();
      if (data.success) {
        setConfig(data.config);
        setHasKey(data.has_key);
        setMaskedKey(data.masked_key);
      } else {
        toast.error('Error cargando configuración: ' + data.error);
      }
    } catch (error) {
      toast.error('Error de conexión');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKey) return;
    try {
      setSaving(true);
      await saveAIConfig({ api_key: apiKey });
      toast.success('API Key actualizada');
      setApiKey('');
      loadConfig();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      setSaving(true);
      await saveAIConfig({
        active_model: config.active_model,
        models: config.models,
        system_prompt: config.system_prompt
      });
      toast.success('Configuración guardada');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config) return;
    try {
      setTesting(true);
      setTestResult(null);
      
      const testData = {
        patient: { name: "Test Patient", age: 45 },
        detections: [
            { type: "Microaneurysm", confidence: 0.95 },
            { type: "Hemorrhage", confidence: 0.88 }
        ]
      };

      const result = await testAIConfig({
        model: config.active_model,
        system_prompt: config.system_prompt,
        test_data: testData
      });

      setTestResult(result);
      if (result.success) {
        toast.success('Prueba exitosa');
      } else {
        toast.warning('La prueba completó con advertencias');
      }
    } catch (error: any) {
      toast.error('Error en la prueba: ' + error.message);
      setTestResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  const handleAddModel = () => {
    if (!config) return;
    const newModel = { ...editingModel };
    
    // Validation
    if (!newModel.id || !newModel.name) {
      toast.error('ID y Nombre son requeridos');
      return;
    }

    // Check if ID exists
    const exists = config.models.some(m => m.id === newModel.id);
    if (exists) {
        // Update existing
        const updatedModels = config.models.map(m => m.id === newModel.id ? newModel : m);
        setConfig({ ...config, models: updatedModels });
        toast.success('Modelo actualizado');
    } else {
        // Add new
        setConfig({ ...config, models: [...config.models, newModel] });
        toast.success('Modelo agregado');
    }
    setIsEditingModel(false);
    setEditingModel({ id: '', name: '', description: '' });
  };

  const handleDeleteModel = (id: string) => {
    if (!config) return;
    if (config.models.length <= 1) {
        toast.error('Debe haber al menos un modelo');
        return;
    }
    if (config.active_model === id) {
        toast.error('No puedes eliminar el modelo activo');
        return;
    }
    const filtered = config.models.filter(m => m.id !== id);
    setConfig({ ...config, models: filtered });
  };

  const handleEditClick = (model: AIModel) => {
    setEditingModel(model);
    setIsEditingModel(true);
  };

  if (loading) return <div className="p-8 text-center">Cargando configuración...</div>;
  if (!config) return <div className="p-8 text-center text-red-500">Error cargando configuración</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-coal-800 dark:text-dark-text">Configuración de IA (Groq)</h2>
        <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* API Key Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5 text-primary-500" />
              API Key
            </CardTitle>
            <CardDescription>
              Gestiona tu clave de API de Groq Cloud
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm font-mono">
                {hasKey ? (
                    <span className="text-green-600 dark:text-green-400 font-bold">Configurada: {maskedKey}</span>
                ) : (
                    <span className="text-amber-600 dark:text-amber-400 font-bold">No configurada</span>
                )}
            </div>
            <div className="flex gap-2">
                <Input 
                    type="password" 
                    placeholder="Nueva API Key (gsk_...)" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
                <Button variant="secondary" onClick={handleSaveKey} disabled={!apiKey || saving}>
                    Actualizar
                </Button>
            </div>
          </CardContent>
        </Card>

        {/* Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cpu className="w-5 h-5 text-primary-500" />
              Modelo Activo
            </CardTitle>
            <CardDescription>
              Selecciona el modelo que se usará para generar reportes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
                <Label>Modelo Seleccionado</Label>
                <Select
                  value={config.active_model}
                  onValueChange={(val) => setConfig({...config, active_model: val})}
                  options={config.models.map(m => ({ value: m.id, label: m.name }))}
                  placeholder="Selecciona un modelo"
                />
            </div>
            
            <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                onClick={() => setIsEditingModel(true)}
            >
                <Edit2 className="w-4 h-4" /> Administrar Modelos
            </Button>

            <Dialog open={isEditingModel} onOpenChange={setIsEditingModel}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Administrar Modelos</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 my-4">
                        <div className="border rounded-md overflow-hidden max-h-[200px] overflow-y-auto">
                            {config.models.map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <div>
                                        <div className="font-semibold text-sm">{m.name}</div>
                                        <div className="text-xs text-muted-foreground">{m.id}</div>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEditClick(m)}>
                                            <Edit2 className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => handleDeleteModel(m.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-md space-y-3">
                            <h4 className="font-semibold text-sm">Agregar / Editar Modelo</h4>
                            <div className="grid gap-2">
                                <Label>ID del Modelo (Groq ID)</Label>
                                <Input 
                                    value={editingModel.id} 
                                    onChange={(e) => setEditingModel({...editingModel, id: e.target.value})} 
                                    placeholder="e.g. llama-3.3-70b-versatile"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Nombre Visible</Label>
                                <Input 
                                    value={editingModel.name} 
                                    onChange={(e) => setEditingModel({...editingModel, name: e.target.value})} 
                                    placeholder="e.g. Llama 3.3 70B"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Descripción</Label>
                                <Input 
                                    value={editingModel.description} 
                                    onChange={(e) => setEditingModel({...editingModel, description: e.target.value})} 
                                    placeholder="Breve descripción..."
                                />
                            </div>
                            <Button onClick={handleAddModel} className="w-full">
                                <Check className="w-4 h-4 mr-2" /> Guardar Modelo
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
            <TabsTrigger value="prompt" className="gap-2">
                <MessageSquare className="w-4 h-4" /> System Prompt
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2">
                <Play className="w-4 h-4" /> Probador / Playground
            </TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompt">
            <Card>
                <CardHeader>
                    <CardTitle>Prompt del Sistema</CardTitle>
                    <CardDescription>
                        Define cómo debe comportarse la IA. Usa <code>{'{LANGUAGE}'}</code> como placeholder para el idioma del reporte.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea 
                        className="font-mono text-sm min-h-[300px]"
                        value={config.system_prompt}
                        onChange={(e) => setConfig({...config, system_prompt: e.target.value})}
                    />
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="test">
            <Card>
                <CardHeader>
                    <CardTitle>Probador de Configuración</CardTitle>
                    <CardDescription>
                        Envía una petición de prueba para verificar que la Key, el Modelo y el Prompt funcionan correctamente.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleTest} disabled={testing || !hasKey} className="w-full">
                        {testing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        {testing ? 'Probando...' : 'Ejecutar Prueba'}
                    </Button>
                    
                    {!hasKey && (
                        <div className="text-amber-600 text-sm text-center">Configura una API Key primero para probar.</div>
                    )}

                    {testResult && (
                        <div className="mt-4 p-4 rounded-md bg-slate-950 text-slate-50 font-mono text-xs overflow-auto max-h-[400px]">
                            <pre>{JSON.stringify(testResult, null, 2)}</pre>
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

    </div>
  );
}
