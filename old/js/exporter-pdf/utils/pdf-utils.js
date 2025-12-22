/**
 * pdf-utils.js
 * Funciones auxiliares generales para la generación de PDF
 */

import { PDFSettings, getTranslation } from '../config/pdf-settings.js';

/**
 * Verifica si hay suficiente espacio en la página, y si no, crea una nueva
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y actual
 * @param {number} requiredSpace - Espacio requerido en vertical
 * @param {Object} options - Opciones adicionales
 * @returns {number} Posición Y actualizada
 */
export function checkPageBreak(doc, y, requiredSpace, options = {}) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const margins = PDFSettings.layout.margins;
    const bottomMargin = options.bottomMargin || margins.bottom;
    
    // Si no hay suficiente espacio para el contenido + margen
    if (y + requiredSpace > pageHeight - bottomMargin) {
        // Agregar nueva página
        doc.addPage();
        
        // Si hay función para encabezado, ejecutarla
        if (typeof options.headerFunction === 'function') {
            y = options.headerFunction(doc);
        } else {
            // Reiniciar posición Y al margen superior
            y = margins.top;
        }
        
        // Si hay que dibujar un título de sección
        if (options.sectionTitle) {
            y = addSectionHeader(doc, options.sectionTitle, y);
        }
    }
    
    return y;
}

/**
 * Agrega un encabezado de sección con formato estándar
 * @param {Object} doc - Documento jsPDF
 * @param {string} title - Título de la sección
 * @param {number} y - Posición Y inicial
 * @returns {number} Nueva posición Y
 */
export function addSectionHeader(doc, title, y) {
    const margins = PDFSettings.layout.margins;
    const spacing = PDFSettings.layout.spacing;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Establecer estilo para título
    doc.setFont(PDFSettings.style.font.family, 'bold');
    doc.setFontSize(PDFSettings.style.font.subtitleSize);
    doc.setTextColor(0, 0, 0);
    
    // Dibujar título
    doc.text(title, margins.left, y);
    y += spacing.paragraph;
    
    // Dibujar línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margins.left, y, pageWidth - margins.right, y);
    
    return y + spacing.paragraph;
}

/**
 * Agrega encabezado de página estándar
 * @param {Object} doc - Documento jsPDF
 * @returns {number} Posición Y después del encabezado
 */
export function addPageHeader(doc) {
    const margins = PDFSettings.layout.margins;
    const spacing = PDFSettings.layout.spacing;
    
    try {
        // Solo si está habilitado el encabezado
        if (PDFSettings.content.includeHeader) {
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(PDFSettings.style.font.smallSize);
            doc.setTextColor(100, 100, 100);
            
            // Texto simple como encabezado
            doc.text(
                getTranslation('coverTitle'),
                margins.left,
                margins.top / 2
            );
            
            return margins.top;
        }
    } catch (error) {
        console.error('Error al agregar encabezado de página:', error);
    }
    
    // En caso de error o si no está habilitado, devolver solo el margen superior
    return margins.top;
}

/**
 * Agrega pie de página estándar con número de página
 * @param {Object} doc - Documento jsPDF
 */
export function addPageFooter(doc) {
    try {
        // Solo si está habilitado el pie de página
        if (PDFSettings.content.includeFooter) {
            const margins = PDFSettings.layout.margins;
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageWidth = doc.internal.pageSize.getWidth();
            
            // Configurar estilo
            doc.setFont(PDFSettings.style.font.family, 'normal');
            doc.setFontSize(PDFSettings.style.font.smallSize);
            doc.setTextColor(100, 100, 100);
            
            // Obtener número de página actual y total
            const pageNumber = doc.internal.getCurrentPageInfo().pageNumber;
            const totalPages = doc.internal.getNumberOfPages();
            
            // Texto de página
            const pageText = `${getTranslation('page')} ${pageNumber} ${getTranslation('of')} ${totalPages}`;
            
            // Agregar texto de página centrado
            doc.text(
                pageText,
                pageWidth / 2,
                pageHeight - margins.bottom / 2,
                { align: 'center' }
            );
            
            // Fecha de generación (opcional)
            if (PDFSettings.content.includeGenerationDate) {
                const date = new Date();
                const dateText = `${getTranslation('generatedAt')}: ${date.toLocaleDateString(PDFSettings.language.defaultLocale)}`;
                
                doc.text(
                    dateText,
                    margins.left,
                    pageHeight - margins.bottom / 2
                );
            }
        }
    } catch (error) {
        console.error('Error al agregar pie de página:', error);
    }
}

/**
 * Añade tabla de contenidos al PDF
 * @param {Object} doc - Documento jsPDF
 * @param {Array} sections - Lista de secciones con { title, pageNumber }
 * @param {number} y - Posición Y inicial
 * @returns {number} Nueva posición Y
 */
