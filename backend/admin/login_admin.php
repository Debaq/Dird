<?php
/**
 * Admin Login API
 * Authenticates admin user and returns session token
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

require_once __DIR__ . '/validate_session.php';

$CREDENTIALS_FILE = __DIR__ . '/../data/admin_credentials.json';
$SESSIONS_FILE = __DIR__ . '/../data/admin_sessions.json';
$SESSION_DURATION_HOURS = 24;

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
    if (!isset($input['username']) || !isset($input['password'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Usuario y contraseña requeridos'
        ]);
        exit();
    }

    $username = $input['username'];
    $password = $input['password'];

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

    // Verify username
    if ($credentials['username'] !== $username) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales inválidas'
        ]);
        exit();
    }

    // Verify password
    if (!password_verify($password, $credentials['password_hash'])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Credenciales inválidas'
        ]);
        exit();
    }

    // Authentication successful - generate session token
    $sessionToken = generateSessionToken();
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$SESSION_DURATION_HOURS} hours"));

    // Load existing sessions
    $sessionsData = ['sessions' => []];
    if (file_exists($SESSIONS_FILE)) {
        $sessionsData = json_decode(file_get_contents($SESSIONS_FILE), true);
    }

    // Add new session
    $sessionsData['sessions'][$sessionToken] = [
        'username' => $username,
        'created_at' => date('Y-m-d H:i:s'),
        'expires_at' => $expiresAt,
        'last_activity' => date('Y-m-d H:i:s')
    ];

    // Clean up expired sessions
    foreach ($sessionsData['sessions'] as $token => $session) {
        if (strtotime($session['expires_at']) < time()) {
            unset($sessionsData['sessions'][$token]);
        }
    }

    // Save sessions
    file_put_contents($SESSIONS_FILE, json_encode($sessionsData, JSON_PRETTY_PRINT));

    // Return response
    $response = [
        'success' => true,
        'token' => $sessionToken,
        'expires_at' => $expiresAt,
        'username' => $username
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
