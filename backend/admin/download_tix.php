<?php
/**
 * Download Contributions as .tix Package
 * Generates Annotix-compatible .tix file from contributions
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/validate_session.php';

$METADATA_FILE = __DIR__ . '/../data/contributions_metadata.json';
$UPLOADS_DIR = __DIR__ . '/../uploads/';

try {
    validateAdminSession();

    // Get optional filters
    $installationToken = $_GET['installation_token'] ?? null;
    $sessionId = $_GET['session_id'] ?? null;
    $contributionIds = isset($_GET['ids']) ? explode(',', $_GET['ids']) : null;

    // Load metadata
    if (!file_exists($METADATA_FILE)) {
        throw new Exception('No contributions found');
    }

    $metadata = json_decode(file_get_contents($METADATA_FILE), true);
    $allContributions = $metadata['contributions'] ?? [];

    // Filter contributions
    $filteredContributions = array_filter($allContributions, function($contrib) use ($installationToken, $sessionId, $contributionIds) {
        // Filter by type (only images for now)
        if (($contrib['type'] ?? 'image') !== 'image') {
            return false;
        }

        // Filter by installation token if specified
        if ($installationToken && ($contrib['installation_token'] ?? '') !== $installationToken) {
            return false;
        }

        // Filter by session ID if specified
        if ($sessionId && ($contrib['session_id'] ?? '') !== $sessionId) {
            return false;
        }

        // Filter by IDs if specified
        if ($contributionIds && !in_array($contrib['id'], $contributionIds)) {
            return false;
        }

        return true;
    });

    if (empty($filteredContributions)) {
        throw new Exception('No matching contributions found');
    }

    // Build .tix structure and create ZIP
    $zipFilename = 'dird_contributions_' . date('Y-m-d_H-i-s') . '.tix';
    $zipPath = sys_get_temp_dir() . '/' . $zipFilename;

    $tixData = buildTixPackage($filteredContributions, $UPLOADS_DIR, $installationToken, $zipPath);

    if (!$tixData || !file_exists($zipPath)) {
        throw new Exception('Failed to create .tix package');
    }

    // Set headers for download
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $zipFilename . '"');
    header('Content-Length: ' . filesize($zipPath));

    readfile($zipPath);

    // Clean up temporary file
    @unlink($zipPath);

} catch (Exception $e) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Build Annotix-compatible .tix package (ZIP with images + annotations.json)
 */
function buildTixPackage($contributions, $uploadsDir, $installationToken, $zipPath) {
    // Define DR classes based on lesion types
    $classes = [
        ['id' => 0, 'name' => 'microaneurysm', 'color' => '#FF0000'],
        ['id' => 1, 'name' => 'hemorrhage', 'color' => '#FF6B00'],
        ['id' => 2, 'name' => 'hard_exudate', 'color' => '#FFD700'],
        ['id' => 3, 'name' => 'soft_exudate', 'color' => '#FFFF00'],
        ['id' => 4, 'name' => 'neovascularization', 'color' => '#00FF00'],
        ['id' => 5, 'name' => 'optic_disc', 'color' => '#00FFFF'],
        ['id' => 6, 'name' => 'other', 'color' => '#808080']
    ];

    // Severity classes for classification
    $severityClasses = [
        ['id' => 0, 'name' => 'no_dr', 'color' => '#00FF00'],
        ['id' => 1, 'name' => 'mild', 'color' => '#FFFF00'],
        ['id' => 2, 'name' => 'moderate', 'color' => '#FF9900'],
        ['id' => 3, 'name' => 'severe', 'color' => '#FF0000'],
        ['id' => 4, 'name' => 'proliferative', 'color' => '#8B0000']
    ];

    $tixProject = [
        'version' => '1.0',
        'project' => [
            'name' => 'Dird Contribution - ' . ($installationToken ? substr($installationToken, 0, 8) : 'All'),
            'type' => 'bbox', // Primary type - bbox for detections
            'classes' => $classes,
            'preprocessingConfig' => ['enabled' => false],
            'createdAt' => time() * 1000,
            'updatedAt' => time() * 1000,
            'metadata' => [
                'source' => 'Dird',
                'exportedAt' => date('Y-m-d H:i:s'),
                'installationToken' => $installationToken ?? 'all',
                'severityClasses' => $severityClasses
            ]
        ],
        'images' => []
    ];

    // Create ZIP archive
    $zip = new ZipArchive();
    if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        return false;
    }

    $imageIndex = 1;
    foreach ($contributions as $contrib) {
        $folderPath = $contrib['folder_path'] ?? $contrib['id'];
        $jsonPath = $uploadsDir . $folderPath . '/annotations.json';
        $imagePath = $uploadsDir . $folderPath . '/' . $contrib['filename'];

        if (!file_exists($jsonPath) || !file_exists($imagePath)) {
            continue; // Skip if missing files
        }

        $annotationData = json_decode(file_get_contents($jsonPath), true);
        if (!$annotationData) {
            continue;
        }

        // Convert Dird annotations to Annotix format
        $imageEntry = convertToAnnotixFormat($annotationData, $imageIndex, $contrib);

        if ($imageEntry) {
            $tixProject['images'][] = $imageEntry;

            // Add image to ZIP in images/ folder
            $imageExt = pathinfo($contrib['filename'], PATHINFO_EXTENSION);
            $zipImageName = sprintf('images/img_%04d.%s', $imageIndex, $imageExt);
            $zip->addFile($imagePath, $zipImageName);

            $imageIndex++;
        }
    }

    // Add annotations.json to ZIP
    $annotationsJson = json_encode($tixProject, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    $zip->addFromString('annotations.json', $annotationsJson);

    // Close ZIP
    $zip->close();

    return true;
}

