<?php
/**
 * Token API - Returns available tokens for report generation
 * Manages tokens per installation using installation_token
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
    // Get installation token from request
    $installationToken = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $installationToken = $input['installation_token'] ?? null;
    } else {
        $installationToken = $_GET['installation_token'] ?? null;
    }

    if (!$installationToken) {
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
