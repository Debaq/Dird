/**
 * pdf-styles.js
 * Definición de estilos y funciones de estilo para el PDF
 */

import { PDFSettings } from './pdf-settings.js';

/**
 * Aplica estilos de título principal al documento
 * @param {Object} doc - Documento jsPDF
 */
export function applyTitleStyle(doc) {
    const { font, colors } = PDFSettings.style;
    
    doc.setFont(font.family, 'bold');
    doc.setFontSize(font.titleSize);
    doc.setTextColor(
        hexToRgb(colors.primary).r,
        hexToRgb(colors.primary).g,
        hexToRgb(colors.primary).b
    );
}

/**
 * Aplica estilos de subtítulo al documento
 * @param {Object} doc - Documento jsPDF
 */
export function applySubtitleStyle(doc) {
    const { font, colors } = PDFSettings.style;
    
    doc.setFont(font.family, 'bold');
    doc.setFontSize(font.subtitleSize);
    doc.setTextColor(
        hexToRgb(colors.secondary).r,
        hexToRgb(colors.secondary).g,
        hexToRgb(colors.secondary).b
    );
}

/**
 * Aplica estilos de texto normal al documento
 * @param {Object} doc - Documento jsPDF
 */
export function applyNormalTextStyle(doc) {
    const { font, colors } = PDFSettings.style;
    
    doc.setFont(font.family, 'normal');
    doc.setFontSize(font.normalSize);
    doc.setTextColor(
        hexToRgb(colors.text).r,
        hexToRgb(colors.text).g,
        hexToRgb(colors.text).b
    );
}

/**
 * Aplica estilos de texto pequeño al documento
 * @param {Object} doc - Documento jsPDF
 */
export function applySmallTextStyle(doc) {
    const { font, colors } = PDFSettings.style;
    
    doc.setFont(font.family, 'normal');
    doc.setFontSize(font.smallSize);
    doc.setTextColor(
        hexToRgb(colors.light).r,
        hexToRgb(colors.light).g,
        hexToRgb(colors.light).b
    );
}

/**
 * Dibuja un separador horizontal en el documento
 * @param {Object} doc - Documento jsPDF
 * @param {number} y - Posición Y donde dibujar el separador
 * @param {Object} options - Opciones adicionales
 * @returns {number} Nueva posición Y después del separador
 */
export function drawSeparator(doc, y, options = {}) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margins = PDFSettings.layout.margins;
    const lineColor = options.color || PDFSettings.style.page.lineColor;
    const lineWidth = options.width || PDFSettings.style.page.lineWidth;
    const spacing = options.spacing || PDFSettings.layout.spacing.paragraph;
    
    // Convertir color a RGB
    const rgb = hexToRgb(lineColor);
    
    // Establecer color y grosor de línea
    doc.setDrawColor(rgb.r, rgb.g, rgb.b);
    doc.setLineWidth(lineWidth);
    
    // Dibujar línea
    doc.line(
        margins.left,
        y,
        pageWidth - margins.right,
        y
    );
    
    // Devolver nueva posición Y con espaciado
    return y + spacing;
}

/**
 * Convierte colores de formato hex a objeto RGB
 * @param {string} hex - Color en formato hexadecimal (#RRGGBB)
 * @returns {Object} Objeto con componentes RGB
 */
