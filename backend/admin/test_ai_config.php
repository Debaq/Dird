<?php
// Start output buffering IMMEDIATELY to catch any unwanted output
ob_start();

// Suppress warnings that could break JSON output
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

// Include logger
require_once __DIR__ . '/../includes/logger.php';
require_once __DIR__ . '/../includes/ai_stats.php';

logDebug("=== TEST AI CONFIG REQUEST START ===");
logDebug("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED'));

// Get headers (compatible with all PHP environments)
$headers = [];
if (function_exists('getallheaders')) {
    $headers = getallheaders();
} else {
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
        }
    }
}
logDebug("Request Headers", $headers);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    logDebug("OPTIONS request - returning 200");
    http_response_code(200);
    exit();
}

$AI_CONFIG_FILE = __DIR__ . '/../data/ai_config.json';
$API_KEYS_FILE = __DIR__ . '/../data/api_keys.json';

logDebug("Config files", [
    'AI_CONFIG_FILE' => $AI_CONFIG_FILE,
    'API_KEYS_FILE' => $API_KEYS_FILE,
    'ai_config_exists' => file_exists($AI_CONFIG_FILE),
    'api_keys_exists' => file_exists($API_KEYS_FILE)
]);

function getGroqKey() {
    global $API_KEYS_FILE;
    if (!file_exists($API_KEYS_FILE)) {
        return null;
    }
    $content = file_get_contents($API_KEYS_FILE);
    $data = json_decode($content, true);
    return $data['groq_api_key'] ?? null;
}

try {
    $rawInput = file_get_contents('php://input');
    logDebug("Raw Input", $rawInput);

    $input = json_decode($rawInput, true);
    logDebug("Decoded Input", $input);

    // Allow overriding config for testing without saving
    $model = $input['model'] ?? 'llama-3.3-70b-versatile';
    $systemPrompt = $input['system_prompt'] ?? '';
    $testData = $input['test_data'] ?? ['test' => 'data'];
    $language = $input['language'] ?? 'es';

    logDebug("Request Parameters", [
        'model' => $model,
        'language' => $language,
        'has_system_prompt' => !empty($systemPrompt),
        'test_data' => $testData
    ]);

    // Get API Key
    $apiKey = getGroqKey();
    logDebug("API Key Retrieved", ['has_key' => !empty($apiKey), 'key_length' => strlen($apiKey ?? '')]);

    if (!$apiKey) {
        logError("API Key not configured");
        throw new Exception('API Key not configured');
    }

    $url = 'https://api.groq.com/openai/v1/chat/completions';
    logDebug("Groq API URL", $url);

    // Determine language name for the prompt
    $langMap = [
        'en' => 'English',
        'pt' => 'Portuguese',
        'fr' => 'French',
        'de' => 'German',
        'it' => 'Italian'
    ];
    $langName = $langMap[$language] ?? 'Spanish';

    logDebug("Language mapping", ['input' => $language, 'output' => $langName]);

    // Replace {LANGUAGE} placeholder if exists
    $finalSystemPrompt = str_replace('{LANGUAGE}', $langName, $systemPrompt);

    $userPrompt = "Here is the patient's screening data: " . json_encode($testData);

    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $finalSystemPrompt],
            ['role' => 'user', 'content' => $userPrompt]
        ],
        'temperature' => 0.5,
        'max_tokens' => 1024
    ];

    logDebug("Groq Request Payload", $data);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    logDebug("cURL configured", ['api_key_prefix' => substr($apiKey, 0, 10) . '...']);

    logDebug("Sending request to Groq API...");
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    logDebug("Groq API Response", [
        'http_code' => $httpCode,
        'response_length' => strlen($response),
        'response_preview' => substr($response, 0, 200)
    ]);

    if (curl_errno($ch)) {
        $error = curl_error($ch);
        logError("cURL Error", ['errno' => curl_errno($ch), 'error' => $error]);
        curl_close($ch);
        throw new Exception($error);
    }

    curl_close($ch);

    $result = json_decode($response, true);
    logDebug("Decoded Groq Response", ['success' => ($result !== null), 'keys' => array_keys($result ?? [])]);

    if (isset($result['usage'])) {
        saveAIUsage($model, $result['usage'], 'test_connection');
    }

    $output = [
        'success' => $httpCode === 200,
        'http_code' => $httpCode,
        'response' => $result,
        'sent_prompt' => $finalSystemPrompt // Useful for debugging
    ];

    logDebug("Final Output", $output);
    logDebug("=== TEST AI CONFIG REQUEST END (SUCCESS) ===");

    // Clean output buffer and send only JSON
    ob_clean();
    echo json_encode($output);
    ob_end_flush();

} catch (Exception $e) {
    logError("Exception caught", [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);

    http_response_code(500);
    $errorOutput = [
        'success' => false,
        'error' => $e->getMessage()
    ];

    logDebug("Error Output", $errorOutput);
    logDebug("=== TEST AI CONFIG REQUEST END (ERROR) ===");

    // Clean output buffer and send only JSON
    ob_clean();
    echo json_encode($errorOutput);
    ob_end_flush();
}
