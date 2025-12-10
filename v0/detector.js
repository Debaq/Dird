/**
 * detector.js
 * Funcionalidad principal para la detección de objetos con YOLOv8
 */

// Variables globales
let model = null
let modelClasses = null // null indica que no hay clases definidas
let allDetections = [] // Almacena todas las detecciones, incluso las filtradas
let imageFile = null // Almacena la referencia al archivo de imagen analizado

// Elementos del DOM
const modelSelectorEl = document.getElementById('modelSelector')
const loadServerModelBtn = document.getElementById('loadServerModel')
const modelUploadEl = document.getElementById('modelUpload')
const imageUploadEl = document.getElementById('imageUpload')
const resultCanvasEl = document.getElementById('resultCanvas')
const modelStatusEl = document.getElementById('modelStatus')
const modelLoadingEl = document.getElementById('modelLoading')
const imageLoadingEl = document.getElementById('imageLoading')
const tooltipEl = document.getElementById('tooltip')
const generateReportBtn = document.getElementById('generateReport')

// Almacenar las cajas detectadas para el manejo de eventos de mouse
let detectedBoxes = []
// Variable para almacenar la URL de la imagen actual
let currentImageURL = null

// Cargar la lista de modelos disponibles al iniciar
window.addEventListener('DOMContentLoaded', async () => {
  try {
    // Intentar cargar modelos desde PHP
    console.log('Intentando cargar lista de modelos desde el servidor...')
    const response = await fetch('list_models.php')

    if (!response.ok) {
      throw new Error(
        `Error al obtener la lista de modelos (${response.status}): ${response.statusText}`
      )
    }

    const responseData = await response.json()
    console.log('Respuesta del servidor:', responseData)

    // Verificar si la respuesta es un array o tiene un error
    let models = []
    if (Array.isArray(responseData)) {
      models = responseData
    } else if (responseData.error) {
      throw new Error(responseData.error)
    } else {
      throw new Error('Formato de respuesta desconocido')
    }

    // Limpiar opciones existentes excepto la primera
    while (modelSelectorEl.options.length > 1) {
      modelSelectorEl.remove(1)
    }

    // Añadir modelos al selector
    if (models.length > 0) {
      models.forEach(model => {
        const option = document.createElement('option')
        option.value = model
        option.textContent = model
        modelSelectorEl.appendChild(option)
      })
      console.log(`Se cargaron ${models.length} modelos en el selector`)
    } else {
      const option = document.createElement('option')
      option.value = ''
      option.textContent = 'No se encontraron modelos'
      option.disabled = true
      modelSelectorEl.appendChild(option)
      console.warn('No se encontraron modelos en el servidor')
    }

    // Configurar eventos
    if (generateReportBtn && typeof generatePDFReport === 'function') {
      console.log('Configurando evento para el botón de generar informe')
      generateReportBtn.addEventListener('click', generatePDFReport)
    } else {
      console.warn(
        'No se encontró el botón de informe o la función generatePDFReport'
      )
    }
  } catch (error) {
    console.error('Error al cargar modelos:', error)
    modelStatusEl.textContent =
      '❌ Error al cargar la lista de modelos: ' + error.message
  }
})

// Función para cargar el modelo ONNX desde archivos locales
modelUploadEl.addEventListener('change', async e => {
  try {
    modelLoadingEl.style.display = 'block'
    modelStatusEl.textContent = ''

    const files = Array.from(e.target.files)

    // Buscar el archivo ONNX
    const onnxFile = files.find(f => f.name.endsWith('.onnx'))
    if (!onnxFile) {
      throw new Error('No se encontró un archivo ONNX válido')
    }

    // Buscar el archivo YAML/YML
    const yamlFile = files.find(
      f => f.name.endsWith('.yaml') || f.name.endsWith('.yml')
    )
    let yamlData = null

    if (yamlFile) {
      yamlData = await yamlFile.text()
      console.log('Archivo YAML encontrado:', yamlFile.name)
    } else {
      console.log('No se encontró archivo YAML. Se usarán números de clase.')
    }

    // Cargar el modelo
    await loadModel(
      onnxFile.name,
      new Uint8Array(await onnxFile.arrayBuffer()),
      yamlData
    )
  } catch (error) {
    modelStatusEl.textContent = '❌ Error al cargar el modelo: ' + error.message
    console.error(error)
  } finally {
    modelLoadingEl.style.display = 'none'
  }
})

