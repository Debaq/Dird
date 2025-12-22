import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc } from '../utils/color-utils.js';
import { checkPageBreak } from '../utils/pdf-utils.js';
import { createDetectionsTable } from '../utils/table-generator.js';
import { captureCanvas } from '../utils/image-handler.js';

/**
 * Agrega la sección de detalle de detecciones al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos adicionales
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addDetectionsSection(doc, y, data, resources) {
    const margins = PDFSettings.layout.margins;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título de la sección
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
        
        doc.text(getTranslation('detectionsTitle'), margins.left, y);
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
                'No hay detecciones disponibles para mostrar.',
                margins.left,
                y
            );
            
            return y + 10;
        }
        
        // Imagen con detecciones
        try {
            const canvas = document.getElementById('outputCanvas');
            
            if (canvas) {
                // Agregar título de imagen
                doc.setFont(PDFSettings.style.font.family, 'bold');
                doc.setFontSize(12);
                applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
                
                doc.text('Imagen con detecciones:', margins.left, y);
                y += 8;
                
                // Capturar el canvas
                const capturedImage = await captureCanvas(canvas, {
                    quality: PDFSettings.content.imageQuality,
                    format: 'image/jpeg'
                });
                
                // Dimensiones para la imagen
                const maxImageWidth = pageWidth - margins.left - margins.right;
                const maxImageHeight = 150; // Altura máxima para no ocupar demasiado espacio
                
                // Calcular dimensiones manteniendo proporción
                const aspectRatio = canvas.height / canvas.width;
                let imgWidth, imgHeight;
                
                if (canvas.width > canvas.height) {
                    imgWidth = Math.min(maxImageWidth, canvas.width);
                    imgHeight = imgWidth * aspectRatio;
                    
                    // Verificar que no exceda la altura máxima
                    if (imgHeight > maxImageHeight) {
                        imgHeight = maxImageHeight;
                        imgWidth = imgHeight / aspectRatio;
                    }
                } else {
                    imgHeight = Math.min(maxImageHeight, canvas.height);
                    imgWidth = imgHeight / aspectRatio;
                }
                
                // Posición centrada
                const imgX = margins.left + (maxImageWidth - imgWidth) / 2;
                
                // Agregar imagen
                doc.addImage(
                    capturedImage,
                    'JPEG',
                    imgX,
                    y,
                    imgWidth,
                    imgHeight
                );
                
                // Actualizar posición Y
                y += imgHeight + 15;
            }
        } catch (imageError) {
            console.error('Error al agregar imagen de detecciones:', imageError);
            // Si falla, simplemente continuamos
            y += 5;
        }
        
        // Introducción a la tabla
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        doc.text(
            `A continuación se presentan las ${data.detections.length} detecciones realizadas:`,
            margins.left,
            y
        );
        y += 10;
        
        // Verificar posible truncado
        if (data.truncated && data.originalCount) {
            doc.setFont(PDFSettings.style.font.family, 'italic');
            doc.setFontSize(10);
            applyColorToDoc(doc, PDFSettings.style.colors.light, 'setTextColor');
            
            doc.text(
                `Nota: Se muestran ${data.detections.length} de ${data.originalCount} detecciones por limitaciones de espacio.`,
                margins.left,
                y
            );
            y += 8;
        }
        
        // Crear tabla de detecciones
        try {
            y = createDetectionsTable(doc, data.detections, y, {
                title: 'Detecciones',
                tableOptions: {
                    margin: { left: margins.left, right: margins.right },
                    headStyles: {
                        fillColor: [60, 90, 120],
                        textColor: [255, 255, 255],
                        fontStyle: 'bold'
                    },
                    bodyStyles: {
                        textColor: [50, 50, 50]
                    },
                    alternateRowStyles: {
                        fillColor: [240, 240, 240]
                    }
                }
            });
        } catch (tableError) {
            console.error('Error al crear tabla de detecciones:', tableError);
            
            // Si falla la tabla, mostrar mensaje
            doc.setFont(PDFSettings.style.font.family, 'italic');
            doc.setFontSize(11);
            applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
            
            doc.text(
                'Error al generar la tabla de detecciones.',
                margins.left,
                y
            );
            
            y += 10;
        }
        
        return y + 10;
    } catch (error) {
        console.error('Error al agregar sección de detecciones:', error);
        return y + 10;
    }
}