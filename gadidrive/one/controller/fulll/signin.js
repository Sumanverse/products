// controller/fulll/signin.js
const Country = require('../../models/country');

exports.getSignin = async (req, res) => {
    try {
        // Check if user is already logged in
        if (req.session && req.session.user) {
            // Redirect based on NEW permission system
            if (req.session.user.role === 'superadmin') {
                // Superadmin: superaccount मात्र
                return res.redirect('/admin/superaccount');
            } else if (req.session.user.role === 'level2') {
                // Level 2: article, category, brand, model
                return res.redirect('/profile');
            } else {
                // Level 1: article मात्र
                return res.redirect('/profile');
            }
        }
        
        // Check if user has a valid token cookie (for backward compatibility)
        if (req.cookies && req.cookies.token) {
            try {
                const jwt = require('jsonwebtoken');
                const token = req.cookies.token;
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gadidrive_superaccount_secret');
                
                // If it's the special admin user
                if (decoded.userId === 0 && decoded.role === 'superadmin') {
                    console.log('Valid admin token found, creating session');
                    
                    // Create session from token
                    req.session.user = { 
                        user_id: 0, 
                        role: 'superadmin', 
                        name: 'Admin',
                        username: 'admin',
                        position: 'Super Administrator',
                        permissions: ['all'],
                        profilePicture: '/images/default-avatar.png',
                        loginTime: new Date().toISOString()
                    };
                    req.session.lastActivity = Date.now();
                    
                    return res.redirect('/admin/superaccount');
                }
            } catch (error) {
                console.log('Invalid or expired token:', error.message);
                // Clear invalid token
                res.clearCookie('token');
            }
        }
        
        // Get all countries for footer selector
        const allCountries = await Country.getAll();
        
        // Get flash messages (if any)
        const errorFlash = req.flash('error_msg');
        const successFlash = req.flash('success_msg');

        // Map query error codes to human-readable messages
        const errorMessages = {
            'user_not_found': 'User not found. Please check your username.',
            'wrong_password': 'Wrong password. Please try again.',
            'invalid': 'Invalid credentials. Please try again.'
        };
        const queryError = req.query.error ? (errorMessages[req.query.error] || 'Login failed. Please try again.') : null;
        
        // Prepare data for the signin view
        const viewData = {
            title: 'Sign In - gadidrive',
            path: '/signin',
            description: 'Sign in to GadiDrive employee portal',
            keywords: 'GadiDrive signin, employee login, automotive portal Nepal',
            error_msg: queryError || (errorFlash.length > 0 ? errorFlash[0] : null),
            success_msg: successFlash.length > 0 ? successFlash[0] : null,
            error: null,
            message: req.query.message || null,
            user: null,
            username: req.cookies.remember_username || '',
            country: null,
            allCountries: allCountries,
            allVehicleTypes: []
        };

        
        console.log('Rendering signin page (user not logged in)');
        
        // Render the signin page
        res.render('signin', viewData);
        
    } catch (error) {
        console.error('Error in signin page:', error);
        
        // Fallback: कमसेकम allCountries त पठाउने
        let allCountries = [];
        try {
            allCountries = await Country.getAll();
        } catch (err) {
            console.error('Error fetching countries:', err);
        }
        
        res.render('signin', {
            title: 'Sign In - gadidrive',
            path: '/signin',
            description: 'Sign in to GadiDrive employee portal',
            keywords: 'GadiDrive signin, employee login',
            error_msg: null,
            success_msg: null,
            error: 'Something went wrong. Please try again.',
            message: null,
            user: null,
            username: '',
            country: null,
            allCountries: allCountries,
            allVehicleTypes: []
        });
    }
};