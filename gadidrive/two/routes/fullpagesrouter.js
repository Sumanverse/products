// routes/fullpagesrouter.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Controller imports
const about = require('../controller/fulll/about');
const homeglobal = require('../controller/fulll/homeglobal'); // Global home controller
const signinController = require('../controller/fulll/signin');
const profileController = require('../controller/admin/profile');
const privacyController = require('../controller/fulll/privacy');
const termsController = require('../controller/fulll/terms');
const contactController = require('../controller/fulll/contact');

// Middleware
const { auth } = require('../middleware/auth');

// Models
const UserDetails = require('../models/userdetails');

// === MIDDLEWARE TO LOG ROUTES ===
router.use((req, res, next) => {
    console.log('🌍 Fullpage Router hit:', req.method, req.url);
    next();
});

// ===== 1. GLOBAL HOME PAGE (FULL PAGE) =====
router.get('/', homeglobal.getGlobalHome);

// ===== 2. ABOUT PAGE =====
router.get('/about', about.getabout);

// ===== 3. STANDALONE LEGAL & CONTACT PAGES =====
router.get('/privacy-policy', privacyController.getPrivacyPolicy);
router.get('/terms', termsController.getTerms);
router.get('/contact', contactController.getContact);

// ===== 3. SIGNIN PAGE =====
router.get('/signin', signinController.getSignin);

// ===== 4. SIGNIN POST ROUTE =====
router.post('/signin', async (req, res) => {
    try {
        const { username, password, remember } = req.body;

        // Validation
        if (!username || !password) {
            req.flash('error_msg', 'Username र Password दुवै भर्नुहोस्');
            return res.redirect('/signin');
        }

        console.log(`Login attempt for username: ${username}`);

        // ========================================
        // SPECIAL SUPERADMIN LOGIN: admin/admin
        // ========================================
        if (username === 'admin' && password === 'adminaccessgarney') {
            console.log('✅ Superadmin login successful');
            
            // Create session
            req.session.user = { 
                user_id: 0, 
                role: 'superadmin', 
                name: 'Super Admin',
                username: 'admin',
                position: 'Super Administrator',
                permissions: ['all'],
                profilePicture: '/images/default-avatar.png',
                loginTime: new Date().toISOString()
            };
            
            // Set session expiry
            req.session.cookie.maxAge = remember === 'on' ? 
                7 * 24 * 60 * 60 * 1000 : // 7 days
                60 * 60 * 1000; // 1 hour
            
            req.session.lastActivity = Date.now();
            
            // Create JWT token
            const token = jwt.sign(
                { 
                    userId: 0, 
                    username: 'admin', 
                    role: 'superadmin',
                    sessionId: req.sessionID 
                },
                process.env.JWT_SECRET || 'gadidrive_superaccount_secret',
                { expiresIn: remember === 'on' ? '7d' : '1h' }
            );
            
            // Set cookies
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: remember === 'on' ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
                sameSite: 'lax'
            });

            // Remember username if checked
            if (remember === 'on') {
                res.cookie('remember_username', 'admin', {
                    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                });
            }

            req.flash('success_msg', 'Welcome Super Administrator!');
            return res.redirect('/admin/superaccount');
        }

        // ========================================
        // NORMAL USER LOGIN (Database)
        // ========================================
        const user = await UserDetails.authenticateUser(username, password);
        
        if (!user || user.error) {
            if (user && user.error === 'user_not_found') {
                console.log('❌ User not found');
                return res.redirect('/signin?error=user_not_found');
            } else if (user && user.error === 'wrong_password') {
                console.log('❌ Wrong password');
                return res.redirect('/signin?error=wrong_password');
            } else {
                return res.redirect('/signin?error=invalid');
            }
        }

        console.log(`✅ User authenticated: ${user.name}, Role: ${user.role}`);
        
        // Create session
        req.session.user = {
            user_id: user.user_id,
            role: user.role,
            name: user.name,
            username: user.username,
            position: user.position,
            permissions: user.permissions,
            profilePicture: user.profilePicture,
            loginTime: new Date().toISOString()
        };
        
        // Set session expiry
        req.session.cookie.maxAge = remember === 'on' ? 
            7 * 24 * 60 * 60 * 1000 : // 7 days
            60 * 60 * 1000; // 1 hour
        
        req.session.lastActivity = Date.now();
        
        // Create JWT token
        const token = jwt.sign(
            { 
                userId: user.user_id, 
                username: user.username, 
                role: user.role,
                sessionId: req.sessionID 
            },
            process.env.JWT_SECRET || 'gadidrive_superaccount_secret',
            { expiresIn: remember === 'on' ? '7d' : '1h' }
        );
        
        // Set cookies
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: remember === 'on' ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000,
            sameSite: 'lax'
        });

        // Remember username if checked
        if (remember === 'on') {
            res.cookie('remember_username', username, {
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
        }

        // Success message
        req.flash('success_msg', `Welcome ${user.name}!`);
        
        // Redirect based on role
        if (user.role === 'superadmin') {
            return res.redirect('/admin/superaccount');
        } else if (user.role === 'level2') {
            return res.redirect('/profile');
        } else {
            return res.redirect('/profile');
        }
        
    } catch (error) {
        console.error('❌ Signin error:', error);
        req.flash('error_msg', 'Server error. Please try again.');
        return res.redirect('/signin');
    }
});

// ===== 5. PROFILE PAGE =====
router.get('/profile', auth, profileController.getProfile);

// ===== 6. LOGOUT ROUTE =====
router.get('/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.name : 'User';
    
    req.session.destroy();
    res.clearCookie('gadidrive.sid');
    res.clearCookie('token');
    res.clearCookie('remember_username');
    
    res.redirect(`/signin?message=${encodeURIComponent(`${userName} logged out successfully`)}`);
});

module.exports = router;