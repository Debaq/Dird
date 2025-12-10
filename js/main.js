// Función principal de procesamiento
async function processImage () {
  try {
    // Limpiar depuración anterior
    if (DEBUG_MODE) {
      debugInfo.innerHTML = ''
      debugInfo.style.display = 'block'
    }

    // Mostrar el spinner de carga
    loadingSpinner.style.display = 'block'
    resultContainer.style.display = 'none'
    errorMessage.style.display = 'none'

    logDebug('Iniciando procesamiento de imagen')

    // Asegurarse de que el modelo esté cargado
    if (!modelLoaded) {
      logDebug('Cargando modelo ONNX...')
      await loadOnnxModel()
      modelLoaded = true
    }

    const file = fileInput.files[0]
    logDebug(`Procesando archivo: ${file.name} (${file.size} bytes)`)

    // Cargar la imagen
    const imageURL = URL.createObjectURL(file)
    lastProcessedImage = imageURL

    // Procesar la imagen con YOLO (redimensionar y detectar)
    await processYoloDetection(imageURL)

    // Mostrar los resultados
    resultContainer.style.display = 'block'
    logDebug('Procesamiento completado')
  } catch (error) {
    showError('Error al procesar la imagen: ' + error.message)
    console.error(error)
  } finally {
    loadingSpinner.style.display = 'none'
  }
}

// Carga del modelo al inicio
window.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Iniciando carga del modelo DIRDv1-ONNX...')
    await loadOnnxModel()
    console.log('Modelo DIRDv1-ONNX cargado correctamente al inicio')
    modelLoaded = true
    modelLoading = false
    // Ocultar mensaje de carga
    // Mostrar interfaz de carga
    toggleUploadInterface(true)
    // Mostrar un mensaje informativo que desaparecerá
    showInfo("Sistema listo para comenzar");
    // Notificar al usuario que el sistema está listo
    console.log('Sistema listo para procesar imágenes')
  } catch (error) {
    console.error('Error al cargar el modelo ONNX:', error)
    // Ocultar mensaje de carga

    showError('Error al cargar el modelo, Por favor, intente recargar la página o contacte con el administrador si el problema persiste');
    

    // Insertar después del área de carga
    const uploadContainer = document.getElementById('dropArea')
    if (uploadContainer && uploadContainer.parentNode) {
      uploadContainer.parentNode.insertBefore(
        errorDiv,
        uploadContainer.nextSibling
      )
    } else {
      // Alternativa: añadir al body
      document.body.appendChild(errorDiv)
    }
  }
})
 
// Inicialización de componentes
function initializeApplication () {
  // Primero, inicializar la interfaz de usuario
  initUI()
  // Registrar event listeners para la interfaz de usuario
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
  uploadBtn.addEventListener('click', processImage)

  // Configurar sliders y sus event listeners
  if (maxDetectionsSlider) {
    maxDetectionsSlider.addEventListener('input', function () {
      maxDetectionsValueDisplay.textContent = this.value
    })
    maxDetectionsSlider.addEventListener('change', reprocessLastImage)
  }

  // Verificación de existencia de elementos antes de agregar listeners
  if (confidenceThresholdSlider) {
    confidenceThresholdSlider.addEventListener('input', function () {
      confidenceValueDisplay.textContent = parseFloat(this.value).toFixed(5)
    })
    confidenceThresholdSlider.addEventListener('change', reprocessLastImage)
  }

  if (confidenceMultiplierSlider) {
    confidenceMultiplierSlider.addEventListener('input', function () {
      multiplierValueDisplay.textContent = this.value
    })
    confidenceMultiplierSlider.addEventListener('change', reprocessLastImage)
  }

  if (nmsThresholdSlider) {
    nmsThresholdSlider.addEventListener('input', function () {
      nmsValueDisplay.textContent = this.value
    })
    nmsThresholdSlider.addEventListener('change', reprocessLastImage)
  }

  // Configuración del botón de depuración avanzada
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

  // Iniciar con interfaz limpia
  loadingSpinner.style.display = 'none'
  resultContainer.style.display = 'none'
  errorMessage.style.display = 'none'

  if (DEBUG_MODE) {
    debugInfo.style.display = 'block'
  } else {
    debugInfo.style.display = 'none'
  }

  console.log('Aplicación inicializada correctamente')
}

// Función de debounce para evitar múltiples ejecuciones seguidas
function debounce (func, wait) {
  let timeout
  return function () {
    const context = this
    const args = arguments
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      func.apply(context, args)
    }, wait)
  }
}

// Iniciar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', initializeApplication)

// Exportamos la función a window para accederla desde zoom.js
window.reprocessLastImage = async function () {
  if (lastProcessedImage) {
    // Asegurarse de que el contenedor de resultados esté visible
    resultContainer.style.display = 'block'
    // Recuperar el canvas original
    const outputCanvas = document.getElementById('outputCanvas')
    if (outputCanvas) {
      outputCanvas.style.display = 'block' // Asegurarse de que sea visible para el redimensionado
    }

    await processYoloDetection(lastProcessedImage)

    if (outputCanvas) {
      outputCanvas.style.display = 'none' // Ocultar después del procesamiento
    }
  }
}
