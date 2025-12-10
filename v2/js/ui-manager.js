// Al principio del archivo, solo declarar variables
let dropArea,
  fileInput,
  uploadBtn,
  loadingSpinner,
  resultContainer,
  outputCanvas,
  errorMessage,
  infoMessage
let confidenceThresholdSlider, confidenceMultiplierSlider, nmsThresholdSlider
let confidenceValueDisplay, multiplierValueDisplay, nmsValueDisplay
let maxDetectionsSlider, maxDetectionsValueDisplay
let debugInfo

function initUI () {
  // Elementos del DOM
  dropArea = document.getElementById('dropArea')
  fileInput = document.getElementById('fileInput')
  uploadBtn = document.getElementById('uploadBtn')
  loadingSpinner = document.getElementById('loadingSpinner')
  resultContainer = document.getElementById('resultContainer')
  outputCanvas = document.getElementById('outputCanvas')
  errorMessage = document.getElementById('errorMessage')
  infoMessage = document.getElementById('infoMessage')
  debugInfo = document.getElementById('debugInfo')

  

  // Elementos de visualización de valores - MUEVE ESTA SECCIÓN ANTES DE USARLOS
  confidenceValueDisplay = document.getElementById('confidenceValue')
  multiplierValueDisplay = document.getElementById('multiplierValue')
  nmsValueDisplay = document.getElementById('nmsValue')
  maxDetectionsSlider = document.getElementById('maxDetections')
  maxDetectionsValueDisplay = document.getElementById('maxDetectionsValue')

  // Controles de detección
  confidenceThresholdSlider = document.getElementById('confidenceThreshold')
  confidenceMultiplierSlider = document.getElementById('confidenceMultiplier')
  nmsThresholdSlider = document.getElementById('nmsThreshold')

  // Verificación de existencia de elementos
  const requiredElements = [
    dropArea,
    fileInput,
    uploadBtn,
    loadingSpinner,
    resultContainer,
    outputCanvas,
    errorMessage,
    infoMessage,
    debugInfo,
    confidenceValueDisplay,
    multiplierValueDisplay,
    nmsValueDisplay,
    maxDetectionsSlider,
    maxDetectionsValueDisplay,
    confidenceThresholdSlider,
    confidenceMultiplierSlider,
    nmsThresholdSlider
  ]

  const missingElements = requiredElements.filter(el => !el)
  if (missingElements.length > 0) {
    console.error('Elementos de interfaz faltantes:', missingElements)
    return
  }
 
  // Configurar multiplicador de confianza
  confidenceMultiplierSlider.min = '1'
  confidenceMultiplierSlider.max = '10'
  confidenceMultiplierSlider.step = '0.5'
  confidenceMultiplierSlider.value = '1'

  // IMPORTANTE: Asegurarse de que multiplierValueDisplay está definido antes de usarlo
  if (multiplierValueDisplay) {
    multiplierValueDisplay.textContent = '1'
  }
  // IMPORTANTE: Mover todos los event listeners aquí dentro
  // Eventos para subir archivos
  dropArea.addEventListener('click', () => fileInput.click())

  dropArea.addEventListener('dragover', e => {
    e.preventDefault()
    dropArea.style.borderColor = '#999'
  })

  dropArea.addEventListener('dragleave', () => {
    dropArea.style.borderColor = '#ccc'
  })

  dropArea.addEventListener('drop', e => {
    e.preventDefault()
    dropArea.style.borderColor = '#ccc'

    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files
      validateFile()
    }
  })

  fileInput.addEventListener('change', validateFile)

  // Procesar la imagen cuando se hace clic en el botón
  uploadBtn.addEventListener('click', processImage)

  // Configuración de sliders
  maxDetectionsSlider.addEventListener('input', function () {
    maxDetectionsValueDisplay.textContent = this.value
  })

  maxDetectionsSlider.addEventListener('change', reprocessLastImage)

  // Actualizar visualización de valores
  confidenceThresholdSlider.addEventListener('input', function () {
    confidenceValueDisplay.textContent = parseFloat(this.value).toFixed(5)
  })

  confidenceMultiplierSlider.addEventListener('input', function () {
    multiplierValueDisplay.textContent = this.value
  })

  nmsThresholdSlider.addEventListener('input', function () {
    nmsValueDisplay.textContent = this.value
  })

  // Volver a procesar la imagen al cambiar los controles
  confidenceThresholdSlider.addEventListener('change', reprocessLastImage)
  confidenceMultiplierSlider.addEventListener('change', reprocessLastImage)
  nmsThresholdSlider.addEventListener('change', reprocessLastImage)

  // Configurar botón de depuración avanzada
  const advancedDebugBtn = document.getElementById('advancedDebugBtn')
  if (advancedDebugBtn) {
    advancedDebugBtn.addEventListener('click', function () {
      if (lastModelOutput) {
        displayModelOutputVisualization(lastModelOutput)
      } else {
        alert(
          'No hay datos de modelo para visualizar. Procesa una imagen primero.'
        )
      }
    })
  }
}

