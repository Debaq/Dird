// Función correcta para escalar detecciones
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
        
        // Asegurarse de que la caja no se salga de los límites
        const clampedX = Math.max(0, Math.min(scaledX, displayWidth - 1));
        const clampedY = Math.max(0, Math.min(scaledY, displayHeight - 1));
        const clampedW = Math.min(scaledW, displayWidth - clampedX);
        const clampedH = Math.min(scaledH, displayHeight - clampedY);
        
        return {
            ...det,
            bbox: [clampedX, clampedY, clampedW, clampedH]
        };
    });
}


