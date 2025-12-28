<?php
// Start output buffering IMMEDIATELY
ob_start();

// Suppress warnings that could break JSON output
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'POST') === 'OPTIONS') {
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

    // New Parameters
    if (isset($input['temperature'])) {
        $currentConfig['temperature'] = (float)$input['temperature'];
    }
    if (isset($input['max_completion_tokens'])) {
        $currentConfig['max_completion_tokens'] = (int)$input['max_completion_tokens'];
    }
    if (isset($input['top_p'])) {
        $currentConfig['top_p'] = (float)$input['top_p'];
    }
    if (isset($input['reasoning_effort'])) {
        $currentConfig['reasoning_effort'] = $input['reasoning_effort'];
    }
    if (isset($input['stream'])) {
        $currentConfig['stream'] = (bool)$input['stream'];
    }
    if (isset($input['stop'])) {
        $currentConfig['stop'] = $input['stop'];
    }

    file_put_contents($AI_CONFIG_FILE, json_encode($currentConfig, JSON_PRETTY_PRINT));

    ob_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Configuration saved successfully'
    ]);
    ob_end_flush();

} catch (Exception $e) {
    http_response_code(500);
    ob_clean();
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    ob_end_flush();
}
