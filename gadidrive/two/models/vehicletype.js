const db = require('../utils/dbutils');

class VehicleType {
    // Create new vehicle type
    static async createVehicleType(vehicleTypeName, vehicleImagePath, countryId = null) {
        // Check if vehicle type already exists in this country
        const exists = await this.vehicleTypeExistsInCountry(vehicleTypeName, countryId);
        if (exists) {
            throw new Error('Vehicle type already exists in this country');
        }
        
        const [result] = await db.execute(
            `INSERT INTO vehicletype (vehicle_type_name, vehicle_type_photo_path, country_id, published_date)
             VALUES (?, ?, ?, CURDATE())`,
            [vehicleTypeName, vehicleImagePath, countryId || null]
        );
        return result.insertId;
    }

    // Get all vehicle types with country info
    static async getAllVehicleTypes() {
        const [rows] = await db.execute(`
            SELECT 
                vt.vehicle_type_id, 
                vt.vehicle_type_name, 
                vt.vehicle_type_photo_path, 
                vt.published_date,
                vt.country_id,
                c.country_name,
                c.currency_symbol
            FROM vehicletype vt
            LEFT JOIN countries c ON vt.country_id = c.id
            ORDER BY vt.published_date DESC
        `);
        return rows;
    }

    // Get vehicle type by ID with country info
    static async getVehicleTypeById(id) {
        const [rows] = await db.execute(
            `SELECT 
                vt.vehicle_type_id, 
                vt.vehicle_type_name, 
                vt.vehicle_type_photo_path, 
                vt.published_date,
                vt.country_id,
                c.country_name,
                c.currency_symbol
             FROM vehicletype vt
             LEFT JOIN countries c ON vt.country_id = c.id
             WHERE vt.vehicle_type_id = ?`,
            [id]
        );
        return rows[0] || null;
    }

    // Update vehicle type
    static async updateVehicleType(id, vehicleTypeName, vehicleImagePath, countryId = null) {
        // Check if vehicle type already exists in this country (excluding current)
        const exists = await this.vehicleTypeExistsInCountry(vehicleTypeName, countryId, id);
        if (exists) {
            throw new Error('Vehicle type already exists in this country');
        }
        
        let queryParts = ['vehicle_type_name = ?', 'country_id = ?'];
        let params = [vehicleTypeName, countryId || null];

        if (vehicleImagePath) {
            queryParts.push('vehicle_type_photo_path = ?');
            params.push(vehicleImagePath);
        }

        const query = `UPDATE vehicletype SET ${queryParts.join(', ')} WHERE vehicle_type_id = ?`;
        params.push(id);

        const [result] = await db.execute(query, params);
        if (result.affectedRows === 0) {
            throw new Error('No vehicle type found');
        }
    }

    // Delete vehicle type
    static async deleteVehicleType(id) {
        await db.execute(`DELETE FROM vehicletype WHERE vehicle_type_id = ?`, [id]);
    }

    // Check if vehicle type exists in a specific country
    static async vehicleTypeExistsInCountry(vehicleTypeName, countryId, excludeId = null) {
        let query = `SELECT vehicle_type_id FROM vehicletype 
                     WHERE LOWER(vehicle_type_name) = LOWER(?) 
                     AND (country_id = ? OR (country_id IS NULL AND ? IS NULL))`;
        let params = [vehicleTypeName, countryId, countryId];
        
        if (excludeId) {
            query += ' AND vehicle_type_id != ?';
            params.push(excludeId);
        }
        
        const [rows] = await db.execute(query, params);
        return rows.length > 0;
    }

    // Get vehicle types for dropdown/menu (with country filter)
    static async getVehicleTypesForMenu(countryId = null) {
        try {
            let query = `
                SELECT vehicle_type_id, vehicle_type_name
                FROM vehicletype
                WHERE 1=1
            `;
            let params = [];
            
            if (countryId) {
                query += ` AND (country_id = ? OR country_id IS NULL)`;
                params.push(countryId);
            }
            
            query += ` ORDER BY vehicle_type_name ASC`;
            
            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) {
            console.error('Error in getVehicleTypesForMenu:', error);
            throw error;
        }
    }

    // Get vehicle type by name (with country context)
    static async getVehicleTypeByName(vehicleTypeName, countryId = null) {
        try {
            console.log('🔍 Searching for vehicle type:', vehicleTypeName, 'in country:', countryId);
            
            if (!vehicleTypeName) {
                console.log('❌ No vehicle type name provided');
                return null;
            }

            // Search with country context
            let query = `
                SELECT vt.vehicle_type_id, vt.vehicle_type_name, vt.vehicle_type_photo_path, 
                       vt.published_date, vt.country_id, c.country_name
                FROM vehicletype vt
                LEFT JOIN countries c ON vt.country_id = c.id
                WHERE LOWER(vt.vehicle_type_name) = LOWER(?)
            `;
            let params = [vehicleTypeName];
            
            if (countryId) {
                query += ` AND (vt.country_id = ? OR vt.country_id IS NULL)`;
                params.push(countryId);
            }
            
            query += ` LIMIT 1`;
            
            let [rows] = await db.execute(query, params);
            
            // If not found, try with hyphens replaced by spaces
            if (rows.length === 0 && vehicleTypeName.includes('-')) {
                const withSpaces = vehicleTypeName.replace(/-/g, ' ');
                console.log('🔄 Trying with spaces:', withSpaces);
                
                params = [withSpaces];
                let newQuery = `
                    SELECT vt.vehicle_type_id, vt.vehicle_type_name, vt.vehicle_type_photo_path, 
                           vt.published_date, vt.country_id, c.country_name
                    FROM vehicletype vt
                    LEFT JOIN countries c ON vt.country_id = c.id
                    WHERE LOWER(vt.vehicle_type_name) = LOWER(?)
                `;
                
                if (countryId) {
                    newQuery += ` AND (vt.country_id = ? OR vt.country_id IS NULL)`;
                    params.push(countryId);
                }
                
                newQuery += ` LIMIT 1`;
                [rows] = await db.execute(newQuery, params);
            }

            return rows[0] || null;

        } catch (error) {
            console.error('❌ Error in getVehicleTypeByName:', error);
            throw error;
        }
    }

