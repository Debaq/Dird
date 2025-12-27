<?php
/**
 * Process Conclusion API - Processes conclusion data and returns enhanced JSON
 * This endpoint receives the report data, processes it, and returns the same JSON
 * with a "processed" comment for verification
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

try {
    // Get request body
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON'
        ]);
        exit();
    }

    // Validate required fields
    if (!isset($input['installation_token'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing installation_token'
        ]);
        exit();
    }

    if (!isset($input['report_data'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing report_data'
        ]);
        exit();
    }

    // Extract data
    $installationToken = $input['installation_token'];
    $reportData = $input['report_data'];

    // Process the data (for now, just add a processing comment)
    // In the future, this could:
    // - Analyze the data with AI
    // - Generate insights
    // - Validate the data
    // - etc.

    $processedData = $reportData;

    // Add processing metadata
    $processedData['_processing'] = [
        'status' => 'processed',
        'comment' => 'Datos procesados exitosamente por el backend',
        'timestamp' => date('Y-m-d H:i:s'),
        'server_version' => '1.0.0',
        'suggestions' => [
            'El reporte contiene información válida',
            'Los datos están bien estructurados',
            'Procesamiento completado correctamente'
        ]
    ];

    // Count detections for additional info
    $detectionCount = isset($reportData['detections']) ? count($reportData['detections']) : 0;
    $imageCount = isset($reportData['images']) ? count($reportData['images']) : 0;

    $processedData['_processing']['stats'] = [
        'total_images' => $imageCount,
        'total_detections' => $detectionCount,
        'patient_name' => $reportData['patient']['name'] ?? 'Unknown'
    ];

    // Return processed data
    $response = [
        'success' => true,
        'message' => 'Conclusion processed successfully',
        'processed_data' => $processedData,
        'timestamp' => time()
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
