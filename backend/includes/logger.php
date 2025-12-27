<?php
/**
 * Simple Logger for debugging API endpoints
 */

function logDebug($message, $data = null, $logFile = 'api_debug.log') {
    $logDir = __DIR__ . '/../logs/';
    if (!file_exists($logDir)) {
        mkdir($logDir, 0777, true);
    }

    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] $message";

    if ($data !== null) {
        $logEntry .= "\nData: " . print_r($data, true);
    }

    $logEntry .= "\n" . str_repeat('-', 80) . "\n";

    file_put_contents($logDir . $logFile, $logEntry, FILE_APPEND);
}

function logError($message, $error = null, $logFile = 'api_errors.log') {
    logDebug("ERROR: $message", $error, $logFile);
}
