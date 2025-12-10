/**
 * Generador de Informe PDF para Análisis DIRD
 * Este script crea un informe PDF con la información de detecciones 
 * realizadas por un modelo YOLOv8.
 */

class ReportGenerator {
    constructor() {
        // Configuración del PDF
        this.pdfWidth = 210;  // A4 ancho en mm
        this.pdfHeight = 297; // A4 alto en mm
        this.margins = {
            top: 15,
            right: 15,
            bottom: 15,
            left: 15
        };
        
        // Estado para almacenar información
        this.modelInfo = {};
        this.imageInfo = {};
        this.detections = [];
        this.canvasImage = null;
    }

    /**
     * Configura la información del modelo
     * @param {Object} info - Objeto con la información del modelo
     */
    setModelInfo(info) {
        this.modelInfo = {
            name: info.name || 'No especificado',
            date: info.date || new Date().toLocaleString(),
            confidenceThreshold: info.confidenceThreshold || 0.25,
            otherParams: info.otherParams || {}
        };
        return this;
    }

    /**
     * Configura la información de la imagen analizada
     * @param {Object} info - Objeto con la información de la imagen
     */
    setImageInfo(info) {
        this.imageInfo = {
            name: info.name || 'No especificado',
            width: info.width || 0,
            height: info.height || 0,
            fileSize: info.fileSize || 0
        };
        return this;
    }

    /**
     * Establece el canvas con la imagen analizada
     * @param {HTMLCanvasElement} canvas - Canvas con la imagen y las detecciones
     */
    setCanvasImage(canvas) {
        this.canvasImage = canvas;
        return this;
    }

    /**
     * Añade todas las detecciones (incluso las filtradas)
     * @param {Array} detections - Array con todas las detecciones
     */
    setDetections(detections) {
        this.detections = detections;
        return this;
    }

