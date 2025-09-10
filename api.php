<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database configuration
$host = 'localhost';
$dbname = 'resume_builder';
$username = 'root';
$password = '';

// Error handling function
function sendError($message, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $message]);
    exit();
}

// Success response function
function sendSuccess($data = null, $message = 'Success') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'data' => $data
    ]);
    exit();
}

// Get request method and endpoint
$method = $_SERVER['REQUEST_METHOD'];
$endpoint = $_GET['endpoint'] ?? '';

try {
    // Database connection
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // If database doesn't exist, use file-based storage
    $useFileStorage = true;
}

// File storage functions
function saveToFile($filename, $data) {
    $dir = 'data';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    file_put_contents("$dir/$filename", json_encode($data, JSON_PRETTY_PRINT));
}

function loadFromFile($filename) {
    $filepath = "data/$filename";
    if (file_exists($filepath)) {
        $content = file_get_contents($filepath);
        return json_decode($content, true);
    }
    return [];
}

function generateId() {
    return uniqid('', true);
}

// Get user ID from authorization header
function getUserIdFromAuth() {
    $authHeader = '';
    // Try common sources for the Authorization header
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!$authHeader && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!$authHeader) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    }
    
    error_log("getUserIdFromAuth: authHeader = " . ($authHeader ?: 'null'));
    
    if (strpos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
        $userId = verifyToken($token);
        error_log("getUserIdFromAuth: token = " . $token . ", userId = " . ($userId ?: 'null'));
        return $userId;
    }
    
    return null;
}

// Verify token (imported from auth.php)
function verifyToken($token) {
    try {
        $decoded = json_decode(base64_decode($token), true);
        if ($decoded && $decoded['expires'] > time()) {
            return $decoded['user_id'];
        }
    } catch (Exception $e) {
        return false;
    }
    return false;
}

// Route handling
switch ($endpoint) {
    case 'resumes':
        handleResumes();
        break;
    case 'download':
        if ($method === 'POST') {
            handleDownloadPost();
        } else {
            handleDownload();
        }
        break;
    case 'templates':
        handleTemplates();
        break;
    default:
        sendError('Endpoint not found', 404);
}

function handleResumes() {
    global $method, $pdo, $useFileStorage;
    
    switch ($method) {
        case 'GET':
            getResumes();
            break;
        case 'POST':
            createResume();
            break;
        case 'PUT':
            updateResume();
            break;
        case 'DELETE':
            deleteResume();
            break;
        default:
            sendError('Method not allowed', 405);
    }
}

