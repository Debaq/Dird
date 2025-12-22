/**
 * summary-section.js
 * Implementa la sección de resumen del PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc } from '../utils/color-utils.js';
import { checkPageBreak } from '../utils/pdf-utils.js';
import { createStatsTable } from '../utils/table-generator.js';
import { addPieChart, addBarChart } from '../utils/chart-generator.js';

/**
 * Agrega la sección de resumen al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addSummarySection(doc, y, data, resources) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título de la sección
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
        
        doc.text(getTranslation('summaryTitle'), margins.left, y);
        y += 5;
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margins.left, y, pageWidth - margins.right, y);
        y += 10;
        
        // Si no hay detecciones, mostrar mensaje
        if (!data.detections || data.detections.length === 0) {
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(12);
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            doc.text(
                'No hay detecciones disponibles para analizar.',
                margins.left,
                y
            );
            
            return y + 20;
        }
        
        // Estadísticas generales
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        // Extraer las estadísticas
        const stats = data.summary || {};
        
        doc.text(`Total de detecciones: ${data.detections.length}`, margins.left, y);
        y += 7;
        
        // Confianza media
        const avgConfidence = stats.avgConfidence || (data.detections.reduce((sum, det) => 
            sum + (det.confidence > 1 ? det.confidence / 100 : det.confidence), 0) 
            / data.detections.length * 100);
        
        doc.text(`Confianza media: ${avgConfidence.toFixed(1)}%`, margins.left, y);
        y += 7;
        
        // Tipos de detecciones
        const classCount = stats.classCount || 
            new Set(data.detections.map(det => det.class)).size;
        
        doc.text(`Tipos de detecciones: ${classCount}`, margins.left, y);
        y += 15;
        
        // Verificar espacio para la tabla y gráfico
        y = checkPageBreak(doc, y, 350);
        
        // Distribución por clase
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(14);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        doc.text('Distribución de detecciones por clase', margins.left, y);
        y += 10;
        
        // Obtener datos para la distribución
        let classCounts = data.classCounts || {};
        
        // Si no hay conteos predefinidos, calcularlos
        if (Object.keys(classCounts).length === 0 && data.detections.length > 0) {
            classCounts = {};
            
            data.detections.forEach(det => {
                let className = `Clase ${det.class}`;
                
                // Intentar obtener el nombre real de la clase
                if (window.classes && det.class < window.classes.length) {
                    className = window.classes[det.class];
                } else if (window.ClassDefinitions && window.ClassDefinitions.getById) {
                    const classInfo = window.ClassDefinitions.getById(det.class);
                    if (classInfo) {
                        className = classInfo.name;
                    }
                }
                
                if (!classCounts[className]) {
                    classCounts[className] = 0;
                }
                classCounts[className]++;
            });
        }
        
        // Convertir el objeto a arrays para el gráfico
        const classNames = Object.keys(classCounts);
        const classCounts_values = Object.values(classCounts);
        
        // Colores para el gráfico
        const classColors = classNames.map((className, index) => {
            // Intentar obtener el color real de la clase
            let colorValue;
            
            // Buscar en ClassDefinitions
            if (window.ClassDefinitions && window.ClassDefinitions.getByName) {
                const classInfo = window.ClassDefinitions.getByName(className);
                if (classInfo && classInfo.color) {
                    colorValue = classInfo.color;
                }
            }
            
            // Si no se encontró, buscar en window.colors
            if (!colorValue && window.classes && window.colors) {
                const classIndex = window.classes.indexOf(className);
                if (classIndex !== -1 && classIndex < window.colors.length) {
                    colorValue = window.colors[classIndex];
                }
            }
            
            // Si aún no se encontró, usar un color por defecto según el índice
            if (!colorValue) {
                const defaultColors = [
                    '#FF3838', '#48F90A', '#FFB21D', '#00C2FF', 
                    '#7B83EB', '#FFA6D9', '#54FFBD', '#FF6E1D'
                ];
                colorValue = defaultColors[index % defaultColors.length];
            }
            
            return colorValue;
        });
        
        // Agregar gráfico circular si hay gráficos habilitados
        if (PDFSettings.content.includeCharts) {
            try {
                // Datos para el gráfico
                const chartData = {
                    labels: classNames,
                    values: classCounts_values,
                    colors: classColors
                };
                
                // Agregar gráfico circular
                y = await addPieChart(doc, chartData, y, {
                    title: 'Distribución por Clase',
                    height: 130,
                    showLegend: true,
                    legendPosition: 'right'
                });
            } catch (chartError) {
                console.error('Error al crear gráfico circular:', chartError);
                // Si falla, simplemente continuamos
                y += 10;
            }
        }
        
        // Agregar tabla con la distribución por clase
        try {
            // Preparar datos para la tabla
            const tableData = classNames.map((className, index) => {
                const count = classCounts_values[index];
                const percentage = (count / data.detections.length * 100).toFixed(1);
                
                return [
                    { text: className, align: 'left' },
                    { text: count.toString(), align: 'right' },
                    { text: `${percentage}%`, align: 'right' }
                ];
            });
            
            // Encabezados de la tabla
            const headers = [
                { text: 'Clase', width: '60%', align: 'left' },
                { text: 'Cantidad', width: '20%', align: 'right' },
                { text: 'Porcentaje', width: '20%', align: 'right' }
            ];
            
            // Crear tabla
            y = checkPageBreak(doc, y, tableData.length * 10 + 20);
            
            // Título de la tabla si no se mostró el gráfico
            if (!PDFSettings.content.includeCharts) {
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                doc.text('Distribución por clase', margins.left, y);
                y += 8;
            }
            
            y = createStatsTable(doc, headers, tableData, y);
        } catch (tableError) {
            console.error('Error al crear tabla de distribución:', tableError);
            y += 10;
        }
        
        // Agregar gráfico de barras para confianza si hay suficientes detecciones
        if (PDFSettings.content.includeCharts && data.detections.length >= 5) {
            try {
                y = checkPageBreak(doc, y, 150);
                
                // Título para distribución de confianza
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(14);
                doc.text('Distribución de Valores de Confianza', margins.left, y);
                y += 10;
                
                // Extraer valores de confianza
                const confidenceValues = data.detections.map(det => 
                    det.confidence > 1 ? det.confidence / 100 : det.confidence
                );
                
                // Crear bins para el histograma (5% cada bin)
                const confidenceBins = Array(20).fill(0);
                
                confidenceValues.forEach(conf => {
                    // Normalizar a 0-1
                    const normalizedConf = Math.min(Math.max(conf, 0), 0.999);
                    const binIndex = Math.floor(normalizedConf * 20);
                    confidenceBins[binIndex]++;
                });
                
                // Etiquetas para los bins
                const confidenceLabels = [];
                for (let i = 0; i < 20; i++) {
                    const min = i * 5;
                    const max = (i + 1) * 5;
                    confidenceLabels.push(`${min}-${max}%`);
                }
                
                // Datos para el gráfico
                const chartData = {
                    labels: confidenceLabels,
                    values: confidenceBins,
                    label: 'Cantidad',
                    colors: '#3498db'
                };
                
                // Agregar gráfico de barras
                y = await addBarChart(doc, chartData, y, {
                    title: 'Histograma de Confianza',
                    xAxisTitle: 'Confianza (%)',
                    yAxisTitle: 'Cantidad de detecciones',
                    height: 130
                });
            } catch (histogramError) {
                console.error('Error al crear histograma de confianza:', histogramError);
                y += 10;
            }
        }
        
        return y + 10;
    } catch (error) {
        console.error('Error al agregar sección de resumen:', error);
        return y + 20;
    }
}