export function addTableOfContents(doc, sections, y) {
    const margins = PDFSettings.layout.margins;
    const spacing = PDFSettings.layout.spacing;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    try {
        // Título
        doc.setFont(PDFSettings.style.font.family, 'bold');
        doc.setFontSize(PDFSettings.style.font.subtitleSize);
        doc.setTextColor(0, 0, 0);
        
        doc.text(getTranslation('tableOfContents'), margins.left, y);
        y += spacing.paragraph;
        
        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margins.left, y, pageWidth - margins.right, y);
        y += spacing.paragraph;
        
        // Configurar estilo para ítems
        doc.setFont(PDFSettings.style.font.family, 'normal');
        doc.setFontSize(PDFSettings.style.font.normalSize);
        doc.setTextColor(0, 0, 0);
        
        // Dibujar cada ítem
        sections.forEach(section => {
            // Comprobar espacio disponible
            y = checkPageBreak(doc, y, spacing.paragraph * 2);
            
            // Título de sección
            doc.text(section.title, margins.left, y);
            
            // Número de página alineado a la derecha
            const pageNumberText = section.pageNumber.toString();
            const pageNumberWidth = doc.getTextWidth(pageNumberText);
            
            doc.text(
                pageNumberText,
                pageWidth - margins.right - pageNumberWidth,
                y
            );
            
            // Puntos de conexión entre título y número
            const titleWidth = doc.getTextWidth(section.title);
            const dotsStartX = margins.left + titleWidth + 5;
            const dotsEndX = pageWidth - margins.right - pageNumberWidth - 5;
            
            if (dotsEndX > dotsStartX) {
                // Dibujar puntos
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.5);
                
                // Puntos discontinuos
                const dotSpacing = 3;
                for (let x = dotsStartX; x < dotsEndX; x += dotSpacing) {
                    doc.line(x, y - 1, x + 1, y - 1);
                }
            }
            
            y += spacing.paragraph;
        });
        
        return y + spacing.paragraph;
    } catch (error) {
        console.error('Error al crear tabla de contenidos:', error);
        return y;
    }
}

/**
 * Descarga el PDF generado con manejo de errores
 * @param {Object} doc - Documento jsPDF
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<boolean>} Éxito de la operación
 */
export async function safeSavePDF(doc, filename) {
    try {
        // Método elegido para descargar
        const downloadMethod = PDFSettings.functionality.downloadMethod;
        
        // Intentar con el método seleccionado
        switch (downloadMethod) {
            case 'save':
                // Método directo .save()
                doc.save(filename);
                return true;
                
            case 'blob':
                // Método usando Blob y URL.createObjectURL
                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 5000);
                return true;
                
            case 'dataUrl':
                // Método usando data URI
                const dataUri = doc.output('datauristring');
                const dataLink = document.createElement('a');
                dataLink.href = dataUri;
                dataLink.download = filename;
                dataLink.style.display = 'none';
                document.body.appendChild(dataLink);
                dataLink.click();
                document.body.removeChild(dataLink);
                return true;
                
            case 'window':
                // Abrir en nueva ventana
                const pdfData = doc.output('datauristring');
                const newWindow = window.open();
                if (!newWindow) {
                    throw new Error('No se pudo abrir una nueva ventana, posible bloqueo de pop-ups');
                }
                
                newWindow.document.write(`
                    <html>
                    <head>
                        <title>PDF Generado - Sistema DIRD</title>
                    </head>
                    <body style="margin:0;padding:20px;font-family:sans-serif;text-align:center;">
                        <h3>Su PDF está listo para descargar</h3>
                        <p>Si la descarga no comienza automáticamente, haga clic en el botón de abajo.</p>
                        <button id="downloadBtn" style="padding:10px 20px;background:#3498db;color:white;border:none;border-radius:4px;cursor:pointer;font-size:16px;margin-top:20px;">
                            Descargar PDF
                        </button>
                        <p style="margin-top:30px;color:#666;font-size:13px;">
                            Una vez descargado, puede cerrar esta ventana.
                        </p>
                        
                        <script>
                            document.getElementById('downloadBtn').addEventListener('click', function() {
                                const link = document.createElement('a');
                                link.href = "${pdfData}";
                                link.download = "${filename}";
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            });
                            
                            // Iniciar descarga automática
                            setTimeout(function() {
                                document.getElementById('downloadBtn').click();
                            }, 1000);
                        </script>
                    </body>
                    </html>
                `);
                
                return true;
                
            case 'auto':
            default:
                // Intentar de forma automática el método más simple
                doc.save(filename);
                return true;
        }
    } catch (error) {
        console.error('Error al guardar PDF:', error);
        
        // Si está habilitado el método alternativo, intentarlo
        if (PDFSettings.functionality.enableAlternativeDownload) {
            try {
                console.log('Intentando método alternativo para guardar PDF...');
                return await tryAlternativeDownload(doc, filename);
            } catch (alternativeError) {
                console.error('Error en método alternativo:', alternativeError);
                
                // Si está habilitado el fallback, mostrar opciones al usuario
                if (PDFSettings.functionality.enableDownloadFallback) {
                    return showDownloadFallback(doc, filename);
                }
                
                return false;
            }
        }
        
        return false;
    }
}

