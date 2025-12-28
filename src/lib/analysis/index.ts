/**
 * DR Classification System
 * Export all classification functionality
 */

// Core classifier
export {
  classifyDiabeticRetinopathy,
  countLesions,
  assessRiskFactors,
  generateRecommendations,
  formatClassificationText,
  type DRSeverityLevel,
  type RiskFactors,
  type LesionCounts,
  type EyeClassification,
  type DRClassification
} from './dr-classifier';

// Service functions
export {
  classifySessionDR,
  classifyPatientDR,
  compareSessionClassifications,
  getGlobalStatistics,
  exportClassificationJSON
} from './dr-classification-service';

// React hook
export { useDRClassification } from '../../hooks/useDRClassification';