/**
 * Convert Dird annotation format to Annotix format
 */
function convertToAnnotixFormat($annotationData, $index, $contrib) {
    $image = $annotationData['image'] ?? [];
    $detections = $annotationData['detections'] ?? [];
    $segmentations = $annotationData['segmentations'] ?? [];
    $classification = $annotationData['classification'] ?? null;

    $annotations = [];

    // Convert detections (bounding boxes)
    foreach ($detections as $detection) {
        $classId = mapDetectionClass($detection['class']);

        $annotations[] = [
            'type' => 'bbox',
            'class' => $classId,
            'data' => [
                'x' => $detection['bbox']['x'],
                'y' => $detection['bbox']['y'],
                'width' => $detection['bbox']['width'],
                'height' => $detection['bbox']['height']
            ],
            'metadata' => [
                'source' => $detection['type'] ?? 'manual',
                'confidence' => $detection['confidence'] ?? null,
                'customLabel' => $detection['customLabel'] ?? null
            ]
        ];
    }

    // Convert segmentations (masks)
    foreach ($segmentations as $segmentation) {
        $classId = mapSegmentationClass($segmentation['class']);

        $annotations[] = [
            'type' => 'mask',
            'class' => $classId,
            'data' => $segmentation['maskData'], // Base64 PNG
            'metadata' => [
                'source' => $segmentation['type'] ?? 'manual',
                'confidence' => $segmentation['confidence'] ?? null
            ]
        ];
    }

    // Build image entry with correct extension
    $imageExt = pathinfo($contrib['filename'], PATHINFO_EXTENSION);
    $filename = sprintf('img_%04d.%s', $index, $imageExt);

    // Determine MIME type
    $mimeTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp'
    ];
    $mimeType = $mimeTypes[strtolower($imageExt)] ?? 'image/jpeg';

    $imageEntry = [
        'name' => $filename,
        'originalFileName' => $image['filename'] ?? $contrib['original_filename'] ?? 'unknown.jpg',
        'displayName' => $image['filename'] ?? $contrib['original_filename'] ?? 'unknown.jpg',
        'mimeType' => $mimeType,
        'annotations' => $annotations,
        'width' => $image['width'] ?? 1920,
        'height' => $image['height'] ?? 1080,
        'timestamp' => isset($image['uploadedAt']) ? strtotime($image['uploadedAt']) * 1000 : time() * 1000,
        'metadata' => [
            'eyeType' => $image['eyeType'] ?? 'unknown',
            'contributionId' => $contrib['id'],
            'uploadedAt' => $contrib['uploaded_at'] ?? null
        ]
    ];

    // Add classification if available
    if ($classification) {
        $severityClassId = mapSeverityClass($classification['severity']);
        $imageEntry['classification'] = [
            'classId' => $severityClassId,
            'metadata' => [
                'severity' => $classification['severity'],
                'confidence' => $classification['confidence'] ?? 'low',
                'guideline' => $classification['guideline'] ?? null,
                'guidelineName' => $classification['guidelineName'] ?? null,
                'lesions' => $classification['lesions'] ?? null,
                'manuallyModified' => $classification['manuallyModified'] ?? false
            ]
        ];
    }

    return $imageEntry;
}

/**
 * Map Dird detection class names to Annotix class IDs
 */
function mapDetectionClass($className) {
    $mapping = [
        'microaneurysm' => 0,
        'hemorrhage' => 1,
        'hard_exudate' => 2,
        'soft_exudate' => 3,
        'neovascularization' => 4,
        'optic_disc' => 5
    ];

    return $mapping[strtolower($className)] ?? 6; // 6 = other
}

/**
 * Map Dird segmentation class names to Annotix class IDs
 */
function mapSegmentationClass($className) {
    // For now, segmentations are mainly optic disc
    if (stripos($className, 'optic') !== false || stripos($className, 'disc') !== false) {
        return 5; // optic_disc
    }
    return 6; // other
}

/**
 * Map DR severity to class ID
 */
function mapSeverityClass($severity) {
    $mapping = [
        'no_dr' => 0,
        'sin_rd' => 0,
        'mild' => 1,
        'leve' => 1,
        'moderate' => 2,
        'moderada' => 2,
        'severe' => 3,
        'severa' => 3,
        'proliferative' => 4,
        'proliferativa' => 4
    ];

    $normalized = strtolower(str_replace([' ', '-'], '_', $severity));
    return $mapping[$normalized] ?? 0;
}
?>
