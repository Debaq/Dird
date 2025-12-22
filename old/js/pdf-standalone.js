// pdf-standalone-enhanced.js - Exportador PDF independiente mejorado
(function() {
    // Crear el exportador PDF
    window.PDFExporter = {
      exportAnalysis: function(analysisData, options = {}) {
        return new Promise((resolve, reject) => {
          try {
            console.log("Generando PDF con exportador standalone mejorado...");
            console.log("Datos para el PDF:", analysisData);
            
            // Verificar si jsPDF está disponible
            if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined' && typeof window.jsPDF === 'undefined') {
              throw new Error("jsPDF no está disponible");
            }
            
            // Obtener la clase jsPDF
            const JsPDF = jspdf?.jsPDF || jsPDF || window.jsPDF;
            
            // Obtener datos actualizados si no se proporcionaron o están incompletos
            if (!analysisData || !analysisData.detections || analysisData.detections.length === 0) {
              analysisData = collectAnalysisData();
              console.log("Datos recolectados internamente:", analysisData);
            }
            
            // Crear documento PDF
            const doc = new JsPDF({
              orientation: 'portrait',
              unit: 'mm',
              format: 'a4'
            });
            
            // PÁGINA 1: PORTADA
            // ------------------------------------------------------------
            
            // Portada - Título
            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.setTextColor(44, 62, 80);
            doc.text("Reporte de Análisis DIRD", 105, 50, { align: 'center' });
            
            // Subtítulo
            doc.setFont("helvetica", "normal");
            doc.setFontSize(16);
            doc.setTextColor(52, 152, 219);
            doc.text("Detección Inteligente de Retinopatía Diabética", 105, 60, { align: 'center' });
            
            // Fecha y hora
            doc.setFontSize(12);
            doc.setTextColor(100, 100, 100);
            const currentDate = new Date().toLocaleDateString();
            const currentTime = new Date().toLocaleTimeString();
            doc.text(`Generado el: ${currentDate} ${currentTime}`, 105, 70, { align: 'center' });
            
            // Línea separadora
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.5);
            doc.line(30, 80, 180, 80);
            
            // Información de la imagen
            const fileName = document.getElementById('fileInput')?.files[0]?.name || 'imagen_sin_nombre.jpg';
            doc.setFontSize(12);
            doc.setTextColor(70, 70, 70);
            doc.text(`Archivo analizado: ${fileName}`, 105, 95, { align: 'center' });
            
            // Información adicional
            doc.setFontSize(14);
            doc.setTextColor(44, 62, 80);
            doc.text(`Total de detecciones: ${analysisData.detections.length}`, 105, 110, { align: 'center' });
            
            // PÁGINA 2: RESUMEN
            // ------------------------------------------------------------
            doc.addPage();
            
            // Título de la sección
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text("Resumen del Análisis", 20, 20);
            
            // Línea separadora
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.5);
            doc.line(20, 25, 190, 25);
            
            // Totales
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text(`Total de detecciones encontradas: ${analysisData.detections.length}`, 20, 40);
            
            // Calcular estadísticas
            let avgConfidence = 0;
            if (analysisData.detections.length > 0) {
              const sumConfidence = analysisData.detections.reduce((sum, det) => {
                // Normalizar confianza (algunos modelos dan 0-1, otros 0-100)
                const normalizedConf = det.confidence > 1 ? det.confidence / 100 : det.confidence;
                return sum + normalizedConf;
              }, 0);
              avgConfidence = sumConfidence / analysisData.detections.length * 100;
            }
            
            doc.text(`Confianza media: ${avgConfidence.toFixed(2)}%`, 20, 50);
            
            // Calcular detecciones por clase
            const classCounts = {};
            analysisData.detections.forEach(det => {
              let className = `Clase ${det.class}`;
              
              // Intentar obtener nombre real de la clase
              if (window.classes && det.class < window.classes.length) {
                className = window.classes[det.class];
              }
              
              classCounts[className] = (classCounts[className] || 0) + 1;
            });
            
            // Mostrar distribución por clase
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("Distribución por Clase", 20, 70);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            
            let y = 85;
            Object.entries(classCounts).forEach(([className, count], index) => {
              // Calcular porcentaje
              const percentage = (count / analysisData.detections.length * 100).toFixed(1);
              
              // Color según clase
              const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];
              const colorIndex = index % colors.length;
              const colorHex = colors[colorIndex];
              
              // Convertir hex a RGB
              const r = parseInt(colorHex.slice(1, 3), 16);
              const g = parseInt(colorHex.slice(3, 5), 16);
              const b = parseInt(colorHex.slice(5, 7), 16);
              
              // Dibujar un cuadrado de color
              doc.setFillColor(r, g, b);
              doc.rect(20, y - 4, 5, 5, 'F');
              
              // Texto con porcentaje
              doc.text(`${className}: ${count} (${percentage}%)`, 30, y);
              y += 10;
            });
            
            // Si hay disponible autoTable, crear una tabla más bonita
            if (typeof doc.autoTable === 'function') {
              // Añadir tabla de distribución
              const tableData = Object.entries(classCounts).map(([className, count]) => {
                const percentage = (count / analysisData.detections.length * 100).toFixed(1);
                return [className, count.toString(), `${percentage}%`];
              });
              
              doc.autoTable({
                startY: 130,
                head: [['Clase', 'Cantidad', 'Porcentaje']],
                body: tableData,
                theme: 'grid',
                headStyles: {
                  fillColor: [52, 152, 219],
                  textColor: 255,
                  fontStyle: 'bold'
                },
                alternateRowStyles: {
                  fillColor: [240, 240, 240]
                },
                styles: {
                  fontSize: 10
                }
              });
            }
            
            // PÁGINA 3: IMAGEN CON DETECCIONES
            // ------------------------------------------------------------
            doc.addPage();
            
            // Título de la sección
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text("Imagen con Detecciones", 20, 20);
            
            // Línea separadora
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.5);
            doc.line(20, 25, 190, 25);
            
            // Añadir imagen con detecciones
            const canvas = document.getElementById('outputCanvas');
            if (canvas) {
              try {
                // Capturar la imagen del canvas
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
                // Dimensiones para la imagen
                const imgWidth = 170;
                const aspectRatio = canvas.height / canvas.width;
                const imgHeight = imgWidth * aspectRatio;
                
                // Añadir imagen al PDF
                doc.addImage(imgData, 'JPEG', 20, 35, imgWidth, imgHeight);
                
                // Leyenda
                y = 35 + imgHeight + 10;
                doc.setFont("helvetica", "bold");
                doc.setFontSize(12);
                doc.text("Leyenda:", 20, y);
                y += 8;
                
                // Clase y colores
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                
                if (window.classes && window.classes.length > 0) {
                  window.classes.forEach((className, index) => {
                    // Obtener color
                    let color = '#000000';
                    if (window.colors && index < window.colors.length) {
                      color = window.colors[index];
                    }
                    
                    // Convertir a RGB
                    const r = parseInt(color.slice(1, 3), 16) || 0;
                    const g = parseInt(color.slice(3, 5), 16) || 0;
                    const b = parseInt(color.slice(5, 7), 16) || 0;
                    
                    // Dibujar un cuadrado de color
                    doc.setFillColor(r, g, b);
                    doc.rect(20, y - 3, 4, 4, 'F');
                    
                    // Texto de la clase
                    doc.text(`${className}`, 30, y);
                    y += 6;
                  });
                }
              } catch (error) {
                console.error("Error al añadir imagen:", error);
                doc.text("No se pudo cargar la imagen con detecciones", 20, 80);
              }
            } else {
              doc.text("No se encontró la imagen para incluir en el PDF", 20, 80);
            }
            
            // PÁGINA 4: TABLA DE DETECCIONES
            // ------------------------------------------------------------
            doc.addPage();
            
            // Título de la sección
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text("Detalle de Detecciones", 20, 20);
            
            // Línea separadora
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.5);
            doc.line(20, 25, 190, 25);
            
            // Tabla de detecciones
            if (typeof doc.autoTable === 'function' && analysisData.detections.length > 0) {
              // Preparar datos para la tabla
              const tableData = analysisData.detections.map((det, idx) => {
                // Obtener nombre de clase
                let className = `Clase ${det.class}`;
                if (window.classes && det.class < window.classes.length) {
                  className = window.classes[det.class];
                }
                
                // Formatear confianza
                const confidence = det.confidence > 1 
                  ? `${Math.min(det.confidence, 100).toFixed(1)}%` 
                  : `${(det.confidence * 100).toFixed(1)}%`;
                
                // Coordenadas redondeadas
                const bbox = det.bbox.map(v => Math.round(v));
                
                // Calcular área
                const area = bbox[2] * bbox[3];
                
                return [
                  (idx + 1).toString(),
                  className,
                  confidence,
                  `(${bbox[0]}, ${bbox[1]})`,
                  `${bbox[2]} × ${bbox[3]}`,
                  area.toString()
                ];
              });
              
              // Crear tabla
              doc.autoTable({
                startY: 35,
                head: [['#', 'Clase', 'Confianza', 'Posición', 'Dimensiones', 'Área']],
                body: tableData,
                theme: 'striped',
                headStyles: {
                  fillColor: [52, 152, 219],
                  textColor: 255,
                  fontStyle: 'bold'
                },
                alternateRowStyles: {
                  fillColor: [240, 240, 240]
                },
                styles: {
                  overflow: 'linebreak',
                  cellWidth: 'auto',
                  fontSize: 9
                },
                columnStyles: {
                  0: {cellWidth: 10}, // #
                  1: {cellWidth: 40}, // Clase
                  2: {cellWidth: 25}, // Confianza
                  3: {cellWidth: 30}, // Posición
                  4: {cellWidth: 30}, // Dimensiones
                  5: {cellWidth: 20}  // Área
                }
              });
            } else {
              // Tabla manual si autoTable no está disponible
              doc.setFont("helvetica", "bold");
              doc.setFontSize(12);
              doc.text("ID", 20, 40);
              doc.text("Clase", 35, 40);
              doc.text("Confianza", 90, 40);
              doc.text("Posición", 130, 40);
              doc.text("Dimensiones", 170, 40);
              
              // Línea separadora
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.5);
              doc.line(20, 43, 190, 43);
              
              // Datos
              doc.setFont("helvetica", "normal");
              doc.setFontSize(10);
              
              y = 50;
              analysisData.detections.forEach((det, idx) => {
                // Obtener nombre de clase
                let className = `Clase ${det.class}`;
                if (window.classes && det.class < window.classes.length) {
                  className = window.classes[det.class];
                }
                
                // Formatear confianza
                const confidence = det.confidence > 1 
                  ? `${Math.min(det.confidence, 100).toFixed(1)}%` 
                  : `${(det.confidence * 100).toFixed(1)}%`;
                
                // Coordenadas redondeadas
                const bbox = det.bbox.map(v => Math.round(v));
                
                doc.text((idx + 1).toString(), 20, y);
                doc.text(className, 35, y);
                doc.text(confidence, 90, y);
                doc.text(`(${bbox[0]}, ${bbox[1]})`, 130, y);
                doc.text(`${bbox[2]} × ${bbox[3]}`, 170, y);
                
                y += 8;
                
                // Nueva página si es necesario
                if (y > 280) {
                  doc.addPage();
                  
                  // Repetir cabecera
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(12);
                  doc.text("ID", 20, 20);
                  doc.text("Clase", 35, 20);
                  doc.text("Confianza", 90, 20);
                  doc.text("Posición", 130, 20);
                  doc.text("Dimensiones", 170, 20);
                  
                  // Línea separadora
                  doc.setDrawColor(200, 200, 200);
                  doc.setLineWidth(0.5);
                  doc.line(20, 23, 190, 23);
                  
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(10);
                  
                  y = 30;
                }
              });
            }
            
            // PÁGINA 5: INFORMACIÓN DEL SISTEMA
            // ------------------------------------------------------------
            doc.addPage();
            
            // Título
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(44, 62, 80);
            doc.text("Información del Sistema", 20, 20);
            
            // Línea separadora
            doc.setDrawColor(52, 152, 219);
            doc.setLineWidth(0.5);
            doc.line(20, 25, 190, 25);
            
            // Sección 1: Detalles del sistema
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(60, 60, 60);
            doc.text("DIRD - Detección Inteligente de Retinopatía Diabética", 20, 40);
            doc.text(`Fecha de análisis: ${new Date().toLocaleDateString()}`, 20, 50);
            doc.text(`Hora: ${new Date().toLocaleTimeString()}`, 20, 60);
            
            // Sección 2: Modelo utilizado
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("Modelo de Detección", 20, 80);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.text("Modelo: DIRD v1", 20, 90);
            doc.text("Formato: ONNX", 20, 100);
            doc.text(`Clases detectables: ${window.classes ? window.classes.length : 'No disponible'}`, 20, 110);
            
            // Sección 3: Referencia de clases
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text("Referencia de Clases", 20, 130);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            
            y = 140;
            if (window.classes && window.classes.length > 0) {
              window.classes.forEach((className, index) => {
                doc.text(`Clase ${index}: ${className}`, 20, y);
                y += 8;
                
                if (y > 280) {
                  doc.addPage();
                  doc.setFont("helvetica", "bold");
                  doc.setFontSize(14);
                  doc.text("Referencia de Clases (continuación)", 20, 20);
                  
                  doc.setFont("helvetica", "normal");
                  doc.setFontSize(12);
                  y = 30;
                }
              });
            } else {
              doc.text("Información de clases no disponible", 20, y);
            }
            
            // Pie de página
            const totalPages = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
              doc.setPage(i);
              doc.setFont("helvetica", "normal");
              doc.setFontSize(8);
              doc.setTextColor(150, 150, 150);
              doc.text(`Página ${i} de ${totalPages}`, 105, 290, { align: 'center' });
              doc.text('DIRD - Sistema de Detección Inteligente de Retinopatía Diabética', 20, 290);
            }
            
            // Guardar PDF
            const filename = options.filename || `analisis_dird_${new Date().toISOString().slice(0, 10)}.pdf`;
            doc.save(filename);
            
            console.log("PDF generado correctamente con el exportador standalone");
            resolve(true);
          } catch (error) {
            console.error("Error en generación del PDF:", error);
            reject(error);
          }
        });
      }
    };
    
    /**
     * Recopila datos de análisis para el PDF
     * @returns {Object} Datos formateados para el exportador
     */
    function collectAnalysisData() {
      // Intentar obtener detecciones del modelo de salida directamente
      let detections = [];
      
      // Opción 1: Desde lastModelOutput actual
      if (window.lastModelOutput && window.processYoloOutputAuto) {
        try {
          detections = window.processYoloOutputAuto(window.lastModelOutput, {});
        } catch (error) {
          console.error("Error al procesar lastModelOutput:", error);
        }
      }
      
      // Opción 2: Desde variable global lastDetections
      if (detections.length === 0 && window.lastDetections) {
        detections = window.lastDetections;
      }
      
      // Opción 3: Intentar extraer información de los elementos dibujados en el canvas
      if (detections.length === 0) {
        const canvas = document.getElementById('outputCanvas');
        if (canvas) {
          try {
            // Este es un enfoque simplificado - en la realidad sería muy difícil
            // extraer las detecciones del canvas ya dibujado
            console.log("Extrayendo información del canvas");
          } catch (error) {
            console.error("Error extrayendo del canvas:", error);
          }
        }
      }
      
      // Crear una copia profunda para evitar problemas de referencia
      const detectionsCopy = JSON.parse(JSON.stringify(detections));
      
      // Calcular conteo por clase
      const classCounts = {};
      detectionsCopy.forEach(det => {
        let className = `Clase ${det.class}`;
        if (window.classes && det.class < window.classes.length) {
          className = window.classes[det.class];
        }
        
        if (!classCounts[className]) {
          classCounts[className] = 0;
        }
        classCounts[className]++;
      });
      
      // Calcular estadísticas
      const avgConfidence = detectionsCopy.length > 0 ?
        detectionsCopy.reduce((sum, det) => sum + (det.confidence > 1 ? det.confidence / 100 : det.confidence), 0) / 
        detectionsCopy.length * 100 : 0;
      
      // Construir objeto de datos
      return {
        detections: detectionsCopy,
        classCounts: classCounts,
        summary: {
          avgConfidence: avgConfidence,
          classCount: Object.keys(classCounts).length,
          date: new Date().toISOString()
        },
        imageInfo: {
          date: new Date().toISOString(),
          name: document.getElementById('fileInput')?.files[0]?.name || 'imagen_sin_nombre.jpg'
        }
      };
    }
    
    console.log("✓ Exportador PDF standalone mejorado inicializado");
  })();