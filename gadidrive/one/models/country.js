const pool = require('../utils/dbutils');

const Country = {
    // Create new country
    create: async (countryData) => {
        const query = 'INSERT INTO countries (country_name, currency_name, currency_symbol, currency_code, status) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.execute(query, [
            countryData.country_name,
            countryData.currency_name,
            countryData.currency_symbol,
            countryData.currency_code,
            countryData.status || 1
        ]);
        return result;
    },

    // Get all countries (active only)
    getAll: async () => {
        const query = 'SELECT * FROM countries WHERE status = 1 ORDER BY country_name';
        const [rows] = await pool.execute(query);
        return rows;
    },

    // Get all countries (including inactive)
    getAllIncludingInactive: async () => {
        const query = 'SELECT * FROM countries ORDER BY country_name';
        const [rows] = await pool.execute(query);
        return rows;
    },

    // Get country by ID
    getById: async (id) => {
        const query = 'SELECT * FROM countries WHERE id = ?';
        const [rows] = await pool.execute(query, [id]);
        return rows[0];
    },

    // NEW: Get country by name
    getByName: async (countryName) => {
        const query = 'SELECT * FROM countries WHERE LOWER(country_name) = LOWER(?) AND status = 1';
        const [rows] = await pool.execute(query, [countryName]);
        return rows[0] || null;
    },

    // Update country
    update: async (id, countryData) => {
        const query = 'UPDATE countries SET country_name = ?, currency_name = ?, currency_symbol = ?, currency_code = ? WHERE id = ?';
        const [result] = await pool.execute(query, [
            countryData.country_name,
            countryData.currency_name,
            countryData.currency_symbol,
            countryData.currency_code,
            id
        ]);
        return result;
    },

    // Get all dependencies for a country
    getDependencies: async (id) => {
        const queries = {
            vehicleTypes: 'SELECT COUNT(*) as count FROM vehicletype WHERE country_id = ?',
            categories: 'SELECT COUNT(*) as count FROM categories WHERE country_id = ?',
            brands: 'SELECT COUNT(*) as count FROM brands WHERE country_id = ?',
            models: 'SELECT COUNT(*) as count FROM models WHERE country_id = ?',
            articles: 'SELECT COUNT(*) as count FROM articles WHERE country_id = ?'
        };
        
        const dependencies = {};
        
        for (let [key, query] of Object.entries(queries)) {
            try {
                const [rows] = await pool.execute(query, [id]);
                dependencies[key] = rows[0].count;
            } catch (error) {
                console.error(`Error checking ${key} dependencies:`, error);
                dependencies[key] = 0;
            }
        }
        
        return dependencies;
    },

    // Check if country has any dependencies
    hasDependencies: async (id) => {
        const dependencies = await Country.getDependencies(id);
        return Object.values(dependencies).some(count => count > 0);
    },

    // PERMANENT DELETE (only if no dependencies)
    delete: async (id) => {
        // First check dependencies
        const hasDeps = await Country.hasDependencies(id);
        if (hasDeps) {
            const deps = await Country.getDependencies(id);
            let errorMessage = 'Cannot delete country because it has associated content:\n';
            
            if (deps.vehicleTypes > 0) errorMessage += `\n• ${deps.vehicleTypes} Vehicle Type(s)`;
            if (deps.categories > 0) errorMessage += `\n• ${deps.categories} Categor(ies)`;
            if (deps.brands > 0) errorMessage += `\n• ${deps.brands} Brand(s)`;
            if (deps.models > 0) errorMessage += `\n• ${deps.models} Model(s)`;
            if (deps.articles > 0) errorMessage += `\n• ${deps.articles} Article(s)`;
            
            errorMessage += '\n\nPlease delete all associated content first.';
            
            throw new Error(errorMessage);
        }
        
        // If no dependencies, permanently delete
        const query = 'DELETE FROM countries WHERE id = ?';
        const [result] = await pool.execute(query, [id]);
        return result;
    },

    // Check if country name exists
    checkExists: async (country_name, excludeId = null) => {
        let query = 'SELECT COUNT(*) as count FROM countries WHERE country_name = ?';
        const params = [country_name];
        
        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }
        
        const [rows] = await pool.execute(query, params);
        return rows[0].count > 0;
    }
};

module.exports = Country;