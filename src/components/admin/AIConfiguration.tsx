import { useEffect, useState } from 'react';
import {
  Save, Key, Cpu, MessageSquare, Play, RefreshCw, Trash2, Edit2, Check, BarChart2, Settings2, Cloud
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
  getAIStats,
  syncAIModels,
  type AIConfig, 
  type AIModel,
  type AIStats
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

  // Stats State
  const [stats, setStats] = useState<AIStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Model Editing State
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel>({ id: '', name: '', description: '', context_window: 128000 });

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
        system_prompt: config.system_prompt,
        temperature: config.temperature,
        max_completion_tokens: config.max_completion_tokens,
        top_p: config.top_p,
        reasoning_effort: config.reasoning_effort,
        stream: config.stream,
        stop: config.stop
      });
      toast.success('Configuración guardada');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const loadStats = async () => {
    try {
        setLoadingStats(true);
        const data = await getAIStats();
        setStats(data);
    } catch (error) {
        console.error('Failed to load stats', error);
        toast.error('No se pudieron cargar las estadísticas');
    } finally {
        setLoadingStats(false);
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

  const handleSyncModels = async () => {
    try {
        setSyncing(true);
        const result = await syncAIModels();
        if (result.success) {
            toast.success(`Sincronización exitosa: ${result.models.length} modelos encontrados`);
            loadConfig(); // Reload to reflect changes
        } else {
            toast.warning(result.message);
        }
    } catch (error: any) {
        toast.error('Error al sincronizar: ' + error.message);
    } finally {
        setSyncing(false);
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
    setEditingModel({ id: '', name: '', description: '', context_window: 128000 });
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
            
            <div className="flex gap-2">
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 gap-2"
                    onClick={() => setIsEditingModel(true)}
                >
                    <Edit2 className="w-4 h-4" /> Administrar
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                    onClick={handleSyncModels}
                    disabled={syncing || !hasKey}
                >
                    <Cloud className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} /> 
                    {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
            </div>

            <Dialog open={isEditingModel} onOpenChange={setIsEditingModel}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Administrar Modelos</DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-4 my-4">
                        <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                            {config.models.map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-sm truncate">{m.name}</div>
                                            {m.context_window && (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-mono">
                                                    {(m.context_window / 1000)}k
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground truncate" title={m.id}>{m.id}</div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Nombre Visible</Label>
                                    <Input 
                                        value={editingModel.name} 
                                        onChange={(e) => setEditingModel({...editingModel, name: e.target.value})} 
                                        placeholder="e.g. Llama 3.3 70B"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Context Window (tokens)</Label>
                                    <Input 
                                        type="number"
                                        value={editingModel.context_window ?? 128000} 
                                        onChange={(e) => setEditingModel({...editingModel, context_window: parseInt(e.target.value)})} 
                                        placeholder="128000"
                                    />
                                </div>
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

      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        if (val === 'stats') loadStats();
      }} className="w-full">
        <TabsList>
            <TabsTrigger value="prompt" className="gap-2">
                <MessageSquare className="w-4 h-4" /> System Prompt
            </TabsTrigger>
            <TabsTrigger value="params" className="gap-2">
                <Settings2 className="w-4 h-4" /> Parámetros
            </TabsTrigger>
            <TabsTrigger value="test" className="gap-2">
                <Play className="w-4 h-4" /> Probador / Playground
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
                <BarChart2 className="w-4 h-4" /> Estadísticas
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

        <TabsContent value="params">
            <Card>
                <CardHeader>
                    <CardTitle>Parámetros de Inferencia</CardTitle>
                    <CardDescription>
                        Configura el comportamiento del modelo de Groq
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Temperature */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">Temperature</Label>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                    {config.temperature ?? 1}
                                </span>
                            </div>
                            <Slider 
                                value={[config.temperature ?? 1]} 
                                min={0} 
                                max={2} 
                                step={0.1}
                                onValueChange={([val]) => setConfig({...config, temperature: val})}
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Controla la aleatoriedad. 0 es determinista, 2 es muy creativo.
                            </p>
                        </div>

                        {/* Top P */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <Label className="text-sm font-medium">Top P</Label>
                                <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">
                                    {config.top_p ?? 1}
                                </span>
                            </div>
                            <Slider 
                                value={[config.top_p ?? 1]} 
                                min={0} 
                                max={1} 
                                step={0.05}
                                onValueChange={([val]) => setConfig({...config, top_p: val})}
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Muestreo de núcleo (nucleus sampling). Alternativa a temperature.
                            </p>
                        </div>

                        {/* Max Tokens */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Max Completion Tokens</Label>
                            <Input 
                                type="number"
                                value={config.max_completion_tokens ?? 8192}
                                onChange={(e) => setConfig({...config, max_completion_tokens: parseInt(e.target.value)})}
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Límite máximo de tokens generados en la respuesta.
                            </p>
                        </div>

                        {/* Reasoning Effort */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Reasoning Effort</Label>
                            <Select 
                                value={config.reasoning_effort ?? 'medium'}
                                onValueChange={(val: any) => setConfig({...config, reasoning_effort: val})}
                                options={[
                                    { value: 'low', label: 'Bajo (Low)' },
                                    { value: 'medium', label: 'Medio (Medium)' },
                                    { value: 'high', label: 'Alto (High)' }
                                ]}
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Solo aplica para modelos con capacidades de razonamiento (como o1).
                            </p>
                        </div>

                        {/* Stream */}
                        <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium">Stream</Label>
                                <p className="text-[10px] text-muted-foreground">Recibir respuesta en tiempo real</p>
                            </div>
                            <Switch 
                                checked={config.stream ?? true}
                                onCheckedChange={(val) => setConfig({...config, stream: val})}
                            />
                        </div>

                        {/* Stop Sequences */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Stop Sequences (JSON format)</Label>
                            <Input 
                                value={typeof config.stop === 'string' ? config.stop : JSON.stringify(config.stop) === 'null' ? '' : JSON.stringify(config.stop)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    try {
                                        if (!val) {
                                            setConfig({...config, stop: null});
                                        } else if (val.startsWith('[') || val.startsWith('"')) {
                                            setConfig({...config, stop: JSON.parse(val)});
                                        } else {
                                            setConfig({...config, stop: val});
                                        }
                                    } catch {
                                        // While typing ignore JSON errors
                                        setConfig({...config, stop: val});
                                    }
                                }}
                                placeholder='null, "STOP", o ["END", "\n"]'
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                                Secuencias que detienen la generación.
                            </p>
                        </div>
                    </div>
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

        <TabsContent value="stats">
            <div className="grid gap-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{stats?.summary.total_requests ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Peticiones Totales</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{stats?.summary.total_tokens.toLocaleString() ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Tokens Totales</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-blue-600">{stats?.summary.total_prompt_tokens.toLocaleString() ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Input Tokens</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold text-green-600">{stats?.summary.total_completion_tokens.toLocaleString() ?? 0}</div>
                            <p className="text-xs text-muted-foreground">Output Tokens</p>
                        </CardContent>
                    </Card>
                </div>

                {/* History Table */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Historial Reciente</CardTitle>
                            <CardDescription>Últimas 100 interacciones con la API</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={loadStats} disabled={loadingStats}>
                            <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <div className="grid grid-cols-6 gap-4 p-4 border-b font-medium text-sm bg-slate-50 dark:bg-slate-900">
                                <div className="col-span-2">Fecha</div>
                                <div>Contexto</div>
                                <div>Modelo</div>
                                <div className="text-right">Tokens</div>
                                <div className="text-right">Costo Est.</div>
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                {loadingStats ? (
                                    <div className="p-8 text-center text-muted-foreground">Cargando...</div>
                                ) : stats?.history.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">No hay registros aún</div>
                                ) : (
                                    stats?.history.map((item) => (
                                        <div key={item.id} className="grid grid-cols-6 gap-4 p-3 border-b last:border-0 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <div className="col-span-2 text-xs text-muted-foreground">{item.date}</div>
                                            <div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                    item.context === 'production_report' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {item.context === 'production_report' ? 'Reporte' : 'Test'}
                                                </span>
                                            </div>
                                            <div className="text-xs truncate" title={item.model}>{item.model}</div>
                                            <div className="text-right font-mono">{item.tokens.total_tokens}</div>
                                            <div className="text-right font-mono text-muted-foreground text-xs">
                                                {/* Rough estimate based on mixed pricing, purely visual */}
                                                ${((item.tokens.total_tokens / 1000) * 0.001).toFixed(5)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
