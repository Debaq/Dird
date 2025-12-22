/**
 * pdf-settings.js
 * Configuración global para el exportador de PDF
 */

/**
 * Configuración por defecto para la generación de PDF
 */
export const PDFSettings = {
    // Configuración del documento
    document: {
        format: 'a4',
        orientation: 'portrait',
        unit: 'mm',
        compress: true,
        encryption: {
            enabled: false,
            userPassword: '',
            ownerPassword: '',
            permissions: []
        }
    },
    
    // Configuración de estilo
    style: {
        font: {
            family: 'helvetica',
            titleSize: 18,
            subtitleSize: 14,
            normalSize: 10,
            smallSize: 8
        },
        colors: {
            primary: '#3498db',
            secondary: '#2c3e50',
            accent: '#e74c3c',
            background: '#f8f9fa',
            text: '#333333',
            light: '#666666',
            ultraLight: '#eeeeee'
        },
        page: {
            backgroundColor: '#ffffff',
            lineColor: '#dddddd',
            lineWidth: 0.5
        }
    },
    
    // Configuración de layout
    layout: {
        margins: {
            top: 20,
            right: 20,
            bottom: 20,
            left: 20
        },
        spacing: {
            paragraph: 5,
            section: 10,
            title: 15
        }
    },
    
    // Configuración de contenido
    content: {
        includePageNumbers: true,
        includeHeader: true,
        includeFooter: true,
        includeTableOfContents: true,
        includeImages: true,
        includeCharts: true,
        includeThumbnails: true,
        maxThumbnailsPerPage: 9,
        pagesLimitWarning: 30,
        imageQuality: 0.8,
        chartQuality: 0.9,
        detectionLimit: 50,
        thumbnailSize: 100
    },
    
    // Configuración de idioma
    language: {
        dateFormat: 'DD/MM/YYYY HH:mm',
        defaultLocale: 'es-ES',
        translations: {
            es: {
                coverTitle: 'Análisis de Detecciones DIRD',
                summaryTitle: 'Resumen del Análisis',
                classInfoTitle: 'Información de Clases Detectadas',
                detectionsTitle: 'Detalle de Detecciones',
                thumbnailsTitle: 'Regiones Detectadas',
                metricsTitle: 'Métricas de Rendimiento',
                generatedAt: 'Generado el',
                page: 'Página',
                of: 'de',
                totalDetections: 'Total de detecciones',
                tableOfContents: 'Índice'
            },
            en: {
                coverTitle: 'DIRD Detection Analysis',
                summaryTitle: 'Analysis Summary',
                classInfoTitle: 'Detected Class Information',
                detectionsTitle: 'Detection Details',
                thumbnailsTitle: 'Detected Regions',
                metricsTitle: 'Performance Metrics',
                generatedAt: 'Generated on',
                page: 'Page',
                of: 'of',
                totalDetections: 'Total detections',
                tableOfContents: 'Table of Contents'
            }
        }
    },
    
    // Configuración de recursos
    resources: {
        logoPath: 'img/header.png',
        logoAlternativePath: 'https://yourhost.com/img/header.png',
        maxLogoWidth: 150,
        defaultClassIconSize: 10,
        defaultFallbackColor: '#3498db'
    },
    
    // Configuración de funcionalidad
    functionality: {
        downloadMethod: 'auto', // auto, save, blob, dataUrl, window
        enableAlternativeDownload: true,
        enableDownloadFallback: true,
        maxRetries: 2,
        retryDelay: 500,
        useCompatibilityMode: false,
        errorHandling: 'silent', // silent, console, throw, alert
        debugMode: false
    }
};

/**
 * Actualiza las configuraciones del PDF de forma recursiva
 * @param {Object} newSettings - Nuevas configuraciones a aplicar
 */
export function updatePDFSettings(newSettings) {
    if (!newSettings || typeof newSettings !== 'object') return;
    
    // Función recursiva para actualizar configuraciones
    function deepUpdate(target, source) {
        for (const key in source) {
            // Solo actualizar propiedades que existen
            if (key in target) {
                if (
                    typeof source[key] === 'object' && 
                    source[key] !== null && 
                    typeof target[key] === 'object' && 
                    target[key] !== null
                ) {
                    // Recursión para objetos anidados
                    deepUpdate(target[key], source[key]);
                } else {
                    // Asignación directa para valores primitivos
                    target[key] = source[key];
                }
            }
        }
    }
    
    // Aplicar actualización recursiva
    deepUpdate(PDFSettings, newSettings);
}

/**
 * Obtiene un texto traducido basado en la clave
 * @param {string} key - Clave de traducción
 * @returns {string} Texto traducido
 */
export function getTranslation(key) {
    const locale = PDFSettings.language.defaultLocale.substring(0, 2);
    const translations = PDFSettings.language.translations;
    
    if (translations[locale] && translations[locale][key]) {
        return translations[locale][key];
    }
    
    // Fallback a español si no hay traducción
    if (translations.es && translations.es[key]) {
        return translations.es[key];
    }
    
    // Fallback a inglés si no hay traducción en español
    if (translations.en && translations.en[key]) {
        return translations.en[key];
    }
    
    // Devolver la clave como último recurso
    return key;
}