export function hexToRgb(hex) {
    // Eliminar # si está presente
    hex = hex.replace(/^#/, '');
    
    // Parsear componentes
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    
    return { r, g, b };
}

/**
 * Convierte un color de clase al formato RGB requerido por jsPDF
 * @param {string} classColor - Color de la clase (puede ser nombre o hex)
 * @returns {Object} Componentes RGB
 */
export function getClassColorRgb(classColor) {
    // Si no hay color, usar el color de fallback
    if (!classColor) {
        return hexToRgb(PDFSettings.resources.defaultFallbackColor);
    }
    
    // Si el color ya está en hex, convertir directamente
    if (classColor.startsWith('#')) {
        return hexToRgb(classColor);
    }
    
    // Mapa de nombres de colores comunes a hex
    const colorMap = {
        'red': '#ff0000',
        'green': '#00ff00',
        'blue': '#0000ff',
        'black': '#000000',
        'white': '#ffffff',
        'yellow': '#ffff00',
        'cyan': '#00ffff',
        'magenta': '#ff00ff',
        'gray': '#808080',
        'orange': '#ffa500',
        'purple': '#800080',
        'brown': '#a52a2a',
        'pink': '#ffc0cb',
        'lime': '#00ff00',
        'indigo': '#4b0082',
        'violet': '#ee82ee',
        'turquoise': '#40e0d0',
        'navy': '#000080',
        'maroon': '#800000',
        'olive': '#808000',
        'teal': '#008080'
    };
    
    // Buscar el hex correspondiente en el mapa de colores
    const hex = colorMap[classColor.toLowerCase()] || PDFSettings.resources.defaultFallbackColor;
    
    return hexToRgb(hex);
}

/**
 * Comprueba si un color es oscuro (para decidir si usar texto blanco o negro)
 * @param {string} hexColor - Color en formato hex
 * @returns {boolean} true si el color es oscuro
 */
export function isColorDark(hexColor) {
    const rgb = hexToRgb(hexColor);
    // Fórmula para luminancia perceptual
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance < 0.5;
}

/**
 * Genera un color contrastante para texto sobre un fondo dado
 * @param {string} backgroundColor - Color de fondo en hex
 * @returns {Object} Color RGB para el texto
 */
export function getContrastTextColor(backgroundColor) {
    return isColorDark(backgroundColor) ? 
        { r: 255, g: 255, b: 255 } : // Blanco para fondos oscuros
        { r: 0, g: 0, b: 0 };       // Negro para fondos claros
}

/**
 * Dibuja un rectángulo con esquinas redondeadas
 * @param {Object} doc - Documento jsPDF
 * @param {number} x - Posición X
 * @param {number} y - Posición Y
 * @param {number} w - Ancho
 * @param {number} h - Alto
 * @param {number} r - Radio de las esquinas
 * @param {string} style - Estilo ('F'=fill, 'S'=stroke, 'DF'=ambos)
 */
export function roundedRect(doc, x, y, w, h, r, style = 'F') {
    const k = doc.internal.scaleFactor;
    const hp = doc.internal.pageSize.getHeight();
    
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    
    // Convertir a unidades del documento
    x = x * k;
    y = (hp - y) * k;
    w = w * k;
    h = h * k;
    r = r * k;
    
    // Factor para curvas Bezier aproximadas
    const c = 0.551915024494;
    
    // Comenzar en esquina superior izquierda
    doc.internal.out([
        'q',                                            // Guardar estado gráfico
        '1 j',                                         // Unión redondeada
        'q',                                            // Guardar estado gráfico
        '0 J',                                         // Tapa redonda
        w - 2 * r + ' ' + (2 * r) + ' m',             // Mover a punto inicial
        w + ' ' + r + ' l',                           // Borde derecho
        w + ' ' + (h - r) + ' l',                     // Hasta esquina inferior derecha
        w - r + ' ' + h + ' ' + w + ' ' + (h - r) + ' ' + w + ' ' + h + ' c',  // Curva esquina inferior derecha
        r + ' ' + h + ' l',                           // Borde inferior
        '0 ' + (h - r) + ' l',                        // Hasta esquina inferior izquierda
        '0 ' + (h - r) + ' ' + r + ' ' + h + ' ' + '0 ' + h + ' c',  // Curva esquina inferior izquierda
        '0 ' + r + ' l',                              // Borde izquierdo
        '0 ' + r + ' ' + r + ' ' + '0 ' + '0 ' + '0 c',  // Curva esquina superior izquierda
        w - r + ' ' + '0 l',                          // Borde superior
        w - r + ' ' + '0 ' + w + ' ' + r + ' ' + w + ' ' + '0 c',  // Curva esquina superior derecha
        'h',                                           // Cerrar ruta
        'f',                                           // Fill
        'Q',                                           // Restaurar estado gráfico
        'Q'                                            // Restaurar estado gráfico
    ].join(' '));
}