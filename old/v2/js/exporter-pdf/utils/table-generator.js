/**
 * table-generator.js
 * Funciones para crear tablas en el PDF
 */

import { PDFSettings } from '../config/pdf-settings.js';
import { checkPageBreak } from './pdf-utils.js';

/**
 * Crea una tabla en el PDF usando autoTable si está disponible, o tabla manual si no
 * @param {Object} doc - Documento jsPDF
 * @param {Array} headers - Cabeceras de la tabla
 * @param {Array} data - Datos de la tabla
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después de la tabla
 */
export function createTable(doc, headers, data, y, options = {}) {
    try {
        // Comprobar si autoTable está disponible
        if (typeof doc.autoTable === 'function') {
            return createAutoTable(doc, headers, data, y, options);
        } else {
            // Fallback a tabla manual si autoTable no está disponible
            return createManualTable(doc, headers, data, y, options);
        }
    } catch (error) {
        console.error('Error al crear tabla:', error);
        return y + 10; // Devolver posición Y con un pequeño incremento
    }
}

/**
 * Crea una tabla usando el plugin autoTable
 * @param {Object} doc - Documento jsPDF
 * @param {Array} headers - Cabeceras de la tabla
 * @param {Array} data - Datos de la tabla
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después de la tabla
 */
function createAutoTable(doc, headers, data, y, options = {}) {
    const margins = PDFSettings.layout.margins;
    
    // Opciones por defecto para autoTable
    const tableOptions = {
        startY: y,
        margin: { left: margins.left, right: margins.right },
        headStyles: {
            fillColor: [60, 90, 120],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            textColor: [50, 50, 50]
        },
        alternateRowStyles: {
            fillColor: [240, 240, 240]
        },
        tableWidth: 'auto',
        theme: 'grid',
        ...options.tableOptions
    };
    
    // Procesamos las cabeceras para formato autoTable
    const autoTableHeaders = headers.map(header => {
        if (typeof header === 'object') {
            // Si es un objeto, extraer propiedades relevantes
            return {
                content: header.text || '',
                styles: {
                    halign: header.align || 'center',
                    fillColor: header.fillColor || tableOptions.headStyles.fillColor,
                    textColor: header.textColor || tableOptions.headStyles.textColor,
                    fontStyle: header.fontStyle || tableOptions.headStyles.fontStyle,
                    cellWidth: header.width || 'auto'
                }
            };
        } else {
            // Si es un string simple
            return { content: header };
        }
    });
    
    // Procesamos los datos para formato autoTable
    const autoTableData = data.map(row => {
        return row.map(cell => {
            if (typeof cell === 'object' && cell !== null) {
                // Si es un objeto, extraer propiedades relevantes
                return {
                    content: cell.text || '',
                    styles: {
                        halign: cell.align || 'left',
                        fillColor: cell.fillColor,
                        textColor: cell.textColor,
                        fontStyle: cell.fontStyle,
                        cellWidth: cell.width
                    }
                };
            } else {
                // Si es un valor simple
                return { content: cell !== undefined && cell !== null ? cell.toString() : '' };
            }
        });
    });
    
    // Ejecutar autoTable
    doc.autoTable({
        ...tableOptions,
        head: [autoTableHeaders],
        body: autoTableData
    });
    
    // Devolver la posición Y final
    return doc.lastAutoTable.finalY + 10; // Agregar un pequeño espaciado después de la tabla
}

/**
 * Crea una tabla manualmente (cuando autoTable no está disponible)
 * @param {Object} doc - Documento jsPDF
 * @param {Array} headers - Cabeceras de la tabla
 * @param {Array} data - Datos de la tabla
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después de la tabla
 */
function createManualTable(doc, headers, data, y, options = {}) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    const tableWidth = options.tableWidth || (pageWidth - margins.left - margins.right);
    
    // Calcular ancho de columnas
    const columnWidths = calculateColumnWidths(headers, data, tableWidth);
    
    // Altura de fila
    const rowHeight = options.rowHeight || 10;
    
    // Dibujar cabecera
    doc.setFillColor(60, 90, 120);
    doc.setTextColor(255, 255, 255);
    doc.setFont(PDFSettings.style.font.family, 'bold');
    
    // Verificar espacio para la cabecera
    y = checkPageBreak(doc, y, rowHeight);
    
    // Posición X inicial
    let x = margins.left;
    
    // Dibujar celdas de cabecera
    headers.forEach((header, index) => {
        const width = columnWidths[index];
        
        // Dibujar fondo
        doc.rect(x, y, width, rowHeight, 'F');
        
        // Texto de cabecera
        const headerText = typeof header === 'object' ? header.text : header;
        
        doc.text(
            headerText || '',
            x + width / 2,
            y + rowHeight / 2,
            { align: 'center', baseline: 'middle' }
        );
        
        x += width;
    });
    
    y += rowHeight;
    
    // Configurar estilo para el cuerpo
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(50, 50, 50);
    doc.setFont(PDFSettings.style.font.family, 'normal');
    
    // Dibujar filas de datos
    data.forEach((row, rowIndex) => {
        // Verificar cambio de página
        y = checkPageBreak(doc, y, rowHeight);
        
        // Color alternado para filas
        if (rowIndex % 2 === 1) {
            doc.setFillColor(240, 240, 240);
        } else {
            doc.setFillColor(255, 255, 255);
        }
        
        // Reiniciar posición X
        x = margins.left;
        
        // Dibujar cada celda
        row.forEach((cell, cellIndex) => {
            const width = columnWidths[cellIndex];
            
            // Dibujar fondo
            doc.rect(x, y, width, rowHeight, 'F');
            
            // Dibujar borde
            doc.setDrawColor(200, 200, 200);
            doc.rect(x, y, width, rowHeight);
            
            // Texto de la celda
            let cellText;
            let cellAlign = 'left';
            
            if (typeof cell === 'object' && cell !== null) {
                cellText = cell.text || '';
                cellAlign = cell.align || 'left';
            } else {
                cellText = cell !== undefined && cell !== null ? cell.toString() : '';
            }
            
            // Alineación
            let textX;
            if (cellAlign === 'center') {
                textX = x + width / 2;
            } else if (cellAlign === 'right') {
                textX = x + width - 2;
            } else {
                textX = x + 2;
            }
            
            // Escribir texto
            doc.text(
                cellText,
                textX,
                y + rowHeight / 2,
                { align: cellAlign, baseline: 'middle' }
            );
            
            x += width;
        });
        
        y += rowHeight;
    });
    
    // Devolver la nueva posición Y
    return y + 5; // Pequeño espaciado después de la tabla
}

