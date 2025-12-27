<?php
/**
 * Consume Token API - Decrements token count when generating a report
 *
 * For now, simulates token consumption
 * Future versions will implement user authentication and database storage
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

    // For now, just return success
    // In the future, this will decrement the token count in the database
    $response = [
        'success' => true,
        'message' => 'Token consumed successfully',
        'remainingTokens' => 4, // Simulated remaining tokens
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
