// Función para procesar la imagen con YOLO
async function processYoloDetection(imageURL) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // Establecer la última imagen procesada
        lastProcessedImage = imageURL;
        
        img.onload = async function() {
            try {
                logDebug(`Imagen cargada: ${img.width}x${img.height}`);
                
                // 1. Redimensionar la imagen para visualización (640px de ancho)
                const displayWidth = 640;
                const resizedImg = resizeImage(img, displayWidth);
                
                // 2. Configurar el canvas para mostrar la imagen redimensionada
                const ctx = outputCanvas.getContext('2d');
                outputCanvas.width = resizedImg.width;
                outputCanvas.height = resizedImg.height;
                
                // 3. Dibujar la imagen redimensionada en el canvas de salida
                ctx.drawImage(resizedImg.canvas, 0, 0);
                
                logDebug(`Imagen redimensionada a ${resizedImg.width}x${resizedImg.height} para visualización`);
                
                // 4. Preparar la imagen para el modelo YOLO (640x640)
                const inputData = prepareImageForModel(img);
                logDebug(`Imagen preparada para modelo: ${INPUT_WIDTH}x${INPUT_HEIGHT}`);
                logDebug(`Padding aplicado: offsetX=${inputData.padding.offsetX}, offsetY=${inputData.padding.offsetY}, scale=${inputData.padding.scale}`);
                
                // NUEVO: Visualizar la imagen preparada para depuración (opcional)
                visualizeProcessedImage(inputData);
                
                // 5. Realizar la inferencia con el modelo ONNX
                try {
                    const detections = await runOnnxInference(inputData);
                  
                    // 6. Escalar las detecciones al tamaño de visualización
                    const scaledDetections = scaleDetectionsToDisplay(
                        detections,
                        INPUT_WIDTH, INPUT_HEIGHT,
                        resizedImg.width, resizedImg.height
                    );
                    
                    logDebug(`Detecciones escaladas para visualización: ${scaledDetections.length}`);
                    
                    // 7. Dibujar las detecciones en la imagen
                    drawDetections(ctx, scaledDetections);
                    
                    // NUEVO: Emitir evento de procesamiento completado para facilitar
                    // la integración con otros componentes (como zoom.js)
                    const processCompleteEvent = new CustomEvent('yolo-processing-complete', {
                        detail: { 
                            canvas: outputCanvas, 
                            detections: scaledDetections,
                            originalImage: img
                        }
                    });
                    document.dispatchEvent(processCompleteEvent);
                    
                    resolve(scaledDetections);
                } catch (inferenceError) {
                    logDebug(`Error en inferencia: ${inferenceError.message}`);
                    showError(`Error en la inferencia del modelo: ${inferenceError.message}`);
                    
                    // Intentar con detecciones simuladas para depuración
                    logDebug('Usando detecciones simuladas para depuración');
                    const simulatedDetections = simulateDetections(resizedImg.width, resizedImg.height);
                    drawDetections(ctx, simulatedDetections);
                    
                    // NUEVO: Emitir evento incluso con detecciones simuladas
                    const processCompleteEvent = new CustomEvent('yolo-processing-complete', {
                        detail: { 
                            canvas: outputCanvas, 
                            detections: simulatedDetections,
                            originalImage: img,
                            isSimulated: true
                        }
                    });
                    document.dispatchEvent(processCompleteEvent);
                    
                    resolve(simulatedDetections); // Seguimos mostrando resultado aunque haya error
                }
            } catch (error) {
                reject(error);
            }
        };
        
        img.onerror = function() {
            reject(new Error('Error al cargar la imagen'));
        };
        
        img.src = imageURL;
    });
}

// Asignar a window para que sea accesible desde otros scripts
window.processYoloDetection = processYoloDetection;



// Función para procesar automáticamente diferentes formatos de YOLO
function processYoloOutputAuto(output, paddingInfo) {
    const outputData = output.data;
    const outputShape = output.dims;
    
    // Obtener valores de los controles
    const confidenceThreshold = parseFloat(confidenceThresholdSlider.value);
    const nmsThreshold = parseFloat(nmsThresholdSlider.value);
    const MAX_DETECTIONS = parseInt(maxDetectionsSlider.value);
    
    logDebug(`Parámetros: umbral=${confidenceThreshold}, NMS=${nmsThreshold}`);
    
    // Analizar estructura de datos
    if (outputShape.length === 3) {
        const [batch, rows, cols] = outputShape;
        logDebug(`Estructura: batch=${batch}, rows=${rows}, cols=${cols}`);
        
        // Determinar qué formato de YOLO es basado en el número de filas
        let detections = [];
        
        if (rows === 4) {
            // Probablemente YOLO v8 con formato [batch, 4, N]: x, y, w, h
            detections = processYoloV8Format(outputData, outputShape, confidenceThreshold);
        } else if (rows === 7) {
            // Formato específico con 7 filas
            detections = processYoloV11Output(output, paddingInfo);
        } else if (rows > 4) {
            // Formato YOLO genérico con coordenadas + clases
            detections = processYoloGenericFormat(outputData, outputShape, confidenceThreshold);
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
    
    throw new Error('Formato de salida no compatible');
}

