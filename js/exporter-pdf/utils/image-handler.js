/**
 * image-handler.js
 * Funciones para manejar y preparar imágenes para el PDF
 */

import { PDFSettings } from '../config/pdf-settings.js';

/**
 * Carga una imagen de forma segura con manejo de errores y timeouts
 * @param {string} src - URL de la imagen
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<HTMLImageElement>} Promesa con la imagen cargada
 */
export function safeLoadImage(src, options = {}) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        // Establecer crossOrigin si es necesario
        if (options.crossOrigin) {
            img.crossOrigin = options.crossOrigin;
        }
        
        // Timeout para evitar esperas infinitas
        const timeout = options.timeout || 5000;
        const timeoutId = setTimeout(() => {
            const error = new Error(`Timeout loading image: ${src}`);
            error.name = 'ImageLoadTimeout';
            
            // Si hay una imagen de respaldo, intentar cargarla
            if (options.fallbackSrc) {
                console.warn(`Image load timeout: ${src}, trying fallback`);
                safeLoadImage(options.fallbackSrc, {
                    ...options,
                    fallbackSrc: null, // Evitar recursión infinita
                    timeout: timeout * 1.5 // Dar más tiempo al fallback
                }).then(resolve).catch(reject);
            } else {
                reject(error);
            }
        }, timeout);
        
        // Evento de carga exitosa
        img.onload = () => {
            clearTimeout(timeoutId);
            resolve(img);
        };
        
        // Evento de error
        img.onerror = (error) => {
            clearTimeout(timeoutId);
            console.error(`Error loading image: ${src}`, error);
            
            // Si hay una imagen de respaldo, intentar cargarla
            if (options.fallbackSrc) {
                console.warn(`Image load error: ${src}, trying fallback`);
                safeLoadImage(options.fallbackSrc, {
                    ...options,
                    fallbackSrc: null // Evitar recursión infinita
                }).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to load image: ${src}`));
            }
        };
        
        // Iniciar carga
        img.src = src;
    });
}

/**
 * Convierte un canvas a una URL de datos optimizada para PDF
 * @param {HTMLCanvasElement} canvas - Canvas a convertir
 * @param {Object} options - Opciones adicionales
 * @returns {string} URL de datos de la imagen
 */
export function canvasToOptimizedDataURL(canvas, options = {}) {
    // Opciones por defecto
    const settings = {
        format: options.format || 'image/jpeg', // JPEG es más estable que PNG con jsPDF
        quality: options.quality || PDFSettings.content.imageQuality,
        maxWidth: options.maxWidth || 1200,
        maxHeight: options.maxHeight || 1200
    };
    
    try {
        // Si el canvas es muy grande, redimensionarlo
        if (canvas.width > settings.maxWidth || canvas.height > settings.maxHeight) {
            // Crear un canvas temporal para redimensionar
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            
            // Calcular nueva dimensión manteniendo proporción
            const ratio = Math.min(
                settings.maxWidth / canvas.width,
                settings.maxHeight / canvas.height
            );
            
            tempCanvas.width = canvas.width * ratio;
            tempCanvas.height = canvas.height * ratio;
            
            // Dibujar la imagen redimensionada
            ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
            
            // Usar el canvas redimensionado
            return tempCanvas.toDataURL(settings.format, settings.quality);
        }
        
        // Si no necesita redimensionado, convertir directamente
        return canvas.toDataURL(settings.format, settings.quality);
    } catch (error) {
        console.error('Error al optimizar canvas:', error);
        
        // Intentar con formato JPEG si falló
        if (settings.format !== 'image/jpeg') {
            try {
                return canvas.toDataURL('image/jpeg', settings.quality);
            } catch (jpegError) {
                console.error('Error al convertir a JPEG:', jpegError);
                throw error; // Propagar el error original
            }
        }
        
        throw error;
    }
}

/**
 * Crea una miniatura a partir de una imagen y coordenadas de detección
 * @param {HTMLImageElement} sourceImg - Imagen fuente
 * @param {Array} bbox - Bounding box [x, y, width, height]
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} URL de datos de la miniatura
 */
export async function createDetectionThumbnail(sourceImg, bbox, options = {}) {
    try {
        // Extraer coordenadas
        const [x, y, width, height] = bbox;
        
        // Opciones
        const thumbnailSize = options.size || PDFSettings.content.thumbnailSize;
        const quality = options.quality || PDFSettings.content.imageQuality;
        const borderWidth = options.borderWidth || 2;
        const borderColor = options.borderColor || PDFSettings.style.colors.primary;
        const format = options.format || 'image/jpeg';
        
        // Crear canvas para la miniatura
        const canvas = document.createElement('canvas');
        canvas.width = thumbnailSize;
        canvas.height = thumbnailSize;
        const ctx = canvas.getContext('2d');
        
        // Llenar fondo
        ctx.fillStyle = PDFSettings.style.colors.background;
        ctx.fillRect(0, 0, thumbnailSize, thumbnailSize);
        
        // Ajustar recorte para asegurar que está dentro de los límites de la imagen
        const cropX = Math.max(0, Math.round(x));
        const cropY = Math.max(0, Math.round(y));
        const cropWidth = Math.min(Math.round(width), sourceImg.width - cropX);
        const cropHeight = Math.min(Math.round(height), sourceImg.height - cropY);
        
        // Verificar que tenemos dimensiones válidas
        if (cropWidth <= 0 || cropHeight <= 0) {
            throw new Error('Dimensiones de recorte inválidas');
        }
        
        // Calcular dimensiones para ajustar proporcionalmente al canvas
        const scale = Math.min(
            (thumbnailSize - borderWidth * 2) / cropWidth,
            (thumbnailSize - borderWidth * 2) / cropHeight
        );
        
        const scaledWidth = cropWidth * scale;
        const scaledHeight = cropHeight * scale;
        
        // Calcular posición centrada
        const offsetX = (thumbnailSize - scaledWidth) / 2;
        const offsetY = (thumbnailSize - scaledHeight) / 2;
        
        // Dibujar la imagen recortada y escalada
        ctx.drawImage(
            sourceImg,
            cropX, cropY, cropWidth, cropHeight,
            offsetX, offsetY, scaledWidth, scaledHeight
        );
        
        // Dibujar borde
        if (borderWidth > 0) {
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = borderWidth;
            ctx.strokeRect(offsetX, offsetY, scaledWidth, scaledHeight);
        }
        
        // Convertir a dataURL
        return canvas.toDataURL(format, quality);
    } catch (error) {
        console.error('Error al crear miniatura:', error);
        
        // Crear una miniatura de error
        const errorCanvas = document.createElement('canvas');
        errorCanvas.width = options.size || PDFSettings.content.thumbnailSize;
        errorCanvas.height = options.size || PDFSettings.content.thumbnailSize;
        
        const errorCtx = errorCanvas.getContext('2d');
        
        // Fondo gris claro
        errorCtx.fillStyle = '#f0f0f0';
        errorCtx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);
        
        // Texto de error
        errorCtx.fillStyle = '#888888';
        errorCtx.font = '10px Arial';
        errorCtx.textAlign = 'center';
        errorCtx.fillText('Error de imagen', errorCanvas.width/2, errorCanvas.height/2 - 5);
        errorCtx.fillText('no disponible', errorCanvas.width/2, errorCanvas.height/2 + 10);
        
        // Borde rojo
        errorCtx.strokeStyle = '#e74c3c';
        errorCtx.lineWidth = 2;
        errorCtx.strokeRect(2, 2, errorCanvas.width - 4, errorCanvas.height - 4);
        
        return errorCanvas.toDataURL('image/jpeg', 0.7);
    }
}

/**
 * Captura de forma segura la imagen del canvas
 * @param {HTMLCanvasElement} canvas - Canvas a capturar
 * @param {Object} options - Opciones adicionales
 * @returns {Promise<string>} URL de datos de la imagen
 */
export async function captureCanvas(canvas, options = {}) {
    try {
        // Intentar convertir directamente
        return await canvasToOptimizedDataURL(canvas, options);
    } catch (error) {
        console.error('Error capturando canvas, intentando método alternativo:', error);
        
        // Método alternativo: dibujar en un nuevo canvas
        try {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            
            const ctx = tempCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            ctx.drawImage(canvas, 0, 0);
            
            return tempCanvas.toDataURL(options.format || 'image/jpeg', options.quality || PDFSettings.content.imageQuality);
        } catch (alternativeError) {
            console.error('Error en método alternativo de captura de canvas:', alternativeError);
            
            // Crear imagen de error
            const errorCanvas = document.createElement('canvas');
            errorCanvas.width = 300;
            errorCanvas.height = 200;
            
            const errorCtx = errorCanvas.getContext('2d');
            errorCtx.fillStyle = '#f8f9fa';
            errorCtx.fillRect(0, 0, errorCanvas.width, errorCanvas.height);
            
            errorCtx.fillStyle = '#e74c3c';
            errorCtx.font = '16px Arial';
            errorCtx.textAlign = 'center';
            errorCtx.fillText('Error al capturar imagen', errorCanvas.width/2, errorCanvas.height/2 - 10);
            errorCtx.fillStyle = '#666666';
            errorCtx.font = '12px Arial';
            errorCtx.fillText('La imagen no pudo ser procesada', errorCanvas.width/2, errorCanvas.height/2 + 15);
            
            return errorCanvas.toDataURL('image/jpeg', 0.7);
        }
    }
}

/**
 * Carga el logo del proyecto de forma segura para el PDF
 * @returns {Promise<string>} URL de datos del logo
 */
export async function loadProjectLogo() {
    try {
        // Intentar cargar el logo primario
        const logoImg = await safeLoadImage(PDFSettings.resources.logoPath, {
            crossOrigin: 'anonymous',
            fallbackSrc: PDFSettings.resources.logoAlternativePath,
            timeout: 3000
        });
        
        // Crear un canvas para procesar el logo
        const canvas = document.createElement('canvas');
        const maxWidth = PDFSettings.resources.maxLogoWidth;
        
        // Redimensionar manteniendo proporción
        const ratio = logoImg.height / logoImg.width;
        canvas.width = maxWidth;
        canvas.height = maxWidth * ratio;
        
        // Dibujar logo
        const ctx = canvas.getContext('2d');
        ctx.drawImage(logoImg, 0, 0, canvas.width, canvas.height);
        
        // Devolver como URL de datos
        return canvas.toDataURL('image/jpeg', 0.95);
    } catch (error) {
        console.error('Error al cargar el logo del proyecto:', error);
        
        // Crear un logo de texto como respaldo
        const canvas = document.createElement('canvas');
        canvas.width = PDFSettings.resources.maxLogoWidth;
        canvas.height = 50;
        
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = PDFSettings.style.colors.primary;
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DIRD', canvas.width/2, canvas.height/2);
        
        return canvas.toDataURL('image/jpeg', 0.9);
    }
}