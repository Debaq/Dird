<?php
/**
 * Diagnostic endpoint - Test server configuration
 */

// NO suppress errors here, we want to see them
error_reporting(E_ALL);
ini_set('display_errors', '1');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$diagnostics = [
    'server_info' => [
        'php_version' => phpversion(),
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'Unknown',
        'request_uri' => $_SERVER['REQUEST_URI'] ?? 'Unknown',
        'script_filename' => __FILE__,
    ],
    'paths' => [
        'current_dir' => __DIR__,
        'includes_exists' => file_exists(__DIR__ . '/../includes/logger.php'),
        'includes_readable' => is_readable(__DIR__ . '/../includes/logger.php'),
        'logs_dir_exists' => file_exists(__DIR__ . '/../logs'),
        'logs_dir_writable' => is_writable(__DIR__ . '/../logs'),
        'ai_config_exists' => file_exists(__DIR__ . '/../data/ai_config.json'),
        'api_keys_exists' => file_exists(__DIR__ . '/../data/api_keys.json'),
    ],
    'functions' => [
        'curl_available' => function_exists('curl_init'),
        'json_encode_available' => function_exists('json_encode'),
        'json_decode_available' => function_exists('json_decode'),
        'getallheaders_available' => function_exists('getallheaders'),
        'file_get_contents_available' => function_exists('file_get_contents'),
    ],
    'php_settings' => [
        'error_reporting' => error_reporting(),
        'display_errors' => ini_get('display_errors'),
        'max_execution_time' => ini_get('max_execution_time'),
        'memory_limit' => ini_get('memory_limit'),
        'post_max_size' => ini_get('post_max_size'),
        'upload_max_filesize' => ini_get('upload_max_filesize'),
    ]
];

// Try to load logger
$logger_test = 'not_tested';
try {
    if (file_exists(__DIR__ . '/../includes/logger.php')) {
        require_once __DIR__ . '/../includes/logger.php';
        logDebug('Diagnostic test');
        $logger_test = 'success';

        // Check if log was created
        if (file_exists(__DIR__ . '/../logs/api_debug.log')) {
            $logger_test = 'success_with_file';
        }
    } else {
        $logger_test = 'file_not_found';
    }
} catch (Exception $e) {
    $logger_test = 'error: ' . $e->getMessage();
}

$diagnostics['logger_test'] = $logger_test;

// Test Groq API Key
$api_key_status = 'not_checked';
try {
    if (file_exists(__DIR__ . '/../data/api_keys.json')) {
        $keyData = json_decode(file_get_contents(__DIR__ . '/../data/api_keys.json'), true);
        $apiKey = $keyData['groq_api_key'] ?? null;
        if ($apiKey) {
            $api_key_status = 'configured (length: ' . strlen($apiKey) . ')';
        } else {
            $api_key_status = 'not_set';
        }
    } else {
        $api_key_status = 'file_not_found';
    }
} catch (Exception $e) {
    $api_key_status = 'error: ' . $e->getMessage();
}

$diagnostics['groq_api_key'] = $api_key_status;

echo json_encode($diagnostics, JSON_PRETTY_PRINT);
