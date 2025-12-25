<?php
// Configuración de CORS
header("Access-Control-Allow-Origin: *"); // En producción, cambia * por tu dominio
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");

// Manejo de la solicitud OPTIONS (pre-flight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Respuesta por defecto
$response = ['success' => false, 'message' => ''];

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido. Use POST.');
    }

    // Directorio de subida
    $uploadDir = __DIR__ . '/uploads/';
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            throw new Exception('No se pudo crear el directorio de uploads.');
        }
    }

    // Validar que lleguen los archivos
    if (!isset($_FILES['image']) || !isset($_FILES['json'])) {
        throw new Exception('Faltan archivos. Se requiere "image" y "json".');
    }

    $imageFile = $_FILES['image'];
    $jsonFile = $_FILES['json'];

    // Validar errores de subida
    if ($imageFile['error'] !== UPLOAD_ERR_OK || $jsonFile['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Error en la subida de archivos.');
    }

    // Validar tipo de imagen (seguridad básica)
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $imageFile['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Tipo de archivo no válido. Solo JPG, PNG o WebP.');
    }

    // Generar nombre único para ambos archivos
    // Formato: YYYY-MM-DD_His_RandomID
    $uniqueId = date('Y-m-d_H-i-s') . '_' . bin2hex(random_bytes(4));
    
    // Extensiones
    $imageExt = pathinfo($imageFile['name'], PATHINFO_EXTENSION);
    // Asegurar que la extensión sea segura
    if (!in_array(strtolower($imageExt), ['jpg', 'jpeg', 'png', 'webp'])) {
        $imageExt = 'jpg'; // Fallback seguro
    }

    $targetImage = $uploadDir . $uniqueId . '.' . $imageExt;
    $targetJson = $uploadDir . $uniqueId . '.json';

    // Mover imagen
    if (!move_uploaded_file($imageFile['tmp_name'], $targetImage)) {
        throw new Exception('Error al guardar la imagen.');
    }

    // Mover JSON (o leer y guardar si se envió como string, pero aquí asumimos File)
    if (!move_uploaded_file($jsonFile['tmp_name'], $targetJson)) {
        // Si falla el json, intentamos borrar la imagen para no dejar basura
        @unlink($targetImage); 
        throw new Exception('Error al guardar el JSON.');
    }

    $response['success'] = true;
    $response['message'] = 'Contribución recibida correctamente.';
    $response['data'] = [
        'id' => $uniqueId,
        'image_path' => $uniqueId . '.' . $imageExt,
        'json_path' => $uniqueId . '.json'
    ];

} catch (Exception $e) {
    http_response_code(400); // Bad Request
    $response['message'] = $e->getMessage();
}

// Devolver respuesta JSON
header('Content-Type: application/json');
echo json_encode($response);
