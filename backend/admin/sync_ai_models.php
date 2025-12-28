<?php
/**
 * Sync AI Models API
 * Fetches available models directly from Groq API and updates ai_config.json
 */

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

$API_KEYS_FILE = __DIR__ . '/../data/api_keys.json';
$AI_CONFIG_FILE = __DIR__ . '/../data/ai_config.json';

// Conocimiento base de ventanas de contexto para mapear
$CONTEXT_WINDOWS = [
    'llama-3.3-70b-versatile' => 128000,
    'llama-3.3-70b-specdec' => 8192,
    'llama-3.1-70b-versatile' => 128000,
    'llama-3.1-8b-instant' => 128000,
    'llama3-70b-8192' => 8192,
    'llama3-8b-8192' => 8192,
    'mixtral-8x7b-32768' => 32768,
    'gemma2-9b-it' => 8192,
    'gemma-7b-it' => 8192,
    'llama-3.2-1b-preview' => 128000,
    'llama-3.2-3b-preview' => 128000,
    'llama-3.2-11b-vision-preview' => 128000,
    'llama-3.2-90b-vision-preview' => 128000,
    'whisper-large-v3' => 0, // Audio model, skip
    'whisper-large-v3-turbo' => 0 // Audio model, skip
];

try {
    // 1. Get API Key
    if (!file_exists($API_KEYS_FILE)) {
        throw new Exception('API Key not configured');
    }
    $keyData = json_decode(file_get_contents($API_KEYS_FILE), true);
    $apiKey = $keyData['groq_api_key'] ?? null;

    if (!$apiKey) {
        throw new Exception('Groq API Key missing');
    }

    // 2. Call Groq API
    $ch = curl_init('https://api.groq.com/openai/v1/models');
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        throw new Exception('cURL Error: ' . curl_error($ch));
    }
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception('Groq API Error: ' . $httpCode . ' - ' . $response);
    }

    $data = json_decode($response, true);
    if (!$data || !isset($data['data'])) {
        throw new Exception('Invalid response format from Groq');
    }

    // 3. Process Models
    $newModels = [];
    foreach ($data['data'] as $groqModel) {
        $id = $groqModel['id'];
        
        // Skip audio models or undesired ones if needed
        if (strpos($id, 'whisper') !== false) continue;

        // Determine nice name
        $name = ucwords(str_replace(['-', '_'], ' ', $id));
        // Manual tweaks for cleaner names
        if (strpos($id, 'llama-3.3-70b') !== false) $name = "Llama 3.3 70B";
        if (strpos($id, 'llama-3.1-70b') !== false) $name = "Llama 3.1 70B";
        if (strpos($id, 'llama-3.1-8b') !== false) $name = "Llama 3.1 8B";
        if (strpos($id, 'mixtral') !== false) $name = "Mixtral 8x7B";
        if (strpos($id, 'vision') !== false) $name .= " (Vision)";

        // Get Context Window (default to 8192 if unknown)
        $context = $groqModel['context_window'] ?? ($CONTEXT_WINDOWS[$id] ?? 8192);

        $newModels[] = [
            'id' => $id,
            'name' => $name,
            'description' => "Imported from Groq API",
            'context_window' => $context
        ];
    }

    // 4. Update Config File
    $currentConfig = [];
    if (file_exists($AI_CONFIG_FILE)) {
        $currentConfig = json_decode(file_get_contents($AI_CONFIG_FILE), true) ?? [];
    }

    // Preserve active model if it still exists in new list, otherwise pick first
    $activeStillExists = false;
    foreach ($newModels as $m) {
        if (isset($currentConfig['active_model']) && $m['id'] === $currentConfig['active_model']) {
            $activeStillExists = true;
            break;
        }
    }

    $currentConfig['models'] = $newModels;
    if (!$activeStillExists && !empty($newModels)) {
        $currentConfig['active_model'] = $newModels[0]['id'];
    }

    file_put_contents($AI_CONFIG_FILE, json_encode($currentConfig, JSON_PRETTY_PRINT));

    ob_clean();
    echo json_encode([
        'success' => true,
        'message' => 'Models synchronized successfully',
        'count' => count($newModels),
        'models' => $newModels
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
