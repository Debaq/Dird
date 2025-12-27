<?php
/**
 * PHP Compatibility Checker for DIRD Backend
 * Verifies that all PHP files are compatible with PHP 7.0+
 */

echo "=== PHP Compatibility Checker ===\n\n";

$phpVersion = phpversion();
echo "Current PHP Version: $phpVersion\n";

// Minimum required version
$minVersion = '7.0.0';
if (version_compare($phpVersion, $minVersion, '<')) {
    echo "ERROR: PHP version $minVersion or higher is required!\n";
    exit(1);
}

echo "✓ PHP version is compatible\n\n";

// Check for required extensions
$requiredExtensions = ['json', 'curl', 'fileinfo'];
echo "Checking required extensions:\n";
foreach ($requiredExtensions as $ext) {
    if (extension_loaded($ext)) {
        echo "  ✓ $ext\n";
    } else {
        echo "  ✗ $ext (MISSING!)\n";
    }
}

echo "\n";

// Check all PHP files for syntax errors
echo "Checking PHP files for syntax errors:\n";
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(__DIR__),
    RecursiveIteratorIterator::SELF_FIRST
);

$errorCount = 0;
$fileCount = 0;

foreach ($files as $file) {
    if ($file->isFile() && $file->getExtension() === 'php') {
        $filePath = $file->getPathname();

        // Skip vendor directory
        if (strpos($filePath, 'vendor') !== false) {
            continue;
        }

        $fileCount++;
        $output = [];
        $returnVar = 0;
        exec("php -l " . escapeshellarg($filePath) . " 2>&1", $output, $returnVar);

        if ($returnVar !== 0) {
            echo "  ✗ " . str_replace(__DIR__ . '/', '', $filePath) . "\n";
            foreach ($output as $line) {
                echo "    " . $line . "\n";
            }
            $errorCount++;
        }
    }
}

if ($errorCount === 0) {
    echo "  ✓ All $fileCount PHP files are syntax-valid\n";
} else {
    echo "  ✗ Found errors in $errorCount file(s)\n";
}

echo "\n";

// Summary
if ($errorCount === 0) {
    echo "=== RESULT: COMPATIBLE ✓ ===\n";
    echo "All PHP files are compatible with PHP 7.0+\n";
} else {
    echo "=== RESULT: ERRORS FOUND ✗ ===\n";
    echo "Please fix the syntax errors listed above.\n";
    exit(1);
}
