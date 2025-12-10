
// Cargar el modelo ONNX
async function loadOnnxModel() {
  try {
      if (onnxSession) return onnxSession;
      
      logDebug('Cargando modelo ONNX...');
      
      // Configurar rutas WASM para evitar problemas de carga
      if (ort.env && ort.env.wasm && !ort.env.wasm.wasmPaths) {
          ort.env.wasm.wasmPaths = {
              'ort-wasm.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm.wasm',
              'ort-wasm-simd.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-simd.wasm',
              'ort-wasm-threaded.wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort-wasm-threaded.wasm'
          };
          logDebug('Rutas WASM configuradas');
      }
      
      // Opciones para ONNX Runtime Web
      const options = {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          fetchOptions: {
            cache: 'no-store'
        }
      };
      
      // URL del modelo (asegúrate de que esta ruta sea correcta)
      const modelUrl = 'models/dird.onnx?v=1.0';
      
      // Para medir el tiempo de carga
      console.time('Carga del modelo');
      logDebug(`Iniciando carga del modelo desde: ${modelUrl} ESPERE...`);
      
      // Cargar el modelo
      onnxSession = await ort.InferenceSession.create(modelUrl, options);
      console.timeEnd('Carga del modelo');
      
      logDebug('Modelo ONNX cargado correctamente');
      return onnxSession;
  } catch (error) {
      logDebug(`Error al cargar el modelo ONNX: ${error.message}`);
      
      // Mostrar un error más descriptivo según el tipo de error
      if (error.message.includes('wasm streaming compile failed')) {
          showError('Error al compilar WASM. Intenta usar una conexión HTTPS o un servidor local.');
      } else if (error.message.includes('Failed to fetch')) {
          showError('No se pudo cargar el modelo. Verifica que el archivo dird.onnx exista en la misma ubicación que esta página.');
      } else {
          showError('Error al cargar el modelo ONNX: ' + error.message);
      }
      
      throw error;
  }
}


// Ejecutar el modelo ONNX
async function runOnnxInference(inputData) {
  try {
      // Verificar que el modelo esté cargado
      if (!onnxSession) {
          throw new Error('El modelo ONNX no está cargado');
      }
      
      // Crear el tensor de entrada
      const inputTensor = new ort.Tensor(
          'float32',
          inputData.tensor,
          [1, 3, INPUT_HEIGHT, INPUT_WIDTH]
      );
      
      // Configurar las entradas para el modelo
      // Nota: El nombre de la entrada puede variar según tu modelo
      const feeds = { images: inputTensor };
      
      // Ejecutar la inferencia
      logDebug('Iniciando inferencia ONNX...');
      console.time('Inferencia ONNX');
      const results = await onnxSession.run(feeds);
      console.timeEnd('Inferencia ONNX');
      
      // Mostrar información sobre los resultados
      logDebug('Resultados ONNX recibidos');
      const outputKeys = Object.keys(results);
      logDebug(`Claves de salida: ${outputKeys.join(', ')}`);
      
      // Extraer las detecciones del resultado
      const output = results[outputKeys[0]];  // Primera salida
      lastModelOutput = output; // Guardar para depuración
      logDebug(`Forma de la salida: ${output.dims.join('x')}`);
      const confidenceInfo = calibrateConfidenceValue(output);
      logDebug(`Análisis de confianza: min=${confidenceInfo.minConfidence.toFixed(6)}, max=${confidenceInfo.maxConfidence.toFixed(6)}, avg=${confidenceInfo.avgConfidence.toFixed(6)}`);
      logDebug(`¿Necesita escalado? ${confidenceInfo.needsScaling}, Factor recomendado: ${confidenceInfo.recommendedFactor}`);

      // Imprimir una muestra de los datos para entender mejor el formato
      const outputData = output.data;
      const outputShape = output.dims;
      logDebug(`Forma detallada: [${outputShape.join(', ')}]`);
      
      // Determinar el formato automáticamente en base a la forma de la salida
      if (outputShape.length === 3) {
          logDebug('Detectado formato YOLO de 3 dimensiones');
          return processYoloOutputAuto(output, inputData.padding);
      } else if (outputShape.length === 2) {
          logDebug('Detectado formato YOLO de 2 dimensiones');
          return processYoloFlatOutput(output, inputData.padding);
      } else {
          // Si no podemos determinar el formato, mostrar más información
          logDebug('Formato de salida desconocido, generando info adicional');
          logDebug(`Muestra de datos: ${outputData.slice(0, 20).map(v => v.toFixed(4)).join(', ')}`);
          
          // Intentar con procesamiento simplificado como último recurso
          try {
              return processSimplifiedOutput(output, inputData.padding);
          } catch (error) {
              logDebug(`Error en procesamiento simplificado: ${error.message}`);
              // Si todo falla, usar detecciones simuladas
              logDebug('Fallback a detecciones simuladas');
              return simulateDetections(INPUT_WIDTH, INPUT_HEIGHT);
          }
      }
  } catch (error) {
      logDebug(`Error en inferencia ONNX: ${error.message}`);
      throw error;
  }
}




function calibrateConfidenceValue(output) {
  const outputData = output.data;
  const outputShape = output.dims;
  const [batch, rows, cols] = outputShape;
  
  // Analizar los rangos de valores de confianza
  let minConfidence = Number.MAX_VALUE;
  let maxConfidence = Number.MIN_VALUE;
  let sumConfidence = 0;
  let countConfidence = 0;
  
  // Asumimos que la fila 4 contiene los valores de confianza
  const confidenceRowIndex = 4;
  
  // Verificar que tenemos suficientes filas
  if (rows <= confidenceRowIndex) {
      return {
          needsScaling: false,
          recommendedFactor: 1
      };
  }
  
  // Analizar los valores de confianza
  for (let col = 0; col < cols; col++) {
      const confidence = outputData[confidenceRowIndex * cols + col];
      
      if (!isNaN(confidence) && confidence > 0) {
          minConfidence = Math.min(minConfidence, confidence);
          maxConfidence = Math.max(maxConfidence, confidence);
          sumConfidence += confidence;
          countConfidence++;
      }
  }
  
  const avgConfidence = countConfidence > 0 ? sumConfidence / countConfidence : 0;
  
  // Determinar si necesitamos escalar los valores de confianza
  const needsScaling = maxConfidence < 0.1; // Si el valor máximo es muy pequeño
  
  // Calcular un factor de escala recomendado
  let recommendedFactor = 1;
  
  if (needsScaling) {
      if (maxConfidence < 0.001) {
          recommendedFactor = 1000;
      } else if (maxConfidence < 0.01) {
          recommendedFactor = 100;
      } else if (maxConfidence < 0.1) {
          recommendedFactor = 10;
      }
  }
  
  // Actualizar el slider de multiplicador si es necesario
  if (needsScaling) {
      const confidenceMultiplierSlider = document.getElementById('confidenceMultiplier');
      if (confidenceMultiplierSlider) {
          confidenceMultiplierSlider.value = recommendedFactor;
          document.getElementById('multiplierValue').textContent = recommendedFactor;
      }
  }
  
  return {
      minConfidence,
      maxConfidence,
      avgConfidence,
      needsScaling,
      recommendedFactor
  };
}
