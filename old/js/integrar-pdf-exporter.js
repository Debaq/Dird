// integrar-pdf-exporter.js
// Script para integrar el botón de exportación a PDF en la interfaz

/**
 * Inicializa y configura el botón de exportación a PDF
 */
function initPDFExportButton() {
    // Crear el botón de exportación
    const exportBtn = document.createElement('button');
    exportBtn.id = 'exportPdfBtn';
    exportBtn.textContent = 'Descargar PDF';
    exportBtn.className = 'action-button pdf-export-btn';
    exportBtn.style.cssText = `
        padding: 8px 15px;
        background-color: #2ecc71;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        margin-top: 10px;
        margin-left: 10px;
        display: none;
    `;
    
    // Añadir ícono (opcional)
    exportBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="12" y1="18" x2="12" y2="12"></line>
            <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        Descargar PDF
    `;
    
    // Insertar el botón en la interfaz
    // Buscar contenedor adecuado (junto a otros controles)
    const controlsContainer = document.querySelector('.controls');
    if (controlsContainer) {
        // Crear un contenedor para el botón en los controles
        const btnContainer = document.createElement('div');
        btnContainer.className = 'control-group';
        btnContainer.style.marginTop = '15px';
        btnContainer.style.textAlign = 'center';
        btnContainer.appendChild(exportBtn);
        
        controlsContainer.appendChild(btnContainer);
    } else {
        // Alternativa: insertar después del botón de procesamiento
        const uploadBtn = document.getElementById('uploadBtn');
        if (uploadBtn && uploadBtn.parentNode) {
            uploadBtn.parentNode.insertBefore(exportBtn, uploadBtn.nextSibling);
        } else {
            // Última opción: añadir al final del resultContainer
            const resultContainer = document.getElementById('resultContainer');
            if (resultContainer) {
                resultContainer.appendChild(exportBtn);
            }
        }
    }
    
    // Configurar evento de clic
    exportBtn.addEventListener('click', handlePDFExport);
    
    // Escuchar eventos de finalización de procesamiento para mostrar/ocultar el botón
    document.addEventListener('yolo-processing-complete', function(event) {
        exportBtn.style.display = 'inline-block';
    });
    
    console.log('Botón de exportación PDF inicializado correctamente');
}

/**
 * Maneja el evento de exportación a PDF
 */
async function handlePDFExport() {
    try {
        // Mostrar indicador visual
        const exportBtn = document.getElementById('exportPdfBtn');
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = `
            <span class="spinner-small"></span> Generando PDF...
        `;
        exportBtn.disabled = true;
        
        // Recopilar datos para el PDF
        const analysisData = collectAnalysisData();
        
        // Verificar que el exportador está disponible
        if (!window.PDFExporter || !window.PDFExporter.exportAnalysis) {
            throw new Error('El módulo exportador de PDF no está disponible');
        }
        
        // Configurar opciones
        const options = {
            filename: `analisis_dird_${new Date().toISOString().slice(0, 10)}.pdf`,
            content: {
                includeCharts: true,
                includeThumbnails: true,
                thumbnailSize: 100
            }
        };
        
        // Exportar a PDF
        const success = await window.PDFExporter.exportAnalysis(analysisData, options);
        
        if (success) {
            showNotification('PDF generado correctamente', 'success');
        } else {
            showNotification('Hubo un problema al generar el PDF', 'warning');
        }
    } catch (error) {
        console.error('Error al exportar a PDF:', error);
        showNotification('Error al generar el PDF: ' + error.message, 'error');
    } finally {
        // Restaurar botón
        const exportBtn = document.getElementById('exportPdfBtn');
        exportBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 5px;">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            Descargar PDF
        `;
        exportBtn.disabled = false;
    }
}

/**
 * Recopila datos de análisis para el PDF
 * @returns {Object} Datos formateados para el exportador de PDF
 */
