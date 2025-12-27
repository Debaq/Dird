import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';

import { getDebugLogs, getErrorLogs } from '@/lib/api/logs-service';

export function LogsViewer() {
  const [debugLogs, setDebugLogs] = useState('');
  const [errorLogs, setErrorLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('debug');
  const [lineCount, setLineCount] = useState(100);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);

      if (activeTab === 'debug') {
        const data = await getDebugLogs(lineCount);
        setDebugLogs(data.content || data.message || 'No logs available');
      } else {
        const data = await getErrorLogs(lineCount);
        setErrorLogs(data.content || data.message || 'No errors logged');
      }
    } catch (error: any) {
      toast.error('Error cargando logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [activeTab, lineCount]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab, lineCount]);

  const handleDownload = () => {
    const content = activeTab === 'debug' ? debugLogs : errorLogs;
    const filename = `${activeTab}_logs_${new Date().toISOString()}.txt`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Logs descargados');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-coal-800 dark:text-dark-text">Logs del Sistema</h2>

        <div className="flex items-center gap-2">
          <Label className="text-sm">Líneas:</Label>
          <Select
            value={lineCount.toString()}
            onValueChange={(val) => setLineCount(parseInt(val))}
            options={[
              { value: '50', label: '50' },
              { value: '100', label: '100' },
              { value: '200', label: '200' },
              { value: '500', label: '500' },
              { value: '1000', label: '1000' },
            ]}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={loadLogs}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Descargar
          </Button>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="debug" className="gap-2">
            <FileText className="w-4 h-4" /> Debug Logs
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-2">
            <FileText className="w-4 h-4" /> Error Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="debug">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Debug</CardTitle>
              <CardDescription>
                Muestra todas las peticiones, respuestas y pasos del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-950 text-slate-50 p-4 rounded-md overflow-auto max-h-[600px] text-xs font-mono whitespace-pre-wrap">
                {loading ? 'Cargando...' : debugLogs}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Logs de Errores</CardTitle>
              <CardDescription>
                Muestra solo errores y excepciones del sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-red-950 text-red-50 p-4 rounded-md overflow-auto max-h-[600px] text-xs font-mono whitespace-pre-wrap">
                {loading ? 'Cargando...' : errorLogs}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
