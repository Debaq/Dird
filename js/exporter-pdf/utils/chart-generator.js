/**
 * chart-generator.js
 * Funciones para crear y agregar gráficos al PDF
 */

import { PDFSettings } from '../config/pdf-settings.js';
import { captureCanvas } from './image-handler.js';
import { checkPageBreak } from './pdf-utils.js';

/**
 * Crea un gráfico para el PDF usando Chart.js y lo agrega al documento
 * @param {Object} doc - Documento jsPDF
 * @param {Object} chartConfig - Configuración del gráfico para Chart.js
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addChart(doc, chartConfig, y, options = {}) {
    try {
        // Verificar que Chart.js está disponible
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js no está disponible, saltando creación de gráfico');
            return y + 10; // Avanzamos un poco la posición Y
        }
        
        // Opciones por defecto
        const settings = Object.assign({
            width: 160,
            height: 120,
            title: '',
            description: '',
            backgroundColor: '#ffffff',
            showTitle: true,
            showDescription: true,
            autoSize: true, // Ajustar tamaño automáticamente según espacio disponible
            maxWidth: 400, // Ancho máximo en auto-size
            maxHeight: 300, // Alto máximo en auto-size
            quality: PDFSettings.content.chartQuality,
            format: 'image/jpeg',
            centerImage: true
        }, options);
        
        // Si es auto-size, calcular tamaño según el espacio disponible
        if (settings.autoSize) {
            const pageWidth = doc.internal.pageSize.getWidth();
            const margins = PDFSettings.layout.margins;
            const availableWidth = pageWidth - margins.left - margins.right;
            
            settings.width = Math.min(availableWidth, settings.maxWidth);
            settings.height = settings.width * (settings.maxHeight / settings.maxWidth);
        }
        
        // Crear un canvas temporal
        const canvas = document.createElement('canvas');
        canvas.width = settings.width * 2; // Doble resolución para mejor calidad
        canvas.height = settings.height * 2;
        
        // Estilo para que no sea visible
        canvas.style.position = 'absolute';
        canvas.style.top = '-9999px';
        canvas.style.left = '-9999px';
        
        document.body.appendChild(canvas);
        
        // Obtener contexto
        const ctx = canvas.getContext('2d');
        
        // Verificar si tenemos que dibujar fondo
        if (settings.backgroundColor) {
            ctx.fillStyle = settings.backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Configurar Chart.js para mejor renderizado en PDF
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        // Escalar para alta resolución
        Chart.defaults.devicePixelRatio = 2;
        
        // Crear el gráfico
        const chart = new Chart(ctx, {
            ...chartConfig,
            options: {
                ...chartConfig.options,
                responsive: false,
                animation: false,
                devicePixelRatio: 2 // Para mayor resolución
            }
        });
        
        // Esperar a que se renderice completamente
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Capturar el gráfico
        const chartImageData = await captureCanvas(canvas, {
            quality: settings.quality,
            format: settings.format
        });
        
        // Limpiar
        chart.destroy();
        document.body.removeChild(canvas);
        
        // Verificar espacio disponible y posible salto de página
        const totalHeight = settings.height + 
            (settings.showTitle && settings.title ? 20 : 0) +
            (settings.showDescription && settings.description ? 15 : 0);
        
        y = checkPageBreak(doc, y, totalHeight);
        
        // Si hay título, agregarlo
        if (settings.showTitle && settings.title) {
            doc.setFont(PDFSettings.style.font.family, 'bold');
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            
            const margins = PDFSettings.layout.margins;
            doc.text(settings.title, margins.left, y);
            y += 8;
        }
        
        // Si hay descripción, agregarla
        if (settings.showDescription && settings.description) {
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(10);
            doc.setTextColor(80, 80, 80);
            
            const margins = PDFSettings.layout.margins;
            doc.text(settings.description, margins.left, y);
            y += 12;
        }
        
        // Agregar el gráfico
        const margins = PDFSettings.layout.margins;
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Calcular posición X (centrada o en margen)
        let x = margins.left;
        if (settings.centerImage) {
            x = (pageWidth - settings.width) / 2;
        }
        
        // Agregar imagen al PDF
        doc.addImage(
            chartImageData,
            'JPEG',
            x,
            y,
            settings.width,
            settings.height
        );
        
        // Devolver nueva posición Y
        return y + settings.height + 10;
    } catch (error) {
        console.error('Error al crear gráfico para PDF:', error);
        
        // En caso de error, avanzamos la posición Y un poco
        return y + 20;
    }
}

/**
 * Crea y agrega un gráfico de barras al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {Object} data - Datos para el gráfico
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addBarChart(doc, data, y, options = {}) {
    // Configuración por defecto
    const chartOptions = {
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: options.yAxisTitle ? true : false,
                    text: options.yAxisTitle || ''
                }
            },
            x: {
                title: {
                    display: options.xAxisTitle ? true : false,
                    text: options.xAxisTitle || ''
                }
            }
        },
        plugins: {
            legend: {
                display: options.showLegend !== false,
                position: 'top'
            }
        }
    };
    
    // Crear configuración del gráfico
    const chartConfig = {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: data.label || 'Valores',
                data: data.values || [],
                backgroundColor: data.colors || 'rgba(54, 162, 235, 0.6)',
                borderColor: data.borderColors || 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: chartOptions
    };
    
    // Agregar gráfico al documento
    return addChart(doc, chartConfig, y, options);
}

/**
 * Crea y agrega un gráfico de líneas al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {Array} datasets - Conjuntos de datos
 * @param {Array} labels - Etiquetas del eje X
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addLineChart(doc, datasets, labels, y, options = {}) {
    // Preparar datos
    const chartDatasets = datasets.map((dataset, index) => {
        // Colores por defecto si no se especifican
        const defaultColors = [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(153, 102, 255, 1)'
        ];
        
        return {
            label: dataset.label || `Serie ${index + 1}`,
            data: dataset.values || [],
            borderColor: dataset.color || defaultColors[index % defaultColors.length],
            backgroundColor: dataset.backgroundColor || dataset.color || defaultColors[index % defaultColors.length],
            tension: 0.1,
            fill: dataset.fill || false
        };
    });
    
    // Configuración por defecto
    const chartOptions = {
        scales: {
            y: {
                beginAtZero: options.beginAtZero !== false,
                title: {
                    display: options.yAxisTitle ? true : false,
                    text: options.yAxisTitle || ''
                }
            },
            x: {
                title: {
                    display: options.xAxisTitle ? true : false,
                    text: options.xAxisTitle || ''
                }
            }
        },
        plugins: {
            legend: {
                display: options.showLegend !== false,
                position: 'top'
            }
        }
    };
    
    // Crear configuración del gráfico
    const chartConfig = {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: chartDatasets
        },
        options: chartOptions
    };
    
    // Agregar gráfico al documento
    return addChart(doc, chartConfig, y, options);
}

/**
 * Crea y agrega un gráfico circular (pie o doughnut) al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {Object} data - Datos para el gráfico
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addPieChart(doc, data, y, options = {}) {
    // Generar colores aleatorios si no se proporcionan
    const backgroundColors = data.colors || data.labels.map(() => {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        return `rgba(${r}, ${g}, ${b}, 0.6)`;
    });
    
    // Configuración por defecto
    const chartOptions = {
        plugins: {
            legend: {
                display: options.showLegend !== false,
                position: options.legendPosition || 'right'
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / sum) * 100);
                        return `${label}: ${value} (${percentage}%)`;
                    }
                }
            }
        }
    };
    
    // Crear configuración del gráfico
    const chartConfig = {
        type: options.type || 'pie', // 'pie' o 'doughnut'
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: backgroundColors,
                borderColor: data.borderColors || backgroundColors.map(color => 
                    color.replace('0.6', '1')
                ),
                borderWidth: 1
            }]
        },
        options: chartOptions
    };
    
    // Agregar gráfico al documento
    return addChart(doc, chartConfig, y, {
        height: options.height || 150, // Gráficos circulares suelen verse mejor con dimensiones cuadradas
        ...options
    });
}

/**
 * Crea y agrega un histograma al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {Array} values - Valores para el histograma
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addHistogram(doc, values, y, options = {}) {
    // Número de intervalos
    const binCount = options.binCount || 10;
    
    // Calcular min y max
    const min = options.min !== undefined ? options.min : Math.min(...values);
    const max = options.max !== undefined ? options.max : Math.max(...values);
    
    // Crear bins
    const binSize = (max - min) / binCount;
    const bins = Array(binCount).fill(0);
    
    // Contar valores en cada bin
    values.forEach(value => {
        if (value >= min && value <= max) {
            const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
            bins[binIndex]++;
        }
    });
    
    // Crear etiquetas
    const labels = bins.map((_, i) => {
        const binMin = min + (i * binSize);
        const binMax = min + ((i + 1) * binSize);
        return `${binMin.toFixed(1)}-${binMax.toFixed(1)}`;
    });
    
    // Datos para gráfico de barras
    const data = {
        labels: labels,
        values: bins,
        label: options.label || 'Frecuencia',
        colors: options.color ? Array(binCount).fill(options.color) : undefined
    };
    
    // Agregar gráfico de barras
    return addBarChart(doc, data, y, {
        yAxisTitle: 'Frecuencia',
        xAxisTitle: options.xAxisTitle || 'Valor',
        title: options.title || 'Histograma',
        ...options
    });
}