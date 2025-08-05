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
    $headers = apache_request_headers();
    $authHeader = $headers['Authorization'] ?? '';
    
    if (strpos($authHeader, 'Bearer ') === 0) {
        $token = substr($authHeader, 7);
        return verifyToken($token);
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
    if (!$userId) {
        sendError('Authentication required', 401);
    }
    
    if (isset($useFileStorage)) {
        $resumes = loadFromFile('resumes.json');
        // Filter resumes by user
        $userResumes = array_filter($resumes, function($resume) use ($userId) {
            return isset($resume['user_id']) && $resume['user_id'] === $userId;
        });
        sendSuccess(array_values($userResumes));
    } else {
        try {
            $stmt = $pdo->prepare("SELECT * FROM resumes WHERE user_id = ? ORDER BY created_at DESC");
            $stmt->execute([$userId]);
            $resumes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Decode JSON fields
            foreach ($resumes as &$resume) {
                $resume['personal_info'] = json_decode($resume['personal_info'], true);
                $resume['education'] = json_decode($resume['education'], true);
                $resume['experience'] = json_decode($resume['experience'], true);
                $resume['skills'] = json_decode($resume['skills'], true);
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
            $stmt = $pdo->prepare("
                INSERT INTO resumes (id, user_id, title, personal_info, education, experience, skills, template, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $stmt->execute([
                $resume['id'],
                $resume['user_id'],
                $resume['title'],
                json_encode($resume['personal_info']),
                json_encode($resume['education']),
                json_encode($resume['experience']),
                json_encode($resume['skills']),
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
            $stmt = $pdo->prepare("
                UPDATE resumes 
                SET title = ?, personal_info = ?, education = ?, experience = ?, skills = ?, template = ?, updated_at = ?
                WHERE id = ? AND user_id = ?
            ");
            
            $result = $stmt->execute([
                $resume['title'],
                json_encode($resume['personal_info']),
                json_encode($resume['education']),
                json_encode($resume['experience']),
                json_encode($resume['skills']),
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
            template VARCHAR(50) DEFAULT 'modern',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        $pdo->exec($sql);
        sendSuccess(null, 'Database setup completed');
    } catch (PDOException $e) {
        sendError('Database setup error: ' . $e->getMessage(), 500);
    }
}

// Uncomment the line below and visit this file once to setup the database
// setupDatabase();

?>