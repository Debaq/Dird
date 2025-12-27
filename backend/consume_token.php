<?php
/**
 * Process Conclusion API - Processes conclusion data and returns enhanced JSON
 * This endpoint receives the report data, processes it via Groq AI, and returns the result.
 */

// Start output buffering IMMEDIATELY
ob_start();

// Suppress warnings that could break JSON output
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

// Include logger
require_once __DIR__ . '/includes/logger.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if (($_SERVER['REQUEST_METHOD'] ?? 'POST') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

logDebug("=== CONSUME TOKEN REQUEST START ===");
logDebug("Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED'));
logDebug("Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'UNDEFINED'));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    logError("Invalid method", ['method' => $_SERVER['REQUEST_METHOD'] ?? 'UNDEFINED']);
    sendJsonResponse([
        'success' => false,
        'error' => 'Method not allowed'
    ], 405);
}

$API_KEYS_FILE = __DIR__ . '/data/api_keys.json';
$AI_CONFIG_FILE = __DIR__ . '/data/ai_config.json';

// Helper function to send clean JSON response
function sendJsonResponse($data, $httpCode = 200) {
    if ($httpCode !== 200) {
        http_response_code($httpCode);
    }
    ob_clean();
    echo json_encode($data);
    ob_end_flush();
    exit();
}

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
    logDebug(">>> GROQ API CALL START <<<");

    $url = 'https://api.groq.com/openai/v1/chat/completions';
    logDebug("Groq URL", $url);

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

    // Replace {LANGUAGE} placeholder
    $systemPrompt = str_replace('{LANGUAGE}', $langName, $promptTemplate);
    logDebug("System Prompt", substr($systemPrompt, 0, 200) . '...');

    $userPrompt = "Here is the patient's screening data: " . json_encode($reportData);
    logDebug("User Prompt", substr($userPrompt, 0, 300) . '...');

    $data = [
        'model' => $model,
        'messages' => [
            ['role' => 'system', 'content' => $systemPrompt],
            ['role' => 'user', 'content' => $userPrompt]
        ],
        'temperature' => 0.5,
        'max_tokens' => 1024
    ];

    logDebug("Request Payload", [
        'model' => $model,
        'messages_count' => count($data['messages']),
        'temperature' => $data['temperature'],
        'max_tokens' => $data['max_tokens']
    ]);

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    logDebug("cURL initialized", [
        'api_key_prefix' => substr($apiKey, 0, 10) . '...',
        'api_key_length' => strlen($apiKey)
    ]);

    logDebug("Sending request to Groq API...");
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    logDebug("Groq API Response Received", [
        'http_code' => $httpCode,
        'response_length' => strlen($response ?? ''),
        'response_preview' => substr($response ?? '', 0, 200)
    ]);

    if (curl_errno($ch)) {
        $error = curl_error($ch);
        $errno = curl_errno($ch);
        curl_close($ch);

        logError("cURL Error", [
            'errno' => $errno,
            'error' => $error,
            'http_code' => $httpCode
        ]);

        return ['error' => "cURL Error [$errno]: $error"];
    }

    curl_close($ch);

    if ($httpCode !== 200) {
        logError("HTTP Error from Groq", [
            'http_code' => $httpCode,
            'response' => $response
        ]);
        return ['error' => "HTTP Error: $httpCode", 'response' => $response];
    }

    $result = json_decode($response, true);

    if ($result === null) {
        logError("Failed to decode JSON response", [
            'json_error' => json_last_error_msg(),
            'response_preview' => substr($response, 0, 500)
        ]);
        return ['error' => 'Invalid JSON response from Groq'];
    }

    logDebug("Groq Response Decoded", [
        'has_choices' => isset($result['choices']),
        'choices_count' => count($result['choices'] ?? []),
        'has_content' => isset($result['choices'][0]['message']['content']),
        'content_length' => strlen($result['choices'][0]['message']['content'] ?? '')
    ]);

    $content = $result['choices'][0]['message']['content'] ?? null;

    if ($content) {
        logDebug("Groq API Content", substr($content, 0, 300) . '...');
    } else {
        logError("No content in Groq response", $result);
    }

    logDebug("<<< GROQ API CALL END <<<");

    return ['content' => $content];
}

