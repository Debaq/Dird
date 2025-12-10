/**
 * thumbnails-section.js
 * Implementa la sección de miniaturas de regiones detectadas en el PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc, getClassColor } from '../utils/color-utils.js';
import { checkPageBreak } from '../utils/pdf-utils.js';
import { createDetectionThumbnail } from '../utils/image-handler.js';

/**
 * Agrega la sección de miniaturas de detecciones al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addThumbnailsSection(doc, y, data, resources) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título de la sección
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
        
        doc.text(getTranslation('thumbnailsTitle'), margins.left, y);
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
                'No hay detecciones disponibles para mostrar miniaturas.',
                margins.left,
                y
            );
            
            return y + 10;
        }
        
        // Texto de introducción
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        doc.text(
            'A continuación se muestran las regiones detectadas en la imagen:',
            margins.left,
            y
        );
        y += 10;
        
        // Verificar posible truncado o limitación
        const maxThumbnails = PDFSettings.content.maxThumbnailsPerPage;
        const thumbnailLimit = Math.min(data.detections.length, maxThumbnails);
        
        if (thumbnailLimit < data.detections.length) {
            doc.setFont(PDFSettings.style.font.family, 'italic');
            doc.setFontSize(10);
            applyColorToDoc(doc, PDFSettings.style.colors.light, 'setTextColor');
            
            doc.text(
                `Nota: Se muestran ${thumbnailLimit} de ${data.detections.length} regiones por limitaciones de espacio.`,
                margins.left,
                y
            );
            y += 8;
        }
        
        // Obtener la imagen original
        const canvas = document.getElementById('outputCanvas');
        if (!canvas) {
            doc.text(
                'Error: No se pudo acceder a la imagen original para generar miniaturas.',
                margins.left,
                y
            );
            
            return y + 10;
        }
        
        // Crear una imagen desde el canvas
        const img = new Image();
        img.src = canvas.toDataURL('image/jpeg', 0.9);
        
        // Esperar a que se cargue la imagen
        await new Promise((resolve) => {
            img.onload = resolve;
            // Por si falla, establecer un timeout
            setTimeout(resolve, 3000);
        });
        
        // Configuración para miniaturas
        const thumbnailSize = PDFSettings.content.thumbnailSize || 60;
        const spacing = 10;
        const maxItemsPerRow = Math.floor((pageWidth - margins.left - margins.right + spacing) / (thumbnailSize + spacing));
        const itemsPerRow = Math.min(maxItemsPerRow, 3); // Limitar a 3 por fila para mejor visualización
        
        // Inicializar contadores
        let currentX = margins.left;
        let currentItem = 0;
        let currentRow = 0;
        
        // Grupo actual de miniaturas
        let currentGroup = [];
        let currentGroupData = [];
        
        // Función para procesar un grupo de miniaturas
        const processGroup = async () => {
            if (currentGroup.length === 0) return;
            
            // Calcular alto de las miniaturas + etiquetas
            const rowHeight = thumbnailSize + 20; // thumbnail + etiqueta
            
            // Verificar si hay espacio para esta fila
            y = checkPageBreak(doc, y, rowHeight + 10, {
                title: getTranslation('thumbnailsTitle')
            });
            
            // Dibujar cada miniatura en el grupo
            for (let i = 0; i < currentGroup.length; i++) {
                const thumbnailUrl = currentGroup[i];
                const detData = currentGroupData[i];
                
                // Calcular posición
                const x = margins.left + (i % itemsPerRow) * (thumbnailSize + spacing);
                const rowOffset = Math.floor(i / itemsPerRow) * rowHeight;
                
                try {
                    // Agregar miniatura
                    doc.addImage(
                        thumbnailUrl,
                        'JPEG',
                        x,
                        y + rowOffset,
                        thumbnailSize,
                        thumbnailSize
                    );
                    
                    // Determinar nombre de clase
                    let className = `Clase ${detData.class}`;
                    if (window.classes && detData.class < window.classes.length) {
                        className = window.classes[detData.class];
                    } else if (window.ClassDefinitions && window.ClassDefinitions.getById) {
                        const classInfo = window.ClassDefinitions.getById(detData.class);
                        if (classInfo) {
                            className = classInfo.name;
                        }
                    }
                    
                    // Agregar etiqueta de clase
                    doc.setFont(PDFSettings.style.font.family, 'bold');
                    doc.setFontSize(8);
                    applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
                    
                    doc.text(
                        className,
                        x + thumbnailSize / 2,
                        y + rowOffset + thumbnailSize + 10,
                        { align: 'center' }
                    );
                    
                    // Agregar confianza
                    doc.setFont(PDFSettings.style.font.family, 'normal');
                    doc.setFontSize(7);
                    
                    const confidence = detData.confidence > 1 ? 
                        `${Math.min(detData.confidence, 100).toFixed(1)}%` : 
                        `${(detData.confidence * 100).toFixed(1)}%`;
                    
                    doc.text(
                        confidence,
                        x + thumbnailSize / 2,
                        y + rowOffset + thumbnailSize + 16,
                        { align: 'center' }
                    );
                } catch (thumbnailError) {
                    console.error('Error al agregar miniatura:', thumbnailError);
                }
            }
            
            // Actualizar la posición Y para la próxima fila
            const totalRows = Math.ceil(currentGroup.length / itemsPerRow);
            y += totalRows * rowHeight + 10;
            
            // Limpiar el grupo actual
            currentGroup = [];
            currentGroupData = [];
        };
        
        // Procesar cada detección
        for (let i = 0; i < thumbnailLimit; i++) {
            const det = data.detections[i];
            
            try {
                // Obtener color de la clase para el borde
                const classColor = getClassColorHex(det.class);
                
                // Crear miniatura para la detección
                const thumbnailUrl = await createDetectionThumbnail(img, det.bbox, {
                    size: thumbnailSize,
                    quality: 0.9,
                    borderWidth: 2,
                    borderColor: classColor
                });
                
                // Agregar al grupo actual
                currentGroup.push(thumbnailUrl);
                currentGroupData.push(det);
                
                // Si alcanzamos el máximo de elementos por fila o es el último elemento, procesar el grupo
                if (currentGroup.length === itemsPerRow || i === thumbnailLimit - 1) {
                    await processGroup();
                }
            } catch (error) {
                console.error(`Error al crear miniatura para detección ${i}:`, error);
            }
        }
        
        // Procesar cualquier grupo restante
        if (currentGroup.length > 0) {
            await processGroup();
        }
        
        return y + 10;
    } catch (error) {
        console.error('Error al agregar sección de miniaturas:', error);
        return y + 10;
    }
}

/**
 * Obtiene el color hexadecimal para una clase
 * @param {number} classId - ID de la clase
 * @returns {string} Color en formato hexadecimal
 */
function getClassColorHex(classId) {
    let color = '';
    
    // Intentar obtener el color de ClassDefinitions
    if (window.ClassDefinitions && window.ClassDefinitions.getById) {
        const classInfo = window.ClassDefinitions.getById(classId);
        if (classInfo && classInfo.color) {
            color = classInfo.color;
        }
    }
    
    // Si no se encontró, intentar obtenerlo de window.colors
    if (!color && window.colors && classId < window.colors.length) {
        color = window.colors[classId];
    }
    
    // Si aún no hay color, usar uno predeterminado según el ID
    if (!color) {
        const defaultColors = [
            '#FF3838', '#48F90A', '#FFB21D', '#00C2FF', 
            '#7B83EB', '#FFA6D9', '#54FFBD', '#FF6E1D'
        ];
        
        color = defaultColors[classId % defaultColors.length];
    }
    
    return color;
}