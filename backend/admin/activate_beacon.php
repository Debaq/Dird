<?php
/**
 * Activate Beacon API
 * Allows users to activate a help beacon for 5 minutes
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

$BEACONS_FILE = __DIR__ . '/../data/beacons.json';
$BEACON_DURATION_MINUTES = 5;

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
    if (!isset($input['installation_token'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'installation_token requerido'
        ]);
        exit();
    }

    $installationToken = $input['installation_token'];

    // Load existing beacons
    $beaconsData = ['beacons' => []];
    if (file_exists($BEACONS_FILE)) {
        $beaconsData = json_decode(file_get_contents($BEACONS_FILE), true);
    }

    $now = time();
    $activatedAt = date('Y-m-d H:i:s');
    $expiresAt = date('Y-m-d H:i:s', strtotime("+{$BEACON_DURATION_MINUTES} minutes"));

    // Clean up expired beacons
    $beaconsData['beacons'] = array_filter($beaconsData['beacons'], function($beacon) use ($now) {
        return strtotime($beacon['expires_at']) > $now;
    });

    // Check if this installation already has an active beacon
    $existingBeacon = null;
    foreach ($beaconsData['beacons'] as $beacon) {
        if ($beacon['installation_token'] === $installationToken) {
            $existingBeacon = $beacon;
            break;
        }
    }

    if ($existingBeacon) {
        // Beacon already active - return remaining time
        $expiresAtTime = strtotime($existingBeacon['expires_at']);
        $secondsRemaining = max(0, $expiresAtTime - $now);

        $response = [
            'success' => true,
            'message' => 'Baliza ya está activa',
            'already_active' => true,
            'expires_at' => $existingBeacon['expires_at'],
            'seconds_remaining' => $secondsRemaining
        ];
    } else {
        // Create new beacon
        $newBeacon = [
            'installation_token' => $installationToken,
            'activated_at' => $activatedAt,
            'expires_at' => $expiresAt
        ];

        $beaconsData['beacons'][] = $newBeacon;

        // Save beacons
        file_put_contents($BEACONS_FILE, json_encode($beaconsData, JSON_PRETTY_PRINT));

        $response = [
            'success' => true,
            'message' => 'Baliza activada correctamente',
            'already_active' => false,
            'expires_at' => $expiresAt,
            'seconds_remaining' => $BEACON_DURATION_MINUTES * 60
        ];
    }

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