function collectAnalysisData() {
    // Detecciones actuales
    const detections = window.lastModelOutput ? 
        processYoloOutputAuto(window.lastModelOutput, {}) : 
        [];
    
    // Crear copia para evitar modificar el original
    const detectionsCopy = JSON.parse(JSON.stringify(detections));
    
    // Conteo por clase
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
    const analysisData = {
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
    
    return analysisData;
}

/**
 * Muestra una notificación en pantalla
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación ('success', 'warning', 'error', 'info')
 */
function showNotification(message, type = 'info') {
    // Verificar si ya existe un contenedor de notificaciones
    let notificationContainer = document.getElementById('notificationContainer');
    
    if (!notificationContainer) {
        // Crear contenedor si no existe
        notificationContainer = document.createElement('div');
        notificationContainer.id = 'notificationContainer';
        notificationContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 300px;
        `;
        document.body.appendChild(notificationContainer);
    }
    
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        padding: 15px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        font-size: 14px;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    // Configurar colores según el tipo
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#d4edda';
            notification.style.color = '#155724';
            notification.style.borderLeft = '4px solid #28a745';
            break;
        case 'warning':
            notification.style.backgroundColor = '#fff3cd';
            notification.style.color = '#856404';
            notification.style.borderLeft = '4px solid #ffc107';
            break;
        case 'error':
            notification.style.backgroundColor = '#f8d7da';
            notification.style.color = '#721c24';
            notification.style.borderLeft = '4px solid #dc3545';
            break;
        default:
            notification.style.backgroundColor = '#cce5ff';
            notification.style.color = '#004085';
            notification.style.borderLeft = '4px solid #007bff';
    }
    
    // Contenido
    notification.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>${message}</span>
            <button style="background: none; border: none; cursor: pointer; font-size: 16px;">&times;</button>
        </div>
    `;
    
    // Añadir al contenedor
    notificationContainer.appendChild(notification);
    
    // Mostrar con animación
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 10);
    
    // Configurar botón de cierre
    const closeBtn = notification.querySelector('button');
    closeBtn.addEventListener('click', () => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notificationContainer.removeChild(notification);
        }, 300);
    });
    
    // Cerrar automáticamente después de 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notificationContainer.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

/**
 * Verifica si el módulo exportador de PDF está cargado
 * @returns {boolean} True si el módulo está disponible
 */
function isPDFExporterAvailable() {
    return Boolean(window.PDFExporter && window.PDFExporter.exportAnalysis);
}

/**
 * Carga dinámicamente las dependencias del exportador de PDF
 */
async function loadPDFExporterDependencies() {
    try {
        // Verificar si jspdf ya está cargado
        if (typeof jspdf === 'undefined' && typeof jsPDF === 'undefined' && typeof window.jsPDF === 'undefined') {
            // Cargar jsPDF
            console.log('Cargando jsPDF...');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        
        // Verificar si autoTable ya está cargado (opcional)
        if (typeof jspdf !== 'undefined' && typeof jspdf.jsPDF !== 'undefined' && 
            typeof jspdf.jsPDF.API.autoTable === 'undefined') {
            // Cargar el plugin autoTable
            console.log('Cargando jsPDF-AutoTable...');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js');
        }
        
        // Verificar si el exportador ya está cargado
        if (!isPDFExporterAvailable()) {
            console.log('Cargando módulo PDF Exporter...');
            await loadScript('js/exporter-pdf/index.js');
        }
        
        // Inicializar botón de exportación si todo está cargado correctamente
        if (isPDFExporterAvailable()) {
            console.log('Módulo PDF Exporter cargado correctamente');
            initPDFExportButton();
        } else {
            console.error('No se pudo cargar el módulo PDF Exporter');
        }
    } catch (error) {
        console.error('Error al cargar dependencias:', error);
    }
}

/**
 * Carga un script externo de forma asíncrona
 * @param {string} src - URL del script
 * @returns {Promise} Promesa que se resuelve cuando el script está cargado
 */
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Agregar estilo para el spinner
    const style = document.createElement('style');
    style.textContent = `
        .spinner-small {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s linear infinite;
            margin-right: 5px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .pdf-export-btn:hover {
            background-color: #27ae60;
        }
        
        .pdf-export-btn:disabled {
            background-color: #95a5a6;
            cursor: not-allowed;
        }
    `;
    document.head.appendChild(style);
    
    // Cargar dependencias
    loadPDFExporterDependencies();
});