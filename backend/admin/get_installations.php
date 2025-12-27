<?php
/**
 * Get Installations API
 * Returns list of all installation tokens with their data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

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

require_once __DIR__ . '/validate_session.php';

$TOKENS_FILE = __DIR__ . '/../data/tokens.json';
$BEACONS_FILE = __DIR__ . '/../data/beacons.json';

try {
    // Validate admin session
    validateAdminSession();

    // Load tokens database
    if (!file_exists($TOKENS_FILE)) {
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'installations' => []
        ]);
        exit();
    }

    $tokensData = json_decode(file_get_contents($TOKENS_FILE), true);
    $installations = $tokensData['installations'] ?? [];

    // Load beacons data
    $beaconsData = ['beacons' => []];
    if (file_exists($BEACONS_FILE)) {
        $beaconsData = json_decode(file_get_contents($BEACONS_FILE), true);
    }

    $activeBeacons = [];
    $now = time();

    // Filter active beacons
    foreach ($beaconsData['beacons'] as $beacon) {
        $expiresAt = strtotime($beacon['expires_at']);
        if ($expiresAt > $now) {
            $activeBeacons[$beacon['installation_token']] = true;
        }
    }

    // Format installations array
    $result = [];
    foreach ($installations as $token => $data) {
        $result[] = [
            'installation_token' => $token,
            'tokens' => $data['tokens'],
            'created_at' => $data['created_at'],
            'last_access' => $data['last_access'] ?? $data['created_at'],
            'last_usage' => $data['last_usage'] ?? null,
            'has_active_beacon' => isset($activeBeacons[$token])
        ];
    }

    // Sort by created_at descending (newest first)
    usort($result, function($a, $b) {
        return strtotime($b['created_at']) - strtotime($a['created_at']);
    });

    $response = [
        'success' => true,
        'installations' => $result,
        'total' => count($result)
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
