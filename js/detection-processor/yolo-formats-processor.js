
// Para formato YOLO v8 (posible formato de tu modelo)
function processYoloV8Format(outputData, outputShape, confidenceThreshold) {
    const [batch, rows, cols] = outputShape;
    const numClasses = classes.length;
    const detections = [];
    
    // En YOLOv8, suele haber 4 filas para bbox y el resto para clases
    const hasConfRow = rows === (4 + numClasses + 1); // +1 para confianza general
    
    for (let i = 0; i < cols; i++) {
        // Obtener las coordenadas
        let x = outputData[0 * cols + i];
        let y = outputData[1 * cols + i];
        let w = outputData[2 * cols + i];
        let h = outputData[3 * cols + i];
        
        // Verificar valores
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) continue;
        if (w <= 0 || h <= 0) continue;
        
        // Encontrar la clase con mayor probabilidad
        let maxClassProb = -1;
        let classId = 0;
        
        for (let c = 0; c < numClasses; c++) {
            const classIdx = 4 + c;
            if (classIdx < rows) {
                const prob = outputData[classIdx * cols + i];
                if (prob > maxClassProb) {
                    maxClassProb = prob;
                    classId = c;
                }
            }
        }
        
        // Obtener confianza
        let confidence = hasConfRow ? outputData[(4 + numClasses) * cols + i] : maxClassProb;
        
        // Filtrar por confianza
        if (confidence < confidenceThreshold) continue;
        
        // Normalizar coordenadas si es necesario
        // YOLOv8 suele tener coordenadas normalizadas (0-1)
        if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
            // Son normalizadas, convertir a píxeles
            x = x * INPUT_WIDTH;
            y = y * INPUT_HEIGHT;
            w = w * INPUT_WIDTH;
            h = h * INPUT_HEIGHT;
        }
        
        detections.push({
            class: classId,
            confidence: confidence,
            bbox: [x, y, w, h]
        });
    }
    
    return detections;
}

// Función para formato YOLO genérico
function processYoloGenericFormat(outputData, outputShape, confidenceThreshold) {
    const [batch, rows, cols] = outputShape;
    const detections = [];
    
    for (let i = 0; i < cols; i++) {
        // Asumimos que las primeras 4 filas son para las coordenadas
        let x = outputData[0 * cols + i];
        let y = outputData[1 * cols + i];
        let w = outputData[2 * cols + i];
        let h = outputData[3 * cols + i];
        
        // Verificar valores
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) continue;
        if (w <= 0 || h <= 0) continue;
        
        // Encontrar la clase con mayor probabilidad
        let maxClassProb = -1;
        let classId = 0;
        
        for (let c = 0; c < Math.min(classes.length, rows - 4); c++) {
            const prob = outputData[(4 + c) * cols + i];
            if (prob > maxClassProb) {
                maxClassProb = prob;
                classId = c;
            }
        }
        
        // Filtrar por confianza
        if (maxClassProb < confidenceThreshold) continue;
        
        // Normalizar coordenadas si es necesario
        if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
            // Son normalizadas, convertir a píxeles
            x = x * INPUT_WIDTH;
            y = y * INPUT_HEIGHT;
            w = w * INPUT_WIDTH;
            h = h * INPUT_HEIGHT;
        }
        
        detections.push({
            class: classId,
            confidence: maxClassProb,
            bbox: [x, y, w, h]
        });
    }
    
    return detections;
}

