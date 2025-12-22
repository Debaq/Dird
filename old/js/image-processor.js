function resizeImage(img, targetWidth = 640) {
    // Calcular dimensiones
    const aspectRatio = img.width / img.height;
    let newWidth, newHeight;
    
    // Determinar el lado más largo y ajustarlo a 640
    if (img.width > img.height) {
        newWidth = targetWidth;
        newHeight = Math.round(targetWidth / aspectRatio);
    } else {
        newHeight = targetWidth;
        newWidth = Math.round(targetWidth * aspectRatio);
    }
    
    // Crear canvas para la imagen redimensionada
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetWidth;
    const ctx = canvas.getContext('2d');
    
    // Rellenar con negro
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetWidth, targetWidth);
    
    // Calcular coordenadas para centrar la imagen redimensionada
    const offsetX = Math.floor((targetWidth - newWidth) / 2);
    const offsetY = Math.floor((targetWidth - newHeight) / 2);
    
    // Dibujar la imagen redimensionada
    ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
    
    return {
        canvas: canvas,
        width: targetWidth,
        height: targetWidth,
        ctx: ctx,
        aspectRatio: aspectRatio
    };
}

// Mejorada para garantizar el uso correcto del padding
function prepareImageForModel(img) {
    // Utilizar la función resizeImage para preparar el canvas
    const resizedImage = resizeImage(img);
    const canvas = resizedImage.canvas;
    
    // Obtener los datos de píxeles
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, INPUT_WIDTH, INPUT_HEIGHT);
    const data = imageData.data;
    
    // Crear tensor de entrada para ONNX
    // Formato [1, 3, HEIGHT, WIDTH] - NCHW (batch, canales, altura, ancho)
    const inputTensor = new Float32Array(1 * 3 * INPUT_HEIGHT * INPUT_WIDTH);
    
    // Normalizar y reordenar
    let offset = 0;
    // Para cada canal (R, G, B)
    for (let c = 0; c < 3; c++) {
        for (let h = 0; h < INPUT_HEIGHT; h++) {
            for (let w = 0; w < INPUT_WIDTH; w++) {
                // RGBA -> cada píxel ocupa 4 bytes
                const pixelOffset = (h * INPUT_WIDTH + w) * 4;
                // Normalizar a [0, 1]
                inputTensor[offset++] = data[pixelOffset + c] / 255.0;
            }
        }
    }
    
    // Información de padding simplificada
    const paddingInfo = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        scaledWidth: INPUT_WIDTH,
        scaledHeight: INPUT_HEIGHT,
        originalWidth: img.width,
        originalHeight: img.height
    };
    
    return {
        tensor: inputTensor,
        padding: paddingInfo
    };
}
function resizeImage(img, targetWidth = 640) {
    // Calcular dimensiones
    const aspectRatio = img.width / img.height;
    let newWidth, newHeight;
    
    // Determinar el lado más largo y ajustarlo a 640
    if (img.width > img.height) {
        newWidth = targetWidth;
        newHeight = Math.round(targetWidth / aspectRatio);
    } else {
        newHeight = targetWidth;
        newWidth = Math.round(targetWidth * aspectRatio);
    }
    
    // Crear canvas para la imagen redimensionada
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetWidth;
    const ctx = canvas.getContext('2d');
    
    // Rellenar con negro
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, targetWidth, targetWidth);
    
    // Calcular coordenadas para centrar la imagen redimensionada
    const offsetX = Math.floor((targetWidth - newWidth) / 2);
    const offsetY = Math.floor((targetWidth - newHeight) / 2);
    
    // Dibujar la imagen redimensionada
    ctx.drawImage(img, offsetX, offsetY, newWidth, newHeight);
    
    return {
        canvas: canvas,
        width: targetWidth,
        height: targetWidth,
        ctx: ctx,
        aspectRatio: aspectRatio
    };
}
// Nueva función para visualizar la imagen procesada antes de enviarla al modelo
function visualizeProcessedImage(inputData) {
    if (!DEBUG_MODE) return;
    
    try {
        // Crear un canvas para visualizar
        const canvas = document.createElement('canvas');
        canvas.width = INPUT_WIDTH;
        canvas.height = INPUT_HEIGHT;
        const ctx = canvas.getContext('2d');
        
        // Crear un ImageData con los datos de entrada
        const imageData = ctx.createImageData(INPUT_WIDTH, INPUT_HEIGHT);
        const data = imageData.data;
        
        // Convertir el tensor de entrada de vuelta a RGBA
        const inputTensor = inputData.tensor;
        
        for (let h = 0; h < INPUT_HEIGHT; h++) {
            for (let w = 0; w < INPUT_WIDTH; w++) {
                const pixelOffset = (h * INPUT_WIDTH + w) * 4;
                // Convertir de NCHW a RGBA
                for (let c = 0; c < 3; c++) {
                    const tensorIdx = c * INPUT_WIDTH * INPUT_HEIGHT + h * INPUT_WIDTH + w;
                    data[pixelOffset + c] = inputTensor[tensorIdx] * 255;
                }
                data[pixelOffset + 3] = 255; // Alpha = 255 (opaco)
            }
        }
        
        // Dibujar la imagen en el canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Visualizar el padding
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            inputData.padding.offsetX,
            inputData.padding.offsetY,
            inputData.padding.scaledWidth,
            inputData.padding.scaledHeight
        );
        
        // Crear un elemento de imagen para la depuración
        const debugImg = document.createElement('img');
        debugImg.src = canvas.toDataURL();
        debugImg.style.maxWidth = '200px';
        debugImg.style.border = '1px solid #ccc';
        debugImg.title = 'Imagen procesada enviada al modelo (con padding)';
        
        // Añadir al div de depuración
        const container = document.createElement('div');
        container.style.margin = '10px 0';
        
        const title = document.createElement('p');
        title.textContent = 'Imagen preprocesada para el modelo:';
        title.style.fontWeight = 'bold';
        title.style.margin = '5px 0';
        
        container.appendChild(title);
        container.appendChild(debugImg);
        
        const paddingInfo = document.createElement('p');
        paddingInfo.textContent = `Padding: X=${inputData.padding.offsetX}, Y=${inputData.padding.offsetY}, Scale=${inputData.padding.scale.toFixed(3)}`;
        paddingInfo.style.fontSize = '12px';
        paddingInfo.style.margin = '5px 0';
        
        container.appendChild(paddingInfo);
        
        // Añadir al contenedor de depuración
        debugInfo.appendChild(container);
    } catch (error) {
        logDebug(`Error al visualizar imagen procesada: ${error.message}`);
    }
}

// Escalar detecciones al tamaño de visualización
function scaleDetectionsToDisplay(detections, modelWidth, modelHeight, displayWidth, displayHeight) {
    const scaleX = displayWidth / modelWidth;
    const scaleY = displayHeight / modelHeight;
    
    return detections.map(det => {
        const [x, y, w, h] = det.bbox;
        
        // Escalar coordenadas al tamaño de visualización
        const scaledX = x * scaleX;
        const scaledY = y * scaleY;
        const scaledW = w * scaleX;
        const scaledH = h * scaleY;
        
        return {
            ...det,
            bbox: [scaledX, scaledY, scaledW, scaledH]
        };
    });
}
