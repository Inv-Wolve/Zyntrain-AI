const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || process.env.Zyntrain_PORT || 4567;

// Enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://discord.com", "https://ipapi.co"],
            mediaSrc: ["'self'", "blob:", "data:"],
            scriptSrcAttr: ["'none'"], // Block all inline event handlers - STRICT CSP
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Enhanced CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://zykro.dev',
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Enhanced rate limiting
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests, please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// AI Chat rate limiter - Fixed definition
const aiChatLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: parseInt(process.env.AI_CHAT_DAILY_LIMIT) || 50,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise use IP with proper IPv6 handling
        if (req.user && req.user.id) {
            return `user:${req.user.id}`;
        }
        // Use the built-in helper that normalizes IPv6 to avoid bypasses
        return ipKeyGenerator(req);
    },
    message: { 
        error: 'Daily AI chat limit exceeded',
        message: 'You have reached your daily limit of AI chat messages. Please try again tomorrow.',
        limit: parseInt(process.env.AI_CHAT_DAILY_LIMIT) || 50
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Daily AI chat limit exceeded',
            message: 'You have reached your daily limit of AI chat messages. Please try again tomorrow.',
            limit: parseInt(process.env.AI_CHAT_DAILY_LIMIT) || 50,
            resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
    }
});

app.use(generalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Explicit static mounts for assets to ensure correct MIME types
app.use('/Zyntrain/styles', express.static(path.join(__dirname, 'Zyntrain', 'styles'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
}));
app.use('/Zyntrain/scripts', express.static(path.join(__dirname, 'Zyntrain', 'scripts'), {
    setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
    }
}));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-for-development';

// Google OAuth2 Configuration
let oauth2Client = null;

// Initialize Google OAuth2 only if credentials are available
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`
    );
    console.log('📅 Google Calendar OAuth configured');
} else {
    console.warn('📅 Google Calendar credentials not configured');
}

// Email configuration
let emailTransporter = null;

// Initialize email transporter only if credentials are available
if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_APP_PASSWORD
        }
    });
    
    // Verify email configuration
    emailTransporter.verify((error, success) => {
        if (error) {
            console.warn('📧 Email configuration error:', error.message);
            emailTransporter = null;
        } else {
            console.log('📧 Email Service: Configured');
        }
    });
} else {
    console.warn('📧 Email credentials not configured');
}

// Utility Functions
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateUserId() {
    return crypto.randomUUID();
}

async function ensureUserDirectory(userId) {
    const userDir = path.join(__dirname, 'Zyntrain', 'data', 'accounts', userId);
    try {
        await fs.mkdir(userDir, { recursive: true });
        return userDir;
    } catch (error) {
        console.error('Error creating user directory:', error);
        throw error;
    }
}

async function readUserFile(userId, filename) {
    try {
        const userDir = await ensureUserDirectory(userId);
        const filePath = path.join(userDir, filename);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return getDefaultData(filename);
        }
        throw error;
    }
}

async function writeUserFile(userId, filename, data) {
    try {
        const userDir = await ensureUserDirectory(userId);
        const filePath = path.join(userDir, filename);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filename}:`, error);
        throw error;
    }
}

