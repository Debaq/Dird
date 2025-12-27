<?php
/**
 * Get Messages API
 * Returns unread messages for a specific installation
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'Method not allowed'
    ]);
    exit();
}

$MESSAGES_FILE = __DIR__ . '/../data/messages.json';

try {
    // Get installation token from query string
    $installationToken = $_GET['installation_token'] ?? null;

    if (!$installationToken) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'installation_token requerido'
        ]);
        exit();
    }

    // Load messages
    $messagesData = ['messages' => []];
    if (file_exists($MESSAGES_FILE)) {
        $messagesData = json_decode(file_get_contents($MESSAGES_FILE), true);
    }

    $now = time();
    $unreadMessages = [];

    // Filter messages: not expired and not read by this installation
    foreach ($messagesData['messages'] as $message) {
        $expiresAt = strtotime($message['expires_at']);

        // Skip expired messages
        if ($expiresAt <= $now) {
            continue;
        }

        // Skip messages already read by this installation
        if (in_array($installationToken, $message['read_by'])) {
            continue;
        }

        // Return only necessary fields to client
        $unreadMessages[] = [
            'id' => $message['id'],
            'text' => $message['text'],
            'type' => $message['type'],
            'variant' => $message['variant'],
            'created_at' => $message['created_at']
        ];
    }

    $response = [
        'success' => true,
        'data' => [
            'messages' => $unreadMessages,
            'count' => count($unreadMessages)
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
