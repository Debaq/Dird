<?php
// backend/admin/get_ai_stats.php
require_once __DIR__ . '/../includes/logger.php';
require_once __DIR__ . '/../includes/ai_stats.php';

// Auth headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Simple session check (adapt as needed for your auth system)
// For now assuming the frontend handles protection via tokens/session checks before calling

try {
    $stats = getAIStats();
    
    // Sort by date desc
    usort($stats, function($a, $b) {
        return $b['timestamp'] - $a['timestamp'];
    });

    // Calculate totals
    $total_prompt = 0;
    $total_completion = 0;
    $total_requests = count($stats);

    foreach ($stats as $row) {
        $total_prompt += ($row['tokens']['prompt_tokens'] ?? 0);
        $total_completion += ($row['tokens']['completion_tokens'] ?? 0);
    }

    echo json_encode([
        'success' => true,
        'summary' => [
            'total_requests' => $total_requests,
            'total_prompt_tokens' => $total_prompt,
            'total_completion_tokens' => $total_completion,
            'total_tokens' => $total_prompt + $total_completion
        ],
        'history' => array_slice($stats, 0, 100) // Return last 100 for now to keep payload light
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
