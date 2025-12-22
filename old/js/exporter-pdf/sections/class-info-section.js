/**
 * class-info-section.js
 * Implementa la sección de información detallada sobre las clases detectadas
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc, hexToRgb, getClassColor, isColorDark } from '../utils/color-utils.js';
import { checkPageBreak } from '../utils/pdf-utils.js';

/**
 * Agrega la sección de información de clases al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addClassInfoSection(doc, y, data, resources) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título de la sección
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
        
        doc.text(getTranslation('classInfoTitle'), margins.left, y);
        y += 5;
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margins.left, y, pageWidth - margins.right, y);
        y += 10;
        
        // Verificar si tenemos información de clases disponible
        const classDefinitions = getClassDefinitions();
        
        if (!classDefinitions || classDefinitions.length === 0) {
            // No hay definiciones de clase disponibles
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(12);
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            doc.text(
                'No hay información detallada disponible sobre las clases.',
                margins.left,
                y
            );
            
            return y + 10;
        }
        
        // Filtrar solo las clases presentes en las detecciones
        const classesInDetections = getClassesInDetections(data.detections);
        let filteredDefinitions = classDefinitions;
        
        if (classesInDetections.length > 0) {
            // Filtrar solo las clases presentes en las detecciones
            filteredDefinitions = classDefinitions.filter(def => 
                classesInDetections.includes(def.id)
            );
        }
        
        // Si después de filtrar no quedan definiciones, mostrar mensaje
        if (filteredDefinitions.length === 0) {
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(12);
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            doc.text(
                'No hay definiciones disponibles para las clases detectadas.',
                margins.left,
                y
            );
            
            return y + 10;
        }
        
        // Texto introductorio
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        doc.text(
            'A continuación se presenta información detallada sobre las clases detectadas:',
            margins.left,
            y
        );
        
        y += 15;
        
        // Agregar cada clase con su información
        for (const classInfo of filteredDefinitions) {
            // Verificar espacio disponible para esta clase
            y = checkPageBreak(doc, y, 100, {
                title: getTranslation('classInfoTitle')
            });
            
            // Rectángulo de color para la clase
            const classColor = classInfo.color || getDefaultColorForClass(classInfo.id);
            const rgb = hexToRgb(classColor);
            
            // Rectángulo coloreado
            doc.setFillColor(rgb.r, rgb.g, rgb.b);
            doc.rect(margins.left, y, pageWidth - margins.left - margins.right, 25, 'F');
            
            // Determinar si es necesario usar texto blanco (para fondos oscuros)
            const isDark = isColorDark(classColor);
            
            // Nombre de la clase
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(16);
            doc.setTextColor(isDark ? 255 : 0, isDark ? 255 : 0, isDark ? 255 : 0);
            
            doc.text(classInfo.name, margins.left + 10, y + 15);
            
            // Reset color del texto
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            y += 35;
            
            // Verificar si hay que pasar a nueva página
            y = checkPageBreak(doc, y, 80);
            
            // Descripción
            if (classInfo.description) {
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Descripción:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                // Manejar texto largo con saltos de línea
                const description = doc.splitTextToSize(
                    classInfo.description,
                    pageWidth - margins.left - margins.right - 10
                );
                
                doc.text(description, margins.left + 10, y);
                y += description.length * 6 + 5;
            }
            
            // Verificar espacio para significado clínico
            y = checkPageBreak(doc, y, 80);
            
            // Significado clínico
            if (classInfo.clinicalSignificance) {
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Significado clínico:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                // Manejar texto largo con saltos de línea
                const significance = doc.splitTextToSize(
                    classInfo.clinicalSignificance,
                    pageWidth - margins.left - margins.right - 10
                );
                
                doc.text(significance, margins.left + 10, y);
                y += significance.length * 6 + 5;
            }
            
            // Características
            if (classInfo.characteristics && classInfo.characteristics.length > 0) {
                y = checkPageBreak(doc, y, 60);
                
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Características:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                // Mostrar cada característica como viñeta
                classInfo.characteristics.forEach(characteristic => {
                    doc.text('•', margins.left + 5, y);
                    
                    // Manejar texto largo con saltos de línea
                    const text = doc.splitTextToSize(
                        characteristic,
                        pageWidth - margins.left - margins.right - 20
                    );
                    
                    doc.text(text, margins.left + 15, y);
                    y += text.length * 6 + 2;
                });
                
                y += 5;
            }
            
            // Ubicaciones comunes
            if (classInfo.commonLocations && classInfo.commonLocations.length > 0) {
                y = checkPageBreak(doc, y, 40);
                
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Ubicaciones comunes:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                // Mostrar cada ubicación como viñeta
                classInfo.commonLocations.forEach(location => {
                    doc.text('•', margins.left + 5, y);
                    
                    // Manejar texto largo con saltos de línea
                    const text = doc.splitTextToSize(
                        location,
                        pageWidth - margins.left - margins.right - 20
                    );
                    
                    doc.text(text, margins.left + 15, y);
                    y += text.length * 6 + 2;
                });
                
                y += 5;
            }
            
            // Posible confusión
            if (classInfo.confusionWith && classInfo.confusionWith.length > 0) {
                y = checkPageBreak(doc, y, 40);
                
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Posible confusión con:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                // Mostrar cada elemento como viñeta
                classInfo.confusionWith.forEach(item => {
                    doc.text('•', margins.left + 5, y);
                    
                    // Manejar texto largo con saltos de línea
                    const text = doc.splitTextToSize(
                        item,
                        pageWidth - margins.left - margins.right - 20
                    );
                    
                    doc.text(text, margins.left + 15, y);
                    y += text.length * 6 + 2;
                });
                
                y += 5;
            }
            
            // Importancia
            if (classInfo.importance) {
                y = checkPageBreak(doc, y, 30);
                
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Importancia:', margins.left, y);
                y += 7;
                
                doc.setFont(PDFSettings.style.font.family, 'normal');
                doc.setFontSize(11);
                
                doc.text(classInfo.importance, margins.left + 10, y);
                y += 7;
            }
            
            // Separador entre clases
            y += 10;
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.5);
            doc.line(margins.left, y, pageWidth - margins.right, y);
            y += 15;
        }
        
        return y;
    } catch (error) {
        console.error('Error al agregar sección de información de clases:', error);
        return y + 10;
    }
}

/**
 * Obtiene las definiciones de clases del sistema
 * @returns {Array} Lista de definiciones de clases
 */
