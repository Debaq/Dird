import { useEffect, useState, useRef } from 'react';
import { Upload, Check, Trash2, AlertCircle, CheckCircle, Loader2, FileJson, Box } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  listModels,
  uninstallModel,
  setActiveModel,
  validateAndInstallModel,
  type InstalledModel,
  type InstallResult,
} from '@/lib/ai/model-registry';

export function CustomModelsSection() {
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [lastResult, setLastResult] = useState<InstallResult | null>(null);
  const onnxInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const [pendingOnnx, setPendingOnnx] = useState<File | null>(null);
  const [pendingCard, setPendingCard] = useState<File | null>(null);

  const refresh = async () => {
    try {
      const m = await listModels();
      setModels(m);
    } catch (e) {
      toast.error('No se pudo listar modelos: ' + String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleInstall = async () => {
    if (!pendingOnnx || !pendingCard) {
      toast.error('Selecciona ambos archivos (.onnx + .json).');
      return;
    }
    setInstalling(true);
    setLastResult(null);
    try {
      const onnxBytes = new Uint8Array(await pendingOnnx.arrayBuffer());
      const cardJson = await pendingCard.text();
      const result = await validateAndInstallModel({ onnxBytes, cardJson });
      setLastResult(result);
      if (result.ok) {
        toast.success(`Modelo "${result.model?.name}" instalado.`);
        setPendingOnnx(null);
        setPendingCard(null);
        if (onnxInputRef.current) onnxInputRef.current.value = '';
        if (cardInputRef.current) cardInputRef.current.value = '';
        await refresh();
      } else {
        toast.error('Validación falló — revisar detalles.');
      }
    } catch (e) {
      toast.error('Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setInstalling(false);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await setActiveModel(id);
      toast.success('Modelo activado.');
      await refresh();
    } catch (e) {
      toast.error('No se pudo activar: ' + String(e));
    }
  };

  const handleUninstall = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar el modelo "${name}"?`)) return;
    try {
      await uninstallModel(id);
      toast.success('Modelo eliminado.');
      await refresh();
    } catch (e) {
      toast.error('No se pudo eliminar: ' + String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-coal-900 dark:text-dark-text">
          Modelos externos
        </h3>
        <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
          DIRD+ es model-agnostic. Carga modelos ONNX de terceros que cumplan con la
          {' '}
          <a href="/docs/model-interface.md" target="_blank" className="text-blue-600 hover:underline">
            especificación model-interface v2.0
          </a>.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <h4 className="font-semibold text-coal-900 dark:text-dark-text flex items-center gap-2">
          <Upload className="w-4 h-4" /> Instalar modelo nuevo
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-smoke-700 dark:text-dark-textSecondary block mb-1 flex items-center gap-1">
              <Box className="w-3.5 h-3.5" /> Archivo .onnx
            </label>
            <input
              ref={onnxInputRef}
              type="file"
              accept=".onnx"
              onChange={(e) => setPendingOnnx(e.target.files?.[0] ?? null)}
              className="text-sm w-full"
            />
            {pendingOnnx && (
              <p className="text-xs text-smoke-500 mt-1">
                {pendingOnnx.name} · {(pendingOnnx.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>
          <div>
            <label className="text-sm text-smoke-700 dark:text-dark-textSecondary block mb-1 flex items-center gap-1">
              <FileJson className="w-3.5 h-3.5" /> Model card .json
            </label>
            <input
              ref={cardInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setPendingCard(e.target.files?.[0] ?? null)}
              className="text-sm w-full"
            />
            {pendingCard && (
              <p className="text-xs text-smoke-500 mt-1">{pendingCard.name}</p>
            )}
          </div>
        </div>
        <Button
          onClick={handleInstall}
          disabled={!pendingOnnx || !pendingCard || installing}
          className="w-full gap-2"
        >
          {installing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {installing ? 'Validando e instalando…' : 'Validar e instalar'}
        </Button>

        {lastResult && (
          <div
            className={
              lastResult.ok
                ? 'p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-lg'
                : 'p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg'
            }
          >
            <div className="flex items-start gap-2">
              {lastResult.ok ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="text-sm space-y-1 flex-1">
                {lastResult.ok ? (
                  <>
                    <p className="font-semibold text-green-800 dark:text-green-200">Instalado correctamente</p>
                    {lastResult.sanity && (
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Sanity check: {lastResult.sanity.inferenceMs?.toFixed(1)} ms ·
                        output shape {JSON.stringify(lastResult.sanity.outputShape)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-red-800 dark:text-red-200">Validación falló</p>
                    <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-0.5">
                      {lastResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-coal-900 dark:text-dark-text">
          Modelos instalados ({loading ? '…' : models.length})
        </h4>
        {loading ? (
          <p className="text-sm text-smoke-500">Cargando…</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-smoke-500">No hay modelos personalizados instalados.</p>
        ) : (
          <ul className="divide-y divide-smoke-200 dark:divide-coal-700">
            {models.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-coal-900 dark:text-dark-text truncate">{m.name}</p>
                    <span className="text-xs text-smoke-500">v{m.version}</span>
                    {m.active && (
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                        Activo
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-smoke-500">
                    {(m.size_bytes / 1024 / 1024).toFixed(1)} MB · instalado {m.installed_at}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!m.active && (
                    <Button size="sm" variant="outline" onClick={() => handleActivate(m.id)} className="gap-1">
                      <Check className="w-3.5 h-3.5" /> Activar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUninstall(m.id, m.name)}
                    className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