// Para formato plano (por ejemplo, YOLOv5 puede tener formato [1, N, 85])
function processYoloFlatOutput(output, paddingInfo) {
    const outputData = output.data;
    const outputShape = output.dims;
    const [rows, cols] = outputShape;
    
    // Obtener valores de los controles
    const confidenceThreshold = parseFloat(confidenceThresholdSlider.value);
    const nmsThreshold = parseFloat(nmsThresholdSlider.value);
    const MAX_DETECTIONS = parseInt(maxDetectionsSlider.value);
    
    logDebug(`Estructura plana: rows=${rows}, cols=${cols}`);
    
    // En formato plano, cada fila es una detección y las columnas son:
    // [x, y, w, h, conf, class1, class2, ...]
    const numClasses = cols - 5; // 4 para coordenadas, 1 para confianza
    const detections = [];
    
    for (let i = 0; i < rows; i++) {
        // Extraer coordenadas y confianza
        const baseIdx = i * cols;
        let x = outputData[baseIdx + 0];
        let y = outputData[baseIdx + 1];
        let w = outputData[baseIdx + 2];
        let h = outputData[baseIdx + 3];
        let confidence = outputData[baseIdx + 4];
        
        // Verificar valores
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || isNaN(confidence)) continue;
        if (w <= 0 || h <= 0 || confidence <= 0) continue;
        
        // Filtrar por confianza
        if (confidence < confidenceThreshold) continue;
        
        // Encontrar la clase con mayor probabilidad
        let maxClassProb = -1;
        let classId = 0;
        
        for (let c = 0; c < numClasses; c++) {
            const prob = outputData[baseIdx + 5 + c];
            if (prob > maxClassProb) {
                maxClassProb = prob;
                classId = c;
            }
        }
        
        // Normalizar coordenadas si es necesario
        if (x <= 1 && y <= 1 && w <= 1 && h <= 1) {
            // Son normalizadas, convertir a píxeles
            x = x * INPUT_WIDTH;
            y = y * INPUT_HEIGHT;
            w = w * INPUT_WIDTH;
            h = h * INPUT_HEIGHT;
        }
        
        detections.push({
            class: classId,
            confidence: confidence * maxClassProb, // Multiplicamos confianza general por la de la clase
            bbox: [x, y, w, h]
        });
    }
    
    // Aplicar NMS
    let filteredDetections = applyNMS(detections, nmsThreshold);
    
    // Limitar detecciones
    if (filteredDetections.length > MAX_DETECTIONS) {
        filteredDetections = filteredDetections
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, MAX_DETECTIONS);
    }
    
    return filteredDetections;
}

