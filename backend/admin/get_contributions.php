<?php
/**
 * Get Contributions API
 * Returns list of all image contributions
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

require_once __DIR__ . '/validate_session.php';

$METADATA_FILE = __DIR__ . '/../data/contributions_metadata.json';
$UPLOADS_DIR = __DIR__ . '/../uploads/';

try {
    // Validate admin session
    validateAdminSession();

    // Load contributions metadata
    $metadata = ['contributions' => []];
    if (file_exists($METADATA_FILE)) {
        $metadata = json_decode(file_get_contents($METADATA_FILE), true);
    }

    $contributions = [];

    // Process each contribution
    foreach ($metadata['contributions'] as $contrib) {
        $imagePath = $UPLOADS_DIR . $contrib['folder_path'] . '/' . $contrib['filename'];
        $jsonPath = $UPLOADS_DIR . $contrib['folder_path'] . '/' . $contrib['json_file'];

        // Check if files still exist
        $imageExists = file_exists($imagePath);
        $jsonExists = file_exists($jsonPath);

        $contributions[] = [
            'id' => $contrib['id'],
            'filename' => $contrib['filename'],
            'original_filename' => $contrib['original_filename'],
            'size' => $contrib['size'],
            'size_formatted' => formatBytes($contrib['size']),
            'installation_token' => $contrib['installation_token'],
            'uploaded_at' => $contrib['uploaded_at'],
            'folder_path' => $contrib['folder_path'],
            'image_exists' => $imageExists,
            'json_exists' => $jsonExists,
            'download_url_image' => '/backend/uploads/' . $contrib['folder_path'] . '/' . $contrib['filename'],
            'download_url_json' => '/backend/uploads/' . $contrib['folder_path'] . '/' . $contrib['json_file']
        ];
    }

    // Sort by uploaded_at descending (newest first)
    usort($contributions, function($a, $b) {
        return strtotime($b['uploaded_at']) - strtotime($a['uploaded_at']);
    });

    $response = [
        'success' => true,
        'data' => [
            'contributions' => $contributions,
            'total' => count($contributions)
        ]
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno del servidor',
        'message' => $e->getMessage()
    ]);
}

/**
 * Format bytes to human readable format
 */
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}
?>
