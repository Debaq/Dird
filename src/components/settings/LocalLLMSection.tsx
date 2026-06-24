import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot, Download, Trash2, Check, Loader2, Play, AlertCircle, X,
  Sparkles, Languages,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  llmCatalog, llmInstalled, llmDownload, llmUninstall,
  llmLoad, llmUnload, llmGenerate, onLlmDownloadProgress,
  type CatalogEntry, type InstalledLlm,
} from '@/lib/ai/llm-client';

interface DownloadState {
  received: number;
  total: number;
}

export function LocalLLMSection() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<InstalledLlm[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [testPrompt, setTestPrompt] = useState(t('settings.localLlm.defaultTestPrompt'));
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const refresh = async () => {
    try {
      const [c, i] = await Promise.all([llmCatalog(), llmInstalled()]);
      setCatalog(c);
      setInstalled(i);
    } catch (e) {
      toast.error(t('settings.localLlm.toast.unavailable', { error: String(e) }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    void onLlmDownloadProgress((p) => {
      setDownloads((prev) => ({
        ...prev,
        [p.id]: { received: p.received, total: p.total },
      }));
      if (p.done) {
        setDownloads((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
        void refresh();
      }
    }).then((un) => { unlistenRef.current = un; });
    return () => { unlistenRef.current?.(); };
  }, []);

  const handleDownload = async (entry: CatalogEntry) => {
    setDownloads((prev) => ({ ...prev, [entry.id]: { received: 0, total: entry.size_mb * 1024 * 1024 } }));
    try {
      await llmDownload(entry.id);
      toast.success(t('settings.localLlm.toast.downloaded', { name: entry.name }));
    } catch (e) {
      toast.error(t('settings.localLlm.toast.downloadError', { error: String(e) }));
      setDownloads((prev) => {
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await llmLoad(id);
      toast.success(t('settings.localLlm.toast.loaded'));
      await refresh();
    } catch (e) {
      toast.error(t('settings.localLlm.toast.loadError', { error: String(e) }));
    }
  };

  const handleUnload = async () => {
    await llmUnload();
    await refresh();
    toast.success(t('settings.localLlm.toast.unloaded'));
  };

  const handleUninstall = async (id: string, name: string) => {
    if (!confirm(t('settings.localLlm.confirmUninstall', { name }))) return;
    try {
      await llmUninstall(id);
      toast.success(t('settings.localLlm.toast.deleted'));
      await refresh();
    } catch (e) {
      toast.error(t('settings.localLlm.toast.deleteError', { error: String(e) }));
    }
  };

  const handleTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestOutput(null);
    try {
      const out = await llmGenerate({ prompt: testPrompt, max_tokens: 256, temperature: 0.6 });
      setTestOutput(out);
    } catch (e) {
      toast.error(t('settings.localLlm.toast.error', { error: String(e) }));
    } finally {
      setTesting(false);
    }
  };

  const isInstalled = (id: string) => installed.some((m) => m.id === id);
  const installedActive = installed.find((m) => m.active);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-coal-900 dark:text-dark-text flex items-center gap-2">
          <Bot className="w-5 h-5" />
          {t('settings.localLlm.title')}
        </h3>
        <p className="text-sm text-smoke-600 dark:text-dark-textSecondary mt-1">
          {t('settings.localLlm.description')}
        </p>
      </div>

      {installedActive && (
        <Card className="p-4 space-y-3 border-green-300 dark:border-green-800">
          <h4 className="font-semibold text-coal-900 dark:text-dark-text flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" /> {t('settings.localLlm.activeModel', { name: installedActive.name })}
          </h4>
          <div className="space-y-2">
            <textarea
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              rows={3}
              className="w-full text-sm rounded-md border border-smoke-300 dark:border-coal-600 dark:bg-coal-900 dark:text-dark-text p-2"
              placeholder={t('settings.localLlm.testPlaceholder')}
            />
            <div className="flex gap-2">
              <Button onClick={handleTest} disabled={testing || !testPrompt.trim()} size="sm" className="gap-2">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {testing ? t('settings.localLlm.generating') : t('settings.localLlm.test')}
              </Button>
              <Button onClick={handleUnload} variant="outline" size="sm" className="gap-2">
                <X className="w-4 h-4" /> {t('settings.localLlm.unloadFromMemory')}
              </Button>
            </div>
            {testOutput !== null && (
              <pre className="text-sm bg-smoke-50 dark:bg-coal-900 border border-smoke-200 dark:border-coal-700 rounded p-3 whitespace-pre-wrap font-sans">
                {testOutput}
              </pre>
            )}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-3">
        <h4 className="font-semibold text-coal-900 dark:text-dark-text">
          {t('settings.localLlm.catalog', { n: loading ? '…' : catalog.length })}
        </h4>
        {loading ? (
          <p className="text-sm text-smoke-500">{t('settings.localLlm.loadingCatalog')}</p>
        ) : (
          <ul className="divide-y divide-smoke-200 dark:divide-coal-700">
            {catalog.map((entry) => {
              const inst = isInstalled(entry.id);
              const dl = downloads[entry.id];
              const pct = dl && dl.total > 0 ? Math.round((dl.received / dl.total) * 100) : 0;
              const installedRecord = installed.find((m) => m.id === entry.id);
              return (
                <li key={entry.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-coal-900 dark:text-dark-text truncate">{entry.name}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-smoke-100 dark:bg-coal-900 rounded">{entry.params}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-smoke-100 dark:bg-coal-900 rounded">{entry.quantization}</span>
                        {entry.languages.includes('es') && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded flex items-center gap-1">
                            <Languages className="w-3 h-3" /> ES
                          </span>
                        )}
                        {installedRecord?.active && (
                          <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                            {t('settings.localLlm.active')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-smoke-600 dark:text-dark-textSecondary mt-1">
                        {entry.description}
                      </p>
                      <p className="text-xs text-smoke-500 mt-0.5">
                        ~{(entry.size_mb / 1024).toFixed(2)} GB · {entry.license} · {entry.family}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 min-w-[120px]">
                      {dl ? (
                        <div className="w-full">
                          <div className="h-2 bg-smoke-200 dark:bg-coal-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-xs text-smoke-500 text-right mt-1">
                            {pct}% · {(dl.received / 1024 / 1024).toFixed(0)} MB
                          </p>
                        </div>
                      ) : inst ? (
                        <>
                          {!installedRecord?.active && (
                            <Button size="sm" variant="outline" onClick={() => handleActivate(entry.id)} className="gap-1">
                              <Sparkles className="w-3.5 h-3.5" /> {t('settings.localLlm.activate')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUninstall(entry.id, entry.name)}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" onClick={() => handleDownload(entry)} className="gap-1">
                          <Download className="w-3.5 h-3.5" /> {t('settings.localLlm.download')}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex gap-3 items-start p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {t('settings.localLlm.disclaimer')}
        </p>
      </div>
    </div>
  );
}
