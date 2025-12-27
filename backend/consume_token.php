<?php
/**
 * Process Conclusion API - Processes conclusion data and returns enhanced JSON
 * This endpoint receives the report data, processes it via Groq AI, and returns the result.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

$API_KEYS_FILE = __DIR__ . '/data/api_keys.json';
$AI_CONFIG_FILE = __DIR__ . '/data/ai_config.json';

function getGroqKey() {
    global $API_KEYS_FILE;
    if (!file_exists($API_KEYS_FILE)) {
        return null;
    }
    $content = file_get_contents($API_KEYS_FILE);
    $data = json_decode($content, true);
    return $data['groq_api_key'] ?? null;
}

function getAIConfig() {
    global $AI_CONFIG_FILE;
    $defaultConfig = [
        'active_model' => 'llama-3.3-70b-versatile',
        'system_prompt' => "You are an expert ophthalmologist assistant. Your task is to analyze the provided Diabetic Retinopathy screening results (JSON) and generate a clear, human-friendly summary for the patient in {LANGUAGE}. \n\nThe summary should:\n1. Be reassuring but professional.\n2. Explain the findings clearly (e.g., 'No signs of DR' or 'Mild signs detected').\n3. Provide a recommendation based on the severity (e.g., 'Routine checkup in 1 year' or 'Consult a specialist').\n4. Do NOT mention JSON fields or technical codes directly. Use natural language.\n5. Keep it concise (under 200 words)."
    ];

    if (!file_exists($AI_CONFIG_FILE)) {
        return $defaultConfig;
    }
    
    $content = file_get_contents($AI_CONFIG_FILE);
    $config = json_decode($content, true);
    
    return array_merge($defaultConfig, $config ?? []);
}

function callGroqAPI($apiKey, $reportData, $language, $model, $promptTemplate) {
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

    // Replace {LANGUAGE} placeholder
    $systemPrompt = str_replace('{LANGUAGE}', $langName, $promptTemplate);

    $userPrompt = "Here is the patient's screening data: " . json_encode($reportData);

    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
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
        $error = curl_error($ch);
        curl_close($ch);
        return ['error' => $error];
    }
    
    curl_close($ch);

    if ($httpCode !== 200) {
        return ['error' => "HTTP Error: $httpCode", 'response' => $response];
    }

    $result = json_decode($response, true);
    return ['content' => $result['choices'][0]['message']['content'] ?? null];
}

try {
    // Get request body
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid JSON'
        ]);
        exit();
    }

    // Validate required fields
    if (!isset($input['installation_token'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing installation_token'
        ]);
        exit();
    }

    if (!isset($input['report_data'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Missing report_data'
        ]);
        exit();
    }

    $reportData = $input['report_data'];
    $language = $input['language'] ?? 'es';

    // Get API Key and Config
    $groqKey = getGroqKey();
    $aiConfig = getAIConfig();
    
    $model = $aiConfig['active_model'];
    $promptTemplate = $aiConfig['system_prompt'];

    // Fallback message
    $limitMessage = "El programa es gratuito y lamentablemente solo tenemos un número limitado de créditos por día para todos los usuarios. Siempre puedes contribuir con un café para que mejoremos nuestros servicios.";
    if ($language === 'en') {
        $limitMessage = "This program is free, and unfortunately, we only have a limited number of daily credits for all users. You can always contribute with a coffee to help us improve our services.";
    }

    // If no key or empty key, return fallback immediately
    if (empty($groqKey)) {
        echo json_encode([
            'success' => true,
            'ai_processed' => false,
            'message' => $limitMessage,
            'processed_data' => $reportData
        ]);
        exit();
    }

    // Call Groq
    $groqResult = callGroqAPI($groqKey, $reportData, $language, $model, $promptTemplate);

    // Check if AI call failed
    if (isset($groqResult['error']) || empty($groqResult['content'])) {
        // Log error internally if needed, but return user-friendly fallback
        // error_log("Groq API Error: " . ($groqResult['error'] ?? 'Unknown'));
        
        echo json_encode([
            'success' => true,
            'ai_processed' => false,
            'message' => $limitMessage, // Same message for quota exceeded or other errors
            'processed_data' => $reportData
        ]);
        exit();
    }

    // Success
    $processedData = $reportData;
    $processedData['ai_analysis'] = $groqResult['content'];
    
    // Add processing metadata
    $processedData['_processing'] = [
        'status' => 'processed',
        'source' => 'Groq AI (' . $model . ')',
        'timestamp' => date('Y-m-d H:i:s'),
    ];

    echo json_encode([
        'success' => true,
        'ai_processed' => true, // Signal that AI worked
        'processed_data' => $processedData
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ]);
}
