// middleware/auth.js
const jwt = require('jsonwebtoken');
const UserDetails = require('../models/userdetails');

const auth = async (req, res, next) => {
    try {
        // 1. पहिले session check गर्ने
        if (req.session.user) {
            req.user = req.session.user;
            
            // Session expiry check (1 hour)
            const now = Date.now();
            if (req.session.lastActivity && 
                (now - req.session.lastActivity) > (60 * 60 * 1000)) {
                req.session.destroy();
                return res.redirect('/signin?message=Session expired. Please sign in again.');
            }
            
            req.session.lastActivity = Date.now();
            return next();
        }

        // 2. Token check गर्ने (backward compatibility)
        const token = req.cookies.token;
        if (!token) {
            // IMPORTANT: Original URL save गर्ने ताकि login पछि त्यही page मा जान सकौं
            req.session.returnTo = req.originalUrl;
            return res.redirect('/signin?message=Please sign in to access this page');
        }

        // 3. Token verify गर्ने
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gadidrive_superaccount_secret');
        
        // 4. Special admin check
        if (decoded.userId === 0 && decoded.role === 'superadmin') {
            req.session.user = { 
                user_id: 0, 
                role: 'superadmin', 
                name: 'Admin',
                username: 'admin',
                position: 'Super Administrator',
                permissions: ['superaccount_only'], // SUPERADMIN को लागि केवल यो permission
                profilePicture: '/images/default-avatar.png'
            };
            req.session.lastActivity = Date.now();
            req.user = req.session.user;
            return next();
        }

        // 5. Normal user check
        const user = await UserDetails.getUserById(decoded.userId);
        if (!user) {
            req.session.returnTo = req.originalUrl;
            return res.redirect('/signin?message=User not found. Please sign in again.');
        }

        // 6. Create session - IMPORTANT: User को position अनुसार permissions दिने
        let permissions = [];
        
        switch(user.position) {
            case 'level1':
                permissions = ['article'];
                break;
            case 'level2':
                permissions = ['article', 'category', 'brand', 'model'];
                break;
            case 'level3':
                permissions = ['article', 'category', 'brand', 'model']; // level3 ले पनि यही पाउँछ
                break;
            case 'admin':
                permissions = ['article', 'category', 'brand', 'model', 'superaccount'];
                break;
            default:
                permissions = [];
        }
        
        req.session.user = {
            user_id: user.user_id,
            role: user.role || user.position,
            name: user.name,
            username: user.username,
            position: user.position,
            permissions: permissions,
            profilePicture: user.profilePicture
        };
        req.session.lastActivity = Date.now();
        req.user = req.session.user;
        
        next();
    } catch (error) {
        console.error('Auth error:', error);
        
        // Specific error handling
        if (error.name === 'TokenExpiredError') {
            req.flash('error_msg', 'Your session has expired');
        } else if (error.name === 'JsonWebTokenError') {
            req.flash('error_msg', 'Invalid authentication token');
        } else {
            req.flash('error_msg', 'Authentication failed');
        }
        
        req.session.destroy();
        res.clearCookie('token');
        res.clearCookie('gadidrive.sid');
        res.redirect('/signin');
    }
};

// Role check middleware
const requireRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/signin?message=Please sign in first');
        }
        
        // Superadmin सधैं access पाउँछ (तर केवल superaccount मा मात्र)
        if (req.session.user.role === 'superadmin') {
            return next();
        }
        
        if (roles.length > 0 && !roles.includes(req.session.user.role)) {
            req.flash('error_msg', 'Access denied. You do not have permission to access this page.');
            return res.redirect('/profile');
        }
        
        next();
    };
};

// UPDATED Permission check middleware
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/signin?message=Please sign in first');
        }
        
        const userPermissions = req.session.user.permissions || [];
        
        // SUPERADMIN को लागि विशेष check
        if (req.session.user.role === 'superadmin') {
            // Superadmin ले केवल superaccount access गर्न पाउँछ
            if (permission === 'superaccount') {
                return next();
            } else {
                // अन्य section मा जान खोज्यो भने
                req.flash('error_msg', 'Super Admin can only access SuperAccount section');
                return res.redirect('/admin/superaccount');
            }
        }
        
        // अन्य users को लागि
        if (!userPermissions.includes(permission)) {
            req.flash('error_msg', `You do not have permission to access ${permission} section.`);
            
            // Redirect to appropriate page based on user permissions
            if (userPermissions.includes('superaccount')) {
                return res.redirect('/admin/superaccount');
            } else if (userPermissions.includes('category') || userPermissions.includes('brand') || userPermissions.includes('model')) {
                return res.redirect('/admin/category');
            } else if (userPermissions.includes('article')) {
                return res.redirect('/admin/article');
            } else {
                return res.redirect('/profile');
            }
        }
        
        next();
    };
};

module.exports = {
    auth,
    requireRole,
    requirePermission
};