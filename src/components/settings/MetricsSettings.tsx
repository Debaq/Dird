import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Timer, Gauge, Copy, Trash2 } from 'lucide-react';
import { useInferenceMetricsStore } from '@/stores/inference-metrics-store';

const fmt = (n: number) => n.toFixed(2);
const fmtSec = (ms: number) => (ms / 1000).toFixed(2) + ' s';
const fmtDate = (ts: number | null) =>
  ts ? new Date(ts).toLocaleString() : '—';

export const MetricsSettings: React.FC = () => {
  const history = useInferenceMetricsStore((s) => s.history);
  const sessionHistory = useInferenceMetricsStore((s) => s.sessionHistory);
  const usage = useInferenceMetricsStore((s) => s.usage);
  const getStats = useInferenceMetricsStore((s) => s.getStats);
  const clear = useInferenceMetricsStore((s) => s.clear);
  const clearAll = useInferenceMetricsStore((s) => s.clearAll);
  const [copied, setCopied] = useState(false);

  const stats = getStats();

  const sessionMean =
    sessionHistory.length > 0
      ? sessionHistory.reduce((s, e) => s + e.session_total_ms, 0) /
        sessionHistory.length
      : 0;
  const perImageMean =
    sessionHistory.length > 0
      ? sessionHistory.reduce((s, e) => s + e.avg_per_image_ms, 0) /
        sessionHistory.length
      : 0;
  const overheadPct =
    perImageMean > 0 && stats.total_ms.mean > 0
      ? ((perImageMean - stats.total_ms.mean) / perImageMean) * 100
      : 0;

  const handleCopy = async () => {
    const payload = {
      exported_at: new Date().toISOString(),
      usage,
      perImage: { stats, recent: history.slice(0, 20) },
      perSession: { recent: sessionHistory.slice(0, 20) },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy metrics', err);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Métricas de uso
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-smoke-600">Estudios procesados</div>
            <div className="text-2xl font-semibold">{usage.totalStudies}</div>
          </div>
          <div>
            <div className="text-smoke-600">Imágenes procesadas</div>
            <div className="text-2xl font-semibold">{usage.totalImages}</div>
          </div>
          <div>
            <div className="text-smoke-600">Tiempo total de inferencia</div>
            <div className="text-2xl font-semibold">
              {fmtSec(usage.totalInferenceTime_ms)}
            </div>
          </div>
          <div>
            <div className="text-smoke-600">Tiempo total de sesiones</div>
            <div className="text-2xl font-semibold">
              {fmtSec(usage.totalSessionTime_ms)}
            </div>
          </div>
          <div>
            <div className="text-smoke-600">Primer uso</div>
            <div className="font-medium">{fmtDate(usage.firstUseTs)}</div>
          </div>
          <div>
            <div className="text-smoke-600">Último uso</div>
            <div className="font-medium">{fmtDate(usage.lastUseTs)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Métricas por imagen (N={stats.count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.count === 0 ? (
            <p className="text-sm text-smoke-600">Sin inferencias aún.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="text-smoke-600 border-b">
                    <th className="text-left py-1 pr-2">Fase</th>
                    <th className="text-right px-2">Media ms</th>
                    <th className="text-right px-2">Mediana</th>
                    <th className="text-right px-2">Min</th>
                    <th className="text-right px-2">Max</th>
                    <th className="text-right px-2">Std</th>
                    <th className="text-right px-2">% E2E</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Preprocess', stats.preprocess_ms],
                    ['ONNX Inference', stats.inference_ms],
                    ['Post-processing', stats.postprocess_ms],
                    ['NMS', stats.nms_ms],
                    ['Spatial analysis', stats.spatial_ms],
                    ['Clinical classification', stats.clinical_ms],
                  ] as const).map(([label, s]) => (
                    <tr key={label} className="border-b">
                      <td className="py-1 pr-2">{label}</td>
                      <td className="text-right px-2">{fmt(s.mean)}</td>
                      <td className="text-right px-2">{fmt(s.median)}</td>
                      <td className="text-right px-2">{fmt(s.min)}</td>
                      <td className="text-right px-2">{fmt(s.max)}</td>
                      <td className="text-right px-2">{fmt(s.std)}</td>
                      <td className="text-right px-2">
                        {s.pct_of_total.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  <tr className="font-medium">
                    <td className="py-1 pr-2">Total E2E</td>
                    <td className="text-right px-2">{fmt(stats.total_ms.mean)}</td>
                    <td className="text-right px-2">
                      {fmt(stats.total_ms.median)}
                    </td>
                    <td className="text-right px-2">{fmt(stats.total_ms.min)}</td>
                    <td className="text-right px-2">{fmt(stats.total_ms.max)}</td>
                    <td className="text-right px-2">{fmt(stats.total_ms.std)}</td>
                    <td className="text-right px-2">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5" />
            Métricas por sesión (N={sessionHistory.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionHistory.length === 0 ? (
            <p className="text-sm text-smoke-600">Sin sesiones procesadas.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                <div>
                  <div className="text-smoke-600">Duración media sesión</div>
                  <div className="font-medium">{fmtSec(sessionMean)}</div>
                </div>
                <div>
                  <div className="text-smoke-600">Media por imagen (E2E sesión)</div>
                  <div className="font-medium">{fmt(perImageMean)} ms</div>
                </div>
                <div>
                  <div className="text-smoke-600">Overhead vs inferencia pura</div>
                  <div className="font-medium">{overheadPct.toFixed(1)}%</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-smoke-600 border-b">
                      <th className="text-left py-1 pr-2">Fecha</th>
                      <th className="text-right px-2">Imágenes</th>
                      <th className="text-right px-2">Carga modelo</th>
                      <th className="text-right px-2">Total sesión</th>
                      <th className="text-right px-2">Media/img</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionHistory.slice(0, 10).map((s, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-2">
                          {new Date(s.timestamp).toLocaleString()}
                        </td>
                        <td className="text-right px-2">{s.imagesProcessed}</td>
                        <td className="text-right px-2">
                          {s.modelLoad_ms > 0 ? fmt(s.modelLoad_ms) + ' ms' : '—'}
                        </td>
                        <td className="text-right px-2">
                          {fmtSec(s.session_total_ms)}
                        </td>
                        <td className="text-right px-2">
                          {fmt(s.avg_per_image_ms)} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy}>
          <Copy className="w-4 h-4 mr-1" />
          {copied ? 'Copiado' : 'Exportar JSON'}
        </Button>
        <Button size="sm" variant="outline" onClick={clear}>
          <Trash2 className="w-4 h-4 mr-1" />
          Limpiar historial
        </Button>
        <Button size="sm" variant="destructive" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1" />
          Reset total (incluye contadores)
        </Button>
      </div>
    </div>
  );
};

export default MetricsSettings;