// Función para cargar un modelo desde el servidor
loadServerModelBtn.addEventListener('click', async () => {
  const selectedModel = modelSelectorEl.value
  if (!selectedModel) {
    alert('Por favor seleccione un modelo')
    return
  }

  try {
    modelLoadingEl.style.display = 'block'
    modelStatusEl.textContent = ''

    // Cargar el modelo ONNX
    console.log(`Intentando cargar modelo: data/${selectedModel}`)
    const response = await fetch(`data/${selectedModel}`)
    if (!response.ok) {
      throw new Error(
        `Error al cargar el modelo (${response.status}): ${response.statusText}`
      )
    }

    const modelData = await response.arrayBuffer()

    // Intentar cargar el archivo YAML correspondiente
    const yamlName = selectedModel.replace('.onnx', '.yaml')
    const ymlName = selectedModel.replace('.onnx', '.yml')
    let yamlData = null

    try {
      // Intentar primero con .yaml
      console.log(`Intentando cargar YAML: data/${yamlName}`)
      const yamlResponse = await fetch(`data/${yamlName}`)
      if (yamlResponse.ok) {
        yamlData = await yamlResponse.text()
        console.log('Archivo YAML encontrado:', yamlName)
      } else {
        // Intentar con .yml
        console.log(`Intentando cargar YAML: data/${ymlName}`)
        const ymlResponse = await fetch(`data/${ymlName}`)
        if (ymlResponse.ok) {
          yamlData = await ymlResponse.text()
          console.log('Archivo YAML encontrado:', ymlName)
        } else {
          console.log(
            'No se encontró archivo YAML. Se usarán números de clase.'
          )
        }
      }
    } catch (yamlError) {
      console.warn('Error al cargar archivo YAML:', yamlError)
    }

    await loadModel(selectedModel, new Uint8Array(modelData), yamlData)
  } catch (error) {
    modelStatusEl.textContent = '❌ Error al cargar el modelo: ' + error.message
    console.error(error)
  } finally {
    modelLoadingEl.style.display = 'none'
  }
})

// Función común para cargar un modelo desde un ArrayBuffer
async function loadModel (modelName, modelData, yamlData = null) {
  // Crear sesión de ONNX
  model = await ort.InferenceSession.create(modelData)

  // Cargar clases desde YAML si está disponible
  if (yamlData) {
    try {
      const yamlObject = jsyaml.load(yamlData)

      // El YAML de YOLOv8 normalmente tiene las clases en names o en nc.names
      if (yamlObject.names) {
        if (Array.isArray(yamlObject.names)) {
          modelClasses = yamlObject.names
        } else {
          // Si es un objeto con índices como claves
          modelClasses = Object.values(yamlObject.names)
        }
      } else if (yamlObject.nc && yamlObject.nc.names) {
        modelClasses = yamlObject.nc.names
      } else {
        console.warn('No se encontraron clases en el archivo YAML.')
        modelClasses = null
      }

      console.log('Clases cargadas:', modelClasses)
    } catch (yamlError) {
      console.error('Error al parsear YAML:', yamlError)
      modelClasses = null
    }
  } else {
    modelClasses = null
  }

  modelStatusEl.textContent = '✅ Modelo cargado correctamente: ' + modelName
  imageUploadEl.disabled = false
}

// Función para procesar la imagen
imageUploadEl.addEventListener('change', async e => {
  try {
    imageLoadingEl.style.display = 'block'

    // Guardar la referencia al archivo
    imageFile = e.target.files[0]

    const boxes = await detect_objects_on_image(imageFile)
    draw_image_and_boxes(imageFile, boxes)

    // Habilitar el botón de generar informe
    generateReportBtn.disabled = false
  } catch (error) {
    console.error('Error al procesar la imagen:', error)
    alert('Error al procesar la imagen: ' + error.message)
  } finally {
    imageLoadingEl.style.display = 'none'
  }
})

