// Aplicar Non-Maximum Suppression (NMS)
function applyNMS(detections, nmsThreshold) {
    if (detections.length <= 1) return detections;
    
    // Ordenar por confianza (de mayor a menor)
    const sortedDetections = [...detections].sort((a, b) => b.confidence - a.confidence);
    const selectedDetections = [];
    
    for (const detection of sortedDetections) {
        let keep = true;
        
        // Comprobar solapamiento con detecciones ya seleccionadas
        for (const selectedDetection of selectedDetections) {
            const iou = calculateIoU(detection.bbox, selectedDetection.bbox);
            
            if (iou > nmsThreshold) {
                keep = false;
                break;
            }
        }
        
        if (keep) {
            selectedDetections.push(detection);
        }
    }
    
    logDebug(`NMS: ${detections.length} -> ${selectedDetections.length} detecciones`);
    return selectedDetections;
}

// Calcular IoU (Intersection over Union) entre dos cajas (continuación)
function calculateIoU(box1, box2) {
    // Format: [x, y, width, height]
    const [x1, y1, w1, h1] = box1;
    const [x2, y2, w2, h2] = box2;
    
    // Calcular coordenadas de las esquinas
    const box1Right = x1 + w1;
    const box1Bottom = y1 + h1;
    const box2Right = x2 + w2;
    const box2Bottom = y2 + h2;
    
    // Calcular área de intersección
    const intersectLeft = Math.max(x1, x2);
    const intersectTop = Math.max(y1, y2);
    const intersectRight = Math.min(box1Right, box2Right);
    const intersectBottom = Math.min(box1Bottom, box2Bottom);
    
    // Verificar si hay intersección
    if (intersectRight < intersectLeft || intersectBottom < intersectTop) {
        return 0;
    }
    
    const intersectionArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
    
    // Calcular áreas de las cajas
    const box1Area = w1 * h1;
    const box2Area = w2 * h2;
    
    // Calcular IoU
    const unionArea = box1Area + box2Area - intersectionArea;
    
    return intersectionArea / unionArea;
}