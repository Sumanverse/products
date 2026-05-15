const db = require('../utils/dbutils');
const path = require('path');
const fs = require('fs');

class Category {
    static async safeDeleteImage(imagePath) {
        if (!imagePath) return;
        const [rows] = await db.execute('SELECT COUNT(*) as count FROM categories WHERE image_path = ?', [imagePath]);
        if (rows[0].count <= 1) { // 1 means only current or no other uses it
            const filePath = path.join(__dirname, '../public', imagePath);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    // Create new category with country
    static async createCategory(categoryName, vehicleTypeId, countryId = null, imagePath = null, authorName) {
        try {
            const [authorRows] = await db.execute(
                `SELECT user_id FROM usertable WHERE name = ? LIMIT 1`,
                [authorName]
            );

            if (!authorRows || authorRows.length === 0) {
                throw new Error('Author not found.');
            }
            const authorId = authorRows[0].user_id;

            // Check if category already exists for this vehicle type and country
            const exists = await this.categoryExists(categoryName, vehicleTypeId, countryId);
            if (exists) {
                throw new Error('Category already exists for this vehicle type and country');
            }

            const [result] = await db.execute(
                `INSERT INTO categories (name, image_path, vehicle_type_id, country_id, author_id, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [categoryName, imagePath, vehicleTypeId, countryId || null, authorId]
            );

            return result.insertId;
        } catch (error) {
            console.error('Error in createCategory:', error.message);
            throw error;
        }
    }

    // Check if category exists
    static async categoryExists(categoryName, vehicleTypeId, countryId, excludeId = null) {
        let query = `SELECT category_id FROM categories 
                     WHERE LOWER(name) = LOWER(?) 
                     AND vehicle_type_id = ? 
                     AND (country_id = ? OR (country_id IS NULL AND ? IS NULL))`;
        let params = [categoryName, vehicleTypeId, countryId, countryId];
        
        if (excludeId) {
            query += ' AND category_id != ?';
            params.push(excludeId);
        }
        
        const [rows] = await db.execute(query, params);
        return rows.length > 0;
    }

    // Get all categories with country info
    static async getAllCategories() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    c.category_id,
                    c.name,
                    c.image_path,
                    c.vehicle_type_id,
                    c.country_id,
                    v.vehicle_type_name,
                    co.country_name,
                    co.currency_symbol,
                    u.name AS author_name
                FROM categories c
                JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
                LEFT JOIN countries co ON c.country_id = co.id
                JOIN usertable u ON c.author_id = u.user_id
                ORDER BY c.created_at DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error in getAllCategories:', error.message);
            throw error;
        }
    }

    // Get category by ID with country info
    static async getCategoryById(id) {
        const [rows] = await db.execute(
            `SELECT c.*, v.vehicle_type_name, co.country_name, u.name AS author_name
             FROM categories c
             JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
             LEFT JOIN countries co ON c.country_id = co.id
             JOIN usertable u ON c.author_id = u.user_id
             WHERE c.category_id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // Get categories by vehicle type and optionally country
    static async getCategoriesByVehicleType(vehicle_type_id, countryId = null) {
        let query = `
            SELECT c.*, v.vehicle_type_name, co.country_name, u.name AS author_name
            FROM categories c
            JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
            LEFT JOIN countries co ON c.country_id = co.id
            JOIN usertable u ON c.author_id = u.user_id
            WHERE c.vehicle_type_id = ?
        `;
        let params = [vehicle_type_id];
        
        if (countryId) {
            query += ` AND (c.country_id = ? OR c.country_id IS NULL)`;
            params.push(countryId);
        }
        
        query += ` ORDER BY c.name ASC`;
        
        const [rows] = await db.execute(query, params);
        return rows;
    }

    // Update category with country
    static async updateCategory(id, categoryName, vehicleTypeId, countryId = null, imagePath = null, authorName) {
        try {
            const [authorRows] = await db.execute(
                `SELECT user_id FROM usertable WHERE name = ? LIMIT 1`,
                [authorName]
            );
            if (!authorRows || authorRows.length === 0) throw new Error('Author not found.');
            const authorId = authorRows[0].user_id;

            // Check if category exists (excluding current)
            const exists = await this.categoryExists(categoryName, vehicleTypeId, countryId, id);
            if (exists) {
                throw new Error('Category already exists for this vehicle type and country');
            }

            let oldImagePath = null;
            if (imagePath) {
                const [oldRows] = await db.execute(`SELECT image_path FROM categories WHERE category_id = ?`, [id]);
                if (oldRows[0]?.image_path) oldImagePath = oldRows[0].image_path;
            }

            if (imagePath) {
                await db.execute(
                    `UPDATE categories SET name = ?, image_path = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE category_id = ?`,
                    [categoryName, imagePath, vehicleTypeId, countryId || null, authorId, id]
                );
            } else {
                await db.execute(
                    `UPDATE categories SET name = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE category_id = ?`,
                    [categoryName, vehicleTypeId, countryId || null, authorId, id]
                );
            }

            if (imagePath && oldImagePath && oldImagePath !== imagePath) {
                await this.safeDeleteImage(oldImagePath);
            }
        } catch (error) {
            console.error('Error in updateCategory:', error.message);
            throw error;
        }
    }

    // Delete category
    static async deleteCategory(id) {
        try {
            const [rows] = await db.execute(`SELECT image_path FROM categories WHERE category_id = ?`, [id]);
            await db.execute(`DELETE FROM categories WHERE category_id = ?`, [id]);

            if (rows[0]?.image_path) {
                await this.safeDeleteImage(rows[0].image_path);
            }
        } catch (error) {
            console.error('Error in deleteCategory:', error.message);
            throw error;
        }
    }

    // Get related categories (same vehicle type and country)
    static async getRelatedCategories(vehicleTypeId, countryId, currentCategoryId) {
        const [rows] = await db.execute(
            `SELECT c.*, v.vehicle_type_name, co.country_name
             FROM categories c
             JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
             LEFT JOIN countries co ON c.country_id = co.id
             WHERE c.vehicle_type_id = ? 
               AND (c.country_id = ? OR (c.country_id IS NULL AND ? IS NULL))
               AND c.category_id != ?
             ORDER BY c.name ASC
             LIMIT 4`,
            [vehicleTypeId, countryId, countryId, currentCategoryId]
        );
        return rows;
    }

    // Get categories by country
    static async getCategoriesByCountry(countryId) {
        const [rows] = await db.execute(
            `SELECT c.*, v.vehicle_type_name, co.country_name, u.name AS author_name
             FROM categories c
             JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
             LEFT JOIN countries co ON c.country_id = co.id
             JOIN usertable u ON c.author_id = u.user_id
             WHERE c.country_id = ? OR c.country_id IS NULL
             ORDER BY c.name ASC`,
            [countryId]
        );
        return rows;
    }

    // Get category by name with country context
    static async getCategoryByName(categoryName, countryId = null) {
        try {
            console.log('🔍 Searching for category by name:', categoryName, 'in country:', countryId);
            
            if (!categoryName) return null;
            
            let query = `
                SELECT c.*, v.vehicle_type_name, co.country_name, u.name AS author_name
                FROM categories c
                JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
                LEFT JOIN countries co ON c.country_id = co.id
                JOIN usertable u ON c.author_id = u.user_id
                WHERE LOWER(c.name) = LOWER(?)
            `;
            let params = [categoryName];
            
            if (countryId) {
                query += ` AND (c.country_id = ? OR c.country_id IS NULL)`;
                params.push(countryId);
            }
            
            query += ` LIMIT 1`;
            
            let [rows] = await db.execute(query, params);
            
            // If not found, try with hyphens replaced by spaces
            if (rows.length === 0 && categoryName.includes('-')) {
                const withSpaces = categoryName.replace(/-/g, ' ');
                console.log('🔄 Trying with spaces:', withSpaces);
                
                params = [withSpaces];
                let newQuery = `
                    SELECT c.*, v.vehicle_type_name, co.country_name, u.name AS author_name
                    FROM categories c
                    JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
                    LEFT JOIN countries co ON c.country_id = co.id
                    JOIN usertable u ON c.author_id = u.user_id
                    WHERE LOWER(c.name) = LOWER(?)
                `;
                
                if (countryId) {
                    newQuery += ` AND (c.country_id = ? OR c.country_id IS NULL)`;
                    params.push(countryId);
                }
                
                newQuery += ` LIMIT 1`;
                [rows] = await db.execute(newQuery, params);
            }
            
            if (rows.length > 0) {
                console.log('✅ Category found:', rows[0].name);
                return rows[0];
            } else {
                console.log('❌ No category found for:', categoryName);
                return null;
            }
            
        } catch (error) {
            console.error('Error in getCategoryByName:', error);
            throw error;
        }
    }

    // Get category statistics by country
    static async getCategoryStats(countryId = null) {
        try {
            let query = `
                SELECT 
                    COUNT(*) AS total_categories,
                    COUNT(DISTINCT vehicle_type_id) AS vehicle_types_covered
                FROM categories
                WHERE 1=1
            `;
            let params = [];
            
            if (countryId) {
                query += ` AND (country_id = ? OR country_id IS NULL)`;
                params.push(countryId);
            }
            
            const [rows] = await db.execute(query, params);
            return rows[0] || { total_categories: 0, vehicle_types_covered: 0 };
        } catch (error) {
            console.error('Error in getCategoryStats:', error);
            throw error;
        }
    }

    // Import category from one country to another
    static async importCategory(sourceCategoryId, targetCountryId, targetVehicleTypeId, authorName) {
        const sourceCategory = await this.getCategoryById(sourceCategoryId);
        if (!sourceCategory) throw new Error('Source category not found.');

        const [authorRows] = await db.execute(`SELECT user_id FROM usertable WHERE name = ? LIMIT 1`, [authorName]);
        if (!authorRows || authorRows.length === 0) throw new Error('Author not found.');
        const authorId = authorRows[0].user_id;

        // Check if a category with the exact same name already exists in target
        let existsQuery = `SELECT category_id, image_path FROM categories 
                           WHERE LOWER(name) = LOWER(?) AND vehicle_type_id = ?`;
        let existsParams = [sourceCategory.name, targetVehicleTypeId];
        
        if (targetCountryId) {
            existsQuery += ` AND (country_id = ? OR country_id IS NULL)`;
            existsParams.push(targetCountryId);
        } else {
            existsQuery += ` AND country_id IS NULL`;
        }
        existsQuery += ` ORDER BY country_id IS NULL ASC LIMIT 1`;

        const [existing] = await db.execute(existsQuery, existsParams);

        if (existing && existing.length > 0) {
            // Overwrite existing category
            const targetCategoryId = existing[0].category_id;
            const oldImagePath = existing[0].image_path;

            // Delete old image only if it's different from the new one and not shared
            if (oldImagePath && oldImagePath !== sourceCategory.image_path) {
                await this.safeDeleteImage(oldImagePath);
            }

            await db.execute(
                'UPDATE categories SET name = ?, image_path = ?, vehicle_type_id = ?, country_id = ?, author_id = ?, created_at = NOW() WHERE category_id = ?',
                [sourceCategory.name, sourceCategory.image_path, targetVehicleTypeId, targetCountryId || null, authorId, targetCategoryId]
            );
            return { action: 'updated', categoryId: targetCategoryId };
        } else {
            // Insert new category
            const [result] = await db.execute(
                'INSERT INTO categories (name, image_path, vehicle_type_id, country_id, author_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [sourceCategory.name, sourceCategory.image_path, targetVehicleTypeId, targetCountryId || null, authorId]
            );
            return { action: 'created', categoryId: result.insertId };
        }
    }

    // Get countries where this category exists (by name and vehicle type)
    static async getCountriesForCategory(categoryName, vehicleTypeId) {
        try {
            const [rows] = await db.execute(`
                SELECT DISTINCT c.id, c.country_name, c.currency_symbol
                FROM categories cat
                JOIN countries c ON cat.country_id = c.id
                JOIN vehicletype vt ON cat.vehicle_type_id = vt.vehicle_type_id
                WHERE (LOWER(cat.name) = LOWER(?) OR LOWER(REPLACE(cat.name, ' ', '-')) = LOWER(?))
                AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
                UNION
                SELECT NULL as id, 'Global' as country_name, NULL as currency_symbol
                FROM categories cat
                JOIN vehicletype vt ON cat.vehicle_type_id = vt.vehicle_type_id
                WHERE (LOWER(cat.name) = LOWER(?) OR LOWER(REPLACE(cat.name, ' ', '-')) = LOWER(?))
                AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
                AND cat.country_id IS NULL
            `, [categoryName, categoryName, vehicleTypeId, categoryName, categoryName, vehicleTypeId]);
            return rows;
        } catch (error) {
            console.error('Error in getCountriesForCategory:', error);
            return [];
        }
    }
}

module.exports = Category;