    /**
     * Genera un canvas con la imagen recortada de una detección
     * @param {Object} detection - Objeto de detección
     * @param {Number} size - Tamaño del canvas (cuadrado)
     * @returns {Promise<HTMLCanvasElement>} - Canvas con la imagen recortada
     */
    async generateDetectionThumbnail(detection, size = 100) {
        return new Promise((resolve) => {
            // Crear canvas temporal para la miniatura
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            // Dibujar el fondo
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, size, size);
            
            // Calcular el área de recorte y escalado
            const sourceWidth = detection.x2 - detection.x1;
            const sourceHeight = detection.y2 - detection.y1;
            
            // Calcular factor de escala manteniendo la proporción
            const scale = Math.min(size / sourceWidth, size / sourceHeight);
            const scaledWidth = sourceWidth * scale;
            const scaledHeight = sourceHeight * scale;
            
            // Centrar la imagen en el canvas
            const offsetX = (size - scaledWidth) / 2;
            const offsetY = (size - scaledHeight) / 2;
            
            // Dibujar la imagen recortada y escalada
            if (this.originalImage) {
                ctx.drawImage(
                    this.originalImage,
                    detection.x1, detection.y1, sourceWidth, sourceHeight,
                    offsetX, offsetY, scaledWidth, scaledHeight
                );
                
                // Dibujar borde de la detección
                ctx.strokeStyle = detection.color || '#FF3838';
                ctx.lineWidth = 2;
                ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
            } else {
                // Si no hay imagen original, mostrar un mensaje de error
                ctx.fillStyle = '#FF3838';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('Imagen no disponible', size/2, size/2);
            }
            
            resolve(canvas);
        });
    }

    /**
     * Prepara y carga la imagen original para usar en las miniaturas
     * @param {String} imageUrl - URL de la imagen original
     * @returns {Promise} - Promesa que se resuelve cuando la imagen está cargada
     */
    loadOriginalImage(imageUrl) {
        return new Promise((resolve) => {
            this.originalImage = new Image();
            this.originalImage.onload = () => resolve();
            this.originalImage.src = imageUrl;
        });
    }

    /**
     * Dibuja el encabezado de la tabla con las columnas
     * @param {jsPDF} pdf - Instancia de jsPDF
     * @param {Number} tableXPos - Posición X de la tabla
     * @param {Number} yPos - Posición Y actual
     * @param {Array} colWidths - Array con los anchos de las columnas
     * @param {Number} totalWidth - Ancho total de la tabla
     * @private
     */
    _drawTableHeader(pdf, tableXPos, yPos, colWidths, totalWidth) {
        pdf.setFillColor(220, 220, 220);
        pdf.rect(tableXPos, yPos, totalWidth, 7, 'F');
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        let colX = tableXPos;
        
        pdf.text('Clase', colX + 2, yPos + 5);
        colX += colWidths[0];
        
        pdf.text('Confianza', colX + 2, yPos + 5);
        colX += colWidths[1];
        
        pdf.text('Estado', colX + 2, yPos + 5);
        colX += colWidths[2];
        
        pdf.text('Dimensiones', colX + 2, yPos + 5);
        colX += colWidths[3];
        
        pdf.text('Coordenadas', colX + 2, yPos + 5);
        colX += colWidths[4];
        
        pdf.text('Vista', colX + 2, yPos + 5);
    }

    /**
     * Elimina detecciones duplicadas o muy similares
     * @param {Array} detections - Array de objetos de detección
     * @returns {Array} - Array filtrado sin duplicados
     */
    _removeDuplicates(detections) {
        // Si hay menos de 2 detecciones, no hay nada que filtrar
        if (!detections || detections.length < 2) {
            return detections;
        }
        
        // Función simple para verificar si dos detecciones se superponen significativamente
        const isSimilar = (det1, det2) => {
            // Considerar duplicados si:
            // 1. Son de la misma clase
            // 2. Sus centros están muy cerca (dentro del 20% del tamaño)
            
            // Si son de clases diferentes, no son duplicados
            if (det1.label !== det2.label) {
                return false;
            }
            
            // Calcular los centros de las detecciones
            const center1X = (det1.x1 + det1.x2) / 2;
            const center1Y = (det1.y1 + det1.y2) / 2;
            const center2X = (det2.x1 + det2.x2) / 2;
            const center2Y = (det2.y1 + det2.y2) / 2;
            
            // Calcular la distancia entre los centros
            const distance = Math.sqrt(
                Math.pow(center1X - center2X, 2) + 
                Math.pow(center1Y - center2Y, 2)
            );
            
            // Calcular el tamaño promedio para determinar qué tan cerca deben estar
            const size1 = Math.max(det1.x2 - det1.x1, det1.y2 - det1.y1);
            const size2 = Math.max(det2.x2 - det2.x1, det2.y2 - det2.y1);
            const avgSize = (size1 + size2) / 2;
            
            // Si los centros están más cerca que el 20% del tamaño promedio, son similares
            return distance < (avgSize * 0.2);
        };
        
        // Clonar el array para no modificar el original
        const dets = [...detections];
        
        // Ordenar por probabilidad (mayor a menor)
        dets.sort((a, b) => b.probability - a.probability);
        
        // Array para las detecciones filtradas
        const result = [];
        
        // Mientras quedan detecciones por procesar
        while (dets.length > 0) {
            // Tomar la detección con mayor probabilidad
            const best = dets[0];
            result.push(best);
            
            // Filtrar las detecciones similares
            dets.shift(); // Eliminar la primera (la mejor)
            
            // Filtrar el resto, mantener solo las que no son similares a la mejor
            const remaining = [];
            for (let i = 0; i < dets.length; i++) {
                if (!isSimilar(best, dets[i])) {
                    remaining.push(dets[i]);
                }
            }
            
            // Actualizar la lista de detecciones restantes
            dets.length = 0;
            dets.push(...remaining);
        }
        
        return result;
    }

    /**
     * Genera el informe PDF
     * @param {String} fileName - Nombre del archivo PDF a generar
     * @returns {Promise} - Promesa que se resuelve cuando el PDF está generado
     */
    async generateReport(fileName = 'informe_analisis_DIRD.pdf') {
        // Crear documento PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        // Variables para controlar la posición
        let yPos = this.margins.top;
        const xPos = this.margins.left;
        const contentWidth = this.pdfWidth - this.margins.left - this.margins.right;
        
        // ----- Encabezado -----
        
        // Título del informe
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('Informe de Análisis DIRD', xPos, yPos + 8);
        
        // Cargar imagen de encabezado
        try {
            const headerImg = new Image();
            await new Promise((resolve, reject) => {
                headerImg.onload = resolve;
                headerImg.onerror = reject;
                headerImg.src = 'img/head.png';
            });
            
            // Calcular posición para que esté en el borde superior derecho
            const imgHeight = 15; // altura fija en mm
            const aspectRatio = headerImg.width / headerImg.height;
            const imgWidth = imgHeight * aspectRatio;
            pdf.addImage(
                headerImg, 
                'PNG', 
                this.pdfWidth - this.margins.right - imgWidth, 
                this.margins.top, 
                imgWidth, 
                imgHeight
            );
        } catch (error) {
            console.error('Error al cargar la imagen de encabezado:', error);
        }
        
        yPos += 25; // Espacio después del encabezado
        
        // ----- Información del Modelo -----
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Información del Modelo', xPos, yPos);
        
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        
        pdf.text(`Nombre del modelo: ${this.modelInfo.name}`, xPos, yPos + 5);
        pdf.text(`Fecha del análisis: ${this.modelInfo.date}`, xPos, yPos + 10);
        pdf.text(`Umbral de confianza: ${this.modelInfo.confidenceThreshold * 100}%`, xPos, yPos + 15);
        
        // Parámetros adicionales
        let paramLine = 20;
        for (const [key, value] of Object.entries(this.modelInfo.otherParams)) {
            pdf.text(`${key}: ${value}`, xPos, yPos + paramLine);
            paramLine += 5;
        }
        
        yPos += paramLine + 5;
        
        // ----- Información de la Imagen -----
        pdf.setFont('helvetica', 'bold');
        pdf.text('Información de la Imagen', xPos, yPos);
        
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Nombre del archivo: ${this.imageInfo.name}`, xPos, yPos + 5);
        pdf.text(`Dimensiones: ${this.imageInfo.width} × ${this.imageInfo.height} píxeles`, xPos, yPos + 10);
        
        if (this.imageInfo.fileSize) {
            const fileSizeMB = (this.imageInfo.fileSize / (1024 * 1024)).toFixed(2);
            pdf.text(`Tamaño del archivo: ${fileSizeMB} MB`, xPos, yPos + 15);
            yPos += 20;
        } else {
            yPos += 15;
        }
        
        // ----- Imagen Analizada -----
        if (this.canvasImage) {
            pdf.setFont('helvetica', 'bold');
            pdf.text('Imagen Analizada', this.pdfWidth / 2, yPos, { align: 'center' });
            yPos += 5;
            
            // Convertir canvas a imagen y colocarla en el PDF
            const imgData = this.canvasImage.toDataURL('image/jpeg', 0.95);
            
            // Calcular dimensiones para que la imagen sea de 640x640 en el PDF
            // Considerando que 1 mm es aproximadamente 3.78 píxeles (asumiendo 96 DPI)
            const imgWidthMM = Math.min(160, contentWidth); // máximo 160mm (aprox. 640px)
            const aspectRatio = this.canvasImage.height / this.canvasImage.width;
            const imgHeightMM = imgWidthMM * aspectRatio;
            
            // Centrar la imagen
            const imgXPos = (this.pdfWidth - imgWidthMM) / 2;
            
            pdf.addImage(
                imgData, 
                'JPEG', 
                imgXPos, 
                yPos, 
                imgWidthMM, 
                imgHeightMM
            );
            
            yPos += imgHeightMM + 10;
        } else {
            yPos += 5;
        }
        
        // ----- Tabla de Detecciones -----
        pdf.setFont('helvetica', 'bold');
        pdf.text('Detecciones Realizadas', xPos, yPos);
        yPos += 8;
        
        // Si estamos cerca del final de la página, comenzar una nueva
        if (yPos > 250) {
            pdf.addPage();
            yPos = this.margins.top;
        }
        
        // Eliminar detecciones duplicadas
        const filteredDetections = this._removeDuplicates(this.detections);
        console.log(`Se eliminaron ${this.detections.length - filteredDetections.length} detecciones duplicadas`);
        
        // Dividir detecciones en aceptables e inaceptables
        const acceptableThreshold = 0.25;
        const acceptableDetections = filteredDetections.filter(det => det.probability >= acceptableThreshold);
        const unacceptableDetections = filteredDetections.filter(det => det.probability < acceptableThreshold);
        
        // Ordenar por probabilidad
        acceptableDetections.sort((a, b) => b.probability - a.probability);
        unacceptableDetections.sort((a, b) => b.probability - a.probability);
        
        // Tomar las 20 mejores detecciones inaceptables
        const topUnacceptable = unacceptableDetections.slice(0, 20);
        
        // Combinar las listas para mostrar (primero aceptables, luego las inaceptables seleccionadas)
        const detectionsToShow = [...acceptableDetections, ...topUnacceptable];
        
        // Añadir estadísticas
        pdf.setFontSize(10);
        pdf.text(`Detecciones totales originales: ${this.detections.length}`, xPos, yPos);
        pdf.text(`Detecciones después de eliminar duplicados: ${filteredDetections.length}`, xPos, yPos + 5);
        pdf.text(`Detecciones aceptables (≥ ${acceptableThreshold * 100}%): ${acceptableDetections.length}`, xPos, yPos + 10);
        pdf.text(`Detecciones inaceptables (< ${acceptableThreshold * 100}%): ${unacceptableDetections.length}`, xPos, yPos + 15);
        
        yPos += 25;
        
        // Si estamos cerca del final de la página, comenzar una nueva
        if (yPos > 250) {
            pdf.addPage();
            yPos = this.margins.top;
        }
        
        // Definir columnas de la tabla
        const colWidths = [25, 20, 25, 35, 40, 35];
        const totalWidth = colWidths.reduce((a, b) => a + b, 0);
        const tableXPos = (this.pdfWidth - totalWidth) / 2;
        
        // Cabecera de la tabla
        this._drawTableHeader(pdf, tableXPos, yPos, colWidths, totalWidth);
        yPos += 7;
        
        // Línea separadora entre secciones aceptables e inaceptables
        let showedSeparator = false;
        
        // Filas de la tabla
        pdf.setFont('helvetica', 'normal');
        for (let i = 0; i < detectionsToShow.length; i++) {
            const det = detectionsToShow[i];
            
            // Mostrar separador entre secciones aceptables e inaceptables
            if (!showedSeparator && det.probability < acceptableThreshold) {
                pdf.setFillColor(200, 200, 200);
                pdf.rect(tableXPos, yPos, totalWidth, 7, 'F');
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(7);
                pdf.text('--- Detecciones por debajo del umbral ---', tableXPos + totalWidth/2, yPos + 5, {
                    align: 'center'
                });
                yPos += 7;
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                showedSeparator = true;
                
                // Si estamos cerca del final de la página, comenzar una nueva
                if (yPos > 270) {
                    pdf.addPage();
                    yPos = this.margins.top;
                    
                    // Repetir cabecera
                    this._drawTableHeader(pdf, tableXPos, yPos, colWidths, totalWidth);
                    yPos += 7;
                }
            }
            
            // Si estamos cerca del final de la página, comenzar una nueva
            if (yPos > 270) {
                pdf.addPage();
                yPos = this.margins.top;
                
                // Repetir cabecera
                this._drawTableHeader(pdf, tableXPos, yPos, colWidths, totalWidth);
                yPos += 7;
            }
            
            // Alternar color de fondo
            if (i % 2 === 0) {
                pdf.setFillColor(245, 245, 245);
                pdf.rect(tableXPos, yPos, totalWidth, 15, 'F');
            }
            
            // Dibujar bordes de la fila
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(tableXPos, yPos, totalWidth, 15);
            
            // Líneas de separación entre columnas
            let colX = tableXPos;
            for (let w of colWidths.slice(0, -1)) {
                colX += w;
                pdf.line(colX, yPos, colX, yPos + 15);
            }
            
            // Datos de la fila
            colX = tableXPos;
            
            // Clase
            pdf.setFontSize(8);
            pdf.text(det.label || 'Desconocido', colX + 2, yPos + 5, {
                maxWidth: colWidths[0] - 4
            });
            colX += colWidths[0];
            
            // Confianza
            const confidence = det.probability ? (det.probability * 100).toFixed(1) + '%' : 'N/A';
            pdf.text(confidence, colX + 2, yPos + 5);
            colX += colWidths[1];
            
            // Estado (Aceptable/Inaceptable)
            const isAcceptable = det.probability >= acceptableThreshold;
            pdf.setTextColor(isAcceptable ? 0 : 200, isAcceptable ? 150 : 0, 0);
            pdf.text(isAcceptable ? 'Aceptable' : 'Inaceptable', colX + 2, yPos + 5);
            pdf.setTextColor(0, 0, 0); // Restaurar color de texto
            colX += colWidths[2];
            
            // Dimensiones
            const width = det.x2 - det.x1;
            const height = det.y2 - det.y1;
            pdf.text(`${Math.round(width)} × ${Math.round(height)} px`, colX + 2, yPos + 5);
            colX += colWidths[3];
            
            // Coordenadas
            pdf.text(`(${Math.round(det.x1)}, ${Math.round(det.y1)})`, colX + 2, yPos + 5);
            colX += colWidths[4];
            
            // Miniatura - Si tenemos la imagen original, agregaremos una miniatura
            if (this.originalImage) {
                try {
                    // Usar una promesa para asegurar que la miniatura se crea antes de continuar
                    const thumbnail = await this.generateDetectionThumbnail({
                        x1: det.x1,
                        y1: det.y1,
                        x2: det.x2,
                        y2: det.y2,
                        color: det.color
                    }, 40);
                    
                    const thumbData = thumbnail.toDataURL('image/jpeg', 0.9);
                    pdf.addImage(
                        thumbData,
                        'JPEG',
                        colX + 5,
                        yPos + 2,
                        10,
                        10
                    );
                } catch (error) {
                    console.error('Error al generar miniatura:', error);
                }
            }
            
            yPos += 15;
        }
        
        // Si hay inaceptables que no se muestran, indicar cuántas son
        if (unacceptableDetections.length > topUnacceptable.length) {
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(
                `* Se muestran solo las ${topUnacceptable.length} mejores detecciones por debajo del umbral (de un total de ${unacceptableDetections.length}).`,
                tableXPos,
                yPos + 5
            );
            pdf.setTextColor(0, 0, 0);
        }
        
        // ----- Pie de página -----
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            
            // Información de página
            pdf.text(
                `Página ${i} de ${pageCount}`,
                this.pdfWidth / 2,
                this.pdfHeight - 10,
                {
                    align: 'center'
                }
            );
            
            // Fecha de generación
            const dateStr = new Date().toLocaleString();
            pdf.text(
                `Generado el: ${dateStr}`,
                this.pdfWidth - this.margins.right,
                this.pdfHeight - 10,
                {
                    align: 'right'
                }
            );
        }
        
        // Guardar el PDF
        pdf.save(fileName);
        
        return pdf; // Devolver objeto PDF por si se necesita para más operaciones
    }
}