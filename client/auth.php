<?php
session_start();
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
    echo json_encode(['success' => false, 'message' => $message]);
    exit();
}

// Success response function
function sendSuccess($data = null, $message = 'Success') {
    echo json_encode([
        'success' => true,
        'message' => $message,
        'user' => $data['user'] ?? null,
        'token' => $data['token'] ?? null
    ]);
    exit();
}

// Generate JWT-like token (simplified)
function generateToken($userId) {
    return base64_encode(json_encode([
        'user_id' => $userId,
        'expires' => time() + (24 * 60 * 60), // 24 hours
        'hash' => hash('sha256', $userId . 'secret_key' . time())
    ]));
}

// Verify token
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

// Hash password
function hashPassword($password) {
    return password_hash($password, PASSWORD_DEFAULT);
}

// Verify password
function verifyPassword($password, $hash) {
    return password_verify($password, $hash);
}

try {
    // Database connection
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    // If database doesn't exist, use file-based storage
    $useFileStorage = true;
}

// File storage functions for users
function saveUser($user) {
    $dir = 'data';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    
    $users = loadUsers();
    $users[] = $user;
    file_put_contents("$dir/users.json", json_encode($users, JSON_PRETTY_PRINT));
}

function loadUsers() {
    $filepath = "data/users.json";
    if (file_exists($filepath)) {
        $content = file_get_contents($filepath);
        return json_decode($content, true) ?: [];
    }
    return [];
}

function findUserByEmail($email) {
    $users = loadUsers();
    foreach ($users as $user) {
        if ($user['email'] === $email) {
            return $user;
        }
    }
    return null;
}

function findUserById($id) {
    $users = loadUsers();
    foreach ($users as $user) {
        if ($user['id'] === $id) {
            return $user;
        }
    }
    return null;
}

// Get request data
$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
    case 'signup':
        handleSignup($input);
        break;
    case 'login':
        handleLogin($input);
        break;
    case 'verify':
        handleVerifyToken($input);
        break;
    case 'logout':
        handleLogout();
        break;
    default:
        sendError('Invalid action', 400);
}

function handleSignup($input) {
    global $pdo, $useFileStorage;
    
    // Validate input
    if (!isset($input['name']) || !isset($input['email']) || !isset($input['password'])) {
        sendError('Name, email, and password are required');
    }
    
    $name = trim($input['name']);
    $email = trim(strtolower($input['email']));
    $password = $input['password'];
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendError('Invalid email format');
    }
    
    // Validate password length
    if (strlen($password) < 6) {
        sendError('Password must be at least 6 characters long');
    }
    
    // Check if user already exists
    if (isset($useFileStorage)) {
        $existingUser = findUserByEmail($email);
        if ($existingUser) {
            sendError('User with this email already exists');
        }
        
        // Create new user
        $user = [
            'id' => uniqid('user_', true),
            'name' => $name,
            'email' => $email,
            'password' => hashPassword($password),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ];
        
        saveUser($user);
        
        // Generate token
        $token = generateToken($user['id']);
        
        // Return user data (without password)
        $userData = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'created_at' => $user['created_at']
        ];
        
        sendSuccess([
            'user' => $userData,
            'token' => $token
        ], 'Account created successfully');
        
    } else {
        try {
            // Check if user exists
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                sendError('User with this email already exists');
            }
            
            // Create new user
            $userId = uniqid('user_', true);
            $hashedPassword = hashPassword($password);
            
            $stmt = $pdo->prepare("
                INSERT INTO users (id, name, email, password, created_at, updated_at)
                VALUES (?, ?, ?, ?, NOW(), NOW())
            ");
            
            $stmt->execute([$userId, $name, $email, $hashedPassword]);
            
            // Generate token
            $token = generateToken($userId);
            
            // Return user data
            $userData = [
                'id' => $userId,
                'name' => $name,
                'email' => $email,
                'created_at' => date('Y-m-d H:i:s')
            ];
            
            sendSuccess([
                'user' => $userData,
                'token' => $token
            ], 'Account created successfully');
            
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

function handleLogin($input) {
    global $pdo, $useFileStorage;
    
    // Validate input
    if (!isset($input['email']) || !isset($input['password'])) {
        sendError('Email and password are required');
    }
    
    $email = trim(strtolower($input['email']));
    $password = $input['password'];
    
    if (isset($useFileStorage)) {
        $user = findUserByEmail($email);
        if (!$user || !verifyPassword($password, $user['password'])) {
            sendError('Invalid email or password');
        }
        
        // Generate token
        $token = generateToken($user['id']);
        
        // Return user data (without password)
        $userData = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'created_at' => $user['created_at']
        ];
        
        sendSuccess([
            'user' => $userData,
            'token' => $token
        ], 'Login successful');
        
    } else {
        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
            $stmt->execute([$email]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$user || !verifyPassword($password, $user['password'])) {
                sendError('Invalid email or password');
            }
            
            // Generate token
            $token = generateToken($user['id']);
            
            // Return user data (without password)
            $userData = [
                'id' => $user['id'],
                'name' => $user['name'],
                'email' => $user['email'],
                'created_at' => $user['created_at']
            ];
            
            sendSuccess([
                'user' => $userData,
                'token' => $token
            ], 'Login successful');
            
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
}

function handleVerifyToken($input) {
    global $useFileStorage;
    
    if (!isset($input['token'])) {
        sendError('Token is required');
    }
    
    $userId = verifyToken($input['token']);
    if (!$userId) {
        sendError('Invalid or expired token', 401);
    }
    
    // Get user data
    if (isset($useFileStorage)) {
        $user = findUserById($userId);
        if (!$user) {
            sendError('User not found', 404);
        }
        
        $userData = [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'created_at' => $user['created_at']
        ];
        
    } else {
        try {
            $stmt = $pdo->prepare("SELECT id, name, email, created_at FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $userData = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$userData) {
                sendError('User not found', 404);
            }
        } catch (PDOException $e) {
            sendError('Database error: ' . $e->getMessage(), 500);
        }
    }
    
    sendSuccess([
        'user' => $userData,
        'token' => $input['token']
    ], 'Token is valid');
}

function handleLogout() {
    // For stateless tokens, logout is handled client-side
    sendSuccess(null, 'Logged out successfully');
}

// Database setup function for users table
function setupUsersTable() {
    global $pdo;
    
    try {
        $sql = "
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        $pdo->exec($sql);
        sendSuccess(null, 'Users table setup completed');
    } catch (PDOException $e) {
        sendError('Database setup error: ' . $e->getMessage(), 500);
    }
}

// Uncomment the line below and visit this file with ?setup=true to setup the users table
// if (isset($_GET['setup']) && $_GET['setup'] === 'true') {
//     setupUsersTable();
// }

?>