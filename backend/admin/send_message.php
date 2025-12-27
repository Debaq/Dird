<?php
/**
 * Send Broadcast Message API
 * Allows admin to send messages to all users
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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

require_once __DIR__ . '/validate_session.php';

$MESSAGES_FILE = __DIR__ . '/../data/messages.json';

try {
    // Validate admin session
    validateAdminSession();

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
    if (!isset($input['text'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'El campo text es requerido'
        ]);
        exit();
    }

    $text = trim($input['text']);
    if (empty($text)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'El mensaje no puede estar vacío'
        ]);
        exit();
    }

    $type = $input['type'] ?? 'toast'; // 'toast' or 'modal'
    $variant = $input['variant'] ?? 'info'; // 'info', 'success', 'warning', 'error'
    $expiresInHours = (int)($input['expires_in_hours'] ?? 24);

    // Validate type
    if (!in_array($type, ['toast', 'modal'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Tipo de mensaje inválido (debe ser toast o modal)'
        ]);
        exit();
    }

    // Validate variant
    if (!in_array($variant, ['info', 'success', 'warning', 'error'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Variante de mensaje inválida'
        ]);
        exit();
    }

    // Generate message ID
    $messageId = 'msg-' . generateSessionToken();
    $createdAt = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$expiresInHours} hours"));

    // Create message object
    $message = [
        'id' => $messageId,
        'text' => $text,
        'type' => $type,
        'variant' => $variant,
        'created_at' => $createdAt,
        'expires_at' => $expiresAt,
        'read_by' => []
    ];

    // Load existing messages
    $messagesData = ['messages' => []];
    if (file_exists($MESSAGES_FILE)) {
        $messagesData = json_decode(file_get_contents($MESSAGES_FILE), true);
    }

    // Add new message
    $messagesData['messages'][] = $message;

    // Clean up expired messages
    $now = time();
    $messagesData['messages'] = array_filter($messagesData['messages'], function($msg) use ($now) {
        return strtotime($msg['expires_at']) > $now;
    });

    // Re-index array
    $messagesData['messages'] = array_values($messagesData['messages']);

    // Save messages
    file_put_contents($MESSAGES_FILE, json_encode($messagesData, JSON_PRETTY_PRINT));

    $response = [
        'success' => true,
        'message' => 'Mensaje enviado correctamente',
        'data' => [
            'message_id' => $messageId,
            'expires_at' => $expiresAt
        ]
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