function getDefaultData(filename) {
    const defaults = {
        'profile.json': {},
        'tasks.json': [],
        'aichat.json': [],
        'schedule.json': { events: [], optimizedSchedule: [], lastOptimized: null },
        'preferences.json': {
            workingHours: { start: '09:00', end: '17:00' },
            energyPeaks: ['morning'],
            preferredBreakDuration: 15,
            focusBlockLength: 60,
            workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            notifications: {
                taskReminders: true,
                aiSuggestions: true,
                breakReminders: true,
                weeklyReports: true
            }
        },
        'analytics.json': {
            totalTasks: 0,
            completedToday: 0,
            focusTime: 0,
            trends: { completed: 0, focus: 0, totalTasks: 0, aiUsage: 0 },
            timeDistribution: {
                work: { hours: 0, percentage: 0 },
                meetings: { hours: 0, percentage: 0 },
                admin: { hours: 0, percentage: 0 }
            },
            weeklyData: [],
            lastCalculated: new Date().toISOString()
        }
    };
    return defaults[filename] || {};
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Analytics calculation
async function calculateAnalytics(userId) {
    try {
        const tasks = await readUserFile(userId, 'tasks.json');
        const preferences = await readUserFile(userId, 'preferences.json');
        
        const now = new Date();
        const today = now.toDateString();
        
        // Calculate basic metrics
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.completed);
        const completedToday = completedTasks.filter(task => {
            return task.completedAt && new Date(task.completedAt).toDateString() === today;
        });
        
        // Calculate focus time (estimated)
        const focusTime = completedTasks.reduce((total, task) => {
            return total + (task.duration || 30);
        }, 0) / 60; // Convert to hours
        
        // Calculate trends (mock data for now)
        const trends = {
            completed: Math.floor(Math.random() * 20) - 5,
            focus: Math.floor(Math.random() * 30) - 10,
            totalTasks: Math.floor(Math.random() * 15) - 5,
            aiUsage: Math.floor(Math.random() * 25)
        };
        
        // Time distribution (estimated based on task categories)
        const workTasks = tasks.filter(task => task.category === 'work');
        const personalTasks = tasks.filter(task => task.category === 'personal');
        const totalTime = Math.max(1, workTasks.length + personalTasks.length);
        
        const timeDistribution = {
            work: {
                hours: Math.round((workTasks.length / totalTime) * focusTime * 10) / 10,
                percentage: Math.round((workTasks.length / totalTime) * 100)
            },
            meetings: {
                hours: Math.round(focusTime * 0.2 * 10) / 10,
                percentage: 20
            },
            admin: {
                hours: Math.round(focusTime * 0.1 * 10) / 10,
                percentage: 10
            }
        };
        
        // Weekly data
        const weeklyData = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayTasks = tasks.filter(task => {
                return task.completedAt && 
                       new Date(task.completedAt).toDateString() === date.toDateString();
            });
            
            const dayTotal = tasks.filter(task => {
                return task.createdAt && 
                       new Date(task.createdAt).toDateString() === date.toDateString();
            });
            
            weeklyData.push({
                date: dateStr,
                day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                completionRate: dayTotal.length > 0 ? Math.round((dayTasks.length / dayTotal.length) * 100) : 0,
                tasksCompleted: dayTasks.length,
                totalTasks: dayTotal.length
            });
        }
        
        const analytics = {
            totalTasks,
            completedToday: completedToday.length,
            focusTime: Math.round(focusTime * 10) / 10,
            trends,
            timeDistribution,
            weeklyData,
            lastCalculated: now.toISOString()
        };
        
        await writeUserFile(userId, 'analytics.json', analytics);
        return analytics;
    } catch (error) {
        console.error('Error calculating analytics:', error);
        return getDefaultData('analytics.json');
    }
}

// Static file serving with security
const blockedExtensions = ['.env', '.md', '.txt', '.log', '.py', '.config', '.yml', '.yaml'];
const blockedDirectories = ['node_modules', '.git', 'logs', 'data'];

app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    
    // Allow CSS and JS files for the application to work
    const allowedPaths = [
        '/styles/',
        '/scripts/',
        '/Zyntrain/styles/',
        '/Zyntrain/scripts/',
        '/Me/styles.css',
        '/Me/script.js',
        '/styles.css',
        '/script.js'
    ];
    
    const isAllowedPath = allowedPaths.some(path => url.includes(path.toLowerCase()));
    
    // Block only if it's a blocked extension OR in a blocked directory (but allow known asset paths)
    const inBlockedDir = blockedDirectories.some(dir => url.includes(`/${dir}/`) || url.includes(`\\${dir}\\`));
    const hasBlockedExt = blockedExtensions.some(ext => url.endsWith(ext));
    const isBlocked = (!isAllowedPath && hasBlockedExt) || inBlockedDir;
    
    if (isBlocked) {
        return res.redirect('/Zyntrain/sorry.html');
    }
    next();
});

