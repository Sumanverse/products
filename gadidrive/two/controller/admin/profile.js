const UserDetails = require('../../models/userdetails');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Country = require('../../models/country'); // Add this for footer

// GET PROFILE PAGE
exports.getProfile = async (req, res) => {
    try {
        console.log('Fetching profile for user ID:', req.user.user_id);
        
        const user = await UserDetails.getUserById(req.user.user_id);
        if (!user) {
            console.log('User not found, redirecting to login');
            return res.redirect('/signin');
        }

        // Get all countries for footer selector (if needed)
        const allCountries = await Country.getAll();

        console.log('Profile data fetched successfully:', {
            id: user.user_id,
            name: user.name,
            username: user.username,
            socialMediaCount: Array.isArray(user.socialMedia) ? user.socialMedia.length : 0
        });

        res.render('admin/profile', { 
            user,
            title: `gadidrive - ${user.name}'s Profile`,
            path: '/profile',  // यो path पठाउनुहोस्
            description: `Profile page for ${user.name} | GadiDrive`,
            keywords: 'user profile, gadidrive profile, automotive enthusiast',
            country: null,  // Admin panel को लागि country null
            allCountries: allCountries,  // Footer को लागि
            allVehicleTypes: []  // Navbar को लागि optional
        });
    } catch (err) {
        console.error('Get Profile Error:', err);
        res.status(500).render('error', { 
            message: 'Unable to load profile',
            error: err.message,
            path: '/error'  // Error page को लागि path
        });
    }
};

// UPDATE PROFILE PICTURE - SIMPLIFIED AND WORKING
exports.updateProfilePicture = async (req, res) => {
    try {
        console.log('Updating profile picture for user:', req.user.user_id);
        
        if (!req.file) {
            console.log('No file uploaded');
            return res.status(400).json({ 
                success: false, 
                message: 'कृपया फोटो छान्नुहोस्' 
            });
        }

        // Validate file
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(req.file.mimetype)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ 
                success: false, 
                message: 'केवल JPG, PNG, GIF, वेबपी फोटोहरू मात्र स्वीकार्य छन्' 
            });
        }

        // Get old user data
        const oldUser = await UserDetails.getUserById(req.user.user_id);
        
        // Delete old profile picture if exists and not default
        if (oldUser && oldUser.profilePicture && 
            !oldUser.profilePicture.includes('default-avatar.png') &&
            fs.existsSync(path.join(__dirname, '../../public', oldUser.profilePicture))) {
            
            const oldPath = path.join(__dirname, '../../public', oldUser.profilePicture);
            fs.unlink(oldPath, (err) => {
                if (err) console.error('Error deleting old photo:', err);
                else console.log('Old photo deleted:', oldPath);
            });
        }

        // Create new path
        const newPath = `/uploads/profiles/${req.file.filename}`;
        console.log('New profile picture path:', newPath);

        // Update in database
        await UserDetails.updateUser(req.user.user_id, {}, newPath);

        return res.json({
            success: true,
            message: 'Profile photo सफलतापूर्वक बद्लियो!',
            picture: newPath
        });

    } catch (err) {
        console.error('Profile Picture Update Error:', err);
        
        // Delete uploaded file if error occurred
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        
        return res.status(500).json({ 
            success: false, 
            message: 'Server error, फेरि प्रयास गर्नुहोस्' 
        });
    }
};

// UPDATE NAME
exports.updateName = async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'नाम लेख्नुहोस्' 
            });
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            return res.status(400).json({ 
                success: false, 
                message: 'नाम कम्तीमा २ अक्षरको हुनुपर्छ' 
            });
        }

        await UserDetails.updateUser(req.user.user_id, { name: trimmedName });
        
        console.log('Name updated for user:', req.user.user_id, 'New name:', trimmedName);
        
        res.json({ 
            success: true, 
            message: 'नाम सफलतापूर्वक बद्लियो!', 
            name: trimmedName 
        });
    } catch (err) {
        console.error('Update Name Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'केही गडबड भयो' 
        });
    }
};

// UPDATE USERNAME
exports.updateUsername = async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || !username.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username लेख्नुहोस्' 
            });
        }

        const trimmedUsername = username.trim().toLowerCase();
        
        // Check username length
        if (trimmedUsername.length < 3) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username कम्तीमा ३ अक्षरको हुनुपर्छ' 
            });
        }

        // Check if username already exists (excluding current user)
        const db = require('../../utils/dbutils');
        const [existing] = await db.execute(
            'SELECT user_id FROM usertable WHERE username = ? AND user_id != ?',
            [trimmedUsername, req.user.user_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'यो username पहिल्यै लिइएको छ' 
            });
        }

        // Update username
        await UserDetails.updateUser(req.user.user_id, { username: trimmedUsername });
        
        console.log('Username updated for user:', req.user.user_id, 'New username:', trimmedUsername);
        
        res.json({ 
            success: true, 
            message: 'Username सफलतापूर्वक बद्लियो!', 
            username: trimmedUsername 
        });
    } catch (err) {
        console.error('Update Username Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'केही गडबड भयो' 
        });
    }
};