/**
 * Dibuja la imagen y las cajas detectadas sin etiquetas
 */
function draw_image_and_boxes (file, boxes) {
  const img = new Image()
  currentImageURL = URL.createObjectURL(file)
  img.src = currentImageURL

  img.onload = () => {
    // Configurar el canvas con el tamaño de la imagen original
    resultCanvasEl.width = img.width
    resultCanvasEl.height = img.height
    const ctx = resultCanvasEl.getContext('2d')

    // Dibujar la imagen
    ctx.drawImage(img, 0, 0)

    // Colores para las diferentes clases
    const colors = [
      '#FF3838',
      '#FF9D97',
      '#FF701F',
      '#FFB21D',
      '#CFD231',
      '#48F90A',
      '#92CC17',
      '#3DDB86',
      '#1A9334',
      '#00D4BB',
      '#2C99A8',
      '#00C2FF',
      '#344593',
      '#6473FF',
      '#0018EC',
      '#8438FF',
      '#520085',
      '#CB38FF',
      '#FF95C8',
      '#FF37C7'
    ]

    // Limpiar cajas detectadas anteriores
    detectedBoxes = []

    // Dibujar cada caja SIN etiquetas
    boxes.forEach(([x1, y1, x2, y2, label, prob, classId]) => {
      // Obtener un color consistente para esta clase
      const color = colors[classId % colors.length]

      // Dibujar solo la caja con el color de la clase
      ctx.strokeStyle = color
      ctx.lineWidth = 3
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Guardar la información de la caja para usar con el tooltip
      detectedBoxes.push({
        x1,
        y1,
        x2,
        y2,
        width: x2 - x1,
        height: y2 - y1,
        label,
        probability: prob,
        text: `${label} ${(prob * 100).toFixed(1)}%`,
        color: color,
        classId: classId
      })
    })

    // Configurar eventos de mouse para el tooltip y zoom
    setupMouseEvents()
  }
}

/**
 * Configura los eventos de mouse para mostrar tooltips y zoom al hacer clic
 */
function setupMouseEvents () {
  // Elementos del modal
  const zoomModal = document.getElementById('zoomModal')
  const zoomCanvas = document.getElementById('zoomCanvas')
  const objectInfo = document.getElementById('objectInfo')
  const closeButton = document.querySelector('.close-button')

  // Cerrar el modal al hacer clic en la X
  closeButton.addEventListener('click', () => {
    zoomModal.style.display = 'none'
  })

  // Cerrar el modal al hacer clic fuera del contenido
  window.addEventListener('click', e => {
    if (e.target === zoomModal) {
      zoomModal.style.display = 'none'
    }
  })

  // Evento mousemove para detectar cuando el cursor está sobre una caja
  resultCanvasEl.addEventListener('mousemove', e => {
    const rect = resultCanvasEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Ajustar coordenadas al tamaño real del canvas
    const scaleX = resultCanvasEl.width / rect.width
    const scaleY = resultCanvasEl.height / rect.height
    const canvasX = x * scaleX
    const canvasY = y * scaleY

    // Buscar si el cursor está sobre alguna caja
    const box = detectedBoxes.find(
      box =>
        canvasX >= box.x1 &&
        canvasX <= box.x2 &&
        canvasY >= box.y1 &&
        canvasY <= box.y2
    )

    if (box) {
      // Mostrar tooltip
      tooltipEl.style.display = 'block'
      tooltipEl.style.left = `${e.clientX - rect.left + 10}px`
      tooltipEl.style.top = `${e.clientY - rect.top - 25}px`
      tooltipEl.style.backgroundColor = box.color
      tooltipEl.textContent = box.text

      // Cambiar el cursor a pointer para indicar que es clickeable
      resultCanvasEl.style.cursor = 'pointer'
    } else {
      // Ocultar tooltip
      tooltipEl.style.display = 'none'
      // Restaurar cursor
      resultCanvasEl.style.cursor = 'default'
    }
  })

  // Ocultar tooltip cuando el mouse sale del canvas
  resultCanvasEl.addEventListener('mouseleave', () => {
    tooltipEl.style.display = 'none'
  })

  // Evento click para ampliar la región seleccionada
  resultCanvasEl.addEventListener('click', e => {
    const rect = resultCanvasEl.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Ajustar coordenadas al tamaño real del canvas
    const scaleX = resultCanvasEl.width / rect.width
    const scaleY = resultCanvasEl.height / rect.height
    const canvasX = x * scaleX
    const canvasY = y * scaleY

    // Buscar si el cursor está sobre alguna caja
    const box = detectedBoxes.find(
      box =>
        canvasX >= box.x1 &&
        canvasX <= box.x2 &&
        canvasY >= box.y1 &&
        canvasY <= box.y2
    )

    if (box) {
      // Mostrar la región ampliada
      showZoomedObject(box)
    }
  })
}

