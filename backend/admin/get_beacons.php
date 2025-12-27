<?php
/**
 * Get Active Beacons API
 * Returns list of all active help beacons
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

$BEACONS_FILE = __DIR__ . '/../data/beacons.json';

try {
    // Validate admin session
    validateAdminSession();

    // Load beacons
    $beaconsData = ['beacons' => []];
    if (file_exists($BEACONS_FILE)) {
        $beaconsData = json_decode(file_get_contents($BEACONS_FILE), true);
    }

    $now = time();
    $activeBeacons = [];

    // Filter active beacons and calculate remaining time
    foreach ($beaconsData['beacons'] as $beacon) {
        $expiresAt = strtotime($beacon['expires_at']);

        // Only include non-expired beacons
        if ($expiresAt > $now) {
            $secondsRemaining = $expiresAt - $now;

            $activeBeacons[] = [
                'installation_token' => $beacon['installation_token'],
                'activated_at' => $beacon['activated_at'],
                'expires_at' => $beacon['expires_at'],
                'seconds_remaining' => $secondsRemaining
            ];
        }
    }

    // Clean up expired beacons from file
    $beaconsData['beacons'] = array_values(array_filter($beaconsData['beacons'], function($beacon) use ($now) {
        return strtotime($beacon['expires_at']) > $now;
    }));

    file_put_contents($BEACONS_FILE, json_encode($beaconsData, JSON_PRETTY_PRINT));

    // Sort by seconds remaining descending (most urgent first)
    usort($activeBeacons, function($a, $b) {
        return $a['seconds_remaining'] - $b['seconds_remaining'];
    });

    $response = [
        'success' => true,
        'beacons' => $activeBeacons,
        'count' => count($activeBeacons)
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