function getClassDefinitions() {
    // Intentar obtener definiciones de ClassDefinitions
    if (window.ClassDefinitions && window.ClassDefinitions.classes) {
        return window.ClassDefinitions.classes;
    }
    
    // Si no hay definiciones disponibles, crear unas básicas a partir de window.classes
    if (window.classes && Array.isArray(window.classes)) {
        return window.classes.map((className, index) => {
            let color = '#3498db'; // Color por defecto
            
            // Intentar obtener color real
            if (window.colors && index < window.colors.length) {
                color = window.colors[index];
            }
            
            return {
                id: index,
                name: className,
                color: color,
                description: `Clase "${className}" identificada por el modelo.`,
                importance: 'No definida'
            };
        });
    }
    
    return [];
}

/**
 * Obtiene los IDs de clases presentes en las detecciones
 * @param {Array} detections - Lista de detecciones
 * @returns {Array} Lista de IDs de clases
 */
function getClassesInDetections(detections) {
    if (!detections || !Array.isArray(detections) || detections.length === 0) {
        return [];
    }
    
    // Extraer IDs únicos
    const classIds = detections.map(det => det.class);
    return [...new Set(classIds)];
}

/**
 * Obtiene un color por defecto para una clase según su ID
 * @param {number} classId - ID de la clase
 * @returns {string} Color en formato hexadecimal
 */
function getDefaultColorForClass(classId) {
    const defaultColors = [
        '#FF3838', '#48F90A', '#FFB21D', '#00C2FF', 
        '#7B83EB', '#FFA6D9', '#54FFBD', '#FF6E1D'
    ];
    
    return defaultColors[classId % defaultColors.length];
}