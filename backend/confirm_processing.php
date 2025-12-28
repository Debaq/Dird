<?php
/**
 * Confirm Processing API - Confirms successful processing and decrements token
 * Uses file locking for data safety
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

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

$TOKENS_FILE = __DIR__ . '/data/tokens.json';

/**
 * Load tokens database safely
 */
function loadTokensDB($file) {
    if (!file_exists($file)) return ['installations' => []];
    
    $content = file_get_contents($file);
    if (empty($content)) return ['installations' => []];

    $data = json_decode($content, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        logError("JSON Decode Error: " . json_last_error_msg());
        // Simple fallback to empty if corrupted, could add backup logic here too
        return ['installations' => []]; 
    }

    return $data ?: ['installations' => []];
}

/**
 * Save tokens database safely with file locking
 */
function saveTokensDB($file, $data) {
    $fp = fopen($file, 'c+');
    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
    } else {
        logError("Could not lock tokens file for writing");
    }
    fclose($fp);
}

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true);

    if (!$input || !isset($input['installation_token'])) {
        throw new Exception('Invalid input');
    }

    $installationToken = $input['installation_token'];

    // Load DB
    $db = loadTokensDB($TOKENS_FILE);

    if (!isset($db['installations'][$installationToken])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Installation not found']);
        exit();
    }

    $currentTokens = $db['installations'][$installationToken]['tokens'];

    if ($currentTokens <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'No tokens available']);
        exit();
    }

    // Decrement
    $db['installations'][$installationToken]['tokens']--;
    $db['installations'][$installationToken]['last_usage'] = date('Y-m-d H:i:s');

    // Save with lock
    saveTokensDB($TOKENS_FILE, $db);

    $remainingTokens = $db['installations'][$installationToken]['tokens'];

    logDebug("Token Consumed", ['remaining' => $remainingTokens]);

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Token consumed successfully',
        'remaining_tokens' => $remainingTokens,
        'timestamp' => time()
    ]);

} catch (Exception $e) {
    logError("Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}