/**
 * index.js
 * Punto de entrada principal para el exportador de PDF del sistema DIRD.
 * Expone las funciones públicas que pueden ser utilizadas por otros módulos.
 */

import { generateAnalysisPDF } from './core/pdf-exporter.js';
import { PDFSettings, updatePDFSettings } from './config/pdf-settings.js';

/**
 * Exporta un análisis completo a PDF
 * @param {Object} analysisData - Datos de análisis para incluir en el PDF
 * @param {Object} options - Opciones de configuración para el PDF
 * @returns {Promise<boolean>} Promesa que se resuelve con el éxito de la operación
 */
async function exportAnalysisToPDF(analysisData, options = {}) {
    try {
        // Actualizar configuración con las opciones proporcionadas
        updatePDFSettings(options);
        
        // Generar y guardar el PDF
        return await generateAnalysisPDF(analysisData);
    } catch (error) {
        console.error('Error en exportación a PDF:', error);
        throw error;
    }
}

/**
 * Obtiene la configuración actual del exportador de PDF
 * @returns {Object} Configuración actual
 */
function getPDFSettings() {
    return { ...PDFSettings };
}

/**
 * Establece la configuración del exportador de PDF
 * @param {Object} settings - Nuevas configuraciones
 */
function setPDFSettings(settings) {
    updatePDFSettings(settings);
}

// Exportar API pública
export {
    exportAnalysisToPDF,
    getPDFSettings,
    setPDFSettings
};

// Para compatibilidad con el código existente que usa window.PDFExporter
window.PDFExporter = {
    exportAnalysis: exportAnalysisToPDF,
    getSettings: getPDFSettings,
    setSettings: setPDFSettings
};