/**
 * Muestra el objeto ampliado en un modal
 */
function showZoomedObject (box) {
  const zoomModal = document.getElementById('zoomModal')
  const zoomCanvas = document.getElementById('zoomCanvas')
  const objectInfo = document.getElementById('objectInfo')

  // Cargar la imagen original
  const img = new Image()
  img.src = currentImageURL

  img.onload = () => {
    // Calcular dimensiones para el zoom
    // Añadir un margen alrededor del objeto (20% extra)
    const margin = {
      x: box.width * 0.2,
      y: box.height * 0.2
    }

    // Coordenadas con margen
    const x1 = Math.max(0, box.x1 - margin.x)
    const y1 = Math.max(0, box.y1 - margin.y)
    const x2 = Math.min(img.width, box.x2 + margin.x)
    const y2 = Math.min(img.height, box.y2 + margin.y)
    const width = x2 - x1
    const height = y2 - y1

    // Ajustar el tamaño del canvas según la región seleccionada
    // manteniendo una proporción razonable para el modal
    const maxModalWidth = 700
    const maxModalHeight = 500

    // Calcular escala para ajustar al modal
    const scaleX = maxModalWidth / width
    const scaleY = maxModalHeight / height
    const scale = Math.min(scaleX, scaleY)

    // Establecer dimensiones del canvas
    zoomCanvas.width = width * scale
    zoomCanvas.height = height * scale

    // Dibujar la región ampliada
    const ctx = zoomCanvas.getContext('2d')
    ctx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height)

    // Dibujar la imagen recortada y escalada
    ctx.drawImage(
      img,
      x1,
      y1,
      width,
      height, // Región de origen (recorte)
      0,
      0,
      zoomCanvas.width,
      zoomCanvas.height // Región de destino (escalada)
    )

    // Dibujar el rectángulo de detección centrado
    const boxX = (box.x1 - x1) * scale
    const boxY = (box.y1 - y1) * scale
    const boxWidth = box.width * scale
    const boxHeight = box.height * scale

    ctx.strokeStyle = box.color
    ctx.lineWidth = 4
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight)

    // Añadir información del objeto
    objectInfo.innerHTML = `
            <div style="color: ${
              box.color
            }; font-weight: bold; font-size: 18px;">
                ${box.label}
            </div>
            <div>Probabilidad: ${(box.probability * 100).toFixed(2)}%</div>
            <div>Dimensiones: ${Math.round(box.width)} × ${Math.round(
      box.height
    )} píxeles</div>
            <div>Posición: (${Math.round(box.x1)}, ${Math.round(box.y1)})</div>
        `

    // Mostrar el modal
    zoomModal.style.display = 'block'
  }
}

/**
 * Detecta objetos en la imagen
 */
async function detect_objects_on_image (buf) {
  const [input, img_width, img_height] = await prepare_input(buf)
  const output = await run_model(input)
  return process_output(output, img_width, img_height)
}

/**
 * Prepara la entrada para el modelo
 */
