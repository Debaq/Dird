import { useState, useEffect } from 'react';
import { RefreshCw, Download, Image as ImageIcon, FileJson, BookOpen, BrainCircuit, Package } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getContributions, downloadTixPackage } from '@/lib/api/admin-service';
import { API_BASE_URL } from '@/config/api';
import type { Contribution } from '@/types/admin';

export function ContributionsList() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingTix, setIsDownloadingTix] = useState(false);

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

  const handleDownloadTix = async (installationToken?: string) => {
    try {
      setIsDownloadingTix(true);
      await downloadTixPackage(installationToken);
      toast.success('Paquete .tix descargado exitosamente');
    } catch (error) {
      toast.error('Error al descargar paquete .tix');
      console.error(error);
    } finally {
      setIsDownloadingTix(false);
    }
  };

  useEffect(() => {
    loadContributions();
  }, []);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const fullUrl = `${API_BASE_URL}${url}`;
      const response = await fetch(fullUrl, {method: 'GET'});
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const truncateToken = (token: string) => {
    return `${token.substring(0, 8)}...`;
  };

  const renderIcon = (type?: string) => {
    switch (type) {
      case 'guideline':
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'conclusion':
        return <BrainCircuit className="w-4 h-4 text-purple-500" />;
      case 'image':
      default:
        return <ImageIcon className="w-4 h-4 text-smoke-500 dark:text-dark-textSecondary" />;
    }
  };

  const renderTitle = (contribution: Contribution) => {
    if (contribution.type === 'guideline') {
      return (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-coal-800 dark:text-dark-text">
            {contribution.guideline_name || contribution.original_filename}
          </span>
          <span className="text-xs text-smoke-500">
            v{contribution.guideline_version || '?'} • {contribution.original_filename}
          </span>
        </div>
      );
    }
    return (
      <span className="text-sm font-medium text-coal-800 dark:text-dark-text">
        {contribution.original_filename}
      </span>
    );
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
            Contribuciones
          </h2>
          <p className="text-sm text-smoke-600 dark:text-dark-textSecondary">
            Total: {contributions.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownloadTix()}
            disabled={isDownloadingTix || contributions.length === 0}
            className="gap-2"
            title="Descargar todas las contribuciones en formato .tix (Annotix)"
          >
            {isDownloadingTix ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            Exportar .tix
          </Button>
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
      </div>

      {contributions.length === 0 ? (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-smoke-400 dark:text-coal-600" />
          <p className="text-smoke-600 dark:text-dark-textSecondary">
            No hay contribuciones aún
          </p>
          <p className="text-sm text-smoke-500 dark:text-coal-500 mt-1">
            Los usuarios pueden contribuir desde la aplicación
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
                  Tipo
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-smoke-600 dark:text-dark-textSecondary">
                  Archivo / Detalles
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
                  <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary whitespace-nowrap">
                    {formatDate(contribution.uploaded_at)}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2" title={contribution.type || 'image'}>
                      {renderIcon(contribution.type)}
                      <span className="text-xs capitalize text-smoke-600">
                        {contribution.type === 'guideline' ? 'Protocolo' : 
                         contribution.type === 'conclusion' ? 'Conclusión' : 'Imagen'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {renderTitle(contribution)}
                  </td>
                  <td className="py-3 px-4 text-sm text-smoke-600 dark:text-dark-textSecondary whitespace-nowrap">
                    {contribution.size_formatted}
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-xs bg-smoke-100 dark:bg-coal-800 px-2 py-1 rounded font-mono">
                      {truncateToken(contribution.installation_token)}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Image Type Actions */}
                      {(!contribution.type || contribution.type === 'image') && (
                        <>
                          {contribution.image_exists && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleDownload(
                                  contribution.download_url_image!,
                                  contribution.original_filename
                                )
                              }
                              className="gap-1"
                              title="Descargar Imagen"
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
                                  contribution.download_url_json!,
                                  `${contribution.id}.json`
                                )
                              }
                              className="gap-1"
                              title="Descargar Anotaciones"
                            >
                              <Download className="w-3 h-3" />
                              <FileJson className="w-3 h-3" />
                            </Button>
                          )}
                        </>
                      )}

                      {/* Single File Types (Guideline / Conclusion) */}
                      {(contribution.type === 'guideline' || contribution.type === 'conclusion') && contribution.exists && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleDownload(
                              contribution.download_url!,
                              contribution.original_filename
                            )
                          }
                          className="gap-1"
                          title="Descargar JSON"
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
        <div className="text-sm text-smoke-700 dark:text-dark-textSecondary">
          <strong>ℹ️ Información:</strong>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            <li><strong>Imágenes:</strong> Incluyen la imagen original y un JSON con anotaciones (detecciones, segmentaciones, clasificación y mediciones).</li>
            <li><strong>Protocolos:</strong> Archivos de configuración de guías clínicas (JSON).</li>
            <li><strong>Conclusiones:</strong> Resultados de IA con correcciones del usuario (JSON).</li>
            <li><strong>Exportar .tix:</strong> Genera un archivo ZIP compatible con Annotix que incluye todas las imágenes originales + annotations.json con metadata del proyecto y anotaciones completas.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
