// models/userdetails.js
const db = require('../utils/dbutils');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

class UserDetails {
    // === PARSE SOCIAL MEDIA ===
    static _parseSocialMedia(linkString) {
        if (Array.isArray(linkString)) {
            return linkString;
        }

        const raw = linkString == null ? '' : String(linkString).trim();

        // Check if valid JSON string
        if (raw && raw.startsWith('[') && raw.endsWith(']') && raw.includes('"link"') && raw.includes('"type"')) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch (e) {
                console.error('JSON Parse failed:', e.message);
            }
        }

        // Empty cases
        if (!raw || raw === '' || raw === 'NULL' || raw === '[]' || raw === '[object Object]') {
            return [];
        }

        // Final try
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        } catch (error) {
            console.error('JSON Parse Error:', error.message, '| Raw:', raw);
            return [];
        }

        return [];
    }

    // === DETERMINE ROLE FROM POSITION ===
    static _determineRole(position) {
        if (!position || typeof position !== 'string') {
            return 'level1';
        }
        
        const posLower = position.toLowerCase().trim();
        
        // Check for superadmin positions
        const superadminKeywords = ['admin', 'super', 'administrator', 'sysadmin', 'root'];
        if (superadminKeywords.some(keyword => posLower.includes(keyword))) {
            return 'superadmin';
        }
        
        // Check for level2/manager positions
        const level2Keywords = ['manager', 'level2', 'moderator', 'editor', 'supervisor'];
        if (level2Keywords.some(keyword => posLower.includes(keyword))) {
            return 'level2';
        }
        
        // Default to level1
        return 'level1';
    }

    // === GET PERMISSIONS BASED ON ROLE ===
    static _getPermissions(role) {
        switch(role) {
            case 'superadmin':
                return ['superaccount_only'];
            case 'level2':
                return ['category', 'brand', 'model', 'article'];
            case 'level1':
            default:
                return ['article'];
        }
    }

    // === CREATE USER ===
    static async createUser(userData, profileImagePath = null) {
        const { name, username, password, position } = userData;
        if (!name || !username || !password || !position) {
            throw new Error('All fields are required');
        }

        const [existing] = await db.execute('SELECT user_id FROM usertable WHERE username = ?', [username.trim()]);
        if (existing.length > 0) throw new Error('Username already taken');

        const hashedPassword = await bcrypt.hash(password, 12);
        
        const [result] = await db.execute(
            `INSERT INTO usertable (name, username, password, position, profile_picture, bio, social_media, created_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())`,
            [name.trim(), username.trim(), hashedPassword, position, profileImagePath, '', '[]']
        );
        return result.insertId;
    }

    // === AUTHENTICATE USER ===
    static async authenticateUser(username, password) {
        const [rows] = await db.execute(
            `SELECT user_id, name, username, password, position, profile_picture, bio, social_media, created_date 
             FROM usertable WHERE username = ?`, 
            [username]
        );
        
        if (rows.length === 0) {
            console.log(`User not found: ${username}`);
            return { error: 'user_not_found' };
        }

        const user = rows[0];
        console.log(`User found: ${user.username}, Position: ${user.position}`);
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Password mismatch for user: ${username}`);
            return { error: 'wrong_password' };
        }

        // Remove password from user object
        const { password: _, ...userWithoutPassword } = user;
        
        // Determine role from position
        const role = this._determineRole(user.position);
        const permissions = this._getPermissions(role);
        
        userWithoutPassword.role = role;
        userWithoutPassword.permissions = permissions;
        userWithoutPassword.socialMedia = this._parseSocialMedia(user.social_media);
        userWithoutPassword.profilePicture = user.profile_picture || '/images/default-avatar.png';
        
        console.log(`Authentication successful. Role: ${role}, Permissions:`, permissions);
        return userWithoutPassword;
    }

    // === GET USER BY ID ===
    static async getUserById(id) {
        const [rows] = await db.execute(
            `SELECT user_id, name, username, position, profile_picture, bio, social_media, created_date 
             FROM usertable WHERE user_id = ?`,
            [id]
        );
        
        if (rows.length === 0) return null;

        const user = rows[0];
        
        // Determine role from position
        const role = this._determineRole(user.position);
        const permissions = this._getPermissions(role);
        
        user.role = role;
        user.permissions = permissions;
        user.socialMedia = this._parseSocialMedia(user.social_media);
        user.profilePicture = user.profile_picture || '/images/default-avatar.png';
        
        return user;
    }

    // === GET ALL USERS ===
    static async getAllUsers() {
        const [rows] = await db.execute(`
            SELECT user_id, name, username, position, profile_picture, created_date, social_media 
            FROM usertable ORDER BY created_date DESC
        `);
        
        return rows.map(user => {
            const role = this._determineRole(user.position);
            return {
                ...user,
                role: role,
                profilePicture: user.profile_picture || '/images/default-avatar.png',
                socialMedia: this._parseSocialMedia(user.social_media)
            };
        });
    }

    // === UPDATE USER ===
    static async updateUser(id, userData, profileImagePath = null) {
        let queryParts = [];
        let params = [];

        if (userData.name !== undefined) { 
            queryParts.push('name = ?'); 
            params.push(userData.name.trim()); 
        }
        if (userData.username !== undefined) { 
            queryParts.push('username = ?'); 
            params.push(userData.username.trim()); 
        }
        if (userData.position !== undefined) { 
            queryParts.push('position = ?'); 
            params.push(userData.position.trim()); 
        }
        if (userData.bio !== undefined) { 
            queryParts.push('bio = ?'); 
            params.push((userData.bio || '').trim().substring(0, 150)); 
        }
        if (userData.social_media !== undefined) { 
            const value = typeof userData.social_media === 'string' 
                ? userData.social_media 
                : JSON.stringify(Array.isArray(userData.social_media) ? userData.social_media : []);
            queryParts.push('social_media = ?'); 
            params.push(value); 
        }
        if (profileImagePath) { 
            queryParts.push('profile_picture = ?'); 
            params.push(profileImagePath); 
        }

        if (queryParts.length === 0) return;

        const query = `UPDATE usertable SET ${queryParts.join(', ')} WHERE user_id = ?`;
        params.push(id);

        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) throw new Error('User not found');
    }

    // === UPDATE PASSWORD ===
    static async updatePassword(id, currentPassword, newPassword) {
        const [rows] = await db.execute(`SELECT password FROM usertable WHERE user_id = ?`, [id]);
        if (rows.length === 0) return false;

        const isMatch = await bcrypt.compare(currentPassword, rows[0].password);
        if (!isMatch) return false;

        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        await db.execute(`UPDATE usertable SET password = ? WHERE user_id = ?`, [hashedNewPassword, id]);
        return true;
    }

    // === DELETE USER ===
    static async deleteUser(id) {
        const [user] = await db.execute(`SELECT profile_picture FROM usertable WHERE user_id = ?`, [id]);
        if (user[0]?.profile_picture && user[0].profile_picture.startsWith('/uploads/profiles/')) {
            const filePath = path.join(__dirname, '../../public', user[0].profile_picture);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await db.execute(`DELETE FROM usertable WHERE user_id = ?`, [id]);
    }

    // === FIND USER BY USERNAME ===
    static async findByUsername(username) {
        const [rows] = await db.execute(
            `SELECT user_id, name, username, position, profile_picture, created_date 
             FROM usertable WHERE username = ?`,
            [username]
        );
        
        if (rows.length === 0) return null;
        
        const user = rows[0];
        const role = this._determineRole(user.position);
        const permissions = this._getPermissions(role);
        
        return {
            ...user,
            role: role,
            permissions: permissions,
            profilePicture: user.profile_picture || '/images/default-avatar.png'
        };
    }

    // === CHECK IF USER EXISTS ===
    static async userExists(username) {
        const [rows] = await db.execute(
            `SELECT COUNT(*) as count FROM usertable WHERE username = ?`,
            [username]
        );
        return rows[0].count > 0;
    }

    // === GET USER ROLE FOR SESSION ===
    static async getUserRoleForSession(userId) {
        const user = await this.getUserById(userId);
        if (!user) return null;
        
        return {
            role: user.role,
            permissions: user.permissions,
            name: user.name,
            username: user.username,
            position: user.position,
            profilePicture: user.profilePicture
        };
    }

    // Vehicle type name बाट data लिन
static async getVehicleTypeByName(vehicleTypeName) {
    const [rows] = await db.execute(
        `SELECT vehicle_type_id, vehicle_type_name, vehicle_type_photo_path 
         FROM vehicletype 
         WHERE LOWER(REPLACE(vehicle_type_name, ' ', '-')) = LOWER(?) 
            OR LOWER(vehicle_type_name) = LOWER(?)`,
        [vehicleTypeName, vehicleTypeName]
    );
    return rows[0] || null;
}

}

module.exports = UserDetails;