function getResumes() {
    global $pdo, $useFileStorage;
    
    // Get user ID from authentication
    $userId = getUserIdFromAuth();
    error_log("getResumes: userId = " . ($userId ?: 'null'));
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    // Check if specific resume ID is requested
    $resumeId = $_GET['id'] ?? null;
    error_log("getResumes: resumeId = " . ($resumeId ?: 'null'));
    
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        // Filter resumes by user
        $userResumes = array_filter($resumes, function($resume) use ($userId) {
            return isset($resume['user_id']) && $resume['user_id'] === $userId;
        });
        
        // If specific ID requested, filter by that ID
        if ($resumeId) {
            $userResumes = array_filter($userResumes, function($resume) use ($resumeId) {
                return isset($resume['id']) && $resume['id'] === $resumeId;
            });
        }
        
        sendSuccess(array_values($userResumes));
    } else {
        try {
            if ($resumeId) {
                // Get specific resume
                $stmt = $pdo->prepare("SELECT * FROM resumes WHERE id = ? AND user_id = ?");
                $stmt->execute([$resumeId, $userId]);
                $resumes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                // Get all resumes for user
                $stmt = $pdo->prepare("SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC");
                $stmt->execute([$userId]);
                $resumes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }
            
            // Decode JSON fields
            foreach ($resumes as &$resume) {
                $resume['personal_info'] = json_decode($resume['personal_info'], true);
                $resume['education'] = json_decode($resume['education'], true);
                $resume['experience'] = json_decode($resume['experience'], true);
                $resume['skills'] = json_decode($resume['skills'], true);
                $resume['projects'] = json_decode($resume['projects'] ?? '[]', true);
                $resume['achievements'] = json_decode($resume['achievements'] ?? '[]', true);
            }
            
            sendSuccess($resumes);
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

function createResume() {
    global $pdo, $useFileStorage;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (!isset($input['title']) || !isset($input['personalInfo'])) {
        sendError('Title and personal info are required');
    }
    
    // Get user ID from authentication
    $userId = getUserIdFromAuth();
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    $resume = [
        'id' => generateId(),
        'user_id' => $userId,
        'title' => $input['title'],
        'personal_info' => $input['personalInfo'],
        'education' => $input['education'] ?? [],
        'experience' => $input['experience'] ?? [],
        'skills' => $input['skills'] ?? [],
        'projects' => $input['projects'] ?? [],
        'achievements' => $input['achievements'] ?? [],
        'template' => $input['template'] ?? 'modern',
        'created_at' => date('Y-m-d H:i:s'),
        'updated_at' => date('Y-m-d H:i:s')
    ];
    
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        $resumes[] = $resume;
        saveToFile('resumes.json', $resumes);
        sendSuccess($resume, 'Resume created successfully');
    } else {
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO resumes (id, user_id, title, personal_info, education, experience, skills, projects, achievements, template, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            
            $stmt->execute([
                $resume['id'],
                $resume['user_id'],
                $resume['title'],
                json_encode($resume['personal_info']),
                json_encode($resume['education']),
                json_encode($resume['experience']),
                json_encode($resume['skills']),
                json_encode($resume['projects']),
                json_encode($resume['achievements']),
                $resume['template'],
                $resume['created_at'],
                $resume['updated_at']
            ]);
            
            sendSuccess($resume, 'Resume created successfully');
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

function updateResume() {
    global $pdo, $useFileStorage;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        sendError('Resume ID is required');
    }
    
    // Get user ID from authentication
    $userId = getUserIdFromAuth();
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    $resume = [
        'id' => $input['id'],
        'user_id' => $userId,
        'title' => $input['title'],
        'personal_info' => $input['personalInfo'],
        'education' => $input['education'] ?? [],
        'experience' => $input['experience'] ?? [],
        'skills' => $input['skills'] ?? [],
        'projects' => $input['projects'] ?? [],
        'achievements' => $input['achievements'] ?? [],
        'template' => $input['template'] ?? 'modern',
        'updated_at' => date('Y-m-d H:i:s')
    ];
    
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        $found = false;
        
        foreach ($resumes as &$existingResume) {
            if ($existingResume['id'] === $input['id'] && $existingResume['user_id'] === $userId) {
                $resume['created_at'] = $existingResume['created_at'];
                $existingResume = $resume;
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            sendError('Resume not found', 404);
        }
        
        saveToFile('resumes.json', $resumes);
        sendSuccess($resume, 'Resume updated successfully');
    } else {
        try {
            $stmt = $pdo->prepare(
                "UPDATE resumes 
                 SET title = ?, personal_info = ?, education = ?, experience = ?, skills = ?, projects = ?, achievements = ?, template = ?, updated_at = ?
                 WHERE id = ? AND user_id = ?"
            );
            
            $result = $stmt->execute([
                $resume['title'],
                json_encode($resume['personal_info']),
                json_encode($resume['education']),
                json_encode($resume['experience']),
                json_encode($resume['skills']),
                json_encode($resume['projects']),
                json_encode($resume['achievements']),
                $resume['template'],
                $resume['updated_at'],
                $resume['id'],
                $userId
            ]);
            
            if ($stmt->rowCount() === 0) {
                sendError('Resume not found', 404);
            }
            
            sendSuccess($resume, 'Resume updated successfully');
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

function deleteResume() {
    global $pdo, $useFileStorage;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['id'])) {
        sendError('Resume ID is required');
    }
    
    // Get user ID from authentication
    $userId = getUserIdFromAuth();
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        $originalCount = count($resumes);
        
        $resumes = array_filter($resumes, function($resume) use ($input, $userId) {
            return !($resume['id'] === $input['id'] && $resume['user_id'] === $userId);
        });
        
        if (count($resumes) === $originalCount) {
            sendError('Resume not found', 404);
        }
        
        saveToFile('resumes.json', array_values($resumes));
        sendSuccess(null, 'Resume deleted successfully');
    } else {
        try {
            $stmt = $pdo->prepare("DELETE FROM resumes WHERE id = ? AND user_id = ?");
            $result = $stmt->execute([$input['id'], $userId]);
            
            if ($stmt->rowCount() === 0) {
                sendError('Resume not found', 404);
            }
            
            sendSuccess(null, 'Resume deleted successfully');
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

// Simple PDF generator and download handler (server-side PDF, no JS generation)
function handleDownload() {
    global $pdo, $useFileStorage;
    
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        sendError('Method not allowed', 405);
    }
    
    $id = $_GET['id'] ?? '';
    if (!$id) {
        sendError('Resume ID is required');
    }
    
    $userId = getUserIdFromAuth();
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    // Load the resume
    $resume = null;
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        foreach ($resumes as $r) {
            if (($r['id'] ?? null) === $id && ($r['user_id'] ?? null) === $userId) {
                $resume = $r;
                break;
            }
        }
    } else {
        try {
            $stmt = $pdo->prepare('SELECT * FROM resumes WHERE id = ? AND user_id = ? LIMIT 1');
            $stmt->execute([$id, $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $resume = $row;
                $resume['personal_info'] = json_decode($resume['personal_info'], true);
                $resume['education'] = json_decode($resume['education'], true);
                $resume['experience'] = json_decode($resume['experience'], true);
                $resume['skills'] = json_decode($resume['skills'], true);
                $resume['projects'] = json_decode($resume['projects'] ?? '[]', true);
                $resume['achievements'] = json_decode($resume['achievements'] ?? '[]', true);
            }
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
    
    if (!$resume) {
        sendError('Resume not found', 404);
    }
    
    // Normalize data shape between file and DB modes
    $title = $resume['title'] ?? 'Resume';
    $pi = $resume['personal_info'] ?? $resume['personalInfo'] ?? [];
    $education = $resume['education'] ?? [];
    $experience = $resume['experience'] ?? [];
    $skills = $resume['skills'] ?? [];
    $projects = $resume['projects'] ?? [];
    $achievements = $resume['achievements'] ?? [];
    
    // Get template for formatting
    $template = $resume['template'] ?? 'modern';
    
    // Build lines for a simple text-based PDF layout
    $lines = [];
    $lines[] = strtoupper($title);
    $lines[] = '';
    $fullName = $pi['fullName'] ?? '';
    $email = $pi['email'] ?? '';
    $phone = $pi['phone'] ?? '';
    $address = $pi['address'] ?? '';
    $summary = $pi['summary'] ?? '';
    if ($fullName) { $lines[] = $fullName; }
    
    // Apply template-specific contact formatting
    $contactParts = array_filter([$email, $phone]);
    if (!empty($contactParts)) { 
        if ($template === 'modern') {
            $lines[] = implode(' • ', $contactParts);
        } else {
            $lines[] = implode(' | ', $contactParts);
        }
    }
    if ($address) { $lines[] = $address; }
    
    // Apply template-specific summary formatting
    if ($summary) { 
        $lines[] = ''; 
        if ($template === 'modern') {
            $lines[] = 'PROFESSIONAL SUMMARY';
        } else {
            $lines[] = 'OBJECTIVE';
        }
        $lines[] = $summary; 
    }
    
    if (!empty($experience)) {
        $lines[] = '';
        if ($template === 'modern') {
            $lines[] = 'WORK EXPERIENCE';
        } else {
            $lines[] = 'EXPERIENCE';
        }
        foreach ($experience as $exp) {
            $position = $exp['position'] ?? '';
            $company = $exp['company'] ?? '';
            $start = $exp['startDate'] ?? '';
            $end = $exp['endDate'] ?? '';
            $desc = $exp['description'] ?? '';
            
            if ($template === 'modern') {
                // Modern: Separate position and company
                if ($position) { $lines[] = $position; }
                if ($company) { $lines[] = $company; }
            } else {
                // Classic: Combined position and company
                $header = trim($position ? $position : 'Position');
                if ($company) { $header .= ', ' . $company; }
                $lines[] = $header;
            }
            
            $dates = trim(($start ?: '') . ($end ? ' - ' . $end : ''));
            if ($dates) { $lines[] = $dates; }
            if ($desc) { $lines[] = $desc; }
            $lines[] = '';
        }
    }
    
    if (!empty($education)) {
        $lines[] = '';
        $lines[] = 'EDUCATION';
        foreach ($education as $edu) {
            $degree = $edu['degree'] ?? '';
            $field = $edu['field'] ?? '';
            $inst = $edu['institution'] ?? '';
            $start = $edu['startDate'] ?? '';
            $end = $edu['endDate'] ?? '';
            $gpa = $edu['gpa'] ?? '';
            $header = trim($degree . ($field ? ' in ' . $field : ''));
            if ($inst) { $header .= ' — ' . $inst; }
            $dates = trim(($start ?: '') . ($end ? ' - ' . $end : ''));
            $lines[] = $header ?: 'Education';
            if ($dates) { $lines[] = $dates; }
            if ($gpa) { $lines[] = 'GPA: ' . $gpa; }
            $lines[] = '';
        }
    }
    
    if (!empty($skills)) {
        $skillsFiltered = array_values(array_filter(array_map('trim', $skills)));
        if (!empty($skillsFiltered)) {
            $lines[] = '';
            $lines[] = 'SKILLS';
            if ($template === 'modern') {
                $lines[] = implode(' • ', $skillsFiltered);
            } else {
                $lines[] = implode(' | ', $skillsFiltered);
            }
        }
    }
    
    if (!empty($projects)) {
        $lines[] = '';
        $lines[] = 'PROJECTS';
        foreach ($projects as $project) {
            $header = ($project['name'] ?? 'Project');
            $dates = trim(($project['startDate'] ?? '') . ((isset($project['endDate']) && $project['endDate']) ? ' - ' . $project['endDate'] : ''));
            $lines[] = $header;
            if ($dates) { $lines[] = $dates; }
            if (!empty($project['technologies'])) { $lines[] = 'Tech: ' . $project['technologies']; }
            if (!empty($project['description'])) { $lines[] = $project['description']; }
            $lines[] = '';
        }
    }
    if (!empty($achievements)) {
        $lines[] = '';
        $lines[] = 'ACHIEVEMENTS';
        foreach ($achievements as $ach) {
            $header = ($ach['title'] ?? 'Achievement') . (!empty($ach['issuer']) ? ' — ' . $ach['issuer'] : '');
            $lines[] = $header;
            if (!empty($ach['date'])) { $lines[] = $ach['date']; }
            if (!empty($ach['description'])) { $lines[] = $ach['description']; }
            $lines[] = '';
        }
    }
    
    $pdf = buildSimplePdf($lines, $resume);
    
    $safeTitle = preg_replace('/[^A-Za-z0-9-_]+/', '_', $title);
    $filename = ($safeTitle ?: 'resume') . '.pdf';
    
    // Send the PDF
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdf));
    echo $pdf;
    exit();
}

function handleDownloadPost() {
    global $pdo, $useFileStorage;

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['resume'])) {
        sendError('Resume payload is required', 400);
    }

    $resume = $input['resume'];

    // Normalize keys between FE and BE
    $title = $resume['title'] ?? 'Resume';
    $template = $resume['template'] ?? 'modern';

    // Build HTML using the same structure as JS generatePDFHTML, but respecting selected template sections
    $html = buildTemplateHtml($resume, $template);

    try {
        // Generate PDF using Dompdf (support both new and legacy versions)
        if (!class_exists('Dompdf\\Dompdf') && !class_exists('DOMPDF')) {
            // Try to include vendor if available
            if (file_exists(__DIR__ . '/vendor/autoload.php')) {
                require_once __DIR__ . '/vendor/autoload.php';
            }
        }

        if (!class_exists('Dompdf\\Dompdf') && !class_exists('DOMPDF')) {
            sendError('PDF engine (Dompdf) not installed on server.', 500);
        }

        // Suppress warnings for legacy Dompdf
        $oldErrorReporting = error_reporting(E_ERROR | E_PARSE);
        
        // Instantiate depending on available class
        if (class_exists('Dompdf\\Dompdf')) {
            $dompdf = new Dompdf\Dompdf();
            $dompdf->loadHtml($html, 'UTF-8');
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();
        } else {
            // Legacy 0.6.x API
            $dompdf = new DOMPDF();
            if (method_exists($dompdf, 'load_html')) {
                $dompdf->load_html($html);
            } else {
                $dompdf->loadHtml($html);
            }
            if (method_exists($dompdf, 'set_paper')) {
                $dompdf->set_paper('a4', 'portrait');
            } else {
                $dompdf->setPaper('A4', 'portrait');
            }
            $dompdf->render();
        }

        // Restore error reporting
        error_reporting($oldErrorReporting);

        $pdfOutput = $dompdf->output();

        if (empty($pdfOutput)) {
            sendError('PDF generation failed - empty output', 500);
        }

        $safeTitle = preg_replace('/[^A-Za-z0-9-_]+/', '_', $title);
        $filename = ($safeTitle ?: 'resume') . '.pdf';

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . strlen($pdfOutput));
        echo $pdfOutput;
        exit();
        
    } catch (Exception $e) {
        // Restore error reporting in case of exception
        if (isset($oldErrorReporting)) {
            error_reporting($oldErrorReporting);
        }
        sendError('PDF generation failed: ' . $e->getMessage(), 500);
    }
}

function buildTemplateHtml($data, $template) {
    $pi = $data['personalInfo'] ?? $data['personal_info'] ?? [];
    $experience = $data['experience'] ?? [];
    $education = $data['education'] ?? [];
    $skills = $data['skills'] ?? [];
    $projects = $data['projects'] ?? [];
    $achievements = $data['achievements'] ?? [];

    $formatDate = function($ym) {
        if (!$ym) return '';
        return date('M Y', strtotime($ym . '-01'));
    };

    $css = '
        @page { margin: 0.5in; }
        body { font-family: Arial, sans-serif; color: #333; }
        .resume { max-width: 800px; margin: 0 auto; }
        .header { padding-bottom: 15px; margin-bottom: 20px; border-bottom: 3px solid ' . ($template === 'modern' ? '#2563eb' : '#1f2937') . '; ' . ($template === 'classic' ? 'text-align:center;' : '') . ' }
        .name { font-size: 28px; font-weight: bold; color: #1f2937; }
        .contact { color: #6b7280; font-size: 12px; line-height: 1.4; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 8px; ' . ($template === 'modern' ? 'border-bottom:1px solid #d1d5db;padding-bottom:4px;' : 'text-transform:uppercase;letter-spacing:1px;') . ' }
        .entry { margin-bottom: 12px; }
        .entry-header { display:flex; justify-content: space-between; align-items: flex-start; }
        .entry-title { font-size: 14px; font-weight: 600; color: #1f2937; }
        .entry-date { color:#6b7280; font-size: 12px; white-space: nowrap; }
        .entry-sub { color: ' . ($template === 'modern' ? '#2563eb' : '#6b7280') . '; font-size: 13px; margin: 2px 0 6px; }
        .entry-desc { font-size: 13px; line-height: 1.6; white-space: pre-line; }
        .skills { display:flex; flex-wrap: wrap; gap:6px; }
        .tag { background:#dbeafe; color:#1e40af; padding:3px 10px; border-radius: 20px; font-size:12px; }
    ';

    $contactLine = [];
    if (!empty($pi['email'])) $contactLine[] = $pi['email'];
    if (!empty($pi['phone'])) $contactLine[] = $pi['phone'];
    if (!empty($pi['address'])) $contactLine[] = $pi['address'];
    if (!empty($pi['linkedIn'])) $contactLine[] = $pi['linkedIn'];
    if (!empty($pi['website'])) $contactLine[] = $pi['website'];

    $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' . $css . '</style></head><body><div class="resume">';
    $html .= '<div class="header">';
    $html .= '<div class="name">' . htmlspecialchars($pi['fullName'] ?? 'Your Name') . '</div>';
    if (!empty($contactLine)) {
        $html .= '<div class="contact">' . htmlspecialchars(implode($template === 'modern' ? ' • ' : ' | ', $contactLine)) . '</div>'; 
    }
    $html .= '</div>';

    if (!empty($pi['summary'])) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">' . ($template === 'modern' ? 'Professional Summary' : 'Objective') . '</div>';
        $html .= '<div class="entry-desc">' . nl2br(htmlspecialchars($pi['summary'])) . '</div>';
        $html .= '</div>';
    }

    if (!empty($experience)) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">' . ($template === 'modern' ? 'Work Experience' : 'Experience') . '</div>';
        foreach ($experience as $exp) {
            $html .= '<div class="entry">';
            $html .= '<div class="entry-header">';
            $html .= '<div class="entry-title">' . htmlspecialchars(($template === 'classic' ? (($exp['position'] ?? 'Position') . (isset($exp['company']) && $exp['company'] ? ', ' . $exp['company'] : '')) : ($exp['position'] ?? 'Position'))) . '</div>';
            $html .= '<div class="entry-date">' . htmlspecialchars(($formatDate($exp['startDate'] ?? '') ?: '') . ' - ' . ((isset($exp['current']) && $exp['current']) ? 'Present' : ($formatDate($exp['endDate'] ?? '') ?: ''))) . '</div>';
            $html .= '</div>';
            if ($template === 'modern') {
                $sub = [];
                if (!empty($exp['company'])) $sub[] = $exp['company'];
                if (!empty($exp['location'])) $sub[] = $exp['location'];
                if (!empty($sub)) $html .= '<div class="entry-sub">' . htmlspecialchars(implode(' • ', $sub)) . '</div>';
            } else if (!empty($exp['location'])) {
                $html .= '<div class="entry-sub">' . htmlspecialchars($exp['location']) . '</div>';
            }
            if (!empty($exp['description'])) $html .= '<div class="entry-desc">' . nl2br(htmlspecialchars($exp['description'])) . '</div>';
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    if (!empty($education)) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">Education</div>';
        foreach ($education as $edu) {
            $html .= '<div class="entry">';
            $html .= '<div class="entry-header">';
            $html .= '<div class="entry-title">' . htmlspecialchars(($edu['degree'] ?? 'Degree') . (!empty($edu['field']) ? ' in ' . $edu['field'] : '')) . '</div>';
            $html .= '<div class="entry-date">' . htmlspecialchars(($formatDate($edu['startDate'] ?? '') ?: '') . ' - ' . ($formatDate($edu['endDate'] ?? '') ?: '')) . '</div>';
            $html .= '</div>';
            $inst = htmlspecialchars(($edu['institution'] ?? '')) . (!empty($edu['gpa']) ? ' • GPA: ' . htmlspecialchars($edu['gpa']) : '');
            if ($inst) $html .= '<div class="entry-sub">' . $inst . '</div>';
            if (!empty($edu['description'])) $html .= '<div class="entry-desc">' . nl2br(htmlspecialchars($edu['description'])) . '</div>';
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    if (!empty($projects)) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">' . ($template === 'modern' ? 'Projects' : 'Projects') . '</div>';
        foreach ($projects as $project) {
            $html .= '<div class="entry">';
            $html .= '<div class="entry-header">';
            $html .= '<div class="entry-title">' . htmlspecialchars($project['name'] ?? 'Project Name') . '</div>';
            $html .= '<div class="entry-date">' . htmlspecialchars(($formatDate($project['startDate'] ?? '') ?: '') . ' - ' . ((isset($project['current']) && $project['current']) ? 'Present' : ($formatDate($project['endDate'] ?? '') ?: ''))) . '</div>';
            $html .= '</div>';
            if (!empty($project['technologies'])) $html .= '<div class="entry-sub">' . htmlspecialchars('Technologies: ' . $project['technologies']) . '</div>';
            if (!empty($project['url'])) $html .= '<div class="entry-sub">' . '<a href="' . htmlspecialchars($project['url']) . '">' . 'View Project' . '</a>' . '</div>';
            if (!empty($project['description'])) $html .= '<div class="entry-desc">' . nl2br(htmlspecialchars($project['description'])) . '</div>';
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    if (!empty($achievements)) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">' . ($template === 'modern' ? 'Achievements' : 'Achievements') . '</div>';
        foreach ($achievements as $ach) {
            $html .= '<div class="entry">';
            $html .= '<div class="entry-header">';
            $html .= '<div class="entry-title">' . htmlspecialchars($ach['title'] ?? 'Achievement') . (!empty($ach['issuer']) && $template === 'classic' ? ', ' . htmlspecialchars($ach['issuer']) : '') . '</div>';
            $html .= '<div class="entry-date">' . htmlspecialchars($formatDate($ach['date'] ?? '')) . '</div>';
            $html .= '</div>';
            if (!empty($ach['issuer']) && $template === 'modern') $html .= '<div class="entry-sub">' . htmlspecialchars($ach['issuer']) . '</div>';
            if (!empty($ach['description'])) $html .= '<div class="entry-desc">' . nl2br(htmlspecialchars($ach['description'])) . '</div>';
            $html .= '</div>';
        }
        $html .= '</div>';
    }

    $skillsFiltered = array_values(array_filter(array_map('trim', $skills)));
    if (!empty($skillsFiltered)) {
        $html .= '<div class="section">';
        $html .= '<div class="section-title">Skills</div>';
        $html .= '<div class="skills">';
        foreach ($skillsFiltered as $skill) {
            $html .= '<span class="tag">' . htmlspecialchars($skill) . '</span>';
        }
        $html .= '</div></div>';
    }

    $html .= '</div></body></html>';
    return $html;
}

function buildSimplePdf($lines, $resumeData = null) {
    // Get template from resume data
    global $resume;
    
    // Use passed resume data or fall back to global
    $resume = $resumeData ?? $resume;
    $template = $resume['template'] ?? 'modern';
    
    // Extract resume data directly
    $pi = $resume['personal_info'] ?? $resume['personalInfo'] ?? [];
    $title = $resume['title'] ?? 'Resume';
    $fullName = $pi['fullName'] ?? '';
    $email = $pi['email'] ?? '';
    $phone = $pi['phone'] ?? '';
    $address = $pi['address'] ?? '';
    $summary = $pi['summary'] ?? '';
    $experience = $resume['experience'] ?? [];
    $education = $resume['education'] ?? [];
    $skills = $resume['skills'] ?? [];
    $projects = $resume['projects'] ?? [];
    $achievements = $resume['achievements'] ?? [];
    
    // Create PDF with proper formatting
    $pdf = "%PDF-1.4\n";
    
    // Calculate object positions
    $pos1 = strlen($pdf);
    $pdf .= "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
    
    $pos2 = strlen($pdf);
    $pdf .= "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
    
    $pos3 = strlen($pdf);
    $pdf .= "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n";
    
    $pos4 = strlen($pdf);
    $pdf .= "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";
    
    $pos5 = strlen($pdf);
    $pdf .= "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
    
    // Build content stream with template-specific formatting
    $content = "BT\n";
    $y = 750;
    
    if ($template === 'modern') {
        // Modern template: Clean, centered header with modern styling
        // Header section - centered with larger name
        if ($fullName) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F1 36 Tf\n"; // Large bold
            $content .= "(" . pdf_escape_text($fullName) . ") Tj\n";
            $y -= 50;
        }
        
        if ($title) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 18 Tf\n"; // Medium
            $content .= "(" . pdf_escape_text($title) . ") Tj\n";
            $y -= 30;
        }
        
        // Contact info - centered with bullet separators
        $contactParts = array_filter([$email, $phone]);
        if (!empty($contactParts)) {
            $contactLine = implode(' • ', $contactParts);
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 14 Tf\n"; // Smaller
            $content .= "(" . pdf_escape_text($contactLine) . ") Tj\n";
            $y -= 25;
        }
        
        if ($address) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 14 Tf\n"; // Smaller
            $content .= "(" . pdf_escape_text($address) . ") Tj\n";
            $y -= 25;
        }
        
        $y -= 30; // Extra space after header
        
        // Summary - Modern style
        if ($summary) {
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 18 Tf\n"; // Bold section title
            $content .= "(PROFESSIONAL SUMMARY) Tj\n";
            $y -= 25;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F2 14 Tf\n"; // Regular
            $content .= "(" . pdf_escape_text($summary) . ") Tj\n";
            $y -= 45;
        }
        
        // Experience section - Modern style
        if (!empty($experience)) {
            $y -= 15;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(WORK EXPERIENCE) Tj\n";
            $y -= 30;
            
            foreach ($experience as $exp) {
                $position = $exp['position'] ?? '';
                $company = $exp['company'] ?? '';
                $start = $exp['startDate'] ?? '';
                $end = $exp['endDate'] ?? '';
                $desc = $exp['description'] ?? '';
                
                if ($position) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($position) . ") Tj\n";
                    $y -= 20;
                }
                
                if ($company) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($company) . ") Tj\n";
                    $y -= 18;
                }
                
                if ($start || $end) {
                    $dates = array_filter([$start, $end]);
                    $dateLine = implode(' - ', $dates);
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($dateLine) . ") Tj\n";
                    $y -= 16;
                }
                
                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }
                
                $y -= 10; // Space between entries
            }
        }
        
        // Education section - Modern style
        if (!empty($education)) {
            $y -= 15;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(EDUCATION) Tj\n";
            $y -= 30;
            
            foreach ($education as $edu) {
                $degree = $edu['degree'] ?? '';
                $field = $edu['field'] ?? '';
                $inst = $edu['institution'] ?? '';
                $start = $edu['startDate'] ?? '';
                $end = $edu['endDate'] ?? '';
                $gpa = $edu['gpa'] ?? '';
                
                if ($degree || $field) {
                    $degreeText = trim($degree . ($field ? ' in ' . $field : ''));
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($degreeText) . ") Tj\n";
                    $y -= 20;
                }
                
                if ($inst) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($inst) . ") Tj\n";
                    $y -= 18;
                }
                
                if ($start || $end) {
                    $dates = array_filter([$start, $end]);
                    $dateText = implode(' - ', $dates);
                    if ($gpa) $dateText .= ' | GPA: ' . $gpa;
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($dateText) . ") Tj\n";
                    $y -= 16;
                }
                
                $y -= 10; // Space between entries
            }
        }
        
        // Skills section - Modern style with bullet separators
        if (!empty($skills)) {
            $skillsFiltered = array_values(array_filter(array_map('trim', $skills)));
            if (!empty($skillsFiltered)) {
                $y -= 15;
                $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                $content .= "/F1 20 Tf\n"; // Bold
                $content .= "(SKILLS) Tj\n";
                $y -= 25;
                
                $skillsLine = implode(' • ', $skillsFiltered);
                $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                $content .= "/F2 14 Tf\n"; // Regular
                $content .= "(" . pdf_escape_text($skillsLine) . ") Tj\n";
            }
        }
        
        // Projects section - Modern style
        if (!empty($projects)) {
            $y -= 15;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(PROJECTS) Tj\n";
            $y -= 25;
            
            foreach ($projects as $project) {
                $name = $project['name'] ?? '';
                $dates = trim(($project['startDate'] ?? '') . ((isset($project['endDate']) && $project['endDate']) ? ' - ' . $project['endDate'] : ''));
                $tech = $project['technologies'] ?? '';
                $desc = $project['description'] ?? '';
                
                if ($name) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($name) . ") Tj\n";
                    $y -= 20;
                }
                
                if ($dates) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($dates) . ") Tj\n";
                    $y -= 18;
                }
                
                if ($tech) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text('Tech: ' . $tech) . ") Tj\n";
                    $y -= 18;
                }
                
                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }
                
                $y -= 10; // Space between entries
            }
        }

        // Achievements section - Modern style
        if (!empty($achievements)) {
            $y -= 15;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(ACHIEVEMENTS) Tj\n";
            $y -= 25;

            foreach ($achievements as $ach) {
                $title = $ach['title'] ?? '';
                $issuer = $ach['issuer'] ?? '';
                $date = $ach['date'] ?? '';
                $desc = $ach['description'] ?? '';

                if ($title) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($title) . ") Tj\n";
                    $y -= 20;
                }

                if ($issuer) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($issuer) . ") Tj\n";
                    $y -= 18;
                }

                if ($date) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($date) . ") Tj\n";
                    $y -= 16;
                }

                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }

                $y -= 10; // Space between entries
            }
        }
        
    } else {
        // Classic template: Traditional layout with pipe separators
        // Header section - centered
        if ($fullName) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F1 30 Tf\n"; // Large bold
            $content .= "(" . pdf_escape_text($fullName) . ") Tj\n";
            $y -= 45;
        }
        
        if ($title) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 16 Tf\n"; // Medium
            $content .= "(" . pdf_escape_text($title) . ") Tj\n";
            $y -= 25;
        }
        
        // Contact info - centered with pipe separators
        $contactParts = array_filter([$email, $phone]);
        if (!empty($contactParts)) {
            $contactLine = implode(' | ', $contactParts);
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 14 Tf\n"; // Smaller
            $content .= "(" . pdf_escape_text($contactLine) . ") Tj\n";
            $y -= 25;
        }
        
        if ($address) {
            $content .= "1 0 0 1 306 $y Tm\n"; // Center
            $content .= "/F2 14 Tf\n"; // Smaller
            $content .= "(" . pdf_escape_text($address) . ") Tj\n";
            $y -= 25;
        }
        
        $y -= 25; // Extra space after header
        
        // Summary - Classic style with "OBJECTIVE"
        if ($summary) {
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(OBJECTIVE) Tj\n";
            $y -= 25;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F2 14 Tf\n"; // Regular
            $content .= "(" . pdf_escape_text($summary) . ") Tj\n";
            $y -= 40;
        }
        
        // Experience section - Classic style
        if (!empty($experience)) {
            $y -= 10;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(EXPERIENCE) Tj\n";
            $y -= 30;
            
            foreach ($experience as $exp) {
                $position = $exp['position'] ?? '';
                $company = $exp['company'] ?? '';
                $start = $exp['startDate'] ?? '';
                $end = $exp['endDate'] ?? '';
                $desc = $exp['description'] ?? '';
                
                if ($position && $company) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($position . ', ' . $company) . ") Tj\n";
                    $y -= 20;
                }
                
                if ($start || $end) {
                    $dates = array_filter([$start, $end]);
                    $dateLine = implode(' - ', $dates);
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($dateLine) . ") Tj\n";
                    $y -= 16;
                }
                
                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }
                
                $y -= 10; // Space between entries
            }
        }
        
        // Education section - Classic style
        if (!empty($education)) {
            $y -= 10;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(EDUCATION) Tj\n";
            $y -= 30;
            
            foreach ($education as $edu) {
                $degree = $edu['degree'] ?? '';
                $field = $edu['field'] ?? '';
                $inst = $edu['institution'] ?? '';
                $start = $edu['startDate'] ?? '';
                $end = $edu['endDate'] ?? '';
                $gpa = $edu['gpa'] ?? '';
                
                if ($degree || $field) {
                    $degreeText = trim($degree . ($field ? ' in ' . $field : ''));
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($degreeText) . ") Tj\n";
                    $y -= 20;
                }
                
                if ($inst) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($inst) . ") Tj\n";
                    $y -= 18;
                }
                
                if ($start || $end) {
                    $dates = array_filter([$start, $end]);
                    $dateText = implode(' - ', $dates);
                    if ($gpa) $dateText .= ' | GPA: ' . $gpa;
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($dateText) . ") Tj\n";
                    $y -= 16;
                }
                
                $y -= 10; // Space between entries
            }
        }
        
        // Skills section - Classic style with pipe separators
        if (!empty($skills)) {
            $skillsFiltered = array_values(array_filter(array_map('trim', $skills)));
            if (!empty($skillsFiltered)) {
                $y -= 10;
                $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                $content .= "/F1 20 Tf\n"; // Bold
                $content .= "(SKILLS) Tj\n";
                $y -= 25;
                
                $skillsLine = implode(' | ', $skillsFiltered);
                $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                $content .= "/F2 14 Tf\n"; // Regular
                $content .= "(" . pdf_escape_text($skillsLine) . ") Tj\n";
            }
        }

        // Projects section - Classic style
        if (!empty($projects)) {
            $y -= 10;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(PROJECTS) Tj\n";
            $y -= 25;

            foreach ($projects as $project) {
                $name = $project['name'] ?? '';
                $dates = trim(($project['startDate'] ?? '') . ((isset($project['endDate']) && $project['endDate']) ? ' - ' . $project['endDate'] : ''));
                $tech = $project['technologies'] ?? '';
                $desc = $project['description'] ?? '';

                if ($name) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($name) . ") Tj\n";
                    $y -= 20;
                }

                if ($dates) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($dates) . ") Tj\n";
                    $y -= 18;
                }

                if ($tech) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text('Tech: ' . $tech) . ") Tj\n";
                    $y -= 18;
                }

                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }

                $y -= 10; // Space between entries
            }
        }

        // Achievements section - Classic style
        if (!empty($achievements)) {
            $y -= 10;
            $content .= "1 0 0 1 72 $y Tm\n"; // Left align
            $content .= "/F1 20 Tf\n"; // Bold
            $content .= "(ACHIEVEMENTS) Tj\n";
            $y -= 25;

            foreach ($achievements as $ach) {
                $title = $ach['title'] ?? '';
                $issuer = $ach['issuer'] ?? '';
                $date = $ach['date'] ?? '';
                $desc = $ach['description'] ?? '';

                if ($title) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F1 16 Tf\n"; // Bold
                    $content .= "(" . pdf_escape_text($title) . ") Tj\n";
                    $y -= 20;
                }

                if ($issuer) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($issuer) . ") Tj\n";
                    $y -= 18;
                }

                if ($date) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 12 Tf\n"; // Smaller
                    $content .= "(" . pdf_escape_text($date) . ") Tj\n";
                    $y -= 16;
                }

                if ($desc) {
                    $content .= "1 0 0 1 72 $y Tm\n"; // Left align
                    $content .= "/F2 14 Tf\n"; // Regular
                    $content .= "(" . pdf_escape_text($desc) . ") Tj\n";
                    $y -= 20;
                }

                $y -= 10; // Space between entries
            }
        }
    }
    
    $content .= "ET\n";
    
    $pos6 = strlen($pdf);
    $pdf .= "6 0 obj\n<< /Length " . strlen($content) . " >>\nstream\n$content\nendstream\nendobj\n";
    
    // Cross-reference table
    $xrefPos = strlen($pdf);
    $pdf .= "xref\n0 7\n";
    $pdf .= "0000000000 65535 f \n";
    $pdf .= sprintf("%010d 00000 n \n", $pos1);
    $pdf .= sprintf("%010d 00000 n \n", $pos2);
    $pdf .= sprintf("%010d 00000 n \n", $pos3);
    $pdf .= sprintf("%010d 00000 n \n", $pos4);
    $pdf .= sprintf("%010d 00000 n \n", $pos5);
    $pdf .= sprintf("%010d 00000 n \n", $pos6);
    
    // Trailer
    $pdf .= "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n$xrefPos\n%%EOF";
    
    return $pdf;
}