async function prepare_input (buf) {
  return new Promise(resolve => {
    const img = new Image()
    img.src = URL.createObjectURL(buf)
    img.onload = () => {
      const [img_width, img_height] = [img.width, img.height]

      // Crear canvas para redimensionar
      const canvas = document.createElement('canvas')
      canvas.width = 640
      canvas.height = 640
      const context = canvas.getContext('2d')

      // Redimensionar manteniendo relación de aspecto y rellenando con negro
      context.fillStyle = 'black'
      context.fillRect(0, 0, 640, 640)

      let newWidth,
        newHeight,
        offsetX = 0,
        offsetY = 0
      const ratio = Math.min(640 / img_width, 640 / img_height)
      newWidth = img_width * ratio
      newHeight = img_height * ratio

      // Centrar la imagen
      offsetX = (640 - newWidth) / 2
      offsetY = (640 - newHeight) / 2

      // Guardar información de redimensionamiento para ajustar las cajas más tarde
      window.resize_info = { ratio, offsetX, offsetY }

      // Dibujar la imagen redimensionada
      context.drawImage(img, offsetX, offsetY, newWidth, newHeight)

      // Obtener datos de píxeles
      const imgData = context.getImageData(0, 0, 640, 640)
      const pixels = imgData.data

      // Preparar arrays para cada canal RGB
      const red = [],
        green = [],
        blue = []
      for (let index = 0; index < pixels.length; index += 4) {
        red.push(pixels[index] / 255.0)
        green.push(pixels[index + 1] / 255.0)
        blue.push(pixels[index + 2] / 255.0)
      }
      const input = [...red, ...green, ...blue]
      resolve([input, img_width, img_height])
    }
  })
}

/**
 * Ejecuta el modelo con la entrada preparada
 */
async function run_model (input) {
  if (!model) {
    throw new Error('El modelo no está cargado')
  }

  input = new ort.Tensor(Float32Array.from(input), [1, 3, 640, 640])

  // Ejecutar inferencia
  const outputs = await model.run({ images: input })

  // Obtener el primer tensor de salida
  const outputName = Object.keys(outputs)[0]
  return outputs[outputName].data
}

/**
 * Procesa la salida del modelo para obtener las cajas
 */
function process_output (output, img_width, img_height) {
  let boxes = []
  allDetections = [] // Reiniciar las detecciones

  // Determinar el número de clases
  // En YOLOv8, el tensor tiene formato [1, nc+4, 8400]
  // donde nc es el número de clases
  const numDetections = 8400 // Número estándar de detecciones en YOLOv8

  // Determinar número de clases a partir del tamaño del tensor
  // output.length = (nc+4) * 8400
  const numClassesPlusFour = output.length / numDetections
  const numClasses = numClassesPlusFour - 4

  console.log(
    `Formato de salida: ${numClassesPlusFour} canales (${numClasses} clases)`,
    `${numDetections} detecciones`
  )

  // Extraer propiedades del resize para ajustar las coordenadas
  const resize = window.resize_info || { ratio: 1, offsetX: 0, offsetY: 0 }
  const { ratio, offsetX, offsetY } = resize

  // Colores para las diferentes clases
  const colors = [
    '#FF3838',
    '#FF9D97',
    '#FF701F',
    '#FFB21D',
    '#CFD231',
    '#48F90A',
    '#92CC17',
    '#3DDB86',
    '#1A9334',
    '#00D4BB',
    '#2C99A8',
    '#00C2FF',
    '#344593',
    '#6473FF',
    '#0018EC',
    '#8438FF',
    '#520085',
    '#CB38FF',
    '#FF95C8',
    '#FF37C7'
  ]

  // Para cada detección
  for (let index = 0; index < numDetections; index++) {
    // Encontrar la clase con mayor probabilidad
    const [class_id, prob] = [...Array(numClasses).keys()]
      .map(col => [col, output[(col + 4) * numDetections + index]])
      .reduce((accum, item) => (item[1] > accum[1] ? item : accum), [0, 0])

    // Obtener etiqueta según si hay clases cargadas o no
    const label = modelClasses ? modelClasses[class_id] : `Clase ${class_id}`

    // Extraer coordenadas normalizadas
    const xc = output[index]
    const yc = output[numDetections + index]
    const w = output[2 * numDetections + index]
    const h = output[3 * numDetections + index]

    // Convertir coordenadas de YOLOv8 a píxeles, ajustando por el redimensionamiento
    const x_norm = (xc - offsetX) / (640 - 2 * offsetX)
    const y_norm = (yc - offsetY) / (640 - 2 * offsetY)
    const w_norm = w / (640 - 2 * offsetX)
    const h_norm = h / (640 - 2 * offsetY)

    // Convertir a coordenadas de imagen original
    const x1 = Math.max(0, (x_norm - w_norm / 2) * img_width)
    const y1 = Math.max(0, (y_norm - h_norm / 2) * img_height)
    const x2 = Math.min(img_width, (x_norm + w_norm / 2) * img_width)
    const y2 = Math.min(img_height, (y_norm + h_norm / 2) * img_height)

    // Obtener color para esta clase
    const color = colors[class_id % colors.length]

    // Guardar TODAS las detecciones
    allDetections.push({
      x1,
      y1,
      x2,
      y2,
      width: x2 - x1,
      height: y2 - y1,
      label,
      probability: prob,
      classId: class_id,
      color
    })

    // Filtrar por umbral de confianza para las que se mostrarán
    if (prob < 0.25) {
      continue
    }

    // Añadir class_id para facilitar la coloración
    boxes.push([x1, y1, x2, y2, label, prob, class_id])
  }

  // Ordenar por probabilidad
  boxes.sort((box1, box2) => box2[5] - box1[5])

  // Aplicar NMS
  const result = []
  while (boxes.length > 0) {
    result.push(boxes[0])
    boxes = boxes.filter(box => iou(boxes[0], box) < 0.7)
  }

  return result
}

