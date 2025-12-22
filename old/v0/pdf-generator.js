/**
 * pdf-generator.js
 * Funciones para la generación del informe PDF
 */

/**
 * Clase de diálogo para mostrar progreso
 */
class ProgressDialog {
    constructor() {
        this.dialog = null;
        this.progressBar = null;
        this.messageElement = null;
        this.cancelButton = null;
        this.isCancelled = false;
        this.createDialog();
    }
    
    createDialog() {
        // Crear el diálogo si no existe
        if (this.dialog) return;
        
        // Crear elementos
        this.dialog = document.createElement('div');
        this.dialog.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;
        
        const dialogContent = document.createElement('div');
        dialogContent.style.cssText = `
            background-color: #fff;
            padding: 20px;
            border-radius: 8px;
            width: 80%;
            max-width: 500px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        `;
        
        const title = document.createElement('h3');
        title.textContent = 'Generando Informe PDF';
        title.style.marginTop = '0';
        
        this.messageElement = document.createElement('p');
        this.messageElement.textContent = 'Preparando...';
        
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            width: 100%;
            background-color: #e0e0e0;
            border-radius: 4px;
            margin: 10px 0;
        `;
        
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            height: 20px;
            width: 0%;
            background-color: #4CAF50;
            border-radius: 4px;
            transition: width 0.3s;
        `;
        
        this.cancelButton = document.createElement('button');
        this.cancelButton.textContent = 'Cancelar';
        this.cancelButton.style.cssText = `
            background-color: #f44336;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            float: right;
            margin-top: 10px;
        `;
        
        // Ensamblar
        progressContainer.appendChild(this.progressBar);
        dialogContent.appendChild(title);
        dialogContent.appendChild(this.messageElement);
        dialogContent.appendChild(progressContainer);
        dialogContent.appendChild(this.cancelButton);
        this.dialog.appendChild(dialogContent);
        
        // Evento para cancelar
        this.cancelButton.addEventListener('click', () => {
            this.isCancelled = true;
            this.hide();
        });
    }
    
    show() {
        document.body.appendChild(this.dialog);
        this.isCancelled = false;
    }
    
    hide() {
        if (this.dialog.parentNode) {
            document.body.removeChild(this.dialog);
        }
    }
    
    updateProgress(message, percent) {
        this.messageElement.textContent = message;
        this.progressBar.style.width = `${percent}%`;
    }
    
    isCanceled() {
        return this.isCancelled;
    }
}

/**
 * Genera un informe PDF con los resultados del análisis
 */
async function generatePDFReport() {
    if (!imageFile || !model) {
        alert('Primero debe cargar un modelo y analizar una imagen.');
        return;
    }
    
    // Crear diálogo de progreso
    const progressDialog = new ProgressDialog();
    progressDialog.show();
    
    try {
        // Actualizar progreso
        const updateProgress = (message, percent) => {
            progressDialog.updateProgress(message, percent);
            
            // Verificar si se canceló la operación
            if (progressDialog.isCanceled()) {
                throw new Error('Operación cancelada por el usuario');
            }
        };
        
        updateProgress('Inicializando generación del informe...', 5);
        
        // Crear el generador de informes
        const reportGen = new ReportGenerator();
        
        // Configurar información del modelo
        updateProgress('Preparando información del modelo...', 10);
        const modelName = modelSelectorEl.value || 'Modelo personalizado';
        reportGen.setModelInfo({
            name: modelName,
            date: new Date().toLocaleString(),
            confidenceThreshold: 0.25, // Umbral de confianza usado
            otherParams: {
                'NMS Threshold': '0.7',
                'Tamaño de entrada': '640x640',
                'Clases cargadas': modelClasses ? 'Sí' : 'No'
            }
        });
        
        // Preparar información de la imagen
        updateProgress('Preparando información de la imagen...', 15);
        const fileSizeMB = (imageFile.size / (1024 * 1024)).toFixed(2);
        reportGen.setImageInfo({
            name: imageFile.name,
            width: resultCanvasEl.width,
            height: resultCanvasEl.height,
            fileSize: imageFile.size
        });
        
        // Generar canvas para el informe (con etiquetas)
        updateProgress('Procesando imagen y detecciones...', 25);
        // Usar las detecciones existentes en lugar de detectar de nuevo
        const reportCanvas = await draw_image_for_report(imageFile, detectedBoxes.map(box => [
            box.x1, box.y1, box.x2, box.y2, box.label, box.probability, box.classId
        ]));
        reportGen.setCanvasImage(reportCanvas);
        
        // Cargar la imagen original para las miniaturas
        updateProgress('Preparando miniaturas para las detecciones...', 35);
        await reportGen.loadOriginalImage(URL.createObjectURL(imageFile));
        
        // Establecer las detecciones (incluyendo las filtradas)
        updateProgress('Organizando datos de detecciones...', 45);
        reportGen.setDetections(allDetections);
        
        // Generar el informe PDF con callback de progreso
        updateProgress('Generando informe PDF...', 50);
        await reportGen.generateReport('informe_analisis_DIRD.pdf', updateProgress);
        
        // Ocultar diálogo de progreso
        progressDialog.updateProgress('Informe PDF generado con éxito.', 100);
        setTimeout(() => {
            progressDialog.hide();
            alert('Informe PDF generado con éxito.');
        }, 1000);
    } catch (error) {
        // Ocultar diálogo de progreso
        progressDialog.hide();
        
        if (error.message === 'Operación cancelada por el usuario') {
            console.log('Generación de PDF cancelada por el usuario');
        } else {
            console.error('Error al generar el informe:', error);
            alert('Error al generar el informe: ' + error.message);
        }
    }
}

// Asegurar que el botón de generar informe tiene el event listener correcto
document.addEventListener('DOMContentLoaded', () => {
    const generateReportBtn = document.getElementById('generateReport');
    if (generateReportBtn) {
        // Eliminar event listeners anteriores para evitar duplicados
        const newBtn = generateReportBtn.cloneNode(true);
        generateReportBtn.parentNode.replaceChild(newBtn, generateReportBtn);
        
        // Agregar nuevo event listener
        newBtn.addEventListener('click', generatePDFReport);
        console.log('Event listener para generación de PDF configurado correctamente');
    } else {
        console.warn('No se encontró el botón de generar informe');
    }
});