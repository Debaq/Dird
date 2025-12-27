<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$AI_CONFIG_FILE = __DIR__ . '/../data/ai_config.json';
$API_KEYS_FILE = __DIR__ . '/../data/api_keys.json';

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        throw new Exception('Invalid JSON input');
    }

    // 1. Update API Key if provided
    if (isset($input['api_key'])) {
        $keyData = [];
        if (file_exists($API_KEYS_FILE)) {
            $keyData = json_decode(file_get_contents($API_KEYS_FILE), true) ?? [];
        }
        
        // Only update if it's not the masked version
        if (strpos($input['api_key'], '...') === false) {
            $keyData['groq_api_key'] = $input['api_key'];
            file_put_contents($API_KEYS_FILE, json_encode($keyData, JSON_PRETTY_PRINT));
        }
    }

    // 2. Update AI Config
    $currentConfig = [];
    if (file_exists($AI_CONFIG_FILE)) {
        $currentConfig = json_decode(file_get_contents($AI_CONFIG_FILE), true) ?? [];
    }

    // Update specific fields
    if (isset($input['active_model'])) {
        $currentConfig['active_model'] = $input['active_model'];
    }
    if (isset($input['models']) && is_array($input['models'])) {
        $currentConfig['models'] = $input['models'];
    }
    if (isset($input['system_prompt'])) {
        $currentConfig['system_prompt'] = $input['system_prompt'];
    }

    file_put_contents($AI_CONFIG_FILE, json_encode($currentConfig, JSON_PRETTY_PRINT));

    echo json_encode([
        'success' => true,
        'message' => 'Configuration saved successfully'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
