<?php
/**
 * Confirm Processing API - Confirms successful processing and decrements token
 * This is called after the frontend validates the processed data
 */

// Include logger
require_once __DIR__ . '/includes/logger.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

logDebug("=== CONFIRM PROCESSING REQUEST START ===");
logDebug("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED'));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    logError("Invalid method", ['method' => $_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED']);
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

$TOKENS_FILE = __DIR__ . '/data/tokens.json';

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
    $rawInput = file_get_contents('php://input');
    logDebug("Raw Input", substr($rawInput, 0, 500));

    $input = json_decode($rawInput, true);

    if (!$input) {
        logError("Invalid JSON input");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON'
        ]);
        exit();
    }

    logDebug("Decoded Input", array_keys($input));

    // Validate required fields
    if (!isset($input['installation_token'])) {
        logError("Missing installation_token");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing installation_token'
        ]);
        exit();
    }

    $installationToken = $input['installation_token'];
    logDebug("Installation Token Received", [
        'token_prefix' => substr($installationToken, 0, 8) . '...'
    ]);

    // Load tokens database
    $db = loadTokensDB($TOKENS_FILE);

    // Check if installation exists
    if (!isset($db['installations'][$installationToken])) {
        logError("Installation not found", ['token' => substr($installationToken, 0, 8) . '...']);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Installation not found'
        ]);
        exit();
    }

    $currentTokens = $db['installations'][$installationToken]['tokens'];
    logDebug("Installation Found", ['current_tokens' => $currentTokens]);

    // Check if installation has tokens
    if ($currentTokens <= 0) {
        logError("No tokens available", ['current_tokens' => $currentTokens]);
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

    logDebug("Token Consumed", [
        'previous_tokens' => $currentTokens,
        'remaining_tokens' => $remainingTokens
    ]);

    // Return success response
    $response = [
        'success' => true,
        'message' => 'Token consumed successfully',
        'remaining_tokens' => $remainingTokens,
        'timestamp' => time()
    ];

    logDebug("Response Prepared", $response);
    logDebug("=== CONFIRM PROCESSING REQUEST END (SUCCESS) ===");

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    logError("Exception caught", [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => substr($e->getTraceAsString(), 0, 500)
    ]);
    logDebug("=== CONFIRM PROCESSING REQUEST END (ERROR) ===");

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
