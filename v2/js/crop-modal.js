// Crop modal functionality utilizando CropperJS
function showCropModal(file) {
    // Crear modal de recorte
    const cropModal = document.createElement('div');
    cropModal.id = 'cropModal';
    cropModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;

    // Contenido del modal
    cropModal.innerHTML = `
        <div style="background-color: white; padding: 20px; border-radius: 10px; width: 80%; max-width: 800px; max-height: 80vh; display: flex; flex-direction: column;">
            <h2>Recortar Imagen</h2>
            <p>Ajusta el recorte para centrarlo en la región de interés de la retina.</p>
            
            <div style="position: relative; max-width: 100%; max-height: 60vh; overflow: auto;">
                <img id="cropImage" src="" style="max-width: 100%; max-height: 60vh; object-fit: contain;">
            </div>

            <div style="margin-top: 15px; display: flex; justify-content: space-between;">
                <button id="cropCancel" style="background-color: #f44336; color: white; padding: 10px 20px;">Cancelar</button>
                <button id="cropConfirm" style="background-color: #4CAF50; color: white; padding: 10px 20px;">Confirmar</button>
            </div>
        </div>
    `;

    // Añadir al cuerpo
    document.body.appendChild(cropModal);

    const cropImage = document.getElementById('cropImage');
    const cropCancel = document.getElementById('cropCancel');
    const cropConfirm = document.getElementById('cropConfirm');

    // Leer archivo
    const reader = new FileReader();
    reader.onload = function(e) {
        cropImage.src = e.target.result;

        // Inicializar Cropper cuando la imagen esté cargada
        cropImage.onload = function() {
            const cropper = new Cropper(cropImage, {
                aspectRatio: 0, // Cuadrado
                viewMode: 1, // Restringir el recorte al tamaño de la imagen
                minContainerWidth: 300,
                minContainerHeight: 300,
                // Opciones para centrar y hacer más grande el recorte inicial
                autoCropArea: 1, // Hace que el área de selección inicial sea el 100% de la imagen

                crop(event) {
                    // Puedes añadir lógica adicional aquí si es necesario
                }
            });

            // Botón de cancelar
            cropCancel.addEventListener('click', () => {
                cropper.destroy();
                document.body.removeChild(cropModal);
            });

            // Botón de confirmar
            cropConfirm.addEventListener('click', () => {
                // Obtener datos del recorte
                const croppedCanvas = cropper.getCroppedCanvas({
                    width: 640, // Tamaño fijo para el modelo
                    height: 640,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });

                // Convertir canvas a blob
                croppedCanvas.toBlob((blob) => {
                    // Crear nuevo archivo
                    const croppedFile = new File([blob], file.name, { type: file.type });
                    
                    // Limpiar
                    cropper.destroy();
                    document.body.removeChild(cropModal);

                    // Procesar imagen recortada
                    processImageAfterCrop(croppedFile);
                }, file.type);
            });
        };
    };
    reader.readAsDataURL(file);
}

// Función para procesar imagen recortada
function processImageAfterCrop(croppedFile) {
    // Crear lista de archivos
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(croppedFile);
    
    // Establecer archivos en input
    fileInput.files = dataTransfer.files;

    // Validar y subir
    if (typeof validateFile === 'function') {
        validateFile();
    }

    uploadBtn.click();
}

// Modificar listener de entrada de archivos
function modifyFileInputListener() {
    // Verificar que fileInput exista
    if (!fileInput) return;

    // Guardar listener original
    const oldListener = fileInput.onchange;
    
    fileInput.onchange = function(event) {
        // Ejecutar listener original si existe
        if (oldListener) {
            oldListener.call(this, event);
        }

        // Si hay archivos de imagen
        if (this.files.length > 0) {
            const file = this.files[0];
            if (file.type.match('image.*')) {
                // Prevenir procesamiento directo
                event.preventDefault();
                
                // Mostrar modal de recorte
                showCropModal(file);
            }
        }
    };
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', modifyFileInputListener);