/**
 * Calcula Intersection over Union (IoU) entre dos cajas
 */
function iou (box1, box2) {
  return intersection(box1, box2) / union(box1, box2)
}

/**
 * Calcula el área de la unión de dos cajas
 */
function union (box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2
  const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1)
  const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1)
  return box1_area + box2_area - intersection(box1, box2)
}

/**
 * Calcula el área de la intersección de dos cajas
 */
function intersection (box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2
  const x1 = Math.max(box1_x1, box2_x1)
  const y1 = Math.max(box1_y1, box2_y1)
  const x2 = Math.min(box1_x2, box2_x2)
  const y2 = Math.min(box1_y2, box2_y2)
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
}

/**
 * Dibuja una imagen con etiquetas para el informe
 */
function draw_image_for_report (file, boxes) {
  return new Promise(resolve => {
    const img = new Image()
    img.src = URL.createObjectURL(file)

    img.onload = () => {
      // Crear un nuevo canvas para el informe
      const reportCanvas = document.createElement('canvas')
      reportCanvas.width = img.width
      reportCanvas.height = img.height
      const ctx = reportCanvas.getContext('2d')

      // Dibujar la imagen
      ctx.drawImage(img, 0, 0)

      // Colores para las diferentes clases
      const colors = [
        '#FF3838',
        '#FF9D97',
        '#FF701F',
        '#FFB21D',
        '#CFD231',
        '#48F90A',
        '#92CC17',
        '#3DDB86',
        '#1A9334',
        '#00D4BB',
        '#2C99A8',
        '#00C2FF',
        '#344593',
        '#6473FF',
        '#0018EC',
        '#8438FF',
        '#520085',
        '#CB38FF',
        '#FF95C8',
        '#FF37C7'
      ]

      // Dibujar cada caja CON etiquetas
      boxes.forEach(([x1, y1, x2, y2, label, prob, classId]) => {
        // Obtener un color consistente para esta clase
        const color = colors[classId % colors.length]

        // Dibujar la caja con el color de la clase
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

        // Fondo para la etiqueta
        ctx.fillStyle = color
        const labelY = y1 > 20 ? y1 - 5 : y1 + 15 // Evitar que la etiqueta quede fuera del canvas
        const rectY = labelY - 18

        // Calcular ancho de texto
        ctx.font = 'bold 16px Arial'
        const textWidth = ctx.measureText(label).width

        // Solo mostrar la etiqueta sin la confianza
        ctx.fillRect(x1, rectY, textWidth + 10, 25)

        // Texto de la etiqueta
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(label, x1 + 5, labelY)
      })

      resolve(reportCanvas)
    }
  })
}