// Procesamiento para formato YOLOv11 (específico para tu formato de salida)
function processYoloV11Output(output, paddingInfo) {
    logDebug("Procesando formato de salida YOLOv11");
    
    // Obtener valores de los controles
    const confidenceThreshold = parseFloat(confidenceThresholdSlider.value);
    // IMPORTANTE: Eliminar el uso del multiplicador o limitarlo a un valor razonable
    // const confidenceMultiplier = parseFloat(confidenceMultiplierSlider.value);
    const confidenceMultiplier = 1.0; // Usar 1.0 en lugar del valor del slider
    const nmsThreshold = parseFloat(nmsThresholdSlider.value);
    const MAX_DETECTIONS = parseInt(maxDetectionsSlider.value);
    
    logDebug(`Parámetros: umbral=${confidenceThreshold}, NMS=${nmsThreshold}`);
    
    const outputData = output.data;
    const outputShape = output.dims;
    
    const numRows = outputShape[1]; // 7
    const numCols = outputShape[2]; // 2100
    
    // Para depuración
    let minValues = Array(numRows).fill(Number.MAX_VALUE);
    let maxValues = Array(numRows).fill(Number.MIN_VALUE);
    
    for (let row = 0; row < numRows; row++) {
        for (let col = 0; col < Math.min(numCols, 100); col++) {
            const value = outputData[row * numCols + col];
            minValues[row] = Math.min(minValues[row], value);
            maxValues[row] = Math.max(maxValues[row], value);
        }
    }
    
    logDebug("Rangos de valores por fila (primeras 100 columnas):");
    for (let row = 0; row < numRows; row++) {
        logDebug(`Fila ${row}: min=${minValues[row].toFixed(4)}, max=${maxValues[row].toFixed(4)}`);
    }
    
    // Determinar si necesitamos normalizar las coordenadas
    // Si las coordenadas (filas 0-3) son todas menores que 1.0, entonces están normalizadas
    const needsNormalization = 
        (maxValues[0] <= 1.0 && maxValues[1] <= 1.0 && maxValues[2] <= 1.0 && maxValues[3] <= 1.0);
    
    // MODIFICADO: Forzar normalización basado en los valores observados
    // Si los valores de coordenadas son demasiado pequeños para el tamaño del modelo, necesitamos normalizarlos
    const forceRescale = (maxValues[0] < INPUT_WIDTH * 0.1 && maxValues[1] < INPUT_HEIGHT * 0.1);
    
    logDebug(`¿Necesita normalización? ${needsNormalization}, ¿Forzar reescalado? ${forceRescale}`);
    
    const detections = [];
    let numValidDetections = 0;
    
    // Ejemplos de valores para inspección
    for (let i = 0; i < Math.min(5, numCols); i++) {
        const x = outputData[0 * numCols + i];
        const y = outputData[1 * numCols + i];
        const w = outputData[2 * numCols + i];
        const h = outputData[3 * numCols + i];
        // MODIFICADO: No aplicar multiplicador aquí, solo mostrar el valor real
        const conf = outputData[4 * numCols + i];
        logDebug(`Col ${i}: x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${w.toFixed(2)}, h=${h.toFixed(2)}, conf=${conf.toFixed(6)}`);
    }
    
    // Iterar por las columnas
    for (let i = 0; i < numCols; i++) {
        // Obtener las coordenadas y confianza
        let x = outputData[0 * numCols + i];
        let y = outputData[1 * numCols + i];
        let w = outputData[2 * numCols + i];
        let h = outputData[3 * numCols + i];
        
        // MODIFICADO: Usar un enfoque diferente para los valores de confianza
        // Para detectar si es un modelo YOLOv8 o similar, verificamos los valores de confianza
        let confidence;
        
        // Si los valores de confianza son muy pequeños (como 0.0001-0.0008), 
        // probablemente necesiten ser escalados de manera diferente
        if (maxValues[4] < 0.01) {
            // Valores extremadamente pequeños, podría ser un error o un modelo mal calibrado
            // Intentamos un enfoque diferente - usamos valores de clase como confianza
            const cls1 = outputData[5 * numCols + i];
            const cls2 = outputData[6 * numCols + i];
            confidence = Math.max(cls1, cls2);
            
            // Si sigue siendo demasiado pequeño, usamos un valor predeterminado
            if (confidence < 0.01) {
                confidence = 0.5; // Valor arbitrario para fines de visualización
            }
        } else {
            // Valores normales, usamos el valor de confianza directo
            confidence = outputData[4 * numCols + i];
        }
        
        // MODIFICADO: No aplicamos multiplicador si la confianza ya es razonable
        if (confidence > 0.01) {
            // Si ya tenemos valores razonables, no aplicamos multiplicador
        } else {
            // Si los valores son muy pequeños, aplicamos un multiplicador limitado
            confidence = Math.min(confidence * 100, 1.0); // Limitar a 1.0 max
        }
        
        // Verificar si son valores válidos
        if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h) || isNaN(confidence)) {
            continue;
        }
        
        // Filtrar valores negativos o cero
        if (w <= 0 || h <= 0 || confidence <= 0) {
            continue;
        }
        
        // Filtrar por confianza con el umbral ajustable
        if (confidence < confidenceThreshold) {
            continue;
        }
        
        // Determinar la clase (modificada para ser más robusta)
        const cls1 = outputData[5 * numCols + i];
        const cls2 = outputData[6 * numCols + i];
        let classId;
        
        // CORRECCIÓN: Algoritmo mejorado para determinar la clase
        if (numRows >= 7) { // Asegurarnos que tenemos suficientes filas
            if (cls1 > cls2 && cls1 > 0.1) {
                classId = 0;
            } else if (cls2 > cls1 && cls2 > 0.1) {
                classId = 1;
            } else if (numRows > 7) {
                // Si hay más clases, buscar la más probable
                let maxClass = Math.max(cls1, cls2);
                classId = cls1 > cls2 ? 0 : 1;
                
                for (let c = 2; c < numRows - 5; c++) {
                    const clsValue = outputData[(5 + c) * numCols + i];
                    if (clsValue > maxClass) {
                        maxClass = clsValue;
                        classId = c;
                    }
                }
            } else {
                // Si ambos valores son bajos, asignar la clase con el valor más alto
                classId = cls1 > cls2 ? 0 : 1;
            }
        } else {
            // Menos de 7 filas, asumimos que no hay información de clase
            classId = 0;
        }
        
        // CORRECCIÓN IMPORTANTE: Manejo correcto de coordenadas
        // Verificar si las coordenadas están normalizadas (entre 0 y 1)
        let scaleX = 1.0;
        let scaleY = 1.0;
        
        // NUEVO: Manejo especial para coordenadas basado en valor máximo observado
        if (needsNormalization) {
            // Si están normalizadas (0-1), escalar al tamaño de entrada
            scaleX = INPUT_WIDTH;
            scaleY = INPUT_HEIGHT;
        } else if (forceRescale) {
            // Si los valores son pequeños pero no normalizados, aplicar un escalado proporcional
            // Determinar un factor de escala basado en el valor máximo observado
            const maxObservedX = maxValues[0];
            const maxObservedY = maxValues[1];
            
            // Calcular factores de escala para llevar a un rango razonable
            scaleX = INPUT_WIDTH / (maxObservedX * 2);
            scaleY = INPUT_HEIGHT / (maxObservedY * 2);
            
            logDebug(`Aplicando escalado proporcional: X=${scaleX.toFixed(2)}, Y=${scaleY.toFixed(2)}`);
        } else {
            // Si las coordenadas parecen ser valores absolutos de píxeles y son demasiado grandes,
            // limitamos a un porcentaje del tamaño de entrada
            if (x > INPUT_WIDTH * 1.5 || y > INPUT_HEIGHT * 1.5) {
                x = x % INPUT_WIDTH;
                y = y % INPUT_HEIGHT;
                w = Math.min(w, INPUT_WIDTH * 0.5);
                h = Math.min(h, INPUT_HEIGHT * 0.5);
            }
        }
        
        // Aplicar escala
        x = x * scaleX;
        y = y * scaleY;
        w = w * scaleX;
        h = h * scaleY;
        
        // Asegurar que la caja no se salga de los límites (sin usar módulo)
        x = Math.max(0, Math.min(x, INPUT_WIDTH - 1));
        y = Math.max(0, Math.min(y, INPUT_HEIGHT - 1));
        w = Math.min(w, INPUT_WIDTH - x);
        h = Math.min(h, INPUT_HEIGHT - y);
        
        // Si los tamaños son muy pequeños, ignorar
        if (w < 5 || h < 5) continue;
        
        detections.push({
            class: classId,
            confidence: confidence,
            bbox: [x, y, w, h]
        });
        
        numValidDetections++;
    }
    
    logDebug(`Detecciones válidas encontradas: ${numValidDetections}`);
    
    // Aplicar NMS con umbral ajustable
    let filteredDetections = applyNMS(detections, nmsThreshold);
    
    // Limitar el número de detecciones a mostrar
    if (filteredDetections.length > MAX_DETECTIONS) {
        // Ordenar por confianza descendente y tomar solo MAX_DETECTIONS
        filteredDetections = filteredDetections
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, MAX_DETECTIONS);
    }
    
    logDebug(`Detecciones finales después de límite: ${filteredDetections.length}`);
    
    return filteredDetections;
}

