/**
 * pdf-document.js
 * Gestiona el flujo de creación del documento PDF con todas sus secciones
 */

import { PDFGenerator } from './pdf-generator.js';
import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { loadProjectLogo } from '../utils/image-handler.js';
import { checkPageBreak, addTableOfContents } from '../utils/pdf-utils.js';

// Importar secciones
import { addCoverPage } from '../sections/cover-section.js';
import { addSummarySection } from '../sections/summary-section.js';
import { addClassInfoSection } from '../sections/class-info-section.js';
import { addDetectionsSection } from '../sections/detections-section.js';
import { addThumbnailsSection } from '../sections/thumbnails-section.js';
import { addMetricsSection } from '../sections/metrics-section.js';

/**
 * Clase que gestiona la creación del documento PDF
 */
export class PDFDocument {
    /**
     * Constructor
     * @param {Object} analysisData - Datos del análisis
     * @param {Object} options - Opciones adicionales
     */
    constructor(analysisData, options = {}) {
        this.data = analysisData || {};
        this.options = options;
        
        // Inicializar generador de PDF
        this.generator = new PDFGenerator(options);
        
        // Marcadores para la tabla de contenidos
        this.bookmarks = [];
        
        // Estado de preparación de recursos
        this.resourcesReady = false;
        
        // Recursos
        this.resources = {
            logo: null,
            projectName: 'Sistema DIRD',
            fileDate: new Date().toLocaleString(PDFSettings.language.defaultLocale)
        };
    }
    
    /**
     * Prepara los recursos necesarios para el documento
     * @returns {Promise<void>}
     */
    async prepareResources() {
        if (this.resourcesReady) return;
        
        try {
            // Cargar logo
            this.resources.logo = await loadProjectLogo();
            
            // Información de imagen si está disponible
            if (this.data.imageInfo) {
                this.resources.imageDate = new Date(this.data.imageInfo.date || Date.now())
                    .toLocaleString(PDFSettings.language.defaultLocale);
            }
            
            // Marcar recursos como preparados
            this.resourcesReady = true;
        } catch (error) {
            console.error('Error al preparar recursos:', error);
            // Continuar aunque falle la carga de recursos
            this.resourcesReady = true;
        }
    }
    
    /**
     * Genera el documento PDF completo
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async generate(filename = 'analisis_dird.pdf') {
        try {
            // Preparar recursos
            await this.prepareResources();
            
            // 1. Portada
            await this.generator.addSection(
                (doc, y) => addCoverPage(doc, y, this.data, this.resources),
                { title: getTranslation('coverTitle'), bookmark: true }
            );
            
            // 2. Tabla de contenidos (se completará al final)
            const tocY = await this.generator.addSection(
                (doc, y) => Promise.resolve(y + 10), // Por ahora solo reservamos espacio
                { 
                    title: getTranslation('tableOfContents'), 
                    bookmark: false,
                    startNewPage: true
                }
            );
            const tocPage = this.generator.doc.getNumberOfPages();
            
            // 3. Sección de resumen
            await this.generator.addSection(
                (doc, y) => addSummarySection(doc, y, this.data, this.resources),
                { 
                    title: getTranslation('summaryTitle'), 
                    bookmark: true,
                    startNewPage: true
                }
            );
            
            // 4. Información de clases
            await this.generator.addSection(
                (doc, y) => addClassInfoSection(doc, y, this.data, this.resources),
                { 
                    title: getTranslation('classInfoTitle'), 
                    bookmark: true,
                    startNewPage: true
                }
            );
            
            // 5. Detalle de detecciones
            await this.generator.addSection(
                (doc, y) => addDetectionsSection(doc, y, this.data, this.resources),
                { 
                    title: getTranslation('detectionsTitle'), 
                    bookmark: true,
                    startNewPage: true
                }
            );
            
            // 6. Miniaturas de regiones detectadas
            if (PDFSettings.content.includeThumbnails && this.data.detections && this.data.detections.length > 0) {
                await this.generator.addSection(
                    (doc, y) => addThumbnailsSection(doc, y, this.data, this.resources),
                    { 
                        title: getTranslation('thumbnailsTitle'), 
                        bookmark: true,
                        startNewPage: true
                    }
                );
            }
            
            // 7. Métricas (si están disponibles)
            if (this.data.confidenceMetrics) {
                await this.generator.addSection(
                    (doc, y) => addMetricsSection(doc, y, this.data, this.resources),
                    { 
                        title: getTranslation('metricsTitle'), 
                        bookmark: true,
                        startNewPage: true
                    }
                );
            }
            
            // Generar tabla de contenidos
            if (PDFSettings.content.includeTableOfContents) {
                this.generator.doc.setPage(tocPage);
                
                const margins = PDFSettings.layout.margins;
                const bookmarks = this.generator.sectionBookmarks;
                
                addTableOfContents(this.generator.doc, bookmarks, margins.top + 10);
            }
            
            // Guardar el documento
            return await this.generator.saveDocument(filename);
        } catch (error) {
            console.error('Error al generar documento PDF:', error);
            throw error;
        }
    }
}