function pdf_escape_text($text) {
    $text = str_replace(["\\", "(", ")", "\r", "\n"], ["\\\\", "\\(", "\\)", '', "\\n"], $text);
    return $text;
}

function handleTemplates() {
    global $method;
    
    if ($method !== 'GET') {
        sendError('Method not allowed', 405);
    }
    
    $templates = [
        [
            'id' => 'modern',
            'name' => 'Modern',
            'description' => 'Clean design with blue accents and professional styling',
            'preview_image' => 'templates/modern-preview.png'
        ],
        [
            'id' => 'classic',
            'name' => 'Classic',
            'description' => 'Traditional serif font layout with centered header',
            'preview_image' => 'templates/classic-preview.png'
        ]
    ];
    
    sendSuccess($templates);
}

// Database setup function (call this once to create tables)
function setupDatabase() {
    global $pdo;
    
    try {
        $sql = "
        CREATE TABLE IF NOT EXISTS resumes (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            title VARCHAR(255) NOT NULL,
            personal_info JSON NOT NULL,
            education JSON,
            experience JSON,
            skills JSON,
            projects JSON,
            achievements JSON,
            template VARCHAR(50) DEFAULT 'modern',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        $pdo->exec($sql);
        
        // Add projects/achievements columns if they don't exist (for existing databases)
        try {
            $pdo->exec("ALTER TABLE resumes ADD COLUMN projects JSON AFTER skills");
        } catch (PDOException $e) {
            // ignore
        }
        try {
            $pdo->exec("ALTER TABLE resumes ADD COLUMN achievements JSON AFTER projects");
        } catch (PDOException $e) {
            // ignore
        }
        
        sendSuccess(null, 'Database setup completed');
    } catch (PDOException $e) {
        sendError('Database setup error: ' . $e->getMessage(), 500);
    }
}

// Uncomment the line below and visit this file once to setup the database
// setupDatabase();

?>