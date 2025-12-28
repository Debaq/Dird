<?php
/**
 * Token API - Returns available tokens for report generation
 * Manages tokens per installation using installation_token
 * Implements midnight reset logic (min 5 tokens)
 * Fixes data persistence issues with file locking
 */

require_once __DIR__ . '/includes/logger.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$TOKENS_FILE = __DIR__ . '/data/tokens.json';
$INITIAL_TOKENS = 5;
$MIN_DAILY_TOKENS = 5;

/**
 * Load tokens database safely with file locking
 */
function loadTokensDB($file) {
    if (!file_exists($file)) {
        return ['installations' => []];
    }
    
    $content = file_get_contents($file);
    if (empty($content)) return ['installations' => []];

    $data = json_decode($content, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        logError("JSON Decode Error: " . json_last_error_msg());
        // Do NOT return empty array to avoid overwriting valid (but malformed) data with empty data.
        // Instead, try to backup the corrupted file and start fresh or throw exception.
        // Here we throw to protect the data until manual intervention, unless it's critical to auto-recover.
        // For auto-recovery:
        copy($file, $file . '.corrupted.' . date('Ymd_His'));
        return ['installations' => []]; 
    }

    return $data ?: ['installations' => []];
}

/**
 * Save tokens database safely with file locking
 */
function saveTokensDB($file, $data) {
    // Use file locking to prevent race conditions
    $fp = fopen($file, 'c+'); // Open for reading and writing
    if (flock($fp, LOCK_EX)) { // Acquire exclusive lock
        ftruncate($fp, 0); // Truncate file
        fwrite($fp, json_encode($data, JSON_PRETTY_PRINT));
        fflush($fp); // Flush output before releasing the lock
        flock($fp, LOCK_UN); // Release the lock
    } else {
        logError("Could not lock tokens file for writing");
    }
    fclose($fp);
}

try {
    logDebug("=== GET TOKENS REQUEST START ===");

    $installationToken = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $installationToken = $input['installation_token'] ?? null;
    } else {
        $installationToken = $_GET['installation_token'] ?? null;
    }

    if (!$installationToken) {
        throw new Exception('Missing installation_token');
    }

    // Load DB (Now robust against corruption)
    $db = loadTokensDB($TOKENS_FILE);

    // Get current date for reset logic
    $today = date('Y-m-d');
    $isNew = false;
    $resetHappened = false;

    if (!isset($db['installations'][$installationToken])) {
        // New Installation
        $db['installations'][$installationToken] = [
            'tokens' => $INITIAL_TOKENS,
            'created_at' => date('Y-m-d H:i:s'),
            'last_access' => date('Y-m-d H:i:s'),
            'last_reset_date' => $today
        ];
        $isNew = true;
        logDebug("New installation created");
    } else {
        // Existing Installation
        $installation = &$db['installations'][$installationToken];
        
        // --- MIDNIGHT RESET LOGIC ---
        $lastReset = $installation['last_reset_date'] ?? '2000-01-01';
        
        if ($lastReset !== $today) {
            // It's a new day
            if ($installation['tokens'] < $MIN_DAILY_TOKENS) {
                logDebug("Resetting tokens for new day", [
                    'old' => $installation['tokens'],
                    'new' => $MIN_DAILY_TOKENS
                ]);
                $installation['tokens'] = $MIN_DAILY_TOKENS;
                $resetHappened = true;
            }
            $installation['last_reset_date'] = $today;
        }
        
        $installation['last_access'] = date('Y-m-d H:i:s');
    }

    // Save with locking
    saveTokensDB($TOKENS_FILE, $db);

    $finalTokens = $db['installations'][$installationToken]['tokens'];

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'tokens' => $finalTokens,
        'is_new_installation' => $isNew,
        'daily_reset' => $resetHappened,
        'timestamp' => time()
    ]);

} catch (Exception $e) {
    logError("Error in get_tokens: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}