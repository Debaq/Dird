<?php
/**
 * Update Tokens API
 * Adds tokens to a specific installation (max 9999 total)
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

$TOKENS_FILE = __DIR__ . '/../data/tokens.json';
$MAX_TOKENS = 9999;

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
    if (!isset($input['installation_token']) || !isset($input['new_total'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'installation_token y new_total requeridos'
        ]);
        exit();
    }

    $installationToken = $input['installation_token'];
    $newTotal = (int)$input['new_total'];

    // Load tokens database
    if (!file_exists($TOKENS_FILE)) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Base de datos de tokens no encontrada'
        ]);
        exit();
    }

    $tokensData = json_decode(file_get_contents($TOKENS_FILE), true);
    $installations = $tokensData['installations'] ?? [];

    // Check if installation exists
    if (!isset($installations[$installationToken])) {
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Instalación no encontrada'
        ]);
        exit();
    }

    $currentTokens = $installations[$installationToken]['tokens'];

    // Validate: Cannot reduce tokens
    if ($newTotal < $currentTokens) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => "No se pueden eliminar tokens. El nuevo total ({$newTotal}) debe ser mayor o igual al actual ({$currentTokens})."
        ]);
        exit();
    }

    // Validate max limit
    if ($newTotal > $MAX_TOKENS) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => "El total de tokens no puede exceder {$MAX_TOKENS}."
        ]);
        exit();
    }

    $tokensAdded = $newTotal - $currentTokens;

    // Update tokens
    $installations[$installationToken]['tokens'] = $newTotal;
    $installations[$installationToken]['last_updated'] = date('Y-m-d H:i:s');

    // Save database
    $tokensData['installations'] = $installations;
    file_put_contents($TOKENS_FILE, json_encode($tokensData, JSON_PRETTY_PRINT));

    $response = [
        'success' => true,
        'message' => 'Tokens actualizados correctamente',
        'data' => [
            'new_total' => $newTotal,
            'tokens_added' => $tokensAdded,
            'installation_token' => $installationToken
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