/**
 * Calcula el ancho de cada columna basado en el contenido
 * @param {Array} headers - Cabeceras de la tabla
 * @param {Array} data - Datos de la tabla
 * @param {number} totalWidth - Ancho total disponible
 * @returns {Array} Array con ancho para cada columna
 */
function calculateColumnWidths(headers, data, totalWidth) {
    const numColumns = headers.length;
    
    // Si hay definiciones de ancho en las cabeceras, usarlas
    const definedWidths = headers.map(header => {
        if (typeof header === 'object' && header.width) {
            return parseFloat(header.width);
        }
        return 0; // Sin ancho definido
    });
    
    // Verificar si todos los anchos están definidos
    const definedTotal = definedWidths.reduce((sum, width) => sum + width, 0);
    
    if (definedTotal > 0) {
        // Ajustar anchos proporcionales si no suman exactamente el total
        if (definedTotal !== totalWidth) {
            const ratio = totalWidth / definedTotal;
            return definedWidths.map(width => width * ratio);
        }
        return definedWidths;
    }
    
    // Distribución equitativa si no hay anchos definidos
    return Array(numColumns).fill(totalWidth / numColumns);
}

/**
 * Crea una tabla de detecciones formateada
 * @param {Object} doc - Documento jsPDF
 * @param {Array} detections - Lista de detecciones
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después de la tabla
 */
export function createDetectionsTable(doc, detections, y, options = {}) {
    // Cabeceras de la tabla
    const headers = [
        { text: 'ID', width: '8%', align: 'center' },
        { text: 'Clase', width: '30%', align: 'left' },
        { text: 'Confianza', width: '12%', align: 'center' },
        { text: 'Posición', width: '20%', align: 'center' },
        { text: 'Dimensiones', width: '20%', align: 'center' },
        { text: 'Área', width: '10%', align: 'right' }
    ];
    
    // Preparar datos para la tabla
    const data = detections.map((det, index) => {
        // Extraer coordenadas
        const [x, y, w, h] = det.bbox.map(Math.round);
        
        // Determinar nombre de clase
        let className = `Clase ${det.class}`;
        if (window.classes && det.class < window.classes.length) {
            className = window.classes[det.class];
        } else if (window.ClassDefinitions && window.ClassDefinitions.getById) {
            const classInfo = window.ClassDefinitions.getById(det.class);
            if (classInfo) {
                className = classInfo.name;
            }
        }
        
        // Normalizar valor de confianza
        const confidence = det.confidence > 1 ? 
            `${Math.min(det.confidence, 100).toFixed(1)}%` : 
            `${(det.confidence * 100).toFixed(1)}%`;
        
        // Calcular área
        const area = w * h;
        
        // Filas de la tabla
        return [
            { text: (index + 1).toString(), align: 'center' },
            { text: className, align: 'left' },
            { text: confidence, align: 'center' },
            { text: `(${x}, ${y})`, align: 'center' },
            { text: `${w} × ${h}`, align: 'center' },
            { text: area.toString(), align: 'right' }
        ];
    });
    
    // Crear la tabla
    return createTable(doc, headers, data, y, options);
}

/**
 * Crea una tabla de estadísticas resumidas
 * @param {Object} doc - Documento jsPDF
 * @param {Object} stats - Estadísticas calculadas
 * @param {number} y - Posición Y inicial
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después de la tabla
 */
export function createStatsTable(doc, stats, y, options = {}) {
    // Cabeceras
    const headers = [
        { text: 'Estadística', width: '40%', align: 'left' },
        { text: 'Valor', width: '60%', align: 'left' }
    ];
    
    // Convertir estadísticas a filas
    const data = [];
    
    // Si hay estadísticas generales
    if (stats.general) {
        Object.entries(stats.general).forEach(([key, value]) => {
            data.push([
                { text: key, align: 'left' },
                { text: value.toString(), align: 'left' }
            ]);
        });
    }
    
    // Si hay distribución por clase
    if (stats.byClass) {
        // Agregar fila de separación
        if (data.length > 0) {
            data.push([
                { text: '', align: 'left' },
                { text: '', align: 'left' }
            ]);
        }
        
        // Agregar cabecera de sección
        data.push([
            { text: 'Distribución por clase', align: 'left', fontStyle: 'bold' },
            { text: '', align: 'left' }
        ]);
        
        // Agregar datos por clase
        Object.entries(stats.byClass).forEach(([className, count]) => {
            data.push([
                { text: className, align: 'left' },
                { text: count.toString(), align: 'left' }
            ]);
        });
    }
    
    // Si no hay datos, agregar fila vacía
    if (data.length === 0) {
        data.push([
            { text: 'No hay estadísticas disponibles', align: 'left' },
            { text: '', align: 'left' }
        ]);
    }
    
    // Crear la tabla
    return createTable(doc, headers, data, y, options);
}