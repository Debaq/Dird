// Variables globales para controlar el estado
let zoomInitialized = false;
let imageToggleBtn = null;
let originalImageDisplay = null;
let detectionImageDisplay = null;
let canvasRef = null; // Referencia al canvas para mantenerla

// Asegurarnos de que lastProcessedImage esté accesible
document.addEventListener('DOMContentLoaded', function() {
    console.log("zoom.js inicializado");
    
    // Verificar si lastProcessedImage existe en el ámbito global
    if (typeof window.lastProcessedImage === 'undefined') {
        console.log("Creando variable global lastProcessedImage");
        window.lastProcessedImage = null;
    }
    
    // Esperar un momento para asegurarnos de que todo está cargado
    setTimeout(function() {
        // Monitorear cambios en el canvas de salida
        const outputCanvas = document.getElementById('outputCanvas');
        
        if (outputCanvas) {
            console.log("Canvas encontrado, configurando observer");
            // Guardar referencia al canvas
            canvasRef = outputCanvas;
            
            // Configurar un MutationObserver para detectar cambios en el canvas
            const observer = new MutationObserver(function(mutations) {
                console.log("Cambios detectados en el canvas");
                // Verificar que hay una imagen procesada
                if (window.lastImageURL || window.lastProcessedImage) {
                    setupImageViewer();
                } else {
                    console.log("No hay imagen procesada disponible");
                }
            });
            
            // Iniciar observación
            observer.observe(outputCanvas, { 
                attributes: true, 
                attributeFilter: ['width', 'height'] 
            });
            
            // También observar el contenedor de resultados
            const resultContainer = document.getElementById('resultContainer');
            if (resultContainer) {
                observer.observe(resultContainer, { 
                    attributes: true, 
                    attributeFilter: ['style'] 
                });
            }
        } else {
            console.log("Canvas no encontrado inicialmente, se buscará más tarde");
        }
        
        // Monitorear clicks en sliders
        const sliders = document.querySelectorAll('input[type="range"]');
        sliders.forEach(slider => {
            slider.addEventListener('input', function() {
                // Almacenar el valor del slider para debug
                console.log(`Slider ${slider.id} cambiado a ${slider.value}`);
            });
        });
        
        // Crear un hook para reprocessLastImage
        if (typeof window.reprocessLastImage === 'function') {
            const originalReprocess = window.reprocessLastImage;
            window.reprocessLastImage = function() {
                console.log("Reprocesando imagen desde hook de zoom.js");
                originalReprocess.apply(this, arguments);
                
                // Dar tiempo para que se actualice el canvas
                setTimeout(function() {
                    if (window.lastImageURL || window.lastProcessedImage) {
                        setupImageViewer();
                    }
                }, 500);
            };
        }
        
        // Crear un hook para processYoloDetection si existe
        if (typeof window.processYoloDetection === 'function') {
            const originalProcess = window.processYoloDetection;
            window.processYoloDetection = async function(imageURL) {
                console.log("Hook de processYoloDetection llamado con URL:", imageURL);
                // Store the URL globally so we can access it later
                window.lastImageURL = imageURL;
                
                try {
                    const result = await originalProcess.apply(this, arguments);
                    
                    // Después de procesar, intentar configurar el visor
                    setTimeout(function() {
                        setupImageViewer();
                    }, 500);
                    
                    return result;
                } catch (error) {
                    console.error("Error en processYoloDetection:", error);
                    throw error;
                }
            };
        }
    }, 500); // Esperar 500ms para asegurarnos de que todo está cargado
});

// Función para encontrar el canvas
function findCanvas() {
    // Primero usar la referencia guardada si existe
    if (canvasRef) return canvasRef;
    
    // Si no, intentar encontrarlo en el DOM
    const outputCanvas = document.getElementById('outputCanvas');
    if (outputCanvas) {
        canvasRef = outputCanvas; // Guardar referencia
        return outputCanvas;
    }
    
    // Como último recurso, buscar cualquier canvas en el contenedor de resultados
    const resultContainer = document.getElementById('resultContainer');
    if (resultContainer) {
        const canvases = resultContainer.querySelectorAll('canvas');
        if (canvases && canvases.length > 0) {
            canvasRef = canvases[0]; // Guardar el primer canvas encontrado
            return canvases[0];
        }
    }
    
    return null;
}

