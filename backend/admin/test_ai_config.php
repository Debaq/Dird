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
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Allow overriding config for testing without saving
    $model = $input['model'] ?? 'llama-3.3-70b-versatile';
    $systemPrompt = $input['system_prompt'] ?? '';
    $testData = $input['test_data'] ?? ['test' => 'data'];
    $language = $input['language'] ?? 'es';

    // Get API Key
    $apiKey = getGroqKey();
    if (!$apiKey) {
        throw new Exception('API Key not configured');
    }

    $url = 'https://api.groq.com/openai/v1/chat/completions';
    
    // Determine language name for the prompt
    $langName = match($language) {
        'en' => 'English',
        'pt' => 'Portuguese',
        'fr' => 'French',
        'de' => 'German',
        'it' => 'Italian',
        default => 'Spanish'
    };

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

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if (curl_errno($ch)) {
        throw new Exception(curl_error($ch));
    }
    
    curl_close($ch);

    $result = json_decode($response, true);
    
    echo json_encode([
        'success' => $httpCode === 200,
        'http_code' => $httpCode,
        'response' => $result,
        'sent_prompt' => $finalSystemPrompt // Useful for debugging
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
