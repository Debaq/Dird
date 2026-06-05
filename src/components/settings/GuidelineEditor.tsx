/**
 * GuidelineEditor Component
 *
 * Visual editor for creating and modifying clinical guidelines
 * Allows administrators to create custom institutional guidelines
 */

import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Layers,
  GitBranch,
  Binary,
  Pill,
  Eye,
  Download,
  Upload,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowUp,
  ArrowDown,
  Copy,
} from 'lucide-react';
import type {
  ClinicalGuideline,
  GuidelineMetadata,
  SeverityLevel,
  ClassificationRule,
  Rule421,
  Rule421Criterion,
  TreatmentProtocol,
  EMCSCriteria,
  RuleCondition,
  RuleOperator,
} from '@/types/clinical-guidelines';

type TabType = 'metadata' | 'severity' | 'rules' | 'rule421' | 'treatment' | 'emcs';

const EMPTY_GUIDELINE: ClinicalGuideline = {
  guideline_id: '',
  metadata: {
    name: '',
    full_name: '',
    version: '1.0.0',
    country: '',
    language: 'es',
    status: 'draft',
    date_published: new Date().toISOString().split('T')[0],
    organization: '',
    description: '',
  },
  severity_levels: [],
  classification_rules: [],
  rule_421: {
    enabled: false,
    name: 'Regla 4-2-1',
    description: '',
    criteria: [],
    severity_mapping: {},
  },
  treatment_protocols: [],
  emcs_criteria: {
    enabled: false,
    geometric_distance_fovea_um: 500,
    min_disc_areas: 1.0,
    apply_geometric_rule: true,
  },
};

const RULE_OPERATORS: RuleOperator[] = ['==', '!=', '>', '<', '>=', '<=', 'in', 'not_in'];

const LESION_FIELDS = [
  'microaneurysms',
  'hemorrhages',
  'hardExudates',
  'softExudates',
  'neovascularization',
  'venous_beading',
  'irma',
  'total_lesions',
  'lesion_types_count',
  'rule_421_criteria_met',
];

interface GuidelineEditorProps {
  initialGuideline?: ClinicalGuideline | null;
  isCreatingNew?: boolean;
  onClose?: () => void;
}