/**
 * Intenta un método alternativo para descargar el PDF
 * @param {Object} doc - Documento jsPDF
 * @param {string} filename - Nombre del archivo
 * @returns {Promise<boolean>} Éxito de la operación
 */
async function tryAlternativeDownload(doc, filename) {
    try {
        // Método 1: Blob
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        
        // Simular clic
        link.click();
        
        // Limpieza
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        
        return true;
    } catch (error) {
        console.error('Error en método alternativo 1:', error);
        
        // Método 2: Data URI
        try {
            const dataUri = doc.output('datauristring');
            const dataLink = document.createElement('a');
            dataLink.href = dataUri;
            dataLink.download = filename;
            dataLink.style.display = 'none';
            document.body.appendChild(dataLink);
            dataLink.click();
            document.body.removeChild(dataLink);
            
            return true;
        } catch (dataUriError) {
            console.error('Error en método alternativo 2:', dataUriError);
            throw error; // Propagar error original
        }
    }
}

/**
 * Muestra opciones de descarga alternativas al usuario
 * @param {Object} doc - Documento jsPDF
 * @param {string} filename - Nombre del archivo
 * @returns {boolean} Éxito de la operación
 */
function showDownloadFallback(doc, filename) {
    try {
        // Crear modal con opciones
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        
        // Contenido del modal
        modal.innerHTML = `
            <div style="background:white; padding:20px; border-radius:5px; max-width:500px; width:90%;">
                <h3 style="margin-top:0;">Problema al descargar PDF</h3>
                <p>Ha ocurrido un problema al intentar descargar el PDF. Por favor, elija una de las siguientes opciones:</p>
                
                <div style="display:flex; flex-direction:column; gap:10px; margin-top:20px;">
                    <button id="newWindowBtn" style="padding:10px; background:#3498db; color:white; border:none; border-radius:4px; cursor:pointer;">
                        Abrir en nueva ventana
                    </button>
                    
                    <button id="dataUriBtn" style="padding:10px; background:#2ecc71; color:white; border:none; border-radius:4px; cursor:pointer;">
                        Descargar como archivo
                    </button>
                    
                    <button id="closeModalBtn" style="padding:10px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; margin-top:10px;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        // Agregar modal al body
        document.body.appendChild(modal);
        
        // Configurar eventos de botones
        const newWindowBtn = document.getElementById('newWindowBtn');
        const dataUriBtn = document.getElementById('dataUriBtn');
        const closeModalBtn = document.getElementById('closeModalBtn');
        
        // Opción 1: Abrir en nueva ventana
        newWindowBtn.addEventListener('click', () => {
            try {
                const pdfData = doc.output('datauristring');
                const newWindow = window.open();
                if (newWindow) {
                    newWindow.document.write(`
                        <iframe width="100%" height="100%" src="${pdfData}"></iframe>
                    `);
                } else {
                    alert('No se pudo abrir una nueva ventana. Compruebe que no tiene bloqueados los popups.');
                }
            } catch (error) {
                console.error('Error al abrir en nueva ventana:', error);
                alert('No se pudo abrir el PDF en una nueva ventana.');
            }
            
            document.body.removeChild(modal);
        });
        
        // Opción 2: Enlace dataURI
        dataUriBtn.addEventListener('click', () => {
            try {
                const dataUri = doc.output('datauristring');
                const dataLink = document.createElement('a');
                dataLink.href = dataUri;
                dataLink.download = filename;
                dataLink.textContent = 'Haga clic aquí si la descarga no comienza automáticamente';
                dataLink.style.display = 'block';
                dataLink.style.margin = '20px auto';
                dataLink.style.textAlign = 'center';
                
                // Reemplazar contenido del modal
                modal.innerHTML = '';
                
                const container = document.createElement('div');
                container.style.cssText = `
                    background:white; 
                    padding:20px; 
                    border-radius:5px; 
                    max-width:500px; 
                    width:90%;
                    text-align: center;
                `;
                
                container.innerHTML = `
                    <h3>Descargando PDF</h3>
                    <p>La descarga debería comenzar automáticamente.</p>
                `;
                
                container.appendChild(dataLink);
                
                container.innerHTML += `
                    <button id="closeBtn" style="padding:10px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; margin-top:20px;">
                        Cerrar
                    </button>
                `;
                
                modal.appendChild(container);
                
                // Simular clic
                dataLink.click();
                
                // Configurar botón de cerrar
                document.getElementById('closeBtn').addEventListener('click', () => {
                    document.body.removeChild(modal);
                });
            } catch (error) {
                console.error('Error en dataURI fallback:', error);
                alert('No se pudo generar el enlace de descarga.');
                document.body.removeChild(modal);
            }
        });
        
        // Botón de cerrar
        closeModalBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        return true;
    } catch (error) {
        console.error('Error en fallback modal:', error);
        return false;
    }
}