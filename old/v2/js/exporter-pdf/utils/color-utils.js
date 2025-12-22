/**
 * color-utils.js
 * Utilidades para manejo de colores en el PDF
 */

import { PDFSettings } from '../config/pdf-settings.js';

/**
 * Convierte un color hexadecimal a componentes RGB
 * @param {string} hex - Color en formato hexadecimal (#RRGGBB)
 * @returns {Object} Objeto con componentes RGB
 */
export function hexToRgb(hex) {
    // Si no es un color, devolver negro
    if (!hex || typeof hex !== 'string') {
        return { r: 0, g: 0, b: 0 };
    }
    
    // Eliminar # si está presente
    hex = hex.replace(/^#/, '');
    
    // Si es un formato acortado (#RGB), convertirlo a #RRGGBB
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    
    // Validar formato
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        console.warn(`Color hexadecimal inválido: ${hex}, usando negro como fallback`);
        return { r: 0, g: 0, b: 0 };
    }
    
    // Parsear componentes
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return { r, g, b };
}

/**
 * Convierte un color RGB a formato hexadecimal
 * @param {number} r - Componente rojo (0-255)
 * @param {number} g - Componente verde (0-255)
 * @param {number} b - Componente azul (0-255)
 * @returns {string} Color en formato hexadecimal (#RRGGBB)
 */
export function rgbToHex(r, g, b) {
    // Asegurar que los valores estén en el rango 0-255
    r = Math.max(0, Math.min(255, Math.round(r)));
    g = Math.max(0, Math.min(255, Math.round(g)));
    b = Math.max(0, Math.min(255, Math.round(b)));
    
    // Convertir a hex y poner ceros a la izquierda si es necesario
    const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    
    return `#${hex}`;
}

/**
 * Parsea un color en diferentes formatos y lo convierte a componentes RGB
 * @param {string} color - Color en formato hex, rgb() o nombre
 * @returns {Object} Componentes RGB
 */
export function parseColor(color) {
    // Si ya es un objeto RGB, devolverlo
    if (color && typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
        return color;
    }
    
    // Si no es un string, devolver negro
    if (!color || typeof color !== 'string') {
        return { r: 0, g: 0, b: 0 };
    }
    
    // Si es formato hex, usar hexToRgb
    if (color.startsWith('#')) {
        return hexToRgb(color);
    }
    
    // Si es formato rgb() o rgba()
    const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3])
        };
    }
    
    const rgbaMatch = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1]),
            g: parseInt(rgbaMatch[2]),
            b: parseInt(rgbaMatch[3]),
            a: parseFloat(rgbaMatch[4])
        };
    }
    
    // Nombres de colores comunes
    const colorNames = {
        black: '#000000',
        white: '#ffffff',
        red: '#ff0000',
        green: '#00ff00',
        blue: '#0000ff',
        yellow: '#ffff00',
        cyan: '#00ffff',
        magenta: '#ff00ff',
        gray: '#808080',
        grey: '#808080',
        lightgray: '#d3d3d3',
        lightgrey: '#d3d3d3',
        darkgray: '#a9a9a9',
        darkgrey: '#a9a9a9',
        navy: '#000080',
        purple: '#800080',
        olive: '#808000',
        maroon: '#800000',
        teal: '#008080',
        aqua: '#00ffff',
        lime: '#00ff00',
        silver: '#c0c0c0',
        orange: '#ffa500',
        brown: '#a52a2a',
        pink: '#ffc0cb'
    };
    
    // Buscar en la lista de nombres de colores
    const colorLower = color.toLowerCase();
    if (colorNames[colorLower]) {
        return hexToRgb(colorNames[colorLower]);
    }
    
    // Si no se reconoce el formato, devolver el color por defecto
    console.warn(`Formato de color no reconocido: ${color}, usando color por defecto`);
    return hexToRgb(PDFSettings.style.colors.primary);
}

/**
 * Aplica un componente RGB a un documento jsPDF
 * @param {Object} doc - Documento jsPDF
 * @param {string|Object} color - Color a aplicar
 * @param {string} method - Método a llamar ('setTextColor', 'setFillColor', 'setDrawColor')
 */
export function applyColorToDoc(doc, color, method = 'setTextColor') {
    try {
        // Convertir el color a componentes RGB
        const rgb = parseColor(color);
        
        // Aplicar el color al documento
        doc[method](rgb.r, rgb.g, rgb.b);
    } catch (error) {
        console.error(`Error al aplicar color en método ${method}:`, error);
        
        // Fallback a color negro
        doc[method](0, 0, 0);
    }
}

/**
 * Calcula la luminancia de un color (para determinar si es claro u oscuro)
 * @param {string|Object} color - Color a analizar
 * @returns {number} Luminancia (0-1)
 */
