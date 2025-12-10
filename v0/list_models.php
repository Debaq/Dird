<?php
// Configuración
$modelsDirectory = 'data';
$allowedExtensions = ['onnx'];

// Establecer cabeceras para JSON
header('Content-Type: application/json');

// Verificar si el directorio existe
if (!is_dir($modelsDirectory)) {
    echo json_encode(['error' => 'Directorio de modelos no encontrado']);
    exit;
}

try {
    // Obtener todos los archivos en el directorio
    $files = scandir($modelsDirectory);
    
    // Filtrar solo archivos .onnx
    $models = [];
    foreach ($files as $file) {
        $extension = pathinfo($file, PATHINFO_EXTENSION);
        if (in_array(strtolower($extension), $allowedExtensions)) {
            $models[] = $file;
            
            // Verificar si existe el archivo YAML correspondiente y mostrarlo en el log
            $yamlFile = pathinfo($file, PATHINFO_FILENAME) . '.yaml';
            $ymlFile = pathinfo($file, PATHINFO_FILENAME) . '.yml';
            
            if (file_exists($modelsDirectory . '/' . $yamlFile)) {
                error_log('Encontrado archivo YAML para ' . $file . ': ' . $yamlFile);
            } elseif (file_exists($modelsDirectory . '/' . $ymlFile)) {
                error_log('Encontrado archivo YAML para ' . $file . ': ' . $ymlFile);
            } else {
                error_log('No se encontró archivo YAML para ' . $file);
            }
        }
    }
    
    // Devolver la lista de modelos como JSON
    echo json_encode($models);
    
} catch (Exception $e) {
    echo json_encode(['error' => 'Error al listar los modelos: ' . $e->getMessage()]);
}
?>