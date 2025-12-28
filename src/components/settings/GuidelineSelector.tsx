/**
 * GuidelineSelector Component
 *
 * UI for selecting active clinical guideline
 * Shows available guidelines with preview of severity levels
 */

import { useState, useEffect } from 'react';
import { Check, AlertTriangle, Globe, MapPin, Edit, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '@/stores/config-store';
import {
  loadGuidelineIndex,
  loadGuideline,
  getGuidelineSeverityLevels,
  clearGuidelineCache,
} from '@/lib/clinical-guidelines/guideline-loader';
import { GuidelineEditor } from './GuidelineEditor';
import type {
  GuidelineIndexEntry,
  SeverityLevel,
  ClinicalGuideline,
} from '@/types/clinical-guidelines';

export function GuidelineSelector() {
  const { t } = useTranslation();
  const { config, setActiveGuideline } = useConfigStore();
  const [guidelines, setGuidelines] = useState<GuidelineIndexEntry[]>([]);
  const [pendingGuidelineId, setPendingGuidelineId] = useState<string | null>(null);
  const [previewSeverityLevels, setPreviewSeverityLevels] = useState<SeverityLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor modal states
  const [showEditor, setShowEditor] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<ClinicalGuideline | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Load available guidelines on mount
  useEffect(() => {
    async function loadGuidelines() {
      try {
        setLoading(true);
        const index = await loadGuidelineIndex();
        setGuidelines(index.guidelines);

        // Load severity levels for current guideline
        const severityLevels = await getGuidelineSeverityLevels(config.activeGuideline);
        setPreviewSeverityLevels(severityLevels);

        setError(null);
      } catch (err) {
        console.error('Error loading guidelines:', err);
        setError(t('settings.guidelines.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    }

    loadGuidelines();
  }, [config.activeGuideline]);


  // Handle guideline selection
  const handleGuidelineSelect = async (guidelineId: string) => {
    // If clicking on the already active guideline, just update preview
    if (guidelineId === config.activeGuideline) {
      try {
        const severityLevels = await getGuidelineSeverityLevels(guidelineId);
        setPreviewSeverityLevels(severityLevels);
      } catch (err) {
        console.error('Error loading severity levels:', err);
      }
      return;
    }

    // If selecting a different guideline, show confirmation modal
    setPendingGuidelineId(guidelineId);

    // Load preview for pending guideline
    try {
      const severityLevels = await getGuidelineSeverityLevels(guidelineId);
      setPreviewSeverityLevels(severityLevels);
    } catch (err) {
      console.error('Error loading severity levels:', err);
    }
  };

  // Confirm guideline change
  const handleConfirmChange = async () => {
    if (!pendingGuidelineId) return;

    try {
      // Clear cache to ensure fresh load
      clearGuidelineCache();

      // Validate guideline can be loaded
      await loadGuideline(pendingGuidelineId);

      // Update config
      setActiveGuideline(pendingGuidelineId);

      // Clear pending
      setPendingGuidelineId(null);

      // Force reload severity levels for the new guideline
      const severityLevels = await getGuidelineSeverityLevels(pendingGuidelineId);
      setPreviewSeverityLevels(severityLevels);
    } catch (err) {
      console.error('Error applying guideline:', err);
      setError(t('settings.guidelines.errors.applyFailed'));
    }
  };

  // Cancel guideline change
  const handleCancelChange = () => {
    setPendingGuidelineId(null);
    // Reload preview for current active guideline
    getGuidelineSeverityLevels(config.activeGuideline).then(setPreviewSeverityLevels);
  };

  // Handle edit guideline
  const handleEditGuideline = async (guidelineId: string) => {
    try {
      const guideline = await loadGuideline(guidelineId);
      setEditingGuideline(guideline);
      setIsCreatingNew(false);
      setShowEditor(true);
    } catch (err) {
      console.error('Error loading guideline for editing:', err);
      setError('Error al cargar la guía para editar');
    }
  };

  // Handle create new guideline
  const handleCreateNew = () => {
    setEditingGuideline(null);
    setIsCreatingNew(true);
    setShowEditor(true);
  };

  // Handle editor close
  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingGuideline(null);
    setIsCreatingNew(false);
    // Reload guidelines list
    loadGuidelineIndex().then((index) => setGuidelines(index.guidelines));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">{t('settings.guidelines.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('settings.guidelines.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('settings.guidelines.description')}
          </p>
        </div>

        <button
          onClick={handleCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva guía
        </button>
      </div>

      {/* Guidelines List */}
      <div className="space-y-3">
        {guidelines.map((guideline) => {
          const isActive = guideline.id === config.activeGuideline;

          return (
            <div
              key={guideline.id}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${isActive
                  ? 'border-sky-500 bg-sky-50'
                  : 'border-gray-200 bg-white'
                }
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => handleGuidelineSelect(guideline.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">
                      {guideline.name}
                    </h4>
                    {isActive && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-sky-700 bg-sky-100 rounded-full">
                        <Check className="w-3 h-3" />
                        {t('settings.guidelines.active')}
                      </span>
                    )}
                    {guideline.status === 'official' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                        {t('settings.guidelines.official')}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-gray-600">
                    {guideline.description}
                  </p>

                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    {guideline.country === 'International' ? (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        <span>{guideline.country}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{guideline.country}</span>
                      </div>
                    )}
                    <span>v{guideline.version}</span>
                    {guideline.date_published && (
                      <span>{new Date(guideline.date_published).getFullYear()}</span>
                    )}
                  </div>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditGuideline(guideline.id);
                  }}
                  className="flex-shrink-0 p-2 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                  title={guideline.status === 'official' ? 'Crear copia para editar' : 'Editar guía'}
                >
                  <Edit className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Severity Levels Preview */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          {t('settings.guidelines.severityPreview')}
        </h4>
        <div className="space-y-2">
          {previewSeverityLevels.map((level) => (
            <div
              key={level.id}
              className="flex items-center gap-3 p-2 bg-white rounded border border-gray-200"
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: level.color }}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {level.name_es || level.name}
                </div>
                <div className="text-xs text-gray-500">
                  {level.description_es || level.description}
                </div>
              </div>
              <div className="text-xs text-gray-400 font-medium">
                L{level.order}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {pendingGuidelineId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-orange-500" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-900">
                  {t('settings.guidelines.confirmDialog.title')}
                </h4>
                <p className="mt-2 text-sm text-gray-600">
                  {t('settings.guidelines.confirmDialog.description')}
                </p>
                <p className="mt-2 text-sm text-orange-600 font-medium">
                  {t('settings.guidelines.confirmDialog.warning')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={handleCancelChange}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('settings.guidelines.confirmDialog.cancel')}
              </button>
              <button
                onClick={handleConfirmChange}
                className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
              >
                {t('settings.guidelines.confirmDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {isCreatingNew
                  ? 'Crear nueva guía clínica'
                  : editingGuideline?.metadata.status === 'official'
                  ? `Crear copia de "${editingGuideline?.metadata.name}"`
                  : `Editar "${editingGuideline?.metadata.name}"`}
              </h2>
              {editingGuideline?.metadata.status === 'official' && !isCreatingNew && (
                <p className="mt-1 text-sm text-orange-600">
                  Las guías oficiales no se pueden modificar. Se creará una copia con estado "custom".
                </p>
              )}
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <GuidelineEditor
                initialGuideline={editingGuideline}
                isCreatingNew={isCreatingNew}
                onClose={handleEditorClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
