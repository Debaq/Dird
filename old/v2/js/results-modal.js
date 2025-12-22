/**
 * model-results.js
 * Script para la funcionalidad del gráfico F1 y el modal de resultados con carrusel
 */

// Función para mostrar el carrusel de imágenes de modelos
function showModelCarousel() {
    // Crear el modal si no existe
    let resultsModal = document.getElementById('resultsModal');

    if (!resultsModal) {
        resultsModal = document.createElement('div');
        resultsModal.id = 'resultsModal';
        resultsModal.className = 'modal';
        document.body.appendChild(resultsModal);
    }

    // Crear el contenido del modal con carrusel
    resultsModal.innerHTML = `
        <div class="modal-content carousel-modal">
            <div class="modal-header">
                <h2>Resultados de Modelos</h2>
                <button class="modal-close" onclick="document.getElementById('resultsModal').style.display = 'none';">&times;</button>
            </div>
            <div class="modal-body">
                <div class="carousel-container">
                    <div class="carousel-slides" id="carouselSlides">
                        <!-- Las imágenes se cargarán dinámicamente aquí -->
                        <div class="loading-indicator">Cargando imágenes...</div>
                    </div>
                    
                    <button class="carousel-button prev" onclick="moveCarousel(-1)">&#10094;</button>
                    <button class="carousel-button next" onclick="moveCarousel(1)">&#10095;</button>
                </div>
                
                <div class="carousel-dots" id="carouselDots">
                    <!-- Los indicadores se generarán aquí -->
                </div>
                
                <div class="carousel-caption" id="carouselCaption">
                    <!-- El título de la imagen actual se mostrará aquí -->
                </div>
            </div>
        </div>
    `;

    // Mostrar el modal
    resultsModal.style.display = 'flex';

    // Cargar las imágenes del carrusel
    loadCarouselImages();

    // Cerrar modal al hacer clic fuera del contenido
    resultsModal.addEventListener('click', function(event) {
        if (event.target === resultsModal) {
            resultsModal.style.display = 'none';
        }
    });
}

// Variables para el carrusel
let currentSlide = 0;
let slides = [];

// Alternativa: Función para cargar imágenes dinámicamente del servidor
// Reemplaza la función loadCarouselImages() en model-results.js con esta versión

function loadCarouselImages() {
    // Referencia al contenedor de slides
    const slidesContainer = document.getElementById('carouselSlides');
    const dotsContainer = document.getElementById('carouselDots');
    
    // Mostrar indicador de carga
    slidesContainer.innerHTML = '<div class="loading-indicator">Cargando imágenes...</div>';
    dotsContainer.innerHTML = '';
    
    // Hacer la petición al servidor para obtener la lista de imágenes
    fetch('php/get-model-images.php')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar las imágenes');
            }
            return response.json();
        })
        .then(data => {
            // Verificar si la petición fue exitosa
            if (data.success && data.files.length > 0) {
                // Limpiar el contenedor
                slidesContainer.innerHTML = '';
                dotsContainer.innerHTML = '';
                
                // Array para almacenar referencias a los slides
                slides = [];
                
                // Para cada imagen, crear un slide
                data.files.forEach((file, index) => {
                    // Crear el slide
                    const slide = document.createElement('div');
                    slide.className = 'carousel-slide';
                    slide.style.display = index === 0 ? 'block' : 'none';
                    
                    // Crear la imagen
                    const img = document.createElement('img');
                    img.src = file.url;
                    img.alt = 'Modelo ' + file.name.replace(/\.[^/.]+$/, ""); // Quitar extensión para el alt
                    img.className = 'carousel-image';
                    
                    // Añadir imagen al slide
                    slide.appendChild(img);
                    
                    // Añadir slide al contenedor
                    slidesContainer.appendChild(slide);
                    
                    // Almacenar referencia al slide
                    slides.push(slide);
                    
                    // Crear indicador (punto)
                    const dot = document.createElement('span');
                    dot.className = 'carousel-dot';
                    if (index === 0) dot.classList.add('active');
                    dot.onclick = function() { showSlide(index); };
                    dotsContainer.appendChild(dot);
                });
                
                // Mostrar el caption para la primera imagen
                updateCaption(0);
                
                // Establecer el slide actual
                currentSlide = 0;
            } else {
                // No hay imágenes
                slidesContainer.innerHTML = '<div class="no-images-message">No se encontraron imágenes en la carpeta de modelos.</div>';
            }
        })
        .catch(error => {
            // Error al cargar las imágenes
            console.error('Error:', error);
            slidesContainer.innerHTML = `<div class="no-images-message">Error al cargar las imágenes: ${error.message}</div>`;
        });
}
// Función para obtener la lista de archivos de imagen de modelos
function getModelImageFiles() {
    // Esta es una función simulada. En un entorno real, necesitarías un endpoint del servidor
    // que devuelva la lista de archivos en la carpeta.
    
    // Array con algunos nombres de archivo de ejemplo
    // En producción, estos vendrían del servidor
    return [
        'model1_results.png',
        'model2_confusion_matrix.png',
        'model3_precision_recall.png',
        'model4_f1_score.png',
        'model5_roc_curve.png'
    ];
}

// Función para mover el carrusel
function moveCarousel(n) {
    showSlide(currentSlide + n);
}

// Función para mostrar un slide específico
function showSlide(n) {
    // Validar el índice
    if (n >= slides.length) {
        currentSlide = 0;
    } else if (n < 0) {
        currentSlide = slides.length - 1;
    } else {
        currentSlide = n;
    }
    
    // Ocultar todos los slides
    for (let i = 0; i < slides.length; i++) {
        slides[i].style.display = 'none';
        document.querySelectorAll('.carousel-dot')[i].classList.remove('active');
    }
    
    // Mostrar el slide actual
    slides[currentSlide].style.display = 'block';
    document.querySelectorAll('.carousel-dot')[currentSlide].classList.add('active');
    
    // Actualizar el caption
    updateCaption(currentSlide);
}

// Función para actualizar el caption
function updateCaption(index) {
    const captionElement = document.getElementById('carouselCaption');
    if (captionElement) {
        const imgElement = slides[index].querySelector('img');
        if (imgElement) {
            // Usar el alt de la imagen como caption
            captionElement.textContent = imgElement.alt;
        }
    }
}

// Navegación con teclado para el carrusel
document.addEventListener('keydown', function(e) {
    if (document.getElementById('resultsModal').style.display === 'flex') {
        if (e.key === 'ArrowLeft') {
            moveCarousel(-1);
        } else if (e.key === 'ArrowRight') {
            moveCarousel(1);
        } else if (e.key === 'Escape') {
            document.getElementById('resultsModal').style.display = 'none';
        }
    }
});

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Buscar la imagen F1
    const f1Image = document.getElementById('f1Image');
    if (f1Image) {
        // Añadir el evento de clic para mostrar el carrusel
        f1Image.addEventListener('click', showModelCarousel);
    }
});