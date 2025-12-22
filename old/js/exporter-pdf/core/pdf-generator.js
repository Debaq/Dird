/**
 * pdf-generator.js
 * Clase principal para generar documentos PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { addPageHeader, addPageFooter, safeSavePDF } from '../utils/pdf-utils.js';
import { applyColorToDoc } from '../utils/color-utils.js';

/**
 * Clase PDFGenerator para generar PDFs con múltiples secciones
 */
export class PDFGenerator {
    /**
     * Constructor del generador de PDF
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Configurar opciones
        this.options = { ...options };
        
        // Inicializar jsPDF
        this.initializeDocument();
        
        // Estado interno
        this.currentY = PDFSettings.layout.margins.top;
        this.sectionBookmarks = [];
        this.documentOutline = [];
    }
    
    /**
     * Inicializa el documento jsPDF
     */
    initializeDocument() {
        try {
            // Comprobar que jsPDF está disponible
            const JsPDF = jspdf?.jsPDF || jsPDF || window.jsPDF;
            
            if (!JsPDF) {
                throw new Error('jsPDF no está disponible');
            }
            
            // Crear instancia de jsPDF
            this.doc = new JsPDF({
                orientation: PDFSettings.document.orientation,
                unit: PDFSettings.document.unit,
                format: PDFSettings.document.format,
                compress: PDFSettings.document.compress
            });
            
            // Configurar encabezado y pie de página
            if (PDFSettings.content.includePageNumbers) {
                this.doc.setPage(1);
                this.setupHeaderAndFooter();
            }
            
        } catch (error) {
            console.error('Error al inicializar documento PDF:', error);
            throw error;
        }
    }
    
    /**
     * Configura el encabezado y pie de página automáticos
     */
    setupHeaderAndFooter() {
        // Configurar evento para encabezado y pie de página
        const headerFunction = (data) => {
            // No aplicar en la primera página
            if (data.pageNumber === 1) return;
            
            // Agregar encabezado en páginas subsiguientes
            addPageHeader(this.doc);
        };
        
        const footerFunction = (data) => {
            // Agregar pie de página en todas las páginas
            addPageFooter(this.doc);
        };
        
        try {
            // Configurar eventos
            if (typeof this.doc.setHeaderFunction === 'function') {
                this.doc.setHeaderFunction(headerFunction);
            }
            
            if (typeof this.doc.setFooterFunction === 'function') {
                this.doc.setFooterFunction(footerFunction);
            }
            
            // Si no están disponibles las funciones de eventos, usar método manual
            if (typeof this.doc.setHeaderFunction !== 'function' && 
                PDFSettings.content.includeHeader) {
                
                // Guardar referencia a la función interna de página nueva
                const originalAddPage = this.doc.addPage;
                
                // Sobreescribir con nuestra versión
                this.doc.addPage = (...args) => {
                    // Llamar a la función original primero
                    originalAddPage.apply(this.doc, args);
                    
                    // Luego agregar nuestro encabezado
                    addPageHeader(this.doc);
                };
            }
        } catch (error) {
            console.error('Error al configurar encabezado y pie de página:', error);
        }
    }
    
    /**
     * Agrega una sección al documento
     * @param {Function} sectionFunction - Función que genera la sección
     * @param {Object} options - Opciones para la sección
     * @returns {number} Posición Y final después de la sección
     */
    async addSection(sectionFunction, options = {}) {
        try {
            // Opciones por defecto
            const sectionOptions = {
                title: '',
                bookmark: true,
                startNewPage: false,
                ...options
            };
            
            // Si es necesario, comenzar una nueva página
            if (sectionOptions.startNewPage && this.doc.getNumberOfPages() > 0) {
                this.doc.addPage();
                this.currentY = PDFSettings.layout.margins.top;
            }
            
            // Guardar posición actual para marcador
            const bookmark = {
                title: sectionOptions.title,
                pageNumber: this.doc.getNumberOfPages()
            };
            
            // Ejecutar la función de sección
            this.currentY = await sectionFunction(this.doc, this.currentY, this.options);
            
            // Guardar marcador si está habilitado
            if (sectionOptions.bookmark && sectionOptions.title) {
                this.sectionBookmarks.push(bookmark);
            }
            
            return this.currentY;
        } catch (error) {
            console.error(`Error al agregar sección "${options.title}":`, error);
            return this.currentY;
        }
    }
    
    /**
     * Finaliza el documento y lo guarda
     * @param {string} filename - Nombre del archivo
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async saveDocument(filename = 'documento.pdf') {
        try {
            // Si está habilitada la encriptación, aplicarla
            if (PDFSettings.document.encryption.enabled) {
                const encOptions = PDFSettings.document.encryption;
                
                if (encOptions.userPassword || encOptions.ownerPassword) {
                    this.doc.setEncryption(
                        encOptions.userPassword,
                        encOptions.ownerPassword,
                        encOptions.permissions
                    );
                }
            }
            
            // Agregar pie de página a todas las páginas si no se configuró automáticamente
            if (PDFSettings.content.includeFooter && typeof this.doc.setFooterFunction !== 'function') {
                const totalPages = this.doc.getNumberOfPages();
                
                for (let i = 1; i <= totalPages; i++) {
                    this.doc.setPage(i);
                    addPageFooter(this.doc);
                }
            }
            
            // Guardar el documento
            return await safeSavePDF(this.doc, filename);
        } catch (error) {
            console.error('Error al guardar documento PDF:', error);
            throw error;
        }
    }
    
    /**
     * Agrega un título de sección con formato estándar
     * @param {string} title - Título de la sección
     * @param {number} y - Posición Y inicial
     * @param {Object} options - Opciones adicionales
     * @returns {number} Nueva posición Y
     */
    addSectionTitle(title, y, options = {}) {
        const margins = PDFSettings.layout.margins;
        const spacing = PDFSettings.layout.spacing;
        const pageWidth = this.doc.internal.pageSize.getWidth();
        
        try {
            // Aplicar estilo de título
            this.doc.setFont(PDFSettings.style.font.family, 'bold');
            this.doc.setFontSize(PDFSettings.style.font.subtitleSize);
            applyColorToDoc(this.doc, PDFSettings.style.colors.secondary);
            
            // Dibujar título
            this.doc.text(title, margins.left, y);
            y += spacing.title / 2;
            
            // Dibujar línea separadora
            this.doc.setDrawColor(200, 200, 200);
            this.doc.setLineWidth(0.5);
            this.doc.line(margins.left, y, pageWidth - margins.right, y);
            
            return y + spacing.paragraph;
        } catch (error) {
            console.error(`Error al agregar título de sección "${title}":`, error);
            return y + spacing.paragraph;
        }
    }
    
    /**
     * Verifica si hay suficiente espacio en la página, y si no, crea una nueva
     * @param {number} y - Posición Y actual
     * @param {number} requiredSpace - Espacio requerido
     * @param {Object} options - Opciones adicionales
     * @returns {number} Nueva posición Y
     */
    checkPageBreak(y, requiredSpace, options = {}) {
        const pageHeight = this.doc.internal.pageSize.getHeight();
        const margins = PDFSettings.layout.margins;
        const bottomMargin = options.bottomMargin || margins.bottom;
        
        // Si no hay suficiente espacio
        if (y + requiredSpace > pageHeight - bottomMargin) {
            // Agregar nueva página
            this.doc.addPage();
            
            // Reiniciar posición Y
            y = margins.top;
            
            // Si hay título de sección para repetir
            if (options.title) {
                return this.addSectionTitle(options.title, y, { noLine: true });
            }
        }
        
        return y;
    }
}