try {
    // Get request body
    $rawInput = file_get_contents('php://input');
    logDebug("Raw Input", substr($rawInput, 0, 500)); // Log first 500 chars

    $input = json_decode($rawInput, true);

    if (!$input) {
        logError("Invalid JSON input");
        sendJsonResponse([
            'success' => false,
            'error' => 'Invalid JSON'
        ], 400);
    }

    logDebug("Decoded Input", array_keys($input));

    // Validate required fields
    if (!isset($input['installation_token'])) {
        logError("Missing installation_token");
        sendJsonResponse([
            'success' => false,
            'error' => 'Missing installation_token'
        ], 400);
    }

    if (!isset($input['report_data'])) {
        logError("Missing report_data");
        sendJsonResponse([
            'success' => false,
            'error' => 'Missing report_data'
        ], 400);
    }

    logDebug("Request validated successfully", [
        'has_installation_token' => true,
        'has_report_data' => true,
        'language' => $input['language'] ?? 'es'
    ]);

    $reportData = $input['report_data'];
    $language = $input['language'] ?? 'es';

    // Get API Key and Config
    $groqKey = getGroqKey();
    logDebug("Groq Key Retrieved", ['has_key' => !empty($groqKey), 'key_length' => strlen($groqKey ?? '')]);

    $aiConfig = getAIConfig();
    logDebug("AI Config Retrieved", ['model' => $aiConfig['active_model'] ?? 'unknown']);

    $model = $aiConfig['active_model'];
    $promptTemplate = $aiConfig['system_prompt'];

    // Fallback message
    $limitMessage = "El programa es gratuito y lamentablemente solo tenemos un número limitado de créditos por día para todos los usuarios. Siempre puedes contribuir con un café para que mejoremos nuestros servicios.";
    if ($language === 'en') {
        $limitMessage = "This program is free, and unfortunately, we only have a limited number of daily credits for all users. You can always contribute with a coffee to help us improve our services.";
    }

    // If no key or empty key, return fallback immediately
    if (empty($groqKey)) {
        logDebug("No API key configured - returning fallback");
        sendJsonResponse([
            'success' => true,
            'ai_processed' => false,
            'message' => $limitMessage,
            'processed_data' => $reportData
        ]);
    }

    // Call Groq
    logDebug("Calling Groq API", ['model' => $model, 'language' => $language]);
    $groqResult = callGroqAPI($groqKey, $reportData, $language, $model, $promptTemplate);

    // Check if AI call failed
    if (isset($groqResult['error']) || empty($groqResult['content'])) {
        logError("Groq API Error", ['error' => $groqResult['error'] ?? 'Unknown', 'has_content' => !empty($groqResult['content'])]);

        sendJsonResponse([
            'success' => true,
            'ai_processed' => false,
            'message' => $limitMessage, // Same message for quota exceeded or other errors
            'processed_data' => $reportData
        ]);
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

    logDebug("AI Processing Successful", [
        'model' => $model,
        'content_length' => strlen($groqResult['content'] ?? ''),
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    logDebug("=== CONSUME TOKEN REQUEST END (SUCCESS) ===");

    sendJsonResponse([
        'success' => true,
        'ai_processed' => true, // Signal that AI worked
        'processed_data' => $processedData
    ]);

} catch (Exception $e) {
    logError("Exception caught", [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => substr($e->getTraceAsString(), 0, 500)
    ]);
    logDebug("=== CONSUME TOKEN REQUEST END (ERROR) ===");

    sendJsonResponse([
        'success' => false,
        'error' => 'Internal server error',
        'message' => $e->getMessage()
    ], 500);
}
