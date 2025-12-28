<?php
// Configuración de CORS
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");

// Manejo de la solicitud OPTIONS (pre-flight)
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

$response = ['success' => false, 'message' => ''];

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido. Use POST.');
    }

    $type = $_POST['type'] ?? 'image';
    $installationToken = $_POST['installation_token'] ?? 'unknown';
    
    // Metadata file path
    $metadataFile = __DIR__ . '/data/contributions_metadata.json';
    $metadata = ['contributions' => []];
    if (file_exists($metadataFile)) {
        $metadata = json_decode(file_get_contents($metadataFile), true);
    }

    // Common metadata structure
    $uniqueId = date('Y-m-d_H-i-s') . '_' . bin2hex(random_bytes(4));
    $contributionMeta = [
        'id' => $uniqueId,
        'type' => $type,
        'installation_token' => $installationToken,
        'uploaded_at' => date('Y-m-d H:i:s'),
    ];

    if ($type === 'image') {
        // --- LOGICA ORIGINAL DE IMAGENES ---
        $uploadDir = __DIR__ . '/uploads/';
        if (!file_exists($uploadDir)) {
            if (!mkdir($uploadDir, 0755, true)) throw new Exception('No se pudo crear directorio uploads.');
        }

        if (!isset($_FILES['image']) || !isset($_FILES['json'])) {
            throw new Exception('Faltan archivos para contribución de imagen.');
        }

        $imageFile = $_FILES['image'];
        $jsonFile = $_FILES['json'];

        if ($imageFile['error'] !== UPLOAD_ERR_OK || $jsonFile['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Error en la subida de archivos.');
        }

        // Validar tipo de imagen
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $imageFile['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) throw new Exception('Tipo de imagen no válido.');

        // Crear carpeta de sesión
        $sessionDir = $uploadDir . $uniqueId . '/';
        if (!mkdir($sessionDir, 0755, true)) throw new Exception('No se pudo crear directorio de sesión.');

        $imageExt = pathinfo($imageFile['name'], PATHINFO_EXTENSION);
        if (!in_array(strtolower($imageExt), ['jpg', 'jpeg', 'png', 'webp'])) $imageExt = 'jpg';

        $targetImage = $sessionDir . 'image.' . $imageExt;
        $targetJson = $sessionDir . 'annotations.json';

        if (!move_uploaded_file($imageFile['tmp_name'], $targetImage)) throw new Exception('Error guardando imagen.');
        if (!move_uploaded_file($jsonFile['tmp_name'], $targetJson)) {
            @unlink($targetImage);
            @rmdir($sessionDir);
            throw new Exception('Error guardando JSON.');
        }

        // Completar metadatos específicos de imagen
        $contributionMeta['filename'] = 'image.' . $imageExt;
        $contributionMeta['original_filename'] = $imageFile['name'];
        $contributionMeta['size'] = filesize($targetImage);
        $contributionMeta['json_file'] = 'annotations.json';
        $contributionMeta['folder_path'] = $uniqueId;

        $response['data'] = [
            'image_path' => $uniqueId . '/image.' . $imageExt,
            'json_path' => $uniqueId . '/annotations.json'
        ];

    } elseif ($type === 'guideline') {
        // --- LOGICA PARA PROTOCOLOS (JSON) ---
        $targetDir = __DIR__ . '/data/contributions/guidelines/';
        if (!file_exists($targetDir)) mkdir($targetDir, 0755, true);

        if (!isset($_FILES['json'])) throw new Exception('Falta el archivo JSON del protocolo.');
        
        $jsonFile = $_FILES['json'];
        $targetPath = $targetDir . $uniqueId . '.json';

        // Validar que sea JSON válido
        $content = file_get_contents($jsonFile['tmp_name']);
        $decoded = json_decode($content, true);
        if ($decoded === null) throw new Exception('El archivo no es un JSON válido.');

        // Validar estructura básica de guideline (opcional pero recomendado)
        if (!isset($decoded['guideline_id']) || !isset($decoded['metadata'])) {
             throw new Exception('El JSON no parece ser un protocolo clínico válido.');
        }

        if (!move_uploaded_file($jsonFile['tmp_name'], $targetPath)) {
            throw new Exception('Error guardando el protocolo.');
        }

        $contributionMeta['filename'] = $uniqueId . '.json';
        $contributionMeta['original_filename'] = $jsonFile['name'];
        $contributionMeta['size'] = filesize($targetPath);
        // Extra info útil para el admin
        $contributionMeta['guideline_name'] = $decoded['metadata']['name'] ?? 'Unknown';
        $contributionMeta['guideline_version'] = $decoded['metadata']['version'] ?? '?.?.?';

        $response['data'] = ['file_path' => 'data/contributions/guidelines/' . $uniqueId . '.json'];

    } elseif ($type === 'conclusion') {
        // --- LOGICA PARA CONCLUSIONES (JSON) ---
        $targetDir = __DIR__ . '/data/contributions/conclusions/';
        if (!file_exists($targetDir)) mkdir($targetDir, 0755, true);

        if (!isset($_FILES['json'])) throw new Exception('Falta el archivo JSON de la conclusión.');

        $jsonFile = $_FILES['json'];
        $targetPath = $targetDir . $uniqueId . '.json';

        $content = file_get_contents($jsonFile['tmp_name']);
        if (json_decode($content) === null) throw new Exception('El archivo no es un JSON válido.');

        if (!move_uploaded_file($jsonFile['tmp_name'], $targetPath)) {
            throw new Exception('Error guardando la conclusión.');
        }

        $contributionMeta['filename'] = $uniqueId . '.json';
        $contributionMeta['original_filename'] = $jsonFile['name'];
        $contributionMeta['size'] = filesize($targetPath);

        $response['data'] = ['file_path' => 'data/contributions/conclusions/' . $uniqueId . '.json'];

    } else {
        throw new Exception('Tipo de contribución no válido: ' . $type);
    }

    // Guardar metadatos
    $metadata['contributions'][] = $contributionMeta;
    file_put_contents($metadataFile, json_encode($metadata, JSON_PRETTY_PRINT));

    $response['success'] = true;
    $response['message'] = 'Contribución recibida correctamente (' . $type . ').';
    $response['data']['id'] = $uniqueId;

} catch (Exception $e) {
    http_response_code(400);
    $response['message'] = $e->getMessage();
}

header('Content-Type: application/json');
echo json_encode($response);