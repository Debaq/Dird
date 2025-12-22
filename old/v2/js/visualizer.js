// Dibujar las detecciones en el canvas
function drawDetections (ctx, detections) {
  logDebug(`Dibujando ${detections.length} detecciones en canvas`)

  detections.forEach((det, index) => {
    const [x, y, w, h] = det.bbox
    const className = classes[det.class] || `Clase ${det.class}`
    logDebug(`clase: ${det.class}`)
    let offsetX = -25
    let offsetY = -30

    if (det.class == 0) {
      // discooptico
      offsetX = -40
      offsetY = -45
    } else if (det.class == 1) {
      //exudado duro
        offsetX = -20
      offsetY = -20
    } else if (det.class == 2) {
        //fovea
      offsetX = -35
      offsetY = -45
    } else if (det.class == 3) {
      offsetX = -15
      offsetY = -10
    } else if (det.class == 4) {
      offsetX = -20
      offsetY = -15
    } else if (det.class == 5) {
      // microhemorragia
      offsetX = -15
      offsetY = -10
    } else if (det.class == 6) {
      offsetX = -15
      offsetY = -10
    } else {
      offsetX = -25
      offsetY = -30
    }

    // Verificar si el valor de confianza es mayor que 1 (ya es porcentaje)
    let confidenceDisplay
    if (det.confidence > 1) {
      // Si es mayor que 1, asumimos que ya es un porcentaje o está escalado
      // Lo limitamos a un máximo de 100%
      confidenceDisplay = Math.min(det.confidence, 100).toFixed(1)
    } else {
      // Si está en el rango 0-1, convertimos a porcentaje
      confidenceDisplay = (det.confidence * 100).toFixed(1)
    }

    const label = `${className} ${confidenceDisplay}%`

    logDebug(
      `Detección ${index + 1}: ${label} en [${x.toFixed(1)}, ${y.toFixed(
        1
      )}, ${w.toFixed(1)}, ${h.toFixed(1)}]`
    )

    // Resto del código del drawDetections sin cambios
    ctx.strokeStyle = colors[det.class % colors.length]
    ctx.lineWidth = 2
    ctx.strokeRect(x + offsetX, y + offsetY, w, h)

    // Parámetros para la bandera
    const fontScale = 1.0
    const thickness = 2
    const fontFace = '10px Arial'

    // Obtener el tamaño del texto
    ctx.font = fontFace
    const textWidth = ctx.measureText(label).width
    const textHeight = 10 // Aproximado para Arial 16px

    // Añadir padding a la bandera
    const paddingX = 5
    const paddingY = 5
    const flagWidth = textWidth + paddingX * 2
    const flagHeight = textHeight + paddingY * 2

    // Coordenadas de la bandera
    const flagX1 = Math.max(0, x + offsetX - paddingX)
    const flagY1 = Math.max(0, y + offsetY - flagHeight)
    const flagX2 = Math.min(ctx.canvas.width, flagX1 + flagWidth)
    const flagY2 = y + offsetY

    // Guardar el estado actual del canvas
    ctx.save()

    // Dibujar la bandera (rectángulo con fondo semi-transparente)
    ctx.globalAlpha = 0.4
    ctx.fillStyle = 'white'
    ctx.fillRect(flagX1, flagY1, flagX2 - flagX1, flagY2 - flagY1)

    // Contorno de la bandera
    ctx.globalAlpha = 1.0
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 1
    ctx.strokeRect(flagX1, flagY1, flagX2 - flagX1, flagY2 - flagY1)

    // Calcular posición centrada del texto dentro de la bandera
    const textX = flagX1 + paddingX
    const textY = flagY1 + paddingY + textHeight

    // Dibujar el texto
    ctx.fillStyle = 'black'
    ctx.fillText(label, textX, textY)

    // Restaurar el estado original
    ctx.restore()
  })
}

// Simular detecciones para depuración
function simulateDetections (width, height) {
  logDebug('Generando detecciones simuladas')

  const detections = []
  const numDetections = 3 // Fijo para depuración

  for (let i = 0; i < numDetections; i++) {
    const classId = i % classes.length

    // Crear detecciones en diferentes áreas de la imagen
    let x, y, w, h

    if (i === 0) {
      // Primera detección: arriba izquierda
      x = width * 0.1
      y = height * 0.1
    } else if (i === 1) {
      // Segunda detección: centro
      x = width * 0.4
      y = height * 0.4
    } else {
      // Tercera detección: abajo derecha
      x = width * 0.7
      y = height * 0.7
    }

    w = width * 0.2
    h = height * 0.2

    detections.push({
      class: classId,
      confidence: 0.9 - i * 0.1, // 0.9, 0.8, 0.7...
      bbox: [x, y, w, h]
    })
  }

  return detections
}
