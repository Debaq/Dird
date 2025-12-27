<?php
/**
 * Token API - Returns available tokens for report generation
 *
 * For now, returns a fixed value of 5 tokens
 * Future versions will implement user authentication and database storage
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // For now, return a fixed number of tokens
    $response = [
        'success' => true,
        'tokens' => 5,
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