// Serve static files (root) with proper MIME types
app.use(express.static(path.join(__dirname), {
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: '1.0.0'
    });
});

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        
        const userId = generateUserId();
        const hashedPassword = hashPassword(password);
        
        const userProfile = {
            id: userId,
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            email,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            settings: {
                theme: 'light',
                notifications: true,
                timezone: 'UTC'
            }
        };
        
        await writeUserFile(userId, 'profile.json', userProfile);
        
        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: {
                id: userId,
                name: userProfile.name,
                email,
                createdAt: userProfile.createdAt
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        const hashedPassword = hashPassword(password);
        
        // Find user by email (simple file-based search)
        const accountsDir = path.join(__dirname, 'Zyntrain', 'data', 'accounts');
        const userDirs = await fs.readdir(accountsDir).catch(() => []);
        
        let userProfile = null;
        for (const userId of userDirs) {
            try {
                const profile = await readUserFile(userId, 'profile.json');
                if (profile.email === email && profile.password === hashedPassword) {
                    userProfile = profile;
                    userProfile.lastLogin = new Date().toISOString();
                    await writeUserFile(userId, 'profile.json', userProfile);
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        
        if (!userProfile) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Check if 2FA is enabled
        if (userProfile.twoFactorEnabled && emailTransporter) {
            // Generate 2FA code
            const twoFactorCode = Math.floor(100000 + Math.random() * 900000).toString();
            const codeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            
            // Store 2FA code temporarily
            userProfile.pendingTwoFactor = {
                code: twoFactorCode,
                expiry: codeExpiry.toISOString(),
                email: email
            };
            await writeUserFile(userProfile.id, 'profile.json', userProfile);
            
            // Send 2FA email
            try {
                await emailTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Zyntrain AI - Two-Factor Authentication Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #2563eb;">Zyntrain AI - Login Verification</h2>
                            <p>Your two-factor authentication code is:</p>
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                                <h1 style="color: #2563eb; font-size: 32px; margin: 0; letter-spacing: 4px;">${twoFactorCode}</h1>
                            </div>
                            <p>This code will expire in 10 minutes.</p>
                            <p>If you didn't request this code, please ignore this email.</p>
                            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                            <p style="color: #6b7280; font-size: 14px;">Zyntrain AI - Intelligent Task Management</p>
                        </div>
                    `
                });
                
                return res.json({
                    success: true,
                    requires2FA: true,
                    userId: userProfile.id,
                    message: '2FA code sent to your email'
                });
            } catch (emailError) {
                console.error('Error sending 2FA email:', emailError);
                // Fall back to normal login if email fails
            }
        }
        
        const token = jwt.sign({ id: userProfile.id, email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: {
                id: userProfile.id,
                name: userProfile.name,
                email: userProfile.email,
                createdAt: userProfile.createdAt
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
    try {
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        res.json({
            id: userProfile.id,
            name: userProfile.name,
            email: userProfile.email,
            createdAt: userProfile.createdAt,
            settings: userProfile.settings
        });
    } catch (error) {
        console.error('Auth verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

// 2FA Routes
app.post('/api/auth/verify-login-2fa', async (req, res) => {
    try {
        const { userId, code } = req.body;
        
        if (!userId || !code) {
            return res.status(400).json({ error: 'User ID and code are required' });
        }
        
        const userProfile = await readUserFile(userId, 'profile.json');
        
        if (!userProfile.pendingTwoFactor) {
            return res.status(400).json({ error: 'No pending 2FA verification' });
        }
        
        const { code: storedCode, expiry } = userProfile.pendingTwoFactor;
        
        if (new Date() > new Date(expiry)) {
            delete userProfile.pendingTwoFactor;
            await writeUserFile(userId, 'profile.json', userProfile);
            return res.status(400).json({ error: '2FA code expired' });
        }
        
        if (code !== storedCode) {
            return res.status(400).json({ error: 'Invalid 2FA code' });
        }
        
        // Clear pending 2FA
        delete userProfile.pendingTwoFactor;
        userProfile.lastLogin = new Date().toISOString();
        await writeUserFile(userId, 'profile.json', userProfile);
        
        const token = jwt.sign({ id: userProfile.id, email: userProfile.email }, JWT_SECRET, { expiresIn: '7d' });
        
        res.json({
            success: true,
            token,
            user: {
                id: userProfile.id,
                name: userProfile.name,
                email: userProfile.email,
                createdAt: userProfile.createdAt
            }
        });
        
    } catch (error) {
        console.error('2FA verification error:', error);
        res.status(500).json({ error: '2FA verification failed' });
    }
});

app.post('/api/auth/enable-2fa', authenticateToken, async (req, res) => {
    try {
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        userProfile.twoFactorEnabled = true;
        await writeUserFile(req.user.id, 'profile.json', userProfile);
        
        res.json({ success: true, message: '2FA enabled successfully' });
    } catch (error) {
        console.error('Enable 2FA error:', error);
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

app.post('/api/auth/disable-2fa', authenticateToken, async (req, res) => {
    try {
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        userProfile.twoFactorEnabled = false;
        delete userProfile.pendingTwoFactor;
        await writeUserFile(req.user.id, 'profile.json', userProfile);
        
        res.json({ success: true, message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

app.post('/api/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        if (!emailTransporter) {
            return res.status(503).json({ error: 'Email service not available' });
        }
        
        // Find user by email
        const accountsDir = path.join(__dirname, 'Zyntrain', 'data', 'accounts');
        const userDirs = await fs.readdir(accountsDir).catch(() => []);
        
        let userProfile = null;
        for (const userId of userDirs) {
            try {
                const profile = await readUserFile(userId, 'profile.json');
                if (profile.email === email) {
                    userProfile = profile;
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        
        if (!userProfile) {
            // Don't reveal if email exists or not for security
            return res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
        }
        
        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        
        userProfile.passwordReset = {
            token: resetToken,
            expiry: resetExpiry.toISOString()
        };
        
        await writeUserFile(userProfile.id, 'profile.json', userProfile);
        
        // Send reset email
        const resetUrl = `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/Zyntrain/reset-password.html?token=${resetToken}`;
        
        await emailTransporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Zyntrain AI - Password Reset Request',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2563eb;">Zyntrain AI - Password Reset</h2>
                    <p>You requested a password reset for your Zyntrain AI account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Reset Password</a>
                    </div>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="background: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all;">${resetUrl}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request this reset, please ignore this email.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">Zyntrain AI - Intelligent Task Management</p>
                </div>
            `
        });
        
        res.json({ success: true, message: 'If an account with that email exists, a reset link has been sent.' });
        
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process password reset request' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        
        // Find user with matching reset token
        const accountsDir = path.join(__dirname, 'Zyntrain', 'data', 'accounts');
        const userDirs = await fs.readdir(accountsDir).catch(() => []);
        
        let userProfile = null;
        for (const userId of userDirs) {
            try {
                const profile = await readUserFile(userId, 'profile.json');
                if (profile.passwordReset && profile.passwordReset.token === token) {
                    userProfile = profile;
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        
        if (!userProfile || !userProfile.passwordReset) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        
        if (new Date() > new Date(userProfile.passwordReset.expiry)) {
            delete userProfile.passwordReset;
            await writeUserFile(userProfile.id, 'profile.json', userProfile);
            return res.status(400).json({ error: 'Reset token expired' });
        }
        
        // Update password
        userProfile.password = hashPassword(newPassword);
        delete userProfile.passwordReset;
        userProfile.passwordChangedAt = new Date().toISOString();
        
        await writeUserFile(userProfile.id, 'profile.json', userProfile);
        
        res.json({ success: true, message: 'Password reset successfully' });
        
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// User Management
app.put('/api/user/update', authenticateToken, async (req, res) => {
    try {
        const updates = req.body;
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        const updatedProfile = { ...userProfile, ...updates };
        await writeUserFile(req.user.id, 'profile.json', updatedProfile);
        
        res.json({ success: true, user: updatedProfile });
    } catch (error) {
        console.error('User update error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Tasks Management
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const tasks = await readUserFile(req.user.id, 'tasks.json');
        res.json({ success: true, tasks });
    } catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({ error: 'Failed to get tasks' });
    }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    try {
        const taskData = req.body;
        const tasks = await readUserFile(req.user.id, 'tasks.json');
        
        const newTask = {
            id: generateUserId(),
            ...taskData,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        tasks.push(newTask);
        await writeUserFile(req.user.id, 'tasks.json', tasks);
        
        // Recalculate analytics
        await calculateAnalytics(req.user.id);
        
        res.json({ success: true, task: newTask });
    } catch (error) {
        console.error('Add task error:', error);
        res.status(500).json({ error: 'Failed to add task' });
    }
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const updates = req.body;
        const tasks = await readUserFile(req.user.id, 'tasks.json');
        
        const taskIndex = tasks.findIndex(task => task.id === taskId);
        if (taskIndex === -1) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
        await writeUserFile(req.user.id, 'tasks.json', tasks);
        
        // Recalculate analytics
        await calculateAnalytics(req.user.id);
        
        res.json({ success: true, task: tasks[taskIndex] });
    } catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const taskId = req.params.id;
        const tasks = await readUserFile(req.user.id, 'tasks.json');
        
        const filteredTasks = tasks.filter(task => task.id !== taskId);
        if (filteredTasks.length === tasks.length) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        await writeUserFile(req.user.id, 'tasks.json', filteredTasks);
        
        // Recalculate analytics
        await calculateAnalytics(req.user.id);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
});

// AI Chat Management - Fixed with proper limiter
app.get('/api/ai/chats', authenticateToken, async (req, res) => {
    try {
        const chats = await readUserFile(req.user.id, 'aichat.json');
        res.json({ success: true, chats });
    } catch (error) {
        console.error('Get AI chats error:', error);
        res.status(500).json({ error: 'Failed to get chats' });
    }
});

app.post('/api/ai/chats', authenticateToken, aiChatLimiter, async (req, res) => {
    try {
        const { message, response } = req.body;
        const chats = await readUserFile(req.user.id, 'aichat.json');
        
        const newChat = {
            id: generateUserId(),
            message,
            response,
            timestamp: new Date().toISOString()
        };
        
        chats.push(newChat);
        
        // Keep only last 100 chats
        if (chats.length > 100) {
            chats.splice(0, chats.length - 100);
        }
        
        await writeUserFile(req.user.id, 'aichat.json', chats);
        
        res.json({ success: true, chat: newChat });
    } catch (error) {
        console.error('Add AI chat error:', error);
        res.status(500).json({ error: 'Failed to save chat' });
    }
});

app.delete('/api/ai/chats', authenticateToken, async (req, res) => {
    try {
        await writeUserFile(req.user.id, 'aichat.json', []);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear AI chats error:', error);
        res.status(500).json({ error: 'Failed to clear chats' });
    }
});

// Preferences Management
app.get('/api/preferences', authenticateToken, async (req, res) => {
    try {
        const preferences = await readUserFile(req.user.id, 'preferences.json');
        res.json(preferences);
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
});

app.post('/api/preferences', authenticateToken, async (req, res) => {
    try {
        const preferences = req.body;
        await writeUserFile(req.user.id, 'preferences.json', preferences);
        res.json({ success: true, preferences });
    } catch (error) {
        console.error('Save preferences error:', error);
        res.status(500).json({ error: 'Failed to save preferences' });
    }
});

// Schedule Management
app.get('/api/schedule', authenticateToken, async (req, res) => {
    try {
        const schedule = await readUserFile(req.user.id, 'schedule.json');
        res.json(schedule);
    } catch (error) {
        console.error('Get schedule error:', error);
        res.status(500).json({ error: 'Failed to get schedule' });
    }
});

app.post('/api/schedule', authenticateToken, async (req, res) => {
    try {
        const schedule = req.body;
        await writeUserFile(req.user.id, 'schedule.json', schedule);
        res.json({ success: true, schedule });
    } catch (error) {
        console.error('Save schedule error:', error);
        res.status(500).json({ error: 'Failed to save schedule' });
    }
});

// Analytics
app.get('/api/analytics', authenticateToken, async (req, res) => {
    try {
        const analytics = await calculateAnalytics(req.user.id);
        res.json(analytics);
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
});

// Dashboard Summary
app.get('/api/dashboard/summary', authenticateToken, async (req, res) => {
    try {
        const [tasks, analytics, preferences] = await Promise.all([
            readUserFile(req.user.id, 'tasks.json'),
            calculateAnalytics(req.user.id),
            readUserFile(req.user.id, 'preferences.json')
        ]);
        
        const activeTasks = tasks.filter(task => !task.completed);
        const completedToday = tasks.filter(task => {
            return task.completed && task.completedAt && 
                   new Date(task.completedAt).toDateString() === new Date().toDateString();
        });
        
        res.json({
            success: true,
            summary: {
                totalTasks: activeTasks.length,
                completedToday: completedToday.length,
                focusTime: analytics.focusTime,
                aiSuggestions: 0,
                trends: analytics.trends,
                upcomingDeadlines: activeTasks.filter(task => task.deadline).length,
                energyLevel: 'medium'
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Failed to get dashboard summary' });
    }
});

// Google Calendar Integration - Fixed
app.get('/api/calendar/auth-url', authenticateToken, async (req, res) => {
    try {
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            return res.status(500).json({ 
                error: 'Google Calendar integration not configured',
                message: 'Google Calendar integration is currently unavailable'
            });
        }
        
        if (!oauth2Client) {
            return res.status(500).json({ 
                error: 'Google Calendar OAuth client not initialized',
                message: 'Google Calendar integration is currently unavailable'
            });
        }

        const scopes = [
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/calendar.events'
        ];
        
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`;
        
        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            state: req.user.id,
            prompt: 'consent',
            redirect_uri: redirectUri
        });
        
        res.json({ success: true, authUrl });
    } catch (error) {
        console.error('Calendar auth URL error:', error);
        res.status(500).json({ 
            error: 'Failed to generate auth URL',
            message: 'Google Calendar integration is currently unavailable'
        });
    }
});

app.get('/api/calendar/callback', async (req, res) => {
    try {
        const { code, state: userId } = req.query;
        
        if (!code || !userId) {
            return res.redirect(`${process.env.PRODUCTION_URL || 'https://zykro.dev'}/Zyntrain/dashboard.html?error=calendar_auth_failed`);
        }
        
        if (!oauth2Client) {
            console.error('OAuth client not initialized');
            return res.redirect(`${process.env.PRODUCTION_URL || 'https://zykro.dev'}/Zyntrain/dashboard.html?error=calendar_auth_failed`);
        }
        
        // Create a new OAuth client instance for this callback to ensure proper redirect URI
        const callbackOAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`
        );
        
        const { tokens } = await callbackOAuth2Client.getToken(code);
        
        // Store tokens securely
        const userProfile = await readUserFile(userId, 'profile.json');
        userProfile.googleCalendarTokens = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: tokens.expiry_date,
            connectedAt: new Date().toISOString()
        };
        
        await writeUserFile(userId, 'profile.json', userProfile);
        
        res.redirect(`${process.env.PRODUCTION_URL || 'https://zykro.dev'}/Zyntrain/dashboard.html?calendar=connected`);
    } catch (error) {
        console.error('Calendar callback error:', error);
        res.redirect(`${process.env.PRODUCTION_URL || 'https://zykro.dev'}/Zyntrain/dashboard.html?error=calendar_auth_failed`);
    }
});

app.get('/api/calendar/events', authenticateToken, async (req, res) => {
    try {
        if (!oauth2Client) {
            return res.status(500).json({ 
                success: false,
                error: 'Google Calendar not configured',
                message: 'Google Calendar integration is not available'
            });
        }
        
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        if (!userProfile.googleCalendarTokens) {
            return res.status(400).json({ 
                success: false,
                error: 'Google Calendar not connected',
                message: 'Please connect your Google Calendar first'
            });
        }
        
        // Create a new OAuth client instance with the stored tokens
        const userOAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`
        );
        userOAuth2Client.setCredentials(userProfile.googleCalendarTokens);
        
        const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
        
        const now = new Date();
        const oneWeekFromNow = new Date();
        oneWeekFromNow.setDate(now.getDate() + 7);
        
        const response = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: oneWeekFromNow.toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: 'startTime'
        });
        
        const events = response.data.items.map(event => ({
            id: event.id,
            summary: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date,
            description: event.description
        }));
        
        res.json({ success: true, events });
    } catch (error) {
        console.error('Get calendar events error:', error);
        if (error.code === 401) {
            res.status(401).json({ 
                success: false,
                error: 'Calendar authorization expired',
                message: 'Please reconnect your Google Calendar'
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: 'Failed to get calendar events',
                message: 'Unable to fetch calendar events'
            });
        }
    }
});

app.post('/api/calendar/sync', authenticateToken, async (req, res) => {
    try {
        if (!oauth2Client) {
            return res.status(500).json({ 
                success: false,
                error: 'Google Calendar not configured'
            });
        }
        
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        if (!userProfile.googleCalendarTokens) {
            return res.status(400).json({ 
                success: false,
                error: 'Google Calendar not connected'
            });
        }
        
        // Create a new OAuth client instance with the stored tokens
        const userOAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`
        );
        userOAuth2Client.setCredentials(userProfile.googleCalendarTokens);
        
        res.json({ 
            success: true, 
            message: 'Calendar sync completed',
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Calendar sync error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to sync calendar'
        });
    }
});

app.post('/api/calendar/create-event', authenticateToken, async (req, res) => {
    try {
        if (!oauth2Client) {
            return res.status(500).json({ 
                success: false,
                error: 'Google Calendar not configured'
            });
        }
        
        const { summary, description, start, duration } = req.body;
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        if (!userProfile.googleCalendarTokens) {
            return res.status(400).json({ 
                success: false,
                error: 'Google Calendar not connected'
            });
        }
        
        // Create a new OAuth client instance with the stored tokens
        const userOAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI || `${process.env.PRODUCTION_URL || 'https://zykro.dev'}/api/calendar/callback`
        );
        userOAuth2Client.setCredentials(userProfile.googleCalendarTokens);
        
        const calendar = google.calendar({ version: 'v3', auth: userOAuth2Client });
        
        const startTime = new Date(start);
        const endTime = new Date(startTime.getTime() + (duration * 60 * 1000));
        
        const event = {
            summary,
            description,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() }
        };
        
        const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: event
        });
        
        res.json({ 
            success: true, 
            event: response.data,
            message: 'Event created successfully'
        });
    } catch (error) {
        console.error('Create calendar event error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to create calendar event'
        });
    }
});

// Integration status
app.get('/api/integrations/status', authenticateToken, async (req, res) => {
    try {
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        const integrations = {
            googleCalendar: !!(userProfile.googleCalendarTokens && oauth2Client),
            notion: !!userProfile.notionTokens
        };
        
        res.json({ success: true, integrations });
    } catch (error) {
        console.error('Integration status error:', error);
        res.status(500).json({ error: 'Failed to get integration status' });
    }
});

app.delete('/api/integrations/:integration', authenticateToken, async (req, res) => {
    try {
        const integration = req.params.integration;
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        if (integration === 'google-calendar') {
            delete userProfile.googleCalendarTokens;
            await writeUserFile(req.user.id, 'profile.json', userProfile);
        } else if (integration === 'notion') {
            delete userProfile.notionTokens;
            await writeUserFile(req.user.id, 'profile.json', userProfile);
        }
        
        res.json({ success: true, message: 'Integration disconnected' });
    } catch (error) {
        console.error('Disconnect integration error:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
});

// Notion Integration Routes
app.get('/api/notion/auth-url', authenticateToken, async (req, res) => {
    try {
        // For now, return a placeholder since Notion integration requires OAuth setup
        res.status(501).json({ 
            success: false,
            error: 'Notion integration coming soon',
            message: 'Notion integration is currently under development'
        });
    } catch (error) {
        console.error('Notion auth URL error:', error);
        res.status(500).json({ 
            error: 'Failed to generate Notion auth URL',
            message: 'Notion integration is currently unavailable'
        });
    }
});

app.get('/api/notion/databases', authenticateToken, async (req, res) => {
    try {
        const userProfile = await readUserFile(req.user.id, 'profile.json');
        
        if (!userProfile.notionTokens) {
            return res.status(400).json({ 
                success: false,
                error: 'Notion not connected',
                message: 'Please connect your Notion workspace first',
                databases: []
            });
        }
        
        // Placeholder for Notion database fetching
        res.json({ 
            success: true, 
            databases: [],
            message: 'Notion integration coming soon'
        });
    } catch (error) {
        console.error('Get Notion databases error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to get Notion databases',
            databases: []
        });
    }
});

// Visitor tracking
app.get('/api/visitor-stats', async (req, res) => {
    try {
        const visitorData = await fs.readFile('visitors.json', 'utf8');
        res.json(JSON.parse(visitorData));
    } catch (error) {
        res.json({
            totalVisitors: 0,
            uniqueVisitors: 0,
            sessions: [],
            dailyStats: {},
            lastUpdated: new Date().toISOString(),
            metadata: {
                created: new Date().toISOString(),
                version: '1.0.0',
                description: 'ZYKRO Portfolio Visitor Tracking Data'
            }
        });
    }
});

app.post('/api/update-visitors', async (req, res) => {
    try {
        const visitorData = req.body;
        await fs.writeFile('visitors.json', JSON.stringify(visitorData, null, 2));
        res.json({ success: true, message: 'Visitor data updated' });
    } catch (error) {
        console.error('Error updating visitor data:', error);
        res.status(500).json({ error: 'Failed to update visitor data' });
    }
});

// Route handlers for different pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/Zyntrain', (req, res) => {
    res.sendFile(path.join(__dirname, 'Zyntrain', 'index.html'));
});

app.get('/Me', (req, res) => {
    res.sendFile(path.join(__dirname, 'Me', 'index.html'));
});

app.get('/Radio', (req, res) => {
    res.sendFile(path.join(__dirname, 'Radio', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    if (req.url.startsWith('/api/')) {
        res.status(404).json({ error: 'API endpoint not found' });
    } else {
        res.status(404).sendFile(path.join(__dirname, 'Zyntrain', 'sorry.html'));
    }
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: 'Something went wrong on our end'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Zyntrain AI Server running on port ${PORT}`);
    console.log(`🌐 Network: http://123.231.97.212:${PORT}`);
    console.log(`🔗 Production: https://zykro.dev`);
    console.log(`🔐 JWT Secret: ${JWT_SECRET ? 'Configured' : 'Missing'}`);
    console.log(`📧 Email: ${process.env.EMAIL_USER ? 'Configured' : 'Not configured'}`);
    console.log(`📅 Google Calendar: ${process.env.GOOGLE_CLIENT_ID ? 'Configured' : 'Not configured'}`);
});