/**
 * cover-section.js
 * Implementa la sección de portada del PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';
import { applyColorToDoc } from '../utils/color-utils.js';
import { captureCanvas } from '../utils/image-handler.js';

/**
 * Agrega la portada al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y inicial
 * @param {Object} data - Datos del análisis
 * @param {Object} resources - Recursos (logo, etc.)
 * @returns {Promise<number>} Promesa con la posición Y final
 */
export async function addCoverPage(doc, y, data, resources) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    try {
        // Fondo blanco para toda la página
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        
        // Agregar logo del proyecto
        try {
            if (resources && resources.logo) {
                // Dimensiones para el logo
                const logoWidth = pageWidth * 0.7;
                const logoHeight = logoWidth / 3; // Proporción aproximada del logo
                
                // Posición centrada
                const logoX = (pageWidth - logoWidth) / 2;
                const logoY = 20;
                
                // Agregar logo
                doc.addImage(
                    resources.logo,
                    'JPEG',
                    logoX,
                    logoY,
                    logoWidth,
                    logoHeight
                );
                
                // Actualizar posición Y
                y = logoY + logoHeight + 20;
            }
        } catch (logoError) {
            console.error('Error al agregar logo:', logoError);
            // Si falla, simplemente avanzamos a la siguiente sección
            y = 60;
        }
        
        // Título principal
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(24);
        applyColorToDoc(doc, PDFSettings.style.colors.primary, 'setTextColor');
        
        doc.text(
            getTranslation('coverTitle'),
            pageWidth / 2,
            y,
            { align: 'center' }
        );
        
        y += 20;
        
        // Agregar la imagen con detecciones si está disponible
        try {
            const canvas = document.getElementById('outputCanvas');
            
            if (canvas) {
                // Capturar el canvas
                const capturedImage = await captureCanvas(canvas, {
                    quality: 0.8,
                    format: 'image/jpeg'
                });
                
                // Dimensiones para la imagen
                const maxImageWidth = pageWidth * 0.8;
                const maxImageHeight = pageHeight * 0.5; // Máximo 50% de la altura
                
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
                const imgX = (pageWidth - imgWidth) / 2;
                
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
            console.error('Error al agregar imagen principal:', imageError);
            // Si falla, simplemente continuamos
            y += 30;
        }
        
        // Fecha y hora de generación
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(12);
        applyColorToDoc(doc, PDFSettings.style.colors.text, 'setTextColor');
        
        const dateStr = new Date().toLocaleDateString(PDFSettings.language.defaultLocale);
        const timeStr = new Date().toLocaleTimeString(PDFSettings.language.defaultLocale);
        
        doc.text(
            `${getTranslation('generatedAt')}: ${dateStr} ${timeStr}`,
            pageWidth / 2,
            y,
            { align: 'center' }
        );
        
        y += 10;
        
        // Información adicional
        if (data.imageInfo && data.imageInfo.date) {
            doc.setFontSize(10);
            applyColorToDoc(doc, PDFSettings.style.colors.light, 'setTextColor');
            
            const imgDate = new Date(data.imageInfo.date);
            const imgDateStr = imgDate.toLocaleDateString(PDFSettings.language.defaultLocale);
            const imgTimeStr = imgDate.toLocaleTimeString(PDFSettings.language.defaultLocale);
            
            doc.text(
                `Imagen analizada el: ${imgDateStr} ${imgTimeStr}`,
                pageWidth / 2,
                y,
                { align: 'center' }
            );
            
            y += 8;
        }
        
        // Total de detecciones
        if (data.detections) {
            doc.setFontSize(11);
            applyColorToDoc(doc, PDFSettings.style.colors.secondary, 'setTextColor');
            
            doc.text(
                `${getTranslation('totalDetections')}: ${data.detections.length}`,
                pageWidth / 2,
                y,
                { align: 'center' }
            );
            
            y += 20;
        }
        
        // Información de truncado si aplica
        if (data.truncated && data.originalCount) {
            doc.setFontSize(9);
            applyColorToDoc(doc, PDFSettings.style.colors.light, 'setTextColor');
            
            doc.text(
                `Nota: Se han incluido ${data.detections.length} de ${data.originalCount} detecciones en este informe.`,
                pageWidth / 2,
                y,
                { align: 'center' }
            );
            
            y += 8;
        }
        
        return y;
    } catch (error) {
        console.error('Error al agregar portada:', error);
        return 40; // Devolver una posición Y por defecto en caso de error
    }
}