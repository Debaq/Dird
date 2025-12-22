/**
 * metrics-section.js
 * Implementa la sección de métricas de rendimiento en el PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc, getClassColorHex } from '../utils/color-utils.js';
import { checkPageBreak } from '../utils/pdf-utils.js';
import { addBarChart, addLineChart } from '../utils/chart-generator.js';

/**
 * Agrega la sección de métricas al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addMetricsSection(doc, y, data, resources) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título de la sección
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
        
        doc.text(getTranslation('metricsTitle'), margins.left, y);
        y += 5;
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margins.left, y, pageWidth - margins.right, y);
        y += 10;
        
        // Si no hay métricas disponibles, mostrar mensaje
        if (!data.confidenceMetrics) {
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(12);
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            doc.text(
                'No hay métricas de rendimiento disponibles para mostrar.',
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
            'A continuación se presentan métricas de rendimiento del modelo:',
            margins.left,
            y
        );
        y += 15;
        
        // Tabla de métricas clave
        const metrics = data.confidenceMetrics;
        
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(14);
        doc.text('Métricas Principales', margins.left, y);
        y += 10;
        
        // Crear tabla simple de métricas
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        
        // Umbral óptimo
        if (metrics.optimalThreshold) {
            doc.text('Umbral óptimo:', margins.left, y);
            doc.text(
                metrics.optimalThreshold.toFixed(2),
                margins.left + 130,
                y
            );
            y += 7;
        }
        
        // Precisión
        if (metrics.optimalPrecision || metrics.currentPrecision) {
            const precision = metrics.optimalPrecision || metrics.currentPrecision || 0;
            doc.text('Precisión:', margins.left, y);
            doc.text(
                `${(precision * 100).toFixed(2)}%`,
                margins.left + 130,
                y
            );
            y += 7;
        }
        
        // Recall
        if (metrics.optimalRecall || metrics.currentRecall) {
            const recall = metrics.optimalRecall || metrics.currentRecall || 0;
            doc.text('Recall:', margins.left, y);
            doc.text(
                `${(recall * 100).toFixed(2)}%`,
                margins.left + 130,
                y
            );
            y += 7;
        }
        
        // F1-Score
        if (metrics.optimalF1 || metrics.currentF1) {
            const f1Score = metrics.optimalF1 || metrics.currentF1 || 0;
            doc.text('F1-Score:', margins.left, y);
            doc.text(
                `${(f1Score * 100).toFixed(2)}%`,
                margins.left + 130,
                y
            );
            y += 7;
        }
        
        // Mapa de Precisión-Recall (AP)
        if (metrics.mAP) {
            doc.text('mAP:', margins.left, y);
            doc.text(
                `${(metrics.mAP * 100).toFixed(2)}%`,
                margins.left + 130,
                y
            );
            y += 7;
        }
        
        // Confianza promedio
        if (metrics.avgConfidence) {
            doc.text('Confianza media:', margins.left, y);
            doc.text(
                `${metrics.avgConfidence.toFixed(2)}%`,
                margins.left + 130,
                y
            );
            y += 15;
        }
        
        // --- Histograma de confianza ---
        if (metrics.distribution && PDFSettings.content.includeCharts) {
            y = checkPageBreak(doc, y, 120);
            
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(14);
            doc.text('Distribución de Confianza', margins.left, y);
            y += 10;
            
            // Preparar datos para el histograma
            const distributionLabels = [];
            for (let i = 0; i < metrics.distribution.length; i++) {
                const min = i * (100 / metrics.distribution.length);
                const max = (i + 1) * (100 / metrics.distribution.length);
                distributionLabels.push(`${min.toFixed(0)}-${max.toFixed(0)}%`);
            }
            
            const chartData = {
                labels: distributionLabels,
                values: metrics.distribution,
                label: 'Detecciones',
                colors: '#3498db'
            };
            
            try {
                // Agregar histograma de confianza
                y = await addBarChart(doc, chartData, y, {
                    title: 'Histograma de Valores de Confianza',
                    xAxisTitle: 'Rango de confianza (%)',
                    yAxisTitle: 'Cantidad',
                    height: 100
                });
            } catch (chartError) {
                console.error('Error al crear histograma de confianza:', chartError);
                y += 10;
            }
        }
        
        // --- Curva Precisión-Recall ---
        if (metrics.prCurve && metrics.prCurve.precision && metrics.prCurve.recall && PDFSettings.content.includeCharts) {
            y = checkPageBreak(doc, y, 130);
            
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(14);
            doc.text('Curva Precisión-Recall', margins.left, y);
            y += 10;
            
            try {
                // Preparar datos para la curva PR
                const datasets = [
                    {
                        label: 'Precisión-Recall',
                        values: metrics.prCurve.precision.map((precision, i) => ({
                            x: metrics.prCurve.recall[i],
                            y: precision
                        })),
                        color: '#e74c3c'
                    }
                ];
                
                // Etiquetas para el eje X (recall)
                const recallLabels = [];
                for (let i = 0; i <= 10; i++) {
                    recallLabels.push((i / 10).toFixed(1));
                }
                
                // Agregar curva PR
                y = await addLineChart(doc, datasets, recallLabels, y, {
                    title: 'Curva Precisión-Recall',
                    xAxisTitle: 'Recall',
                    yAxisTitle: 'Precisión',
                    height: 110,
                    showLegend: true
                });
            } catch (chartError) {
                console.error('Error al crear curva Precisión-Recall:', chartError);
                y += 10;
            }
        }
        
        // --- Métricas por clase ---
        if (metrics.byClass && Object.keys(metrics.byClass).length > 0) {
            y = checkPageBreak(doc, y, 150);
            
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(14);
            doc.text('Métricas por Clase', margins.left, y);
            y += 10;
            
            // Crear tabla simple
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(10);
            
            // Encabezados
            const columnWidths = [140, 60, 60, 60];
            doc.text('Clase', margins.left, y);
            doc.text('Precisión', margins.left + columnWidths[0], y);
            doc.text('Recall', margins.left + columnWidths[0] + columnWidths[1], y);
            doc.text('F1-Score', margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2], y);
            
            y += 4;
            
            // Línea separadora
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.line(
                margins.left, 
                y, 
                margins.left + columnWidths.reduce((a, b) => a + b, 0), 
                y
            );
            
            y += 6;
            
            // Filas con datos por clase
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(9);
            
            Object.entries(metrics.byClass).forEach(([className, stats]) => {
                // Comprobar espacio disponible, si no hay suficiente, nueva página
                if (y > doc.internal.pageSize.getHeight() - margins.bottom - 15) {
                    doc.addPage();
                    y = margins.top;
                    
                    // Repetir encabezados
                    doc.setFont(PDFSettings.style.font.family, 'bold');
                    doc.setFontSize(10);
                    
                    doc.text('Clase', margins.left, y);
                    doc.text('Precisión', margins.left + columnWidths[0], y);
                    doc.text('Recall', margins.left + columnWidths[0] + columnWidths[1], y);
                    doc.text('F1-Score', margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2], y);
                    
                    y += 4;
                    
                    doc.setDrawColor(180, 180, 180);
                    doc.setLineWidth(0.3);
                    doc.line(
                        margins.left, 
                        y, 
                        margins.left + columnWidths.reduce((a, b) => a + b, 0), 
                        y
                    );
                    
                    y += 6;
                    
                    doc.setFont(PDFSettings.style.font.family, 'normal');
                    doc.setFontSize(9);
                }
                
                // Nombre de clase
                doc.text(className, margins.left, y);
                
                // Datos de métricas
                const precision = stats.precision || 0;
                const recall = stats.recall || 0;
                const f1Score = stats.f1Score || stats.f1 || 0;
                
                doc.text(
                    `${(precision * 100).toFixed(1)}%`,
                    margins.left + columnWidths[0],
                    y
                );
                
                doc.text(
                    `${(recall * 100).toFixed(1)}%`,
                    margins.left + columnWidths[0] + columnWidths[1],
                    y
                );
                
                doc.text(
                    `${(f1Score * 100).toFixed(1)}%`,
                    margins.left + columnWidths[0] + columnWidths[1] + columnWidths[2],
                    y
                );
                
                y += 7;
            });
            
            y += 10;
        }
        
        // --- Gráfico F1-Score por clase ---
        if (metrics.byClass && Object.keys(metrics.byClass).length > 0 && PDFSettings.content.includeCharts) {
            y = checkPageBreak(doc, y, 120);
            
            const classNames = Object.keys(metrics.byClass);
            const f1Scores = classNames.map(className => {
                const stats = metrics.byClass[className];
                return stats.f1Score || stats.f1 || 0;
            });
            
            // Obtener colores para las clases
            const classColors = classNames.map((className, index) => {
                // Intentar obtener el ID de la clase
                let classId = index;
                
                if (window.classes) {
                    const classIndex = window.classes.indexOf(className);
                    if (classIndex !== -1) {
                        classId = classIndex;
                    }
                }
                
                return getClassColorHex(classId);
            });
            
            try {
                // Preparar datos para el gráfico
                const chartData = {
                    labels: classNames,
                    values: f1Scores.map(score => score * 100), // Convertir a porcentaje
                    label: 'F1-Score',
                    colors: classColors
                };
                
                // Agregar gráfico de barras
                y = await addBarChart(doc, chartData, y, {
                    title: 'F1-Score por Clase',
                    xAxisTitle: 'Clase',
                    yAxisTitle: 'F1-Score (%)',
                    height: 110
                });
            } catch (chartError) {
                console.error('Error al crear gráfico F1-Score por clase:', chartError);
                y += 10;
            }
        }
        
        // Información de validación
        if (metrics.validationInfo) {
            y = checkPageBreak(doc, y, 80);
            
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(14);
            doc.text('Información de Validación', margins.left, y);
            y += 8;
            
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(10);
            
            if (metrics.validationInfo.dataset) {
                doc.text(`Dataset: ${metrics.validationInfo.dataset}`, margins.left, y);
                y += 6;
            }
            
            if (metrics.validationInfo.samples) {
                doc.text(`Muestras: ${metrics.validationInfo.samples}`, margins.left, y);
                y += 6;
            }
            
            if (metrics.validationInfo.date) {
                const date = new Date(metrics.validationInfo.date);
                const dateStr = date.toLocaleDateString(PDFSettings.language.defaultLocale);
                doc.text(`Fecha: ${dateStr}`, margins.left, y);
                y += 10;
            }
            
            // Notas de validación
            if (metrics.validationInfo.notes) {
                doc.setFont(PDFSettings.style.font.family, 'italic');
                
                const notes = doc.splitTextToSize(
                    metrics.validationInfo.notes,
                    pageWidth - margins.left - margins.right - 10
                );
                
                doc.text(notes, margins.left, y);
                y += notes.length * 5 + 5;
            }
        }
        
        return y + 10;
    } catch (error) {
        console.error('Error al agregar sección de métricas:', error);
        return y + 10;
    }
}