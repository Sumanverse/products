const db = require('../utils/dbutils');
const path = require('path');
const fs = require('fs');

class Brand {
    static async safeDeleteImage(imagePath) {
        if (!imagePath) return;
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM brands WHERE image_path = ?', [imagePath]);
        if (rows[0].count <= 1) { // 1 means only current or no other uses it
            const filePath = path.join(__dirname, '../public', imagePath);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    // Create new brand with country
    static async createBrand(brandName, vehicleTypeId, countryId = null, imagePath = null, authorName) {
        const [author] = await db.execute('SELECT user_id FROM usertable WHERE name = ?', [authorName]);
        if (!author[0]) throw new Error('Author not found.');

        const exists = await this.brandExists(brandName, vehicleTypeId, countryId);
        if (exists) {
            throw new Error(`Brand "${brandName}" already exists for this vehicle type and country!`);
        }

        const [result] = await db.execute(
            'INSERT INTO brands (name, image_path, vehicle_type_id, country_id, author_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [brandName, imagePath, vehicleTypeId, countryId || null, author[0].user_id]
        );
        return result.insertId;
    }

    // Check if brand exists
    static async brandExists(brandName, vehicleTypeId, countryId, excludeId = null) {
        let query = `SELECT brand_id FROM brands 
                     WHERE LOWER(name) = LOWER(?) 
                     AND vehicle_type_id = ? 
                     AND (country_id = ? OR (country_id IS NULL AND ? IS NULL))`;
        let params = [brandName, vehicleTypeId, countryId, countryId];
        
        if (excludeId) {
            query += ' AND brand_id != ?';
            params.push(excludeId);
        }
        
        const [rows] = await db.execute(query, params);
        return rows.length > 0;
    }

    // Get all brands with country info
    static async getAllBrands() {
        const [rows] = await db.execute(`
            SELECT b.brand_id, b.name, b.image_path, b.vehicle_type_id, b.country_id,
                   v.vehicle_type_name, co.country_name, co.currency_symbol, u.name AS author_name
            FROM brands b
            JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
            LEFT JOIN countries co ON b.country_id = co.id
            JOIN usertable u ON b.author_id = u.user_id
            ORDER BY b.created_at DESC
        `);
        return rows;
    }

    // Get brands by vehicle type (with optional country filter)
    static async getBrandsByVehicleType(vehicleTypeId, countryId = null) {
        let query = `
            SELECT b.brand_id, b.name, b.image_path, b.vehicle_type_id, b.country_id,
                   v.vehicle_type_name, co.country_name, u.name AS author_name
            FROM brands b
            JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
            LEFT JOIN countries co ON b.country_id = co.id
            JOIN usertable u ON b.author_id = u.user_id
            WHERE b.vehicle_type_id = ?
        `;
        let params = [vehicleTypeId];
        
        if (countryId) {
            query += ` AND (b.country_id = ? OR b.country_id IS NULL)`;
            params.push(countryId);
        }
        
        query += ` ORDER BY b.name ASC`;
        
        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Get brand by ID with country info
    static async getBrandById(id) {
        const [rows] = await db.execute(
            `SELECT b.*, v.vehicle_type_name, co.country_name, u.name AS author_name
             FROM brands b
             JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
             LEFT JOIN countries co ON b.country_id = co.id
             JOIN usertable u ON b.author_id = u.user_id
             WHERE b.brand_id = ?`, [id]
        );
        return rows[0] || null;
    }

    // Update brand with country
    static async updateBrand(id, brandName, vehicleTypeId, countryId = null, imagePath = null, authorName) {
        const [author] = await db.execute('SELECT user_id FROM usertable WHERE name = ?', [authorName]);
        if (!author[0]) throw new Error('Author not found.');

        const exists = await this.brandExists(brandName, vehicleTypeId, countryId, id);
        if (exists) {
            throw new Error(`Brand "${brandName}" already exists for this vehicle type and country!`);
        }

        if (imagePath) {
            const [old] = await db.execute('SELECT image_path FROM brands WHERE brand_id = ?', [id]);
            if (old[0]?.image_path && old[0].image_path !== imagePath) {
                await this.safeDeleteImage(old[0].image_path);
            }
            await db.execute(
                'UPDATE brands SET name = ?, image_path = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE brand_id = ?',
                [brandName, imagePath, vehicleTypeId, countryId || null, author[0].user_id, id]
            );
        } else {
            await db.execute(
                'UPDATE brands SET name = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE brand_id = ?',
                [brandName, vehicleTypeId, countryId || null, author[0].user_id, id]
            );
        }
    }

    // Delete brand
    static async deleteBrand(id) {
        const [models] = await db.execute('SELECT COUNT(*) as count FROM models WHERE brand_id = ?', [id]);
        if (models[0].count > 0) {
            throw new Error(`Cannot delete brand because it has ${models[0].count} model(s) associated.`);
        }

        const [brand] = await db.execute('SELECT image_path FROM brands WHERE brand_id = ?', [id]);
        if (brand[0]?.image_path) {
            await this.safeDeleteImage(brand[0].image_path);
        }
        await db.execute('DELETE FROM brands WHERE brand_id = ?', [id]);
    }

    // ✅ FIXED: Get brand by name with country AND vehicle type context
    static async getBrandByName(brandName, countryId = null, vehicleTypeId = null) {
        let query = `
            SELECT b.*, v.vehicle_type_name, co.country_name, u.name AS author_name
            FROM brands b
            JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
            LEFT JOIN countries co ON b.country_id = co.id
            LEFT JOIN usertable u ON b.author_id = u.user_id
            WHERE (
                LOWER(REPLACE(b.name, ' ', '-')) = LOWER(?)
                OR LOWER(b.name) = LOWER(?)
            )
        `;
        let params = [brandName, brandName];

        // ✅ vehicleTypeId filter — Fixed to match by NAME to handle duplicate vehicle types
        if (vehicleTypeId) {
            query += ` AND LOWER(v.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)`;
            params.push(vehicleTypeId);
        }

        // ✅ countryId filter — Bug 2 fix (same name, different country)
        if (countryId) {
            query += ` AND (b.country_id = ? OR b.country_id IS NULL)`;
            params.push(countryId);
        }

        // Country-specific brand lai priority deu (NULL last)
        query += ` ORDER BY b.country_id IS NULL ASC LIMIT 1`;

        const [rows] = await db.execute(query, params);
        return rows[0] || null;
    }

    // Get brands by country
    static async getBrandsByCountry(countryId) {
        const [rows] = await db.execute(`
            SELECT b.*, v.vehicle_type_name, co.country_name, u.name AS author_name
            FROM brands b
            JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
            LEFT JOIN countries co ON b.country_id = co.id
            JOIN usertable u ON b.author_id = u.user_id
            WHERE b.country_id = ? OR b.country_id IS NULL
            ORDER BY b.name ASC
        `, [countryId]);
        return rows;
    }

    // Get brand statistics by country
    static async getBrandStats(countryId = null) {
        let query = `
            SELECT 
                COUNT(*) AS total_brands,
                COUNT(DISTINCT vehicle_type_id) AS vehicle_types_covered
            FROM brands
            WHERE 1=1
        `;
        let params = [];
        
        if (countryId) {
            query += ` AND (country_id = ? OR country_id IS NULL)`;
            params.push(countryId);
        }
        
        const [rows] = await db.execute(query, params);
        return rows[0] || { total_brands: 0, vehicle_types_covered: 0 };
    }

    // Import brand from one country to another
    static async importBrand(sourceBrandId, targetCountryId, targetVehicleTypeId, authorName) {
        const sourceBrand = await this.getBrandById(sourceBrandId);
        if (!sourceBrand) throw new Error('Source brand not found.');

        const [author] = await db.execute('SELECT user_id FROM usertable WHERE name = ?', [authorName]);
        if (!author[0]) throw new Error('Author not found.');

        // Check if a brand with the exact same name already exists in target
        let existsQuery = `SELECT brand_id, image_path FROM brands 
                           WHERE LOWER(name) = LOWER(?) AND vehicle_type_id = ?`;
        let existsParams = [sourceBrand.name, targetVehicleTypeId];
        
        if (targetCountryId) {
            existsQuery += ` AND (country_id = ? OR country_id IS NULL)`;
            existsParams.push(targetCountryId);
        } else {
            existsQuery += ` AND country_id IS NULL`;
        }
        existsQuery += ` ORDER BY country_id IS NULL ASC LIMIT 1`;

        const [existing] = await db.execute(existsQuery, existsParams);

        if (existing && existing.length > 0) {
            // Overwrite existing brand
            const targetBrandId = existing[0].brand_id;
            const oldImagePath = existing[0].image_path;

            // Delete old image only if it's different from the new one and not shared
            if (oldImagePath && oldImagePath !== sourceBrand.image_path) {
                await this.safeDeleteImage(oldImagePath);
            }

            await db.execute(
                'UPDATE brands SET name = ?, image_path = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE brand_id = ?',
                [sourceBrand.name, sourceBrand.image_path, targetVehicleTypeId, targetCountryId || null, author[0].user_id, targetBrandId]
            );
            return { action: 'updated', brandId: targetBrandId };
        } else {
            // Insert new brand
            const [result] = await db.execute(
                'INSERT INTO brands (name, image_path, vehicle_type_id, country_id, author_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [sourceBrand.name, sourceBrand.image_path, targetVehicleTypeId, targetCountryId || null, author[0].user_id]
            );
            return { action: 'created', brandId: result.insertId };
        }
    }

    // Get countries where this brand exists (by name and vehicle type)
    static async getCountriesForBrand(brandName, vehicleTypeId) {
        try {
            const [rows] = await db.execute(`
                SELECT DISTINCT c.id, c.country_name, c.currency_symbol
                FROM brands b
                JOIN countries c ON b.country_id = c.id
                JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
                WHERE (LOWER(b.name) = LOWER(?) OR LOWER(REPLACE(b.name, ' ', '-')) = LOWER(?))
                AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
                UNION
                SELECT NULL as id, 'Global' as country_name, NULL as currency_symbol
                FROM brands b
                JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
                WHERE (LOWER(b.name) = LOWER(?) OR LOWER(REPLACE(b.name, ' ', '-')) = LOWER(?))
                AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
                AND b.country_id IS NULL
            `, [brandName, brandName, vehicleTypeId, brandName, brandName, vehicleTypeId]);
            return rows;
        } catch (error) {
            console.error('Error in getCountriesForBrand:', error);
            return [];
        }
    }
}

module.exports = Brand;