// UPDATE BIO
exports.updateBio = async (req, res) => {
    try {
        const { bio } = req.body;
        
        // Allow empty bio but trim it
        const safeBio = (bio || '').trim().substring(0, 150);
        
        await UserDetails.updateUser(req.user.user_id, { bio: safeBio });
        
        console.log('Bio updated for user:', req.user.user_id);
        
        res.json({ 
            success: true, 
            message: 'Bio सफलतापूर्वक बद्लियो!', 
            bio: safeBio || 'No bio yet...' 
        });
    } catch (err) {
        console.error('Update Bio Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'केही गडबड भयो' 
        });
    }
};

// UPDATE SOCIAL MEDIA - FIXED VERSION
exports.updateSocialMedia = async (req, res) => {
    try {
        console.log('Social media update request for user:', req.user.user_id);
        console.log('Request body:', req.body);
        
        let { socialMedia } = req.body;
        
        // Ensure socialMedia is an array
        if (!Array.isArray(socialMedia)) {
            console.log('socialMedia is not array, converting');
            socialMedia = [];
        }

        // Validate and clean social media data
        const validSocialMedia = socialMedia
            .filter(social => social && typeof social === 'object')
            .map(social => ({
                type: (social.type || '').trim().toLowerCase(),
                link: (social.link || '').trim()
            }))
            .filter(social => {
                // Validate required fields
                if (!social.type || !social.link) {
                    console.log('Invalid social media entry (missing type/link):', social);
                    return false;
                }
                
                // Validate URL format
                const urlPattern = /^https?:\/\/.+/i;
                if (!urlPattern.test(social.link)) {
                    console.log('Invalid URL format:', social.link);
                    return false;
                }
                
                // Validate social media type
                const validTypes = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'website', 'other'];
                if (!validTypes.includes(social.type)) {
                    console.log('Invalid social media type:', social.type);
                    return false;
                }
                
                return true;
            });

        console.log('Valid social media after filtering:', validSocialMedia);

        // Limit to 6 social media links
        if (validSocialMedia.length > 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Maximum 6 social media links allowed' 
            });
        }

        // Update in database
        await UserDetails.updateUser(req.user.user_id, { 
            social_media: JSON.stringify(validSocialMedia) 
        });

        console.log('Social media updated successfully for user:', req.user.user_id);
        
        res.json({ 
            success: true, 
            message: 'Social links सफलतापूर्वक बचत भयो!', 
            socialMedia: validSocialMedia 
        });
    } catch (err) {
        console.error('Social Media Update Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'केही गडबड भयो' 
        });
    }
};

// UPDATE PASSWORD
exports.updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        console.log('Password change request for user:', req.user.user_id);

        // Validation
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'दुवै password लेख्नुहोस्' 
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password कम्तीमा ६ अक्षरको हुनुपर्छ' 
            });
        }

        // Check if new password is same as current
        if (currentPassword === newPassword) {
            return res.status(400).json({ 
                success: false, 
                message: 'नयाँ password पुरानो जस्तै हुनु हुँदैन' 
            });
        }

        // Update password
        const success = await UserDetails.updatePassword(
            req.user.user_id, 
            currentPassword, 
            newPassword
        );

        if (!success) {
            return res.status(400).json({ 
                success: false, 
                message: 'हालको password गलत छ' 
            });
        }

        console.log('Password updated successfully for user:', req.user.user_id);
        
        res.json({
            success: true,
            message: 'Password सफलतापूर्वक बद्लियो!'
        });
    } catch (err) {
        console.error('Update Password Error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'केही गडबड भयो' 
        });
    }
};

// ADMIN PANEL REDIRECT
exports.getAdminCategory = (req, res) => {
    try {
        const position = req.user.position;
        console.log('Admin redirect for position:', position);
        
        const routeMap = {
            'admin': '/admin/superaccount',
            'level1': '/admin/article',
            'level2': '/admin/category',
            'level3': '/admin/level3am'
        };

        const redirectTo = routeMap[position] || '/admin/category';
        console.log('Redirecting to:', redirectTo);
        
        res.redirect(redirectTo);
    } catch (err) {
        console.error('Admin redirect error:', err);
        res.redirect('/profile');
    }
};