export function GuidelineEditor({
  initialGuideline,
  onClose,
}: GuidelineEditorProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabType>('metadata');
  const [guideline, setGuideline] = useState<ClinicalGuideline>(() => {
    if (initialGuideline) {
      // If editing an official guideline, create a copy with custom status
      if (initialGuideline.metadata.status === 'official') {
        return {
          ...initialGuideline,
          guideline_id: `${initialGuideline.guideline_id}_copy`,
          metadata: {
            ...initialGuideline.metadata,
            name: `${initialGuideline.metadata.name} (${t('settings.guidelines.copy')})`,
            status: 'custom',
            organization: '',
          },
        };
      }
      return initialGuideline;
    }
    return EMPTY_GUIDELINE;
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  // ============================================================================
  // Metadata Handlers
  // ============================================================================

  const updateMetadata = (field: keyof GuidelineMetadata, value: string) => {
    setGuideline((prev) => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [field]: value,
      },
    }));

    // Auto-generate guideline_id from name
    if (field === 'name') {
      const id = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      setGuideline((prev) => ({ ...prev, guideline_id: id }));
    }
  };

  // ============================================================================
  // Severity Level Handlers
  // ============================================================================

  const addSeverityLevel = () => {
    const newLevel: SeverityLevel = {
      id: `level_${Date.now()}`,
      name: '',
      name_en: '',
      name_es: '',
      order: guideline.severity_levels.length,
      color: '#gray-500',
      description: '',
      description_en: '',
      description_es: '',
    };

    setGuideline((prev) => ({
      ...prev,
      severity_levels: [...prev.severity_levels, newLevel],
    }));
  };

  const updateSeverityLevel = (index: number, field: keyof SeverityLevel, value: any) => {
    setGuideline((prev) => ({
      ...prev,
      severity_levels: prev.severity_levels.map((level, i) =>
        i === index ? { ...level, [field]: value } : level
      ),
    }));
  };

  const deleteSeverityLevel = (index: number) => {
    setGuideline((prev) => ({
      ...prev,
      severity_levels: prev.severity_levels.filter((_, i) => i !== index),
    }));
  };

  const moveSeverityLevel = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === guideline.severity_levels.length - 1)
    ) {
      return;
    }

    const newLevels = [...guideline.severity_levels];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];

    // Update order
    newLevels.forEach((level, i) => {
      level.order = i;
    });

    setGuideline((prev) => ({ ...prev, severity_levels: newLevels }));
  };

  const duplicateSeverityLevel = (index: number) => {
    const level = guideline.severity_levels[index];
    const newLevel: SeverityLevel = {
      ...level,
      id: `${level.id}_copy_${Date.now()}`,
      name: `${level.name} (Copy)`,
      order: guideline.severity_levels.length,
    };

    setGuideline((prev) => ({
      ...prev,
      severity_levels: [...prev.severity_levels, newLevel],
    }));
  };

  // ============================================================================
  // Classification Rule Handlers
  // ============================================================================

  const addClassificationRule = () => {
    const newRule: ClassificationRule = {
      severity: guideline.severity_levels[0]?.id || '',
      conditions: [],
      logic: 'AND',
      priority: guideline.classification_rules.length + 1,
    };

    setGuideline((prev) => ({
      ...prev,
      classification_rules: [...prev.classification_rules, newRule],
    }));
  };

  const updateClassificationRule = (
    index: number,
    field: keyof ClassificationRule,
    value: any
  ) => {
    setGuideline((prev) => ({
      ...prev,
      classification_rules: prev.classification_rules.map((rule, i) =>
        i === index ? { ...rule, [field]: value } : rule
      ),
    }));
  };

  const deleteClassificationRule = (index: number) => {
    setGuideline((prev) => ({
      ...prev,
      classification_rules: prev.classification_rules.filter((_, i) => i !== index),
    }));
  };

  const addRuleCondition = (ruleIndex: number) => {
    const newCondition: RuleCondition = {
      field: 'total_lesions',
      operator: '>=',
      value: 0,
    };

    setGuideline((prev) => ({
      ...prev,
      classification_rules: prev.classification_rules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: [...rule.conditions, newCondition] }
          : rule
      ),
    }));
  };

  const updateRuleCondition = (
    ruleIndex: number,
    conditionIndex: number,
    field: keyof RuleCondition,
    value: any
  ) => {
    setGuideline((prev) => ({
      ...prev,
      classification_rules: prev.classification_rules.map((rule, i) =>
        i === ruleIndex
          ? {
              ...rule,
              conditions: rule.conditions.map((cond, j) =>
                j === conditionIndex ? { ...cond, [field]: value } : cond
              ),
            }
          : rule
      ),
    }));
  };

  const deleteRuleCondition = (ruleIndex: number, conditionIndex: number) => {
    setGuideline((prev) => ({
      ...prev,
      classification_rules: prev.classification_rules.map((rule, i) =>
        i === ruleIndex
          ? { ...rule, conditions: rule.conditions.filter((_, j) => j !== conditionIndex) }
          : rule
      ),
    }));
  };

  // ============================================================================
  // Rule 4-2-1 Handlers
  // ============================================================================

  const updateRule421 = (field: keyof Rule421, value: any) => {
    setGuideline((prev) => ({
      ...prev,
      rule_421: {
        ...prev.rule_421,
        [field]: value,
      },
    }));
  };

  const addRule421Criterion = () => {
    const newCriterion: Rule421Criterion = {
      name: '',
      description: '',
      field: 'hemorrhages',
      min_quadrants: 4,
      min_per_quadrant: 5,
    };

    setGuideline((prev) => ({
      ...prev,
      rule_421: {
        ...prev.rule_421,
        criteria: [...prev.rule_421.criteria, newCriterion],
      },
    }));
  };

  const updateRule421Criterion = (
    index: number,
    field: keyof Rule421Criterion,
    value: any
  ) => {
    setGuideline((prev) => ({
      ...prev,
      rule_421: {
        ...prev.rule_421,
        criteria: prev.rule_421.criteria.map((crit, i) =>
          i === index ? { ...crit, [field]: value } : crit
        ),
      },
    }));
  };

  const deleteRule421Criterion = (index: number) => {
    setGuideline((prev) => ({
      ...prev,
      rule_421: {
        ...prev.rule_421,
        criteria: prev.rule_421.criteria.filter((_, i) => i !== index),
      },
    }));
  };

  // ============================================================================
  // Treatment Protocol Handlers
  // ============================================================================

  const addTreatmentProtocol = () => {
    const newProtocol: TreatmentProtocol = {
      severity: guideline.severity_levels[0]?.id || '',
      urgency: 'routine',
      actions: [],
      followup_interval_days: 365,
      rationale: '',
    };

    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: [...prev.treatment_protocols, newProtocol],
    }));
  };

  const updateTreatmentProtocol = (
    index: number,
    field: keyof TreatmentProtocol,
    value: any
  ) => {
    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: prev.treatment_protocols.map((protocol, i) =>
        i === index ? { ...protocol, [field]: value } : protocol
      ),
    }));
  };

  const deleteTreatmentProtocol = (index: number) => {
    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: prev.treatment_protocols.filter((_, i) => i !== index),
    }));
  };

  const addTreatmentAction = (protocolIndex: number) => {
    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: prev.treatment_protocols.map((protocol, i) =>
        i === protocolIndex
          ? { ...protocol, actions: [...protocol.actions, ''] }
          : protocol
      ),
    }));
  };

  const updateTreatmentAction = (
    protocolIndex: number,
    actionIndex: number,
    value: string
  ) => {
    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: prev.treatment_protocols.map((protocol, i) =>
        i === protocolIndex
          ? {
              ...protocol,
              actions: protocol.actions.map((action, j) =>
                j === actionIndex ? value : action
              ),
            }
          : protocol
      ),
    }));
  };

  const deleteTreatmentAction = (protocolIndex: number, actionIndex: number) => {
    setGuideline((prev) => ({
      ...prev,
      treatment_protocols: prev.treatment_protocols.map((protocol, i) =>
        i === protocolIndex
          ? { ...protocol, actions: protocol.actions.filter((_, j) => j !== actionIndex) }
          : protocol
      ),
    }));
  };

  // ============================================================================
  // EMCS Criteria Handlers
  // ============================================================================

  const updateEMCSCriteria = (field: keyof EMCSCriteria, value: any) => {
    setGuideline((prev) => ({
      ...prev,
      emcs_criteria: {
        enabled: true,
        name: '',
        geometric_distance_fovea_um: 500,
        min_disc_areas: 1,
        apply_geometric_rule: true,
        ...prev.emcs_criteria,
        [field]: value,
      },
    }));
  };

  // ============================================================================
  // Import/Export Handlers
  // ============================================================================

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setGuideline(json);
        setSuccess(t('settings.guidelines.editor.messages.importSuccess'));
        setErrors([]);
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        setErrors([t('settings.guidelines.editor.messages.importError')]);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = async () => {
    // Validate before export
    const validationErrors = validateGuideline();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    const dataStr = JSON.stringify(guideline, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `${guideline.guideline_id || 'guideline'}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    setSuccess(t('settings.guidelines.editor.messages.exportSuccess'));

    setTimeout(() => setSuccess(null), 3000);
  };

  // ============================================================================
  // Validation
  // ============================================================================

  const validateGuideline = (): string[] => {
    const errors: string[] = [];

    // Metadata validation
    if (!guideline.guideline_id) errors.push(t('settings.guidelines.editor.validation.idRequired'));
    if (!guideline.metadata.name) errors.push(t('settings.guidelines.editor.validation.nameRequired'));
    if (!guideline.metadata.version) errors.push(t('settings.guidelines.editor.validation.versionRequired'));
    if (!guideline.metadata.country) errors.push(t('settings.guidelines.editor.validation.countryRequired'));

    // Severity levels validation
    if (guideline.severity_levels.length === 0) {
      errors.push(t('settings.guidelines.editor.validation.severityRequired'));
    }

    guideline.severity_levels.forEach((level, i) => {
      if (!level.id) errors.push(t('settings.guidelines.editor.validation.levelIdRequired', { index: i + 1 }));
      if (!level.name) errors.push(t('settings.guidelines.editor.validation.levelNameRequired', { index: i + 1 }));
      if (!level.color) errors.push(t('settings.guidelines.editor.validation.levelColorRequired', { index: i + 1 }));
    });

    // Check for duplicate severity level IDs
    const severityIds = guideline.severity_levels.map((l) => l.id);
    const duplicateIds = severityIds.filter((id, i) => severityIds.indexOf(id) !== i);
    if (duplicateIds.length > 0) {
      errors.push(t('settings.guidelines.editor.validation.duplicateIds', { ids: duplicateIds.join(', ') }));
    }

    // Classification rules validation
    guideline.classification_rules.forEach((rule, i) => {
      if (!rule.severity) errors.push(t('settings.guidelines.editor.validation.ruleSeverityRequired', { index: i + 1 }));
      if (rule.conditions.length === 0) {
        errors.push(t('settings.guidelines.editor.validation.ruleConditionRequired', { index: i + 1 }));
      }
    });

    return errors;
  };

  // ============================================================================
  // Render Tab Content
  // ============================================================================

  const renderMetadataTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.name')} *
          </label>
          <input
            type="text"
            value={guideline.metadata.name}
            onChange={(e) => updateMetadata('name', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            placeholder={t('settings.guidelines.editor.metadata.namePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.id')}
          </label>
          <input
            type="text"
            value={guideline.guideline_id}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.guidelines.editor.metadata.fullName')}
        </label>
        <input
          type="text"
          value={guideline.metadata.full_name || ''}
          onChange={(e) => updateMetadata('full_name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          placeholder={t('settings.guidelines.editor.metadata.fullNamePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.version')} *
          </label>
          <input
            type="text"
            value={guideline.metadata.version}
            onChange={(e) => updateMetadata('version', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            placeholder="1.0.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.country')} *
          </label>
          <input
            type="text"
            value={guideline.metadata.country}
            onChange={(e) => updateMetadata('country', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            placeholder="Chile"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.language')}
          </label>
          <select
            value={guideline.metadata.language}
            onChange={(e) => updateMetadata('language', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="es">Spanish</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.status')}
          </label>
          <select
            value={guideline.metadata.status}
            onChange={(e) => updateMetadata('status', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          >
            <option value="draft">Draft</option>
            <option value="official">Official</option>
            <option value="custom">Custom</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('settings.guidelines.editor.metadata.datePublished')}
          </label>
          <input
            type="date"
            value={guideline.metadata.date_published || ''}
            onChange={(e) => updateMetadata('date_published', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.guidelines.editor.metadata.organization')}
        </label>
        <input
          type="text"
          value={guideline.metadata.organization || ''}
          onChange={(e) => updateMetadata('organization', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          placeholder="Ministerio de Salud de Chile (MINSAL)"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('settings.guidelines.editor.metadata.description')}
        </label>
        <textarea
          value={guideline.metadata.description || ''}
          onChange={(e) => updateMetadata('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          placeholder={t('settings.guidelines.editor.metadata.descriptionPlaceholder')}
        />
      </div>
    </div>
  );

  const renderSeverityTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {t('settings.guidelines.editor.severity.description')}
        </p>
        <button
          onClick={addSeverityLevel}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('settings.guidelines.editor.severity.addLevel')}
        </button>
      </div>

      <div className="space-y-3">
        {guideline.severity_levels.map((level, index) => (
          <div
            key={level.id}
            className="p-4 border border-gray-200 rounded-lg bg-white space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: level.color }}
                />
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {level.name || t('settings.guidelines.editor.severity.level.unnamed')}
                  </h4>
                  <p className="text-xs text-gray-500">{t('settings.guidelines.editor.severity.level.order')}: {level.order}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => moveSeverityLevel(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveSeverityLevel(index, 'down')}
                  disabled={index === guideline.severity_levels.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => duplicateSeverityLevel(index)}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteSeverityLevel(index)}
                  className="p-1 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.severity.level.id')} *
                </label>
                <input
                  type="text"
                  value={level.id}
                  onChange={(e) => updateSeverityLevel(index, 'id', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                  placeholder="no_dr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.severity.level.name')} *
                </label>
                <input
                  type="text"
                  value={level.name}
                  onChange={(e) => updateSeverityLevel(index, 'name', e.target.value)}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                  placeholder="Sin RD Aparente"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.severity.level.color')} *
                </label>
                <input
                  type="color"
                  value={level.color}
                  onChange={(e) => updateSeverityLevel(index, 'color', e.target.value)}
                  className="w-full h-8 border border-gray-300 rounded cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('settings.guidelines.editor.severity.level.description')}
              </label>
              <textarea
                value={level.description}
                onChange={(e) => updateSeverityLevel(index, 'description', e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                placeholder="Description of this severity level..."
              />
            </div>
          </div>
        ))}
      </div>

      {guideline.severity_levels.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {t('settings.guidelines.editor.severity.noLevels')}
        </div>
      )}
    </div>
  );

  const renderRulesTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {t('settings.guidelines.editor.rules.description')}
        </p>
        <button
          onClick={addClassificationRule}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('settings.guidelines.editor.rules.addRule')}
        </button>
      </div>

      <div className="space-y-4">
        {guideline.classification_rules.map((rule, ruleIndex) => (
          <div
            key={ruleIndex}
            className="p-4 border border-gray-200 rounded-lg bg-white space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{t('settings.guidelines.editor.rules.rule')} {ruleIndex + 1}</h4>
                <span className="text-xs text-gray-500">{t('settings.guidelines.editor.rules.priority')}: {rule.priority}</span>
              </div>
              <button
                onClick={() => deleteClassificationRule(ruleIndex)}
                className="p-1 text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.rules.severityLevel')}
                </label>
                <select
                  value={rule.severity}
                  onChange={(e) =>
                    updateClassificationRule(ruleIndex, 'severity', e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                >
                  {guideline.severity_levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.rules.logic')}
                </label>
                <select
                  value={rule.logic}
                  onChange={(e) =>
                    updateClassificationRule(ruleIndex, 'logic', e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                >
                  <option value="AND">{t('settings.guidelines.editor.rules.logicOptions.and')}</option>
                  <option value="OR">{t('settings.guidelines.editor.rules.logicOptions.or')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.rules.priority')}
                </label>
                <input
                  type="number"
                  value={rule.priority}
                  onChange={(e) =>
                    updateClassificationRule(
                      ruleIndex,
                      'priority',
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                  min="1"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-gray-700">
                  {t('settings.guidelines.editor.rules.conditions')}
                </label>
                <button
                  onClick={() => addRuleCondition(ruleIndex)}
                  className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t('settings.guidelines.editor.rules.addCondition')}
                </button>
              </div>

              <div className="space-y-2">
                {rule.conditions.map((condition, condIndex) => (
                  <div
                    key={condIndex}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                  >
                    <select
                      value={condition.field}
                      onChange={(e) =>
                        updateRuleCondition(
                          ruleIndex,
                          condIndex,
                          'field',
                          e.target.value
                        )
                      }
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {LESION_FIELDS.map((field) => (
                        <option key={field} value={field}>
                          {field}
                        </option>
                      ))}
                    </select>

                    <select
                      value={condition.operator}
                      onChange={(e) =>
                        updateRuleCondition(
                          ruleIndex,
                          condIndex,
                          'operator',
                          e.target.value
                        )
                      }
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                    >
                      {RULE_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      value={condition.value as number}
                      onChange={(e) =>
                        updateRuleCondition(
                          ruleIndex,
                          condIndex,
                          'value',
                          parseFloat(e.target.value)
                        )
                      }
                      className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                    />

                    <button
                      onClick={() => deleteRuleCondition(ruleIndex, condIndex)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {guideline.classification_rules.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {t('settings.guidelines.editor.rules.noRules')}
        </div>
      )}
    </div>
  );

  const renderRule421Tab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={guideline.rule_421.enabled}
          onChange={(e) => updateRule421('enabled', e.target.checked)}
          className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
        />
        <label className="text-sm font-medium text-gray-700">
          {t('settings.guidelines.editor.rule421.enable')}
        </label>
      </div>

      {guideline.rule_421.enabled && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.guidelines.editor.rule421.name')}
              </label>
              <input
                type="text"
                value={guideline.rule_421.name || ''}
                onChange={(e) => updateRule421('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                placeholder="Regla 4-2-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.guidelines.editor.rule421.description')}
            </label>
            <textarea
              value={guideline.rule_421.description || ''}
              onChange={(e) => updateRule421('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="Criterios de severidad RDNP según ETDRS..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">
                {t('settings.guidelines.editor.rule421.criteria')}
              </label>
              <button
                onClick={addRule421Criterion}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-sky-600 text-white rounded hover:bg-sky-700"
              >
                <Plus className="w-3 h-3" />
                {t('settings.guidelines.editor.rule421.addCriterion')}
              </button>
            </div>

            <div className="space-y-3">
              {guideline.rule_421.criteria.map((criterion, index) => (
                <div
                  key={index}
                  className="p-3 border border-gray-200 rounded-lg bg-white space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <h5 className="text-sm font-semibold text-gray-900">
                      {t('settings.guidelines.editor.rule421.criterion')} {index + 1}
                    </h5>
                    <button
                      onClick={() => deleteRule421Criterion(index)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('settings.guidelines.editor.rule421.fields.name')}
                      </label>
                      <input
                        type="text"
                        value={criterion.name}
                        onChange={(e) =>
                          updateRule421Criterion(index, 'name', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        placeholder="severe_hemorrhages_4q"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('settings.guidelines.editor.rule421.fields.field')}
                      </label>
                      <select
                        value={criterion.field}
                        onChange={(e) =>
                          updateRule421Criterion(index, 'field', e.target.value)
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      >
                        {LESION_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('settings.guidelines.editor.rule421.fields.minQuadrants')}
                      </label>
                      <input
                        type="number"
                        value={criterion.min_quadrants || ''}
                        onChange={(e) =>
                          updateRule421Criterion(
                            index,
                            'min_quadrants',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        min="1"
                        max="4"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('settings.guidelines.editor.rule421.fields.minPerQuadrant')}
                      </label>
                      <input
                        type="number"
                        value={criterion.min_per_quadrant || ''}
                        onChange={(e) =>
                          updateRule421Criterion(
                            index,
                            'min_per_quadrant',
                            parseInt(e.target.value)
                          )
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {t('settings.guidelines.editor.rule421.fields.minDiscAreas')}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={criterion.min_area_disc_diameters || ''}
                        onChange={(e) =>
                          updateRule421Criterion(
                            index,
                            'min_area_disc_diameters',
                            parseFloat(e.target.value)
                          )
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {t('settings.guidelines.editor.rule421.fields.description')}
                    </label>
                    <textarea
                      value={criterion.description || ''}
                      onChange={(e) =>
                        updateRule421Criterion(index, 'description', e.target.value)
                      }
                      rows={2}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="Description of this criterion..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.guidelines.editor.rule421.severityMapping')}
            </label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('settings.guidelines.editor.rule421.mapping.0met')}
                  </label>
                  <select
                    value={guideline.rule_421.severity_mapping['0_criteria_met'] || ''}
                    onChange={(e) =>
                      updateRule421('severity_mapping', {
                        ...guideline.rule_421.severity_mapping,
                        '0_criteria_met': e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="">{t('settings.guidelines.editor.rule421.mapping.none')}</option>
                    {guideline.severity_levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    {t('settings.guidelines.editor.rule421.mapping.1met')}
                  </label>
                  <select
                    value={guideline.rule_421.severity_mapping['1_criteria_met'] || ''}
                    onChange={(e) =>
                      updateRule421('severity_mapping', {
                        ...guideline.rule_421.severity_mapping,
                        '1_criteria_met': e.target.value,
                      })
                    }
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                  >
                    <option value="">{t('settings.guidelines.editor.rule421.mapping.none')}</option>
                    {guideline.severity_levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  {t('settings.guidelines.editor.rule421.mapping.2met')}
                </label>
                <select
                  value={
                    guideline.rule_421.severity_mapping['2_or_more_criteria_met'] || ''
                  }
                  onChange={(e) =>
                    updateRule421('severity_mapping', {
                      ...guideline.rule_421.severity_mapping,
                      '2_or_more_criteria_met': e.target.value,
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                >
                  <option value="">{t('settings.guidelines.editor.rule421.mapping.none')}</option>
                  {guideline.severity_levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderTreatmentTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {t('settings.guidelines.editor.treatment.description')}
        </p>
        <button
          onClick={addTreatmentProtocol}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('settings.guidelines.editor.treatment.addProtocol')}
        </button>
      </div>

      <div className="space-y-4">
        {guideline.treatment_protocols.map((protocol, index) => (
          <div
            key={index}
            className="p-4 border border-gray-200 rounded-lg bg-white space-y-3"
          >
            <div className="flex items-start justify-between">
              <h4 className="font-semibold text-gray-900">{t('settings.guidelines.editor.treatment.protocol')} {index + 1}</h4>
              <button
                onClick={() => deleteTreatmentProtocol(index)}
                className="p-1 text-red-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.treatment.severityLevel')}
                </label>
                <select
                  value={protocol.severity}
                  onChange={(e) =>
                    updateTreatmentProtocol(index, 'severity', e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                >
                  {guideline.severity_levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.treatment.urgency')}
                </label>
                <select
                  value={protocol.urgency}
                  onChange={(e) =>
                    updateTreatmentProtocol(index, 'urgency', e.target.value)
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                >
                  <option value="routine">{t('settings.guidelines.editor.treatment.urgencyOptions.routine')}</option>
                  <option value="accelerated">{t('settings.guidelines.editor.treatment.urgencyOptions.accelerated')}</option>
                  <option value="urgent">{t('settings.guidelines.editor.treatment.urgencyOptions.urgent')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  {t('settings.guidelines.editor.treatment.followupDays')}
                </label>
                <input
                  type="number"
                  value={protocol.followup_interval_days}
                  onChange={(e) =>
                    updateTreatmentProtocol(
                      index,
                      'followup_interval_days',
                      parseInt(e.target.value)
                    )
                  }
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                  min="1"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-medium text-gray-700">
                  {t('settings.guidelines.editor.treatment.actions')}
                </label>
                <button
                  onClick={() => addTreatmentAction(index)}
                  className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t('settings.guidelines.editor.treatment.addAction')}
                </button>
              </div>

              <div className="space-y-2">
                {protocol.actions.map((action, actionIndex) => (
                  <div key={actionIndex} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={action}
                      onChange={(e) =>
                        updateTreatmentAction(index, actionIndex, e.target.value)
                      }
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                      placeholder="Treatment action..."
                    />
                    <button
                      onClick={() => deleteTreatmentAction(index, actionIndex)}
                      className="p-1 text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {t('settings.guidelines.editor.treatment.rationale')}
              </label>
              <textarea
                value={protocol.rationale}
                onChange={(e) =>
                  updateTreatmentProtocol(index, 'rationale', e.target.value)
                }
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-sky-500"
                placeholder="Clinical rationale for this protocol..."
              />
            </div>
          </div>
        ))}
      </div>

      {guideline.treatment_protocols.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {t('settings.guidelines.editor.treatment.noProtocols')}
        </div>
      )}
    </div>
  );

  const renderEMCSTab = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={guideline.emcs_criteria?.enabled ?? false}
          onChange={(e) => updateEMCSCriteria('enabled', e.target.checked)}
          className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
        />
        <label className="text-sm font-medium text-gray-700">
          {t('settings.guidelines.editor.emcs.enable')}
        </label>
      </div>

      {guideline.emcs_criteria?.enabled && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.guidelines.editor.emcs.name')}
            </label>
            <input
              type="text"
              value={guideline.emcs_criteria?.name || ''}
              onChange={(e) => updateEMCSCriteria('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder="EMCS - Edema Macular Clínicamente Significativo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.guidelines.editor.emcs.distance')}
              </label>
              <input
                type="number"
                value={guideline.emcs_criteria?.geometric_distance_fovea_um ?? 500}
                onChange={(e) =>
                  updateEMCSCriteria(
                    'geometric_distance_fovea_um',
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('settings.guidelines.editor.emcs.minDiscAreas')}
              </label>
              <input
                type="number"
                step="0.1"
                value={guideline.emcs_criteria?.min_disc_areas ?? 1}
                onChange={(e) =>
                  updateEMCSCriteria('min_disc_areas', parseFloat(e.target.value))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                min="0"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={guideline.emcs_criteria?.apply_geometric_rule ?? true}
              onChange={(e) =>
                updateEMCSCriteria('apply_geometric_rule', e.target.checked)
              }
              className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
            />
            <label className="text-sm text-gray-700">
              {t('settings.guidelines.editor.emcs.applyGeometric')}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('settings.guidelines.editor.emcs.description')}
            </label>
            <textarea
              value={guideline.emcs_criteria?.description || ''}
              onChange={(e) => updateEMCSCriteria('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
              placeholder={t('settings.guidelines.editor.metadata.descriptionPlaceholder')}
            />
          </div>
        </>
      )}
    </div>
  );

  // ============================================================================
  // Main Render
  // ============================================================================

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'metadata', label: t('settings.guidelines.editor.tabs.metadata'), icon: FileText },
    { id: 'severity', label: t('settings.guidelines.editor.tabs.severity'), icon: Layers },
    { id: 'rules', label: t('settings.guidelines.editor.tabs.rules'), icon: GitBranch },
    { id: 'rule421', label: t('settings.guidelines.editor.tabs.rule421'), icon: Binary },
    { id: 'treatment', label: t('settings.guidelines.editor.tabs.treatment'), icon: Pill },
    { id: 'emcs', label: t('settings.guidelines.editor.tabs.emcs'), icon: Eye },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('settings.guidelines.editor.title')}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {t('settings.guidelines.editor.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t('settings.guidelines.editor.importJson')}
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('settings.guidelines.editor.exportJson')}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-900 mb-2">
                {t('settings.guidelines.editor.messages.validationError')}
              </h4>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setErrors([])}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">{success}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    activeTab === tab.id
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {activeTab === 'metadata' && renderMetadataTab()}
        {activeTab === 'severity' && renderSeverityTab()}
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'rule421' && renderRule421Tab()}
        {activeTab === 'treatment' && renderTreatmentTab()}
        {activeTab === 'emcs' && renderEMCSTab()}
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-gray-200 space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {t('settings.guidelines.editor.summary.levels', { count: guideline.severity_levels.length })} •{' '}
            {t('settings.guidelines.editor.summary.rules', { count: guideline.classification_rules.length })} •{' '}
            {t('settings.guidelines.editor.summary.protocols', { count: guideline.treatment_protocols.length })}
          </div>
        </div>


        <div className="flex gap-3 justify-end">
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {t('settings.guidelines.editor.cancel')}
            </button>
          )}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('settings.guidelines.editor.exportJson')}
          </button>
          <button
            onClick={() => {
              const validationErrors = validateGuideline();
              if (validationErrors.length > 0) {
                setErrors(validationErrors);
              } else {
                // Export and close
                handleExportJSON();
                setSuccess(t('settings.guidelines.editor.messages.saveSuccess'));
                setTimeout(() => {
                  setSuccess(null);
                  onClose?.();
                }, 1500);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {t('settings.guidelines.editor.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
