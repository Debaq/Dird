// simple-pdf-button-enhanced.js - Botón de PDF mejorado
(function() {
    // Crear estilo para el botón
    const style = document.createElement('style');
    style.textContent = `
      .pdf-export-btn {
        padding: 8px 15px;
        background-color: #2ecc71;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin: 10px;
        display: flex;
        align-items: center;
        transition: background-color 0.3s ease;
      }
      
      .pdf-export-btn:hover {
        background-color: #27ae60;
      }
      
      .pdf-export-btn:active {
        background-color: #229954;
      }
      
      .pdf-export-btn svg {
        margin-right: 8px;
      }
      
      .spinner-pdf {
        display: inline-block;
        width: 12px;
        height: 12px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 1s linear infinite;
        margin-right: 8px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Notificaciones */
      #pdfNotification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background-color: #d4edda;
        color: #155724;
        border-left: 4px solid #28a745;
        border-radius: 4px;
        z-index: 9999;
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s ease;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }
      
      .pdf-notification-error {
        background-color: #f8d7da !important;
        color: #721c24 !important;
        border-left: 4px solid #dc3545 !important;
      }
      
      .pdf-appear {
        animation: pdf-appear 0.3s forwards;
      }
      
      @keyframes pdf-appear {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    // Función para crear e insertar el botón
    function createExportButton() {
      // Verificar si el botón ya existe
      if (document.getElementById('pdfExportBtn')) {
        return;
      }
      
      // Crear el botón
      const exportBtn = document.createElement('button');
      exportBtn.id = 'pdfExportBtn';
      exportBtn.className = 'pdf-export-btn';
      exportBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="12" y1="18" x2="12" y2="12"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        Descargar PDF
      `;
      
      // Añadir evento de clic
      exportBtn.addEventListener('click', handlePdfExport);
      
      // Buscar el mejor lugar para insertar el botón
      let targetContainer = null;
      
      // Opciones en orden de preferencia:
      const options = [
        // 1. En la sección de controles
        document.querySelector('.controls'),
        
        // 2. Después de los controles existentes
        document.querySelector('.control-group:last-child'),
        
        // 3. En el contenedor de resultados
        document.getElementById('resultContainer'),
        
        // 4. Antes del contenedor de resultados
        document.getElementById('resultContainer')?.previousElementSibling
      ];
      
      // Encontrar el primer contenedor válido
      for (const container of options) {
        if (container) {
          targetContainer = container;
          break;
        }
      }
      
      // Si encontramos un contenedor, insertar el botón
      if (targetContainer) {
        // Verificar si es el contenedor de resultados para un manejo especial
        if (targetContainer.id === 'resultContainer') {
          const controlContainer = document.createElement('div');
          controlContainer.style.textAlign = 'center';
          controlContainer.style.margin = '10px 0';
          controlContainer.appendChild(exportBtn);
          
          // Insertar al principio del contenedor
          if (targetContainer.firstChild) {
            targetContainer.insertBefore(controlContainer, targetContainer.firstChild);
          } else {
            targetContainer.appendChild(controlContainer);
          }
        } else {
          // Para otros contenedores, simplemente añadir
          targetContainer.appendChild(exportBtn);
        }
        
        console.log(`✓ Botón de exportación PDF añadido a ${targetContainer.className || targetContainer.id}`);
      } else {
        // Última opción: añadir al body
        document.body.appendChild(exportBtn);
        console.log('✓ Botón de exportación PDF añadido al body');
      }
    }
    
    // Función para manejar la exportación a PDF
    async function handlePdfExport(event) {
      event.preventDefault();
      
      const exportBtn = document.getElementById('pdfExportBtn');
      if (!exportBtn) return;
      
      // Cambiar el botón a estado de carga
      const originalContent = exportBtn.innerHTML;
      exportBtn.innerHTML = `
        <span class="spinner-pdf"></span>
        Generando PDF...
      `;
      exportBtn.disabled = true;
      
      try {
        // Verificar si tenemos acceso al exportador
        if (!window.PDFExporter || !window.PDFExporter.exportAnalysis) {
          throw new Error("Módulo exportador de PDF no disponible");
        }
        
        // Recolectar datos actualizados
        const analysisData = collectAnalysisData();
        console.log("Datos recolectados para el PDF:", analysisData);
        
        // Opciones para el PDF
        const options = {
          filename: `analisis_dird_${new Date().toISOString().slice(0, 10)}.pdf`
        };
        
        // Mostrar notificación de proceso
        showNotification("Generando PDF completo...", "info");
        
        // Generar el PDF
        const success = await window.PDFExporter.exportAnalysis(analysisData, options);
        
        if (success) {
          // Mostrar mensaje de éxito
          showNotification("PDF generado correctamente", "success");
        } else {
          // Mostrar mensaje de error
          showNotification("Hubo un problema al generar el PDF", "warning");
        }
      } catch (error) {
        console.error('Error al exportar a PDF:', error);
        showNotification(`Error al generar el PDF: ${error.message}`, "error");
      } finally {
        // Restaurar el botón
        exportBtn.innerHTML = originalContent;
        exportBtn.disabled = false;
      }
    }
    
    // Función para recolectar datos para el PDF
    function collectAnalysisData() {
      // Intentar obtener detecciones del modelo de salida directamente
      let detections = [];
      
      // Opción 1: Desde lastModelOutput actual
      if (window.lastModelOutput && window.processYoloOutputAuto) {
        try {
          // Obtener los controles actuales
          const confidenceThreshold = document.getElementById('confidenceThreshold')?.value || 0.25;
          const nmsThreshold = document.getElementById('nmsThreshold')?.value || 0.45;
          
          detections = window.processYoloOutputAuto(window.lastModelOutput, {
            confidenceThreshold: parseFloat(confidenceThreshold),
            nmsThreshold: parseFloat(nmsThreshold)
          });
        } catch (error) {
          console.error("Error al procesar lastModelOutput:", error);
        }
      }
      
      // Opción 2: Desde variable global lastDetections
      if (detections.length === 0 && window.lastDetections) {
        detections = window.lastDetections;
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
      
      // Obtener información del archivo
      const fileInput = document.getElementById('fileInput');
      const fileName = fileInput?.files?.[0]?.name || 'imagen_sin_nombre.jpg';
      const fileSize = fileInput?.files?.[0]?.size || 0;
      
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
          name: fileName,
          size: fileSize
        }
      };
    }
    
    // Función para mostrar notificaciones
    function showNotification(message, type = "success") {
      // Eliminar notificación anterior si existe
      const existingNotification = document.getElementById('pdfNotification');
      if (existingNotification) {
        document.body.removeChild(existingNotification);
      }
      
      // Crear nueva notificación
      const notification = document.createElement('div');
      notification.id = 'pdfNotification';
      notification.textContent = message;
      
      // Aplicar estilo según el tipo
      if (type === "error") {
        notification.classList.add('pdf-notification-error');
      }
      
      // Añadir al body
      document.body.appendChild(notification);
      
      // Trigger reflow para aplicar la animación
      notification.offsetWidth;
      
      // Mostrar notificación
      notification.classList.add('pdf-appear');
      notification.style.opacity = '1';
      
      // Ocultar después de 5 segundos
      setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 300);
      }, 4000);
    }
    
    // Detectar cuando el resultado está listo
    function setupResultsObserver() {
      // Observar cambios en el contenedor de resultados
      const resultContainer = document.getElementById('resultContainer');
      if (resultContainer) {
        // Observar cambios en la propiedad display
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && 
                mutation.attributeName === 'style' &&
                getComputedStyle(resultContainer).display !== 'none') {
              // El contenedor de resultados se ha hecho visible
              setTimeout(createExportButton, 500); // Pequeño retraso para asegurar que todo está listo
            }
          });
        });
        
        // Configurar observación
        observer.observe(resultContainer, { attributes: true });
        
        // Si ya está visible, crear el botón de inmediato
        if (getComputedStyle(resultContainer).display !== 'none') {
          createExportButton();
        }
      }
      
      // También escuchar el evento personalizado si existe
      document.addEventListener('yolo-processing-complete', function(event) {
        createExportButton();
      });
    }
    
    // Inicialización
    function init() {
      // Configurar observador para detectar cuando los resultados estén disponibles
      setupResultsObserver();
      
      // También escuchar clics en el botón de procesamiento
      const uploadBtn = document.getElementById('uploadBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
          // Esperar a que termine el procesamiento
          setTimeout(function checkResults() {
            const resultContainer = document.getElementById('resultContainer');
            if (resultContainer && getComputedStyle(resultContainer).display !== 'none') {
              createExportButton();
            } else {
              // Verificar de nuevo en 500ms (hasta un máximo de 10 segundos)
              setTimeout(checkResults, 500);
            }
          }, 1000);
        });
      }
      
      console.log("✓ Sistema de exportación PDF mejorado inicializado");
    }
    
    // Ejecutar después de que se haya cargado la página
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();