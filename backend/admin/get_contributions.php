<?php
/**
 * Get Contributions API
 * Returns list of all contributions (images, guidelines, conclusions)
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/validate_session.php';

$METADATA_FILE = __DIR__ . '/../data/contributions_metadata.json';
$UPLOADS_DIR = __DIR__ . '/../uploads/';
$DATA_DIR = __DIR__ . '/../data/contributions/';

try {
    validateAdminSession();

    $metadata = ['contributions' => []];
    if (file_exists($METADATA_FILE)) {
        $metadata = json_decode(file_get_contents($METADATA_FILE), true);
    }

    $contributions = [];

    foreach ($metadata['contributions'] as $contrib) {
        $type = $contrib['type'] ?? 'image'; // Default to image for legacy data
        
        $item = [
            'id' => $contrib['id'],
            'type' => $type,
            'installation_token' => $contrib['installation_token'] ?? 'unknown',
            'uploaded_at' => $contrib['uploaded_at'],
            'size' => $contrib['size'] ?? 0,
            'size_formatted' => formatBytes($contrib['size'] ?? 0),
            'original_filename' => $contrib['original_filename'] ?? 'unknown',
        ];

        if ($type === 'image') {
            $folderPath = $contrib['folder_path'] ?? $contrib['id'];
            $filename = $contrib['filename'];
            $jsonFile = $contrib['json_file'];
            
            $imageFsPath = $UPLOADS_DIR . $folderPath . '/' . $filename;
            $jsonFsPath = $UPLOADS_DIR . $folderPath . '/' . $jsonFile;

            $item['filename'] = $filename;
            $item['image_exists'] = file_exists($imageFsPath);
            $item['json_exists'] = file_exists($jsonFsPath);
            $item['download_url_image'] = '/backend/uploads/' . $folderPath . '/' . $filename;
            $item['download_url_json'] = '/backend/uploads/' . $folderPath . '/' . $jsonFile;
            
        } elseif ($type === 'guideline') {
            $filename = $contrib['filename'];
            $fsPath = $DATA_DIR . 'guidelines/' . $filename;
            
            $item['filename'] = $filename;
            $item['exists'] = file_exists($fsPath);
            $item['download_url'] = '/backend/data/contributions/guidelines/' . $filename;
            $item['guideline_name'] = $contrib['guideline_name'] ?? 'Unknown';
            $item['guideline_version'] = $contrib['guideline_version'] ?? '?.?';

        } elseif ($type === 'conclusion') {
            $filename = $contrib['filename'];
            $fsPath = $DATA_DIR . 'conclusions/' . $filename;
            
            $item['filename'] = $filename;
            $item['exists'] = file_exists($fsPath);
            $item['download_url'] = '/backend/data/contributions/conclusions/' . $filename;
        }

        $contributions[] = $item;
    }

    // Sort by uploaded_at descending
    usort($contributions, function($a, $b) {
        return strtotime($b['uploaded_at']) - strtotime($a['uploaded_at']);
    });

    echo json_encode([
        'success' => true,
        'data' => [
            'contributions' => $contributions,
            'total' => count($contributions)
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}

function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}
?>