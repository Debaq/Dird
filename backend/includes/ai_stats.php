<?php

// Function to save AI usage statistics
function saveAIUsage($model, $usageData, $context = 'unknown') {
    $STATS_FILE = __DIR__ . '/../data/ai_usage_stats.json';
    
    // Default structure for a new record
    $record = [
        'id' => uniqid('usage_', true),
        'timestamp' => time(),
        'date' => date('Y-m-d H:i:s'),
        'model' => $model,
        'context' => $context,
        'tokens' => [
            'prompt_tokens' => $usageData['prompt_tokens'] ?? 0,
            'completion_tokens' => $usageData['completion_tokens'] ?? 0,
            'total_tokens' => $usageData['total_tokens'] ?? 0
        ]
    ];

    // Read existing stats
    $stats = [];
    if (file_exists($STATS_FILE)) {
        $content = file_get_contents($STATS_FILE);
        $stats = json_decode($content, true);
        if (!is_array($stats)) {
            $stats = [];
        }
    }

    // Append new record
    $stats[] = $record;

    // Optional: Keep only last 1000 records to prevent file from growing too large?
    // For now, we will keep all as requested for analysis.
    
    // Save back to file
    file_put_contents($STATS_FILE, json_encode($stats, JSON_PRETTY_PRINT));
    
    // Also log to debug log
    if (function_exists('logDebug')) {
        logDebug("AI Usage Saved", $record);
    }
}

// Function to get aggregated stats (for future use/admin dashboard)
function getAIStats() {
    $STATS_FILE = __DIR__ . '/../data/ai_usage_stats.json';
    if (!file_exists($STATS_FILE)) {
        return [];
    }
    $content = file_get_contents($STATS_FILE);
    return json_decode($content, true) ?? [];
}
