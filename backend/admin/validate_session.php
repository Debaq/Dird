<?php
/**
 * Admin Session Validation Helper
 * Include this file in all admin endpoints to validate session
 */

function validateAdminSession() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';

    // Extract token from "Bearer TOKEN" or just "TOKEN"
    $token = '';
    if (strpos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
    } else {
        $token = $authHeader;
    }

    if (!$token) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'No autorizado - Token no proporcionado'
        ]);
        exit;
    }

    $sessionsFile = __DIR__ . '/../data/admin_sessions.json';

    if (!file_exists($sessionsFile)) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'No autorizado - Sistema de sesiones no disponible'
        ]);
        exit;
    }

    $sessionsData = json_decode(file_get_contents($sessionsFile), true);
    $sessions = $sessionsData['sessions'] ?? [];

    if (!isset($sessions[$token])) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Sesión inválida'
        ]);
        exit;
    }

    $session = $sessions[$token];
    $expiresAt = strtotime($session['expires_at']);

    if ($expiresAt < time()) {
        // Session expired - remove it
        unset($sessions[$token]);
        file_put_contents($sessionsFile, json_encode(['sessions' => $sessions], JSON_PRETTY_PRINT));

        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Sesión expirada'
        ]);
        exit;
    }

    return true;
}

/**
 * Generate a UUID v4
 */
function generateSessionToken() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}
?>
