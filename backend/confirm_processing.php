<?php
/**
 * Confirm Processing API - Confirms successful processing and decrements token
 * This is called after the frontend validates the processed data
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

$TOKENS_FILE = __DIR__ . '/tokens.json';

/**
 * Load tokens database from JSON file
 */
function loadTokensDB($file) {
    if (!file_exists($file)) {
        return ['installations' => []];
    }
    $content = file_get_contents($file);
    return json_decode($content, true) ?: ['installations' => []];
}

/**
 * Save tokens database to JSON file
 */
function saveTokensDB($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT));
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

    $installationToken = $input['installation_token'];

    // Load tokens database
    $db = loadTokensDB($TOKENS_FILE);

    // Check if installation exists
    if (!isset($db['installations'][$installationToken])) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Installation not found'
        ]);
        exit();
    }

    // Check if installation has tokens
    if ($db['installations'][$installationToken]['tokens'] <= 0) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'No tokens available'
        ]);
        exit();
    }

    // Decrement token
    $db['installations'][$installationToken]['tokens']--;
    $db['installations'][$installationToken]['last_usage'] = date('Y-m-d H:i:s');

    // Save updated database
    saveTokensDB($TOKENS_FILE, $db);

    $remainingTokens = $db['installations'][$installationToken]['tokens'];

    // Return success response
    $response = [
        'success' => true,
        'message' => 'Token consumed successfully',
        'remaining_tokens' => $remainingTokens,
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
