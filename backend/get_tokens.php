<?php
/**
 * Token API - Returns available tokens for report generation
 * Manages tokens per installation using installation_token
 */

// Include logger
require_once __DIR__ . '/includes/logger.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$TOKENS_FILE = __DIR__ . '/data/tokens.json';
$INITIAL_TOKENS = 5;

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
    logDebug("=== GET TOKENS REQUEST START ===");
    logDebug("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED'));

    // Get installation token from request
    $installationToken = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $installationToken = $input['installation_token'] ?? null;
    } else {
        $installationToken = $_GET['installation_token'] ?? null;
    }

    logDebug("Installation Token Received", [
        'has_token' => !empty($installationToken),
        'token_prefix' => $installationToken ? substr($installationToken, 0, 8) . '...' : 'none'
    ]);

    if (!$installationToken) {
        logError("Missing installation_token");
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing installation_token'
        ]);
        exit();
    }

    // Load tokens database
    $db = loadTokensDB($TOKENS_FILE);

    // Check if installation exists
    if (!isset($db['installations'][$installationToken])) {
        // New installation - assign initial tokens
        logDebug("New Installation Detected", ['initial_tokens' => $INITIAL_TOKENS]);

        $db['installations'][$installationToken] = [
            'tokens' => $INITIAL_TOKENS,
            'created_at' => date('Y-m-d H:i:s'),
            'last_access' => date('Y-m-d H:i:s')
        ];
        saveTokensDB($TOKENS_FILE, $db);

        $response = [
            'success' => true,
            'tokens' => $INITIAL_TOKENS,
            'is_new_installation' => true,
            'timestamp' => time()
        ];
    } else {
        // Existing installation - return current tokens
        $installation = $db['installations'][$installationToken];

        logDebug("Existing Installation Found", [
            'current_tokens' => $installation['tokens'],
            'created_at' => $installation['created_at'] ?? 'unknown'
        ]);

        // Update last access
        $db['installations'][$installationToken]['last_access'] = date('Y-m-d H:i:s');
        saveTokensDB($TOKENS_FILE, $db);

        $response = [
            'success' => true,
            'tokens' => $installation['tokens'],
            'is_new_installation' => false,
            'timestamp' => time()
        ];
    }

    logDebug("Response Prepared", $response);
    logDebug("=== GET TOKENS REQUEST END (SUCCESS) ===");

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    logError("Exception caught", [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => substr($e->getTraceAsString(), 0, 500)
    ]);
    logDebug("=== GET TOKENS REQUEST END (ERROR) ===");

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