    // Get vehicle types with counts (brands, categories, models)
    static async getVehicleTypesWithStats() {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    vt.vehicle_type_id,
                    vt.vehicle_type_name,
                    vt.vehicle_type_photo_path,
                    vt.published_date,
                    vt.country_id,
                    c.country_name,
                    COUNT(DISTINCT b.brand_id) AS brand_count,
                    COUNT(DISTINCT cat.category_id) AS category_count,
                    COUNT(DISTINCT m.id) AS model_count
                FROM vehicletype vt
                LEFT JOIN countries c ON vt.country_id = c.id
                LEFT JOIN brands b ON vt.vehicle_type_id = b.vehicle_type_id
                LEFT JOIN categories cat ON vt.vehicle_type_id = cat.vehicle_type_id
                LEFT JOIN models m ON vt.vehicle_type_id = m.vehicle_type_id
                GROUP BY vt.vehicle_type_id
                ORDER BY vt.published_date DESC
            `);
            return rows;
        } catch (error) {
            console.error('Error in getVehicleTypesWithStats:', error);
            throw error;
        }
    }

    // Get vehicle types by country
    static async getVehicleTypesByCountry(countryId) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    vt.vehicle_type_id, 
                    vt.vehicle_type_name, 
                    vt.vehicle_type_photo_path,
                    vt.published_date,
                    c.country_name
                FROM vehicletype vt
                LEFT JOIN countries c ON vt.country_id = c.id
                WHERE vt.country_id = ? OR vt.country_id IS NULL
                ORDER BY vt.vehicle_type_name ASC
            `, [countryId]);
            return rows;
        } catch (error) {
            console.error('Error in getVehicleTypesByCountry:', error);
            throw error;
        }
    }

    // Get popular vehicle types (with most models)
    static async getPopularVehicleTypes(limit = 4, countryId = null) {
        try {
            let query = `
                SELECT 
                    vt.vehicle_type_id,
                    vt.vehicle_type_name,
                    vt.vehicle_type_photo_path,
                    COUNT(m.id) AS model_count
                FROM vehicletype vt
                LEFT JOIN models m ON vt.vehicle_type_id = m.vehicle_type_id
                WHERE 1=1
            `;
            let params = [];
            
            if (countryId) {
                query += ` AND (vt.country_id = ? OR vt.country_id IS NULL)`;
                params.push(countryId);
            }
            
            query += ` GROUP BY vt.vehicle_type_id
                       HAVING model_count > 0
                       ORDER BY model_count DESC
                       LIMIT ?`;
            params.push(limit);
            
            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) {
            console.error('Error in getPopularVehicleTypes:', error);
            throw error;
        }
    }

    // Search vehicle types by name (with country filter)
    static async searchVehicleTypes(searchTerm, countryId = null) {
        try {
            let query = `
                SELECT vt.vehicle_type_id, vt.vehicle_type_name, vt.vehicle_type_photo_path,
                       c.country_name
                FROM vehicletype vt
                LEFT JOIN countries c ON vt.country_id = c.id
                WHERE LOWER(vt.vehicle_type_name) LIKE LOWER(?)
            `;
            let params = [`%${searchTerm}%`];
            
            if (countryId) {
                query += ` AND (vt.country_id = ? OR vt.country_id IS NULL)`;
                params.push(countryId);
            }
            
            query += ` ORDER BY vt.vehicle_type_name ASC LIMIT 10`;
            
            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) {
            console.error('Error in searchVehicleTypes:', error);
            throw error;
        }
    }

    // Get vehicle type statistics
    static async getVehicleTypeStats(countryId = null) {
        try {
            let query = `
                SELECT 
                    COUNT(*) AS total_types,
                    SUM(CASE WHEN published_date >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS new_this_month
                FROM vehicletype
                WHERE 1=1
            `;
            let params = [];
            
            if (countryId) {
                query += ` AND (country_id = ? OR country_id IS NULL)`;
                params.push(countryId);
            }
            
            const [rows] = await db.execute(query, params);
            return rows[0] || { total_types: 0, new_this_month: 0 };
        } catch (error) {
            console.error('Error in getVehicleTypeStats:', error);
            throw error;
        }
    }

    // Get countries that have this vehicle type
    static async getCountriesForVehicleType(vehicleTypeId) {
        try {
            const [rows] = await db.execute(`
                SELECT c.id, c.country_name, c.currency_symbol
                FROM vehicletype vt
                JOIN countries c ON vt.country_id = c.id
                WHERE vt.vehicle_type_id = ? AND vt.country_id IS NOT NULL
                UNION
                SELECT NULL as id, 'Global' as country_name, NULL as currency_symbol
                FROM vehicletype vt
                WHERE vt.vehicle_type_id = ? AND vt.country_id IS NULL
            `, [vehicleTypeId, vehicleTypeId]);
            return rows;
        } catch (error) {
            console.error('Error in getCountriesForVehicleType:', error);
            throw error;
        }
    }
}

module.exports = VehicleType;