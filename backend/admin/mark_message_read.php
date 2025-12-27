<?php
/**
 * Mark Message as Read API
 * Marks a message as read for a specific installation
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

$MESSAGES_FILE = __DIR__ . '/../data/messages.json';

try {
    // Get request body
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'JSON inválido'
        ]);
        exit();
    }

    // Validate required fields
    if (!isset($input['message_id']) || !isset($input['installation_token'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'message_id e installation_token requeridos'
        ]);
        exit();
    }

    $messageId = $input['message_id'];
    $installationToken = $input['installation_token'];

    // Load messages
    if (!file_exists($MESSAGES_FILE)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'No hay mensajes'
        ]);
        exit();
    }

    $messagesData = json_decode(file_get_contents($MESSAGES_FILE), true);
    $messageFound = false;

    // Find message and add installation to read_by
    foreach ($messagesData['messages'] as &$message) {
        if ($message['id'] === $messageId) {
            $messageFound = true;

            // Add installation token if not already in read_by array
            if (!in_array($installationToken, $message['read_by'])) {
                $message['read_by'][] = $installationToken;
            }

            break;
        }
    }
    unset($message); // Break reference

    if (!$messageFound) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Mensaje no encontrado'
        ]);
        exit();
    }

    // Save updated messages
    file_put_contents($MESSAGES_FILE, json_encode($messagesData, JSON_PRETTY_PRINT));

    $response = [
        'success' => true,
        'message' => 'Mensaje marcado como leído'
    ];

    http_response_code(200);
    echo json_encode($response);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Error interno del servidor',
        'message' => $e->getMessage()
    ]);
}
?>