// Configurar el visor para ver la imagen con/sin detecciones
function setupImageViewer() {
    // Si ya está inicializado, actualizar imágenes
    if (zoomInitialized) {
        updateViewerImages();
        return;
    }
    
    console.log("Configurando visor de imágenes");
    
    const outputCanvas = findCanvas();
    const imageContainer = document.querySelector('.image-container');
    
    if (!outputCanvas) {
        console.error("Canvas no encontrado para el visor - reintentando en 500ms");
        setTimeout(setupImageViewer, 500);
        return;
    }
    
    if (!imageContainer) {
        console.error("Contenedor de imagen no encontrado");
        return;
    }
    
    // Usar la URL directamente si está disponible
    const imageURL = window.lastImageURL || window.lastProcessedImage;
    
    if (!imageURL) {
        console.error("No hay URL de imagen disponible");
        return;
    }
    
    console.log("Usando URL de imagen:", imageURL);
    
    // Crear elementos del visor
    const viewerContainer = document.createElement('div');
    viewerContainer.id = 'simpleViewerContainer';
    viewerContainer.style.marginTop = '15px';
    
    // Clonar el canvas para mantener el original intacto
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = outputCanvas.width;
    tempCanvas.height = outputCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(outputCanvas, 0, 0);
    
    // Imagen con detecciones (desde el canvas clonado)
    detectionImageDisplay = document.createElement('img');
    detectionImageDisplay.src = tempCanvas.toDataURL();
    detectionImageDisplay.alt = "Imagen con detecciones";
    detectionImageDisplay.style.maxWidth = "100%";
    detectionImageDisplay.style.display = "block";
    detectionImageDisplay.style.border = "1px solid #eaeaea";
    detectionImageDisplay.style.marginBottom = "10px";
    detectionImageDisplay.style.borderRadius = "4px";
    
    // Imagen original
    originalImageDisplay = document.createElement('img');
    originalImageDisplay.alt = "Imagen original";
    originalImageDisplay.style.maxWidth = "100%";
    originalImageDisplay.style.display = "none";
    originalImageDisplay.style.border = "1px solid #eaeaea";
    originalImageDisplay.style.marginBottom = "10px";
    originalImageDisplay.style.borderRadius = "4px";
    
    // Cargar la imagen original
    const originalImg = new Image();
    originalImg.onload = function() {
        // Redimensionar para que coincida con el tamaño del canvas
        const canvas = document.createElement('canvas');
        canvas.width = outputCanvas.width;
        canvas.height = outputCanvas.height;
        const ctx = canvas.getContext('2d');
        
        // Dibujar imagen original redimensionada
        ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
        originalImageDisplay.src = canvas.toDataURL();
    };
    originalImg.onerror = function() {
        console.error("Error al cargar la imagen original");
        // Usar un placeholder o el canvas sin detecciones
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputCanvas.width;
        tempCanvas.height = outputCanvas.height;
        originalImageDisplay.src = tempCanvas.toDataURL();
    };
    originalImg.src = imageURL;
    
    // Botón para cambiar entre imágenes
    imageToggleBtn = document.createElement('button');
    imageToggleBtn.textContent = "Ver imagen original";
    imageToggleBtn.style.padding = "8px 15px";
    imageToggleBtn.style.backgroundColor = "#3498db";
    imageToggleBtn.style.color = "white";
    imageToggleBtn.style.border = "none";
    imageToggleBtn.style.borderRadius = "4px";
    imageToggleBtn.style.cursor = "pointer";
    imageToggleBtn.style.fontSize = "14px";
    imageToggleBtn.style.marginBottom = "15px";
    
    // Estado actual
    let showingOriginal = false;
    
    // Función para alternar entre imágenes
    imageToggleBtn.addEventListener('click', function() {
        showingOriginal = !showingOriginal;
        
        if (showingOriginal) {
            detectionImageDisplay.style.display = "none";
            originalImageDisplay.style.display = "block";
            imageToggleBtn.textContent = "Ver detecciones";
            // Cambiar el título si existe
            const titleElement = imageContainer.querySelector('.image-label');
            if (titleElement) titleElement.textContent = "Imagen original";
        } else {
            originalImageDisplay.style.display = "none";
            detectionImageDisplay.style.display = "block";
            imageToggleBtn.textContent = "Ver imagen original";
            // Restaurar el título original
            const titleElement = imageContainer.querySelector('.image-label');
            if (titleElement) titleElement.textContent = "Imagen con detecciones";
        }
    });
    
    // Agregar elementos al contenedor
    viewerContainer.appendChild(detectionImageDisplay);
    viewerContainer.appendChild(originalImageDisplay);
    viewerContainer.appendChild(imageToggleBtn);
    
    // Limpiar el visor anterior si existe
    const oldViewer = document.getElementById('simpleViewerContainer');
    if (oldViewer) {
        oldViewer.parentNode.removeChild(oldViewer);
    }
    
    // Mantener el título original
    const titleElement = imageContainer.querySelector('.image-label');
    
    // Limpiar el contenedor pero preservar el título
    if (titleElement) {
        // Guardar el texto del título
        const titleText = titleElement.textContent;
        
        // Crear un nuevo contenedor para nuestro visor
        const ourContainer = document.createElement('div');
        ourContainer.className = 'our-viewer-container';
        
        // Mover el canvas existente a un lugar seguro
        const parentNode = imageContainer.parentNode;
        const canvasHolder = document.createElement('div');
        canvasHolder.id = 'canvas-holder';
        canvasHolder.style.display = 'none';
        if (outputCanvas.parentNode) {
            outputCanvas.parentNode.removeChild(outputCanvas);
        }
        canvasHolder.appendChild(outputCanvas);
        parentNode.appendChild(canvasHolder);
        
        // Limpiar el contenedor
        imageContainer.innerHTML = '';
        
        // Recrear el título
        const newTitle = document.createElement('div');
        newTitle.className = 'image-label';
        newTitle.textContent = titleText;
        newTitle.style.fontWeight = "500";
        newTitle.style.marginBottom = "10px";
        newTitle.style.fontSize = "18px";
        
        // Agregar elementos al contenedor
        imageContainer.appendChild(newTitle);
        imageContainer.appendChild(viewerContainer);
    } else {
        // Si no hay título, simplemente agregar nuestro visor
        imageContainer.innerHTML = '';
        imageContainer.appendChild(viewerContainer);
    }
    
    // No ocultamos el canvas original, sino que lo movemos a un lugar seguro
    // y mantenemos la referencia
    
    zoomInitialized = true;
    console.log("Visor de imágenes configurado correctamente");
    
    // Aplicar zoom si Viewer.js está disponible
    applyZoomCapability();
}