export function getLuminance(color) {
    const rgb = parseColor(color);
    
    // Fórmula para luminancia percibida
    // https://www.w3.org/TR/WCAG20-TECHS/G17.html#G17-tests
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    
    return luminance;
}

/**
 * Determina si un color es oscuro basado en su luminancia
 * @param {string|Object} color - Color a analizar
 * @returns {boolean} true si el color es oscuro
 */
export function isColorDark(color) {
    return getLuminance(color) < 0.5;
}

/**
 * Retorna un color de texto apropiado para un fondo dado
 * @param {string|Object} backgroundColor - Color de fondo
 * @returns {Object} Color para el texto en formato RGB
 */
export function getContrastTextColor(backgroundColor) {
    return isColorDark(backgroundColor) ? 
        { r: 255, g: 255, b: 255 } : // Blanco para fondos oscuros
        { r: 0, g: 0, b: 0 };       // Negro para fondos claros
}

/**
 * Ajusta el brillo de un color
 * @param {string|Object} color - Color a ajustar
 * @param {number} factor - Factor de ajuste (-1 a 1, negativo oscurece, positivo aclara)
 * @returns {Object} Color ajustado en formato RGB
 */
export function adjustBrightness(color, factor) {
    const rgb = parseColor(color);
    
    // Ajustar cada componente
    const r = Math.max(0, Math.min(255, rgb.r + factor * 255));
    const g = Math.max(0, Math.min(255, rgb.g + factor * 255));
    const b = Math.max(0, Math.min(255, rgb.b + factor * 255));
    
    return { r, g, b };
}

/**
 * Genera un degradado de colores
 * @param {string|Object} color1 - Color inicial
 * @param {string|Object} color2 - Color final
 * @param {number} steps - Número de pasos en el degradado
 * @returns {Array} Array de colores en formato RGB
 */
export function generateGradient(color1, color2, steps = 10) {
    const rgb1 = parseColor(color1);
    const rgb2 = parseColor(color2);
    
    const gradient = [];
    
    for (let i = 0; i < steps; i++) {
        const factor = i / (steps - 1);
        
        const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
        const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
        const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));
        
        gradient.push({ r, g, b });
    }
    
    return gradient;
}

/**
 * Obtiene el color para una clase específica del modelo
 * @param {number|string} classId - ID o nombre de la clase
 * @returns {Object} Color en formato RGB
 */
export function getClassColor(classId) {
    try {
        let color;
        
        // Si es un string, buscar por nombre
        if (typeof classId === 'string') {
            // Primero intentar con window.ClassDefinitions
            if (window.ClassDefinitions && window.ClassDefinitions.getByName) {
                const classInfo = window.ClassDefinitions.getByName(classId);
                if (classInfo && classInfo.color) {
                    color = classInfo.color;
                }
            }
            
            // Si no encontramos el color, buscar en window.classes
            if (!color && window.classes) {
                const index = window.classes.indexOf(classId);
                if (index !== -1 && window.colors && index < window.colors.length) {
                    color = window.colors[index];
                }
            }
        } 
        // Si es un número, buscar por ID
        else if (typeof classId === 'number') {
            // Primero intentar con window.ClassDefinitions
            if (window.ClassDefinitions && window.ClassDefinitions.getById) {
                const classInfo = window.ClassDefinitions.getById(classId);
                if (classInfo && classInfo.color) {
                    color = classInfo.color;
                }
            }
            
            // Si no encontramos el color, usar window.colors
            if (!color && window.colors && classId < window.colors.length) {
                color = window.colors[classId];
            }
        }
        
        // Si encontramos un color, parsearlo
        if (color) {
            return parseColor(color);
        }
    } catch (error) {
        console.error('Error al obtener color de clase:', error);
    }
    
    // Devolver color por defecto si no se encontró
    return parseColor(PDFSettings.resources.defaultFallbackColor);
}


/**
 * Obtiene el color hexadecimal para una clase
 * @param {number} classId - ID de la clase
 * @returns {string} Color en formato hexadecimal
 */
export function getClassColorHex(classId) {
    let color = '';
    
    // Intentar obtener el color de ClassDefinitions
    if (window.ClassDefinitions && window.ClassDefinitions.getById) {
        const classInfo = window.ClassDefinitions.getById(classId);
        if (classInfo && classInfo.color) {
            color = classInfo.color;
        }
    }
    
    // Si no se encontró, intentar obtenerlo de window.colors
    if (!color && window.colors && classId < window.colors.length) {
        color = window.colors[classId];
    }
    
    // Si aún no hay color, usar uno predeterminado según el ID
    if (!color) {
        const defaultColors = [
            '#FF3838', '#48F90A', '#FFB21D', '#00C2FF', 
            '#7B83EB', '#FFA6D9', '#54FFBD', '#FF6E1D'
        ];
        
        color = defaultColors[classId % defaultColors.length];
    }
    
    return color;
}