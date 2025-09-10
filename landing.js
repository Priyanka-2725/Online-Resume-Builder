// Landing page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking on links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // Theme initialization
    try {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(theme);
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
            toggleBtn.addEventListener('click', () => {
                const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                setTheme(next);
                localStorage.setItem('theme', next);
                toggleBtn.textContent = next === 'dark' ? '☀️' : '🌙';
                // Recompute header background after theme change
                try { (typeof updateHeaderBg === 'function') && updateHeaderBg(); } catch {}
            });
        }
    } catch (e) { console.warn('Theme init failed', e); }

    // Check if user is already logged in
    checkLoginStatus();
    
    // Add scroll effect to navbar with theme awareness
    function updateHeaderBg() {
        const header = document.querySelector('.header');
        if (!header) return;
        const isDark = document.documentElement.classList.contains('dark');
        const scrolled = window.scrollY > 100;
        if (isDark) {
            header.style.background = scrolled ? 'rgba(17, 24, 39, 0.95)' : 'rgba(17, 24, 39, 0.85)';
        } else {
            header.style.background = scrolled ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)';
        }
    }
    window.addEventListener('scroll', updateHeaderBg);
    // Initial set on load
    updateHeaderBg();
});

function setTheme(mode) {
    if (mode === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

// Modal functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
    document.getElementById('signupModal').style.display = 'none';
    document.body.style.overflow = 'hidden';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function showSignupModal() {
    document.getElementById('signupModal').style.display = 'block';
    document.getElementById('loginModal').style.display = 'none';
    document.body.style.overflow = 'hidden';
}

function hideSignupModal() {
    document.getElementById('signupModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    
    if (event.target === loginModal) {
        hideLoginModal();
    }
    if (event.target === signupModal) {
        hideSignupModal();
    }
});

// Handle login form submission
async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const loginData = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    // Add loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Logging in...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login',
                ...loginData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Store user session
            localStorage.setItem('user', JSON.stringify(result.user));
            sessionStorage.setItem('authToken', result.token);
            
            // Redirect to My Resumes view
            window.location.href = 'index.html?view=my-resumes';
        } else {
            showError(result.message || 'Login failed. Please try again.');
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Handle signup form submission
async function handleSignup(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    const signupData = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword')
    };
    
    // Validate passwords match
    if (signupData.password !== signupData.confirmPassword) {
        showError('Passwords do not match.');
        return;
    }
    
    // Validate password strength
    if (signupData.password.length < 6) {
        showError('Password must be at least 6 characters long.');
        return;
    }
    
    // Add loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating Account...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'signup',
                ...signupData
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Store user session
            localStorage.setItem('user', JSON.stringify(result.user));
            sessionStorage.setItem('authToken', result.token);
            
            // Show success message and redirect
            showSuccess('Account created successfully! Redirecting to resume builder...');
            setTimeout(() => {
                window.location.href = 'index.html?view=my-resumes';
            }, 1000);
        } else {
            showError(result.message || 'Signup failed. Please try again.');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showError('Network error. Please check your connection and try again.');
    } finally {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Check login status
function checkLoginStatus() {
    const user = localStorage.getItem('user');
    const token = sessionStorage.getItem('authToken');
    
    if (user && token) {
        // User is logged in, update navbar
        updateNavbarForLoggedInUser(JSON.parse(user));
    }
}

// Update navbar for logged in user
function updateNavbarForLoggedInUser(user) {
    const navMenu = document.querySelector('.nav-menu');
    
    // Remove login/signup buttons
    const loginBtn = navMenu.querySelector('.login-btn');
    const signupBtn = navMenu.querySelector('.signup-btn');
    
    if (loginBtn) loginBtn.remove();
    if (signupBtn) signupBtn.remove();
    
    // Add user menu
    const userMenu = document.createElement('li');
    userMenu.innerHTML = `
        <div class="user-menu">
            <span class="user-greeting">Hi, ${user.name}!</span>
            <a href="index.html?view=my-resumes" class="nav-link">My Resumes</a>
            <a href="#" class="nav-link" onclick="logout()">Logout</a>
        </div>
    `;
    navMenu.appendChild(userMenu);
}

// Logout function
function logout() {
    localStorage.removeItem('user');
    sessionStorage.removeItem('authToken');
    window.location.reload();
}

// Utility functions
function showError(message) {
    // Create or update error message
    removeExistingMessages();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

function showSuccess(message) {
    // Create or update success message
    removeExistingMessages();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        color: #166534;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    successDiv.textContent = message;
    
    document.body.appendChild(successDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

function removeExistingMessages() {
    const existingMessages = document.querySelectorAll('.error-message, .success-message');
    existingMessages.forEach(msg => msg.remove());
}

// Add slide-in animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .user-menu {
        display: flex;
        gap: 1rem;
        align-items: center;
    }
    
    .user-greeting {
        color: #667eea;
        font-weight: 600;
    }
    
    @media (max-width: 768px) {
        .user-menu {
            flex-direction: column;
            gap: 0.5rem;
        }
    }
`;
document.head.appendChild(style);

// Add loading animations for better UX
function addLoadingAnimation(element) {
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    
    const loading = document.createElement('div');
    loading.className = 'loading-overlay';
    loading.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    const spinner = document.createElement('div');
    spinner.style.cssText = `
        width: 20px;
        height: 20px;
        border: 2px solid #667eea;
        border-radius: 50%;
        border-top-color: transparent;
        animation: spin 1s linear infinite;
    `;
    
    loading.appendChild(spinner);
    element.appendChild(loading);
    
    return loading;
}

function removeLoadingAnimation(element) {
    const loading = element.querySelector('.loading-overlay');
    if (loading) {
        loading.remove();
    }
}

// Intersection Observer for animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        }
    });
}, observerOptions);

// Observe elements for animations
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.feature-card, .template-card, .about-content');
    animateElements.forEach(el => observer.observe(el));
});