// Función para actualizar las imágenes en el visor
function updateViewerImages() {
    if (!zoomInitialized || !detectionImageDisplay) {
        console.log("El visor no está inicializado, no se puede actualizar");
        return;
    }
    
    console.log("Actualizando imágenes del visor");
    
    const outputCanvas = findCanvas();
    if (!outputCanvas) {
        console.error("Canvas no encontrado para actualización");
        return;
    }
    
    try {
        // Crear un canvas temporal para clonar el contenido actual
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = outputCanvas.width;
        tempCanvas.height = outputCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(outputCanvas, 0, 0);
        
        // Actualizar la imagen con detecciones
        detectionImageDisplay.src = tempCanvas.toDataURL();
        
        console.log("Imagen del visor actualizada correctamente");
        
        // Reiniciar Viewer.js si está disponible
        if (typeof Viewer !== 'undefined') {
            if (detectionImageDisplay.viewer) {
                detectionImageDisplay.viewer.destroy();
            }
            detectionImageDisplay.viewer = new Viewer(detectionImageDisplay, {
                inline: false,
                navbar: false,
                title: false,
                toolbar: {
                    zoomIn: true,
                    zoomOut: true,
                    oneToOne: true,
                    reset: true,
                    rotateLeft: true,
                    rotateRight: true
                }
            });
        }
    } catch (error) {
        console.error("Error al actualizar la imagen:", error);
    }
}

// Aplicar capacidad de zoom usando Viewer.js
function applyZoomCapability() {
    if (typeof Viewer === 'undefined') {
        console.log("Viewer.js no está disponible, zoom no habilitado");
        return;
    }
    
    console.log("Añadiendo capacidad de zoom");
    
    try {
        // Aplicar Viewer.js a la imagen con detecciones
        if (detectionImageDisplay) {
            detectionImageDisplay.viewer = new Viewer(detectionImageDisplay, {
                inline: false,
                navbar: false,
                title: false,
                toolbar: {
                    zoomIn: true,
                    zoomOut: true,
                    oneToOne: true,
                    reset: true,
                    rotateLeft: true,
                    rotateRight: true
                }
            });
        }
        
        // Aplicar Viewer.js a la imagen original
        if (originalImageDisplay) {
            originalImageDisplay.viewer = new Viewer(originalImageDisplay, {
                inline: false,
                navbar: false,
                title: false,
                toolbar: {
                    zoomIn: true,
                    zoomOut: true,
                    oneToOne: true,
                    reset: true,
                    rotateLeft: true,
                    rotateRight: true
                }
            });
        }
        
        console.log("Zoom añadido correctamente");
    } catch (error) {
        console.error("Error al aplicar zoom:", error);
    }
}

// Hook para saber cuándo se carga una nueva imagen
document.addEventListener('DOMContentLoaded', function() {
    // Buscar el botón de procesar imagen
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', function() {
            // Reiniciar el visor cuando se cargue una nueva imagen
            console.log("Botón de carga clickeado, reiniciando visor");
            zoomInitialized = false;
            
            // Destruir instancias de Viewer.js si existen
            if (detectionImageDisplay && detectionImageDisplay.viewer) {
                detectionImageDisplay.viewer.destroy();
            }
            
            if (originalImageDisplay && originalImageDisplay.viewer) {
                originalImageDisplay.viewer.destroy();
            }
            
            // Limpiar referencias
            detectionImageDisplay = null;
            originalImageDisplay = null;
            imageToggleBtn = null;
        });
    }
    
    // Monitorear cambios en los sliders después de que esté todo cargado
    setTimeout(function() {
        const allSliders = [
            document.getElementById('confidenceThreshold'),
            document.getElementById('confidenceMultiplier'),
            document.getElementById('nmsThreshold'),
            document.getElementById('maxDetections')
        ];
        
        allSliders.forEach(slider => {
            if (slider) {
                slider.addEventListener('input', function() {
                    // Debounce para actualizar solo después de parar el movimiento
                    if (this.timeout) clearTimeout(this.timeout);
                    this.timeout = setTimeout(() => {
                        if (typeof window.reprocessLastImage === 'function') {
                            window.reprocessLastImage();
                        }
                    }, 300);
                });
            }
        });
    }, 1000);
});