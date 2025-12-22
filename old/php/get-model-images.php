<?php
/**
 * get-model-images.php
 * Script para obtener las imágenes de la carpeta img/models/
 * 
 * Este archivo es opcional y solo necesario si deseas implementar la carga dinámica
 * de imágenes desde el servidor en lugar de definirlas estáticamente.
 */

// Establecer encabezados para JSON
header('Content-Type: application/json');
header('Cache-Control: no-cache, no-store, must-revalidate');

// Directorio de imágenes
$dir = '../img/models/';

// Extensiones de imagen permitidas
$allowed_extensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

// Array para almacenar los archivos encontrados
$files = [];

// Verificar si el directorio existe
if (is_dir($dir)) {
    // Abrir el directorio
    if ($handle = opendir($dir)) {
        // Leer cada archivo
        while (($file = readdir($handle)) !== false) {
            // Ignorar directorios y archivos ocultos
            if ($file != "." && $file != ".." && $file[0] != '.') {
                // Obtener la extensión
                $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
                
                // Verificar si es una imagen
                if (in_array($extension, $allowed_extensions)) {
                    // Añadir al array de archivos
                    $files[] = [
                        'name' => $file,
                        'path' => $dir . $file,
                        'url' => 'img/models/' . $file,
                        'type' => $extension
                    ];
                }
            }
        }
        // Cerrar el directorio
        closedir($handle);
        
        // Ordenar archivos alfabéticamente
        usort($files, function($a, $b) {
            return strcmp($a['name'], $b['name']);
        });
    }
}

// Devolver los archivos como JSON
echo json_encode([
    'success' => true,
    'files' => $files,
    'count' => count($files)
]);
?>