import { useState, useEffect } from 'react';
import { RefreshCw, Download, Image as ImageIcon, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getContributions } from '@/lib/api/admin-service';
import { API_BASE_URL } from '@/config/api';
import type { Contribution } from '@/types/admin';

export function ContributionsList() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadContributions = async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const data = await getContributions();
      setContributions(data);
      if (showToast) {
        toast.success('Lista actualizada');
      }
    } catch (error) {
      toast.error('Error al cargar contribuciones');
      console.error(error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadContributions();
  }, []);

  const handleDownload = (url: string, filename: string) => {
    const fullUrl = `${API_BASE_URL}${url}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateToken = (token: string) => {
    return `${token.substring(0, 8)}...`;
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center gap-2 text-smoke-600 dark:text-dark-textSecondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Cargando contribuciones...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 dark:bg-dark-surface dark:border-coal-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-coal-800 dark:text-dark-text">
            Imágenes Contribuidas
          </h2>
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            Total: {contributions.length}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadContributions(true)}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {contributions.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-smoke-400 dark:text-coal-600" />
          <p className="text-smoke-600 dark:text-dark-textSecondary">
            No hay contribuciones aún
          </p>
          <p className="text-sm text-smoke-500 dark:text-coal-500 mt-1">
            Los usuarios pueden contribuir imágenes desde el menú de contribución
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-smoke-200 dark:border-coal-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Fecha
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Archivo
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Tamaño
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Installation
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((contribution) => (
                <tr
                  key={contribution.id}
                  className="border-b border-smoke-100 dark:border-coal-800 hover:bg-smoke-50 dark:hover:bg-coal-900 transition-colors"
                >
                  <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary">
                    {formatDate(contribution.uploaded_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-smoke-500 dark:text-dark-textSecondary" />
                      <span className="text-sm font-medium text-coal-800 dark:text-dark-text">
                        {contribution.original_filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary">
                    {contribution.size_formatted}
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-xs bg-smoke-100 dark:bg-coal-800 px-2 py-1 rounded font-mono">
                      {truncateToken(contribution.installation_token)}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {contribution.image_exists && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownload(
                              contribution.download_url_image,
                              contribution.original_filename
                            )
                          }
                          className="gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <ImageIcon className="w-3 h-3" />
                        </Button>
                      )}
                      {contribution.json_exists && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownload(
                              contribution.download_url_json,
                              `${contribution.id}.json`
                            )
                          }
                          className="gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <FileJson className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 p-4 bg-smoke-100 dark:bg-coal-900 rounded-lg">
        <p className="text-sm text-smoke-700 dark:text-dark-textSecondary">
          <strong>ℹ️ Información:</strong> Las contribuciones incluyen la imagen original y un archivo JSON con las anotaciones. Puedes descargarlas individualmente.
        </p>
      </div>
    </Card>
  );
}
