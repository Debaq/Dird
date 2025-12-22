// Variables para controlar el estado de carga
let modelLoading = true; // Inicialmente está cargando
let uploadInterfaceReady = false;

// Función para mostrar/ocultar la interfaz de carga
function toggleUploadInterface(show) {
  const dropArea = document.getElementById('dropArea');
  const uploadBtn = document.getElementById('uploadBtn');
  
  if (!dropArea || !uploadBtn) return;
  
  if (show) {
    // Mostrar el área de carga y habilitarla para interacción
    dropArea.style.display = 'block';
    // El botón sigue deshabilitado hasta que se seleccione un archivo
    // pero aseguramos que sea visible (aunque disabled)
    //uploadBtn.style.display = 'block';
    uploadInterfaceReady = true;
  } else {
    // Ocultar temporalmente mientras se carga el modelo
    dropArea.style.display = 'none';
    //uploadBtn.style.display = 'none';
    controls.style.display = 'none';

    uploadInterfaceReady = false;
  }
}




// Variables globales principales
let onnxSession = null;
let modelLoaded = false;
// Variable para almacenar la última imagen procesada
let lastProcessedImage = null;
// Variable global para almacenar la última salida del modelo
let lastModelOutput = null;
// Configuración del modelo
const INPUT_WIDTH = 640;    // Ancho de entrada para el modelo YOLO ONNX
const INPUT_HEIGHT = 640;   // Altura de entrada para el modelo YOLO ONNX
// Clases para el modelo YOLO
const classes = ['Disco optico','Exudado Duro','Fovea','Hemorragia','Mancha Algodonosa','Microhemorragias','Edema'];  // Mancha ciega renombrada a Fovea
const colors = [
    '#FF3838', // Rojo brillante
    '#48F90A', // Verde brillante
    '#FFB21D', // Naranja
    '#00C2FF', // Azul celeste
    '#7B83EB', // Lila
    '#FFA6D9', // Rosa
    '#54FFBD', // Turquesa
    '#FFF700', // Amarillo brillante
    '#C04CFD', // Púrpura
    '#FF6E1D'  // Naranja más oscuro
];
// Modo de depuración
const DEBUG_MODE = true;


