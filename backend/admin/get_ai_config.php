<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Basic session validation would go here (or check for admin token)

$AI_CONFIG_FILE = __DIR__ . '/../data/ai_config.json';
$API_KEYS_FILE = __DIR__ . '/../data/api_keys.json';

try {
    // Load Config
    $config = [];
    if (file_exists($AI_CONFIG_FILE)) {
        $config = json_decode(file_get_contents($AI_CONFIG_FILE), true);
    }

    // Load API Key (and mask it)
    $apiKey = '';
    if (file_exists($API_KEYS_FILE)) {
        $keyData = json_decode(file_get_contents($API_KEYS_FILE), true);
        $fullKey = $keyData['groq_api_key'] ?? '';
        if (!empty($fullKey)) {
            // Mask key: show first 4 and last 4 chars
            if (strlen($fullKey) > 8) {
                $apiKey = substr($fullKey, 0, 4) . '...' . substr($fullKey, -4);
            } else {
                $apiKey = '********';
            }
        }
    }

    echo json_encode([
        'success' => true,
        'config' => $config,
        'has_key' => !empty($fullKey),
        'masked_key' => $apiKey
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
