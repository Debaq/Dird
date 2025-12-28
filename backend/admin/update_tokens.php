<?php
/**
 * Update Tokens API
 * Adds tokens to a specific installation (max 9999 total)
 * Uses file locking for data safety
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/validate_session.php';

$TOKENS_FILE = __DIR__ . '/../data/tokens.json';
$MAX_TOKENS = 9999;

/**
 * Load tokens database safely
 */
function loadTokensDB($file) {
    if (!file_exists($file)) return ['installations' => []];
    
    $content = file_get_contents($file);
    if (empty($content)) return ['installations' => []];

    $data = json_decode($content, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        // Fallback or error logic could go here
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
    }
    fclose($fp);
}

try {
    validateAdminSession();

    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['installation_token']) || !isset($input['new_total'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing fields']);
        exit();
    }

    $installationToken = $input['installation_token'];
    $newTotal = (int)$input['new_total'];

    // Load with lock safety in mind (though we lock on write, reading handles partials via JSON check)
    $db = loadTokensDB($TOKENS_FILE);

    if (!isset($db['installations'][$installationToken])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Installation not found']);
        exit();
    }

    if ($newTotal < 0 || $newTotal > $MAX_TOKENS) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid amount']);
        exit();
    }

    $currentTokens = $db['installations'][$installationToken]['tokens'];
    $tokensDiff = $newTotal - $currentTokens;

    // Update
    $db['installations'][$installationToken]['tokens'] = $newTotal;
    $db['installations'][$installationToken]['last_updated'] = date('Y-m-d H:i:s');

    // Save with lock
    saveTokensDB($TOKENS_FILE, $db);

    $response = [
        'success' => true,
        'message' => 'Tokens updated successfully',
        'data' => [
            'new_total' => $newTotal,
            'tokens_diff' => $tokensDiff,
            'installation_token' => $installationToken
        ]
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>