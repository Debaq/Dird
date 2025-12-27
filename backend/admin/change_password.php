<?php
/**
 * Admin Change Password API
 * Allows admin to change their own password
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

$CREDENTIALS_FILE = __DIR__ . '/../data/admin_credentials.json';
$SESSIONS_FILE = __DIR__ . '/../data/admin_sessions.json';

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
    if (!isset($input['current_password']) || !isset($input['new_password']) || !isset($input['confirm_password'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'current_password, new_password y confirm_password son requeridos'
        ]);
        exit();
    }

    $currentPassword = $input['current_password'];
    $newPassword = $input['new_password'];
    $confirmPassword = $input['confirm_password'];

    // Validate new password confirmation
    if ($newPassword !== $confirmPassword) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Las contraseñas nuevas no coinciden'
        ]);
        exit();
    }

    // Validate new password strength
    if (strlen($newPassword) < 8) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'La nueva contraseña debe tener al menos 8 caracteres'
        ]);
        exit();
    }

    // Check if new password is the same as current
    if ($currentPassword === $newPassword) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'La nueva contraseña debe ser diferente a la actual'
        ]);
        exit();
    }

    // Load credentials
    if (!file_exists($CREDENTIALS_FILE)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => 'Sistema de autenticación no configurado'
        ]);
        exit();
    }

    $credentials = json_decode(file_get_contents($CREDENTIALS_FILE), true);

    // Verify current password
    if (!password_verify($currentPassword, $credentials['password_hash'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Contraseña actual incorrecta'
        ]);
        exit();
    }

    // Generate new password hash
    $newPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

    // Update credentials
    $credentials['password_hash'] = $newPasswordHash;
    $credentials['last_password_change'] = date('Y-m-d H:i:s');

    // Save credentials
    file_put_contents($CREDENTIALS_FILE, json_encode($credentials, JSON_PRETTY_PRINT));

    // Invalidate all existing sessions for security (force re-login)
    $sessionsData = ['sessions' => []];
    file_put_contents($SESSIONS_FILE, json_encode($sessionsData, JSON_PRETTY_PRINT));

    $response = [
        'success' => true,
        'message' => 'Contraseña actualizada correctamente. Por favor, inicia sesión nuevamente.'
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