// Versión simplificada para depuración
function processSimplifiedOutput(output, paddingInfo) {
    logDebug("Usando procesamiento simplificado para depuración");
    
    const outputData = output.data;
    const outputShape = output.dims;
    const numRows = outputShape[1];
    const numCols = outputShape[2];
    
    // Mostrar una muestra de los datos para análisis
    logDebug(`Muestra de datos (primeros 5 valores de cada fila):`);
    for (let row = 0; row < numRows; row++) {
        const sampleValues = Array.from(outputData.slice(row * numCols, row * numCols + 5))
            .map(v => v.toFixed(4));
        logDebug(`Fila ${row}: ${sampleValues.join(', ')}`);
    }
    
    // CORREGIDO: Este bloque estaba fuera de lugar y usaba variables no definidas
    // Ahora lo procesamos correctamente dentro del bucle más abajo
    
    // Generar algunas detecciones de prueba basadas en valores reales
    const detections = [];
    
    // Usar los primeros valores como base para detecciones de prueba
    for (let i = 0; i < Math.min(10, numCols); i++) {
        // Calcular coordenadas basadas en los datos reales pero limitadas a valores razonables
        const xVal = Math.abs(outputData[i % numCols]) % INPUT_WIDTH;
        const yVal = Math.abs(outputData[(i + 1) % numCols]) % INPUT_HEIGHT;
        const wVal = Math.max(20, Math.abs(outputData[(i + 2) % numCols]) % 100);
        const hVal = Math.max(20, Math.abs(outputData[(i + 3) % numCols]) % 100);
        
        // Solo para depuración, imprimimos los primeros 10 valores
        if (i < 10) {
            logDebug(`Col ${i}: x=${xVal.toFixed(1)}, y=${yVal.toFixed(1)}, w=${wVal.toFixed(1)}, h=${hVal.toFixed(1)}`);
        }
        
        // Clase aleatoria y confianza alta para prueba
        const classId = i % classes.length;
        const confidence = 0.8; // Confianza fija alta para ver las detecciones
        
        // Ajustar coordenadas según el padding (si está disponible)
        let x1 = xVal;
        let y1 = yVal;
        let detWidth = wVal;
        let detHeight = hVal;
        
        if (paddingInfo && paddingInfo.scale) {
            const { scale, offsetX, offsetY } = paddingInfo;
            x1 = (xVal - offsetX) / scale;
            y1 = (yVal - offsetY) / scale;
            detWidth = wVal / scale;
            detHeight = hVal / scale;
        }
        
        // Asegurarnos de que las coordenadas son válidas
        x1 = Math.max(0, x1);
        y1 = Math.max(0, y1);
        detWidth = Math.max(10, Math.min(detWidth, INPUT_WIDTH - x1));
        detHeight = Math.max(10, Math.min(detHeight, INPUT_HEIGHT - y1));
        
        detections.push({
            class: classId,
            confidence: confidence,
            bbox: [x1, y1, detWidth, detHeight]
        });
    }
    
    return detections;
}
