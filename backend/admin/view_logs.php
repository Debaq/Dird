<?php
// Start output buffering IMMEDIATELY
ob_start();

// Suppress warnings that could break JSON output
error_reporting(E_ERROR | E_PARSE);
ini_set('display_errors', '0');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$LOG_DIR = __DIR__ . '/../logs/';

try {
    // Get parameters
    $logType = $_GET['type'] ?? 'debug'; // 'debug' or 'errors'
    $lines = (int)($_GET['lines'] ?? 100); // Number of lines to return
    $lines = max(1, min($lines, 1000)); // Limit between 1 and 1000

    // Determine log file
    $logFile = $logType === 'errors' ? 'api_errors.log' : 'api_debug.log';
    $logPath = $LOG_DIR . $logFile;

    if (!file_exists($logPath)) {
        ob_clean();
        echo json_encode([
            'success' => true,
            'content' => '',
            'message' => 'No log file found yet',
            'file' => $logFile,
            'lines_requested' => $lines
        ]);
        ob_end_flush();
        exit();
    }

    // Read last N lines
    $file = new SplFileObject($logPath, 'r');
    $file->seek(PHP_INT_MAX);
    $totalLines = $file->key() + 1;

    $startLine = max(0, $totalLines - $lines);

    $content = [];
    $file->seek($startLine);
    while (!$file->eof()) {
        $line = $file->current();
        if ($line !== false && trim($line) !== '') {
            $content[] = rtrim($line);
        }
        $file->next();
    }

    ob_clean();
    echo json_encode([
        'success' => true,
        'content' => implode("\n", $content),
        'file' => $logFile,
        'total_lines' => $totalLines,
        'lines_returned' => count($content),
        'lines_requested' => $lines
    ]);
    ob_end_flush();

} catch (Exception $e) {
    http_response_code(500);
    ob_clean();
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    ob_end_flush();
}