//document.addEventListener('DOMContentLoaded', initUI)

// Funciones que no dependen directamente de los elementos DOM
function validateFile () {
  errorMessage.style.display = 'none'
  uploadBtn.disabled = true

  if (fileInput.files.length === 0) return

  const file = fileInput.files[0]
  if (!file.type.match('image.*')) {
    showError('Por favor, selecciona un archivo de imagen válido.')
    return
  }

  uploadBtn.disabled = false
}

function showError (message) {
  errorMessage.textContent = message
  errorMessage.style.display = 'block'
  loadingSpinner.style.display = 'none'
  logDebug(`ERROR: ${message}`)
}


function showInfo(message, duration = 3000) {
  // Asegúrate de que estas propiedades CSS estén definidas para infoMessage
  // transition: opacity 0.5s ease;
  
  infoMessage.textContent = message
  infoMessage.style.display = 'block'
  infoMessage.style.opacity = '1'
  loadingSpinner.style.display = 'none'
  logDebug(`AVISO: ${message}`)
  
  setTimeout(() => {
    infoMessage.style.opacity = '0'
    
    // Ocultar completamente después de la transición
    setTimeout(() => {
      infoMessage.style.display = 'none'
    }, 500)
  }, duration)
}

function toggleDocumentation () {
  const docContent = `
        <h2>Documentación</h2>
        <h3>Cómo utilizar el detector</h3>
        <p>1. Sube una imagen médica mediante el área de arrastrar y soltar.</p>
        <p>2. Ajusta los parámetros de detección según sea necesario:</p>
        <ul>
            <li><strong>Umbral de confianza:</strong> Define la sensibilidad del detector.</li>
            <li><strong>Umbral NMS:</strong> Controla la supresión de detecciones redundantes.</li>
            <li><strong>Máximo de detecciones:</strong> Limita el número de objetos a detectar.</li>
        </ul>
        <p>3. Haz clic en "Procesar Imagen" para iniciar la detección.</p>
        <p>4. Los resultados se mostrarán con recuadros de colores que indican los elementos detectados.</p>
    `

  showModal('Documentación', docContent)
}

function toggleAbout () {
  const aboutContent = `
        <h2>Acerca del Proyecto DIRD</h2>
        <p>Este proyecto implementa un modelo de detección de imágenes médicas basado en la arquitectura YOLO (You Only Look Once), 
        exportado a formato ONNX para su ejecución en navegadores web.</p>
        <p>Características principales:</p>
        <ul>
            <li>Procesamiento completo en el lado del cliente (sin enviar imágenes a servidores)</li>
            <li>Detección de elementos específicos en imágenes médicas</li>
            <li>Interfaz de usuario intuitiva para ajuste de parámetros</li>
            <li>Herramientas de depuración avanzada para análisis técnico</li>
        </ul>
        <p>Desarrollado como parte del proyecto de investigación DIRD.</p>
    `

  showModal('Acerca del Proyecto', aboutContent)
}

function showModal (title, content) {
  // Crear el modal si no existe
  let modal = document.getElementById('infoModal')

  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'infoModal'
    modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
        `

    document.body.appendChild(modal)
  }

  // Crear el contenido del modal
  modal.innerHTML = `
        <div style="background-color: white; max-width: 600px; padding: 20px; border-radius: 5px; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="margin: 0;">${title}</h2>
                <button onclick="document.getElementById('infoModal').style.display = 'none';" 
                style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div>${content}</div>
        </div>
    `

  modal.style.display = 'flex'
}

// Ahora todo lo relacionado con DOMContentLoaded está centralizado en la función initUI
