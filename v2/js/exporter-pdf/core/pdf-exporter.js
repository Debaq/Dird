/**
 * pdf-exporter.js
 * Punto de entrada para la exportación de PDF con manejo de errores y notificaciones
 */

import { PDFDocument } from './pdf-document.js';
import { PDFSettings, updatePDFSettings } from '../config/pdf-settings.js';

/**
 * Genera un PDF de análisis completo
 * @param {Object} analysisData - Datos del análisis
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<boolean>} Éxito de la operación
 */
export async function generateAnalysisPDF(analysisData, options = {}) {
    // Verificar datos mínimos necesarios
    if (!analysisData || !analysisData.detections) {
        showStatusMessage('No hay datos suficientes para generar el PDF', 'error');
        return false;
    }
    
    try {
        // Mostrar mensaje de inicio
        showStatusMessage('Preparando generación de PDF...', 'info');
        
        // Comenzar a contar tiempo
        console.time('Generación de PDF');
        
        // Obtener fecha para el nombre de archivo
        const date = new Date();
        const timestamp = date.toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const filename = options.filename || `analisis_dird_${timestamp}.pdf`;
        
        // Actualizar configuración con opciones proporcionadas
        if (Object.keys(options).length > 0) {
            updatePDFSettings(options);
        }
        
        // Crear documento
        showStatusMessage('Generando documento PDF...', 'info');
        const document = new PDFDocument(analysisData, options);
        
        // Generar el PDF
        const success = await document.generate(filename);
        
        // Mostrar mensaje final según resultado
        if (success) {
            console.timeEnd('Generación de PDF');
            showStatusMessage('PDF generado exitosamente', 'success');
        } else {
            console.timeEnd('Generación de PDF');
            showStatusMessage('Hubo un problema al generar el PDF', 'warning');
        }
        
        return success;
    } catch (error) {
        console.error('Error en la generación de PDF:', error);
        console.timeEnd('Generación de PDF');
        
        // Mensaje de error
        let errorMessage = 'Error al generar el PDF';
        
        if (error && error.message) {
            // Mensajes de error específicos según el tipo
            if (error.message.includes('jsPDF')) {
                errorMessage = 'Error de librería jsPDF: biblioteca no disponible o corrupta';
            } else if (error.message.includes('Image')) {
                errorMessage = 'Error al procesar imágenes para el PDF';
            } else if (error.message.includes('load') || error.message.includes('fetch')) {
                errorMessage = 'Error al cargar recursos para el PDF';
            } else {
                errorMessage = `Error: ${error.message}`;
            }
        }
        
        showStatusMessage(errorMessage, 'error');
        
        // Propagar error si está habilitado
        if (PDFSettings.functionality.errorHandling === 'throw') {
            throw error;
        }
        
        return false;
    }
}

/**
 * Muestra un mensaje de estado al usuario
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de mensaje ('info', 'success', 'warning', 'error')
 */
function showStatusMessage(message, type = 'info') {
    // Intentar mostrar en el modal de análisis
    const useModalStatus = window.AnalysisModal && window.AnalysisModal.showStatus;
    
    if (useModalStatus) {
        window.AnalysisModal.showStatus(message, type);
    }
    
    // Mostrar en consola dependiendo del tipo
    switch (type) {
        case 'error':
            console.error(`PDF Exporter: ${message}`);
            break;
        case 'warning':
            console.warn(`PDF Exporter: ${message}`);
            break;
        case 'success':
            console.log(`PDF Exporter: %c${message}`, 'color: green; font-weight: bold;');
            break;
        default:
            console.log(`PDF Exporter: ${message}`);
    }
    
    // Si el manejo de errores es 'alert', mostrar alertas para errores
    if (type === 'error' && PDFSettings.functionality.errorHandling === 'alert') {
        alert(`Error en generación de PDF: ${message}`);
    }
}