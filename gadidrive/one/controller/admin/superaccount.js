const UserDetails = require('../../models/userdetails');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const db = require('../../utils/dbutils');

// GET Super Account Page
exports.getadminsuperaccount = async (req, res, next) => {
    try {
        const [users, vehicleTypes, countries] = await Promise.all([
            UserDetails.getAllUsers().catch(err => { 
                console.error('Error fetching users:', err); 
                return []; 
            }),
            VehicleType.getAllVehicleTypes().catch(err => { 
                console.error('Error fetching vehicle types:', err); 
                return []; 
            }),
            Country.getAll().catch(err => {
                console.error('Error fetching countries:', err);
                return [];
            })
        ]);
        
        res.render('admin/superaccount', {
            title: 'Super Account',
            users: users || [],
            vehicleTypes: vehicleTypes || [],
            countries: countries || [],
            user: req.session.user,
            error: null
        });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.render('admin/superaccount', {
            title: 'Super Account',
            users: [],
            vehicleTypes: [],
            countries: [],
            user: req.session.user,
            error: 'Failed to load data'
        });
    }
};

// ======================= USER OPERATIONS =======================

exports.createUser = async (req, res, next) => {
    try {
        const userData = {
            name: req.body.name?.trim(),
            username: req.body.username?.trim(),
            password: req.body.password,
            position: req.body.position
        };
        
        if (!userData.name || !userData.username || !userData.password || !userData.position) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const profileImagePath = req.file ? `/uploads/profiles/${req.file.filename}` : null;
        await UserDetails.createUser(userData, profileImagePath);
        res.json({ success: true, message: 'User created successfully!' });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error creating user' });
    }
};

exports.getUserById = async (req, res, next) => {
    try {
        const user = await UserDetails.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, message: 'Error fetching user' });
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        const userData = {
            name: req.body.name?.trim(),
            username: req.body.username?.trim(),
            password: req.body.password || '',
            position: req.body.position
        };
        
        if (!userData.name || !userData.username || !userData.position) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }
        
        const profileImagePath = req.file ? `/uploads/profiles/${req.file.filename}` : null;
        await UserDetails.updateUser(req.params.id, userData, profileImagePath);
        res.json({ success: true, message: 'User updated successfully!' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error updating user' });
    }
};

exports.deleteUser = async (req, res, next) => {
    try {
        await UserDetails.deleteUser(req.params.id);
        res.json({ success: true, message: 'User deleted successfully!' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
};

// ======================= VEHICLE TYPE OPERATIONS =======================

// CREATE vehicle type
exports.createVehicleType = async (req, res, next) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    try {
        const vehicleTypeName = req.body.vehicleTypeName?.trim();
        const countryId = req.body.country_id ? parseInt(req.body.country_id) : null;
        
        if (!vehicleTypeName) {
            return res.status(400).json({ success: false, message: 'Vehicle type name is required' });
        }
        
        const vehicleImagePath = `/uploads/vehicle-types/${req.file.filename}`;
        
        // Check if vehicle type exists in this country
        const exists = await VehicleType.vehicleTypeExistsInCountry(vehicleTypeName, countryId);
        if (exists) {
            let countryName = 'Global';
            if (countryId) {
                const country = await Country.getById(countryId);
                countryName = country?.country_name || 'selected country';
            }
            
            return res.status(400).json({ 
                success: false, 
                message: `Vehicle type "${vehicleTypeName}" already exists in ${countryName}`
            });
        }
        
        await VehicleType.createVehicleType(vehicleTypeName, vehicleImagePath, countryId);
        
        let successMessage = 'Vehicle type created successfully';
        if (countryId) {
            const country = await Country.getById(countryId);
            successMessage += ` for ${country?.country_name}!`;
        } else {
            successMessage += ' as Global!';
        }
        
        res.json({ success: true, message: successMessage });
    } catch (error) {
        console.error('Error creating vehicle type:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error creating vehicle type' 
        });
    }
};

// GET vehicle type by ID
exports.getVehicleTypeById = async (req, res, next) => {
    try {
        const vehicleType = await VehicleType.getVehicleTypeById(req.params.id);
        if (!vehicleType) {
            return res.status(404).json({ success: false, message: 'Vehicle type not found' });
        }
        
        // Get all countries for dropdown
        const countries = await Country.getAll();
        
        res.json({ 
            success: true, 
            vehicleType,
            countries 
        });
    } catch (error) {
        console.error('Error fetching vehicle type:', error);
        res.status(500).json({ success: false, message: 'Error fetching vehicle type' });
    }
};

// UPDATE vehicle type
exports.updateVehicleType = async (req, res, next) => {
    try {
        const vehicleTypeName = req.body.vehicleTypeName?.trim();
        const countryId = req.body.country_id ? parseInt(req.body.country_id) : null;
        const vehicleTypeId = req.params.id;
        
        if (!vehicleTypeName) {
            return res.status(400).json({ success: false, message: 'Vehicle type name is required' });
        }
        
        const vehicleImagePath = req.file ? `/uploads/vehicle-types/${req.file.filename}` : null;
        
        // Check if vehicle type exists in this country (excluding current)
        const exists = await VehicleType.vehicleTypeExistsInCountry(vehicleTypeName, countryId, vehicleTypeId);
        if (exists) {
            let countryName = 'Global';
            if (countryId) {
                const country = await Country.getById(countryId);
                countryName = country?.country_name || 'selected country';
            }
            
            return res.status(400).json({ 
                success: false, 
                message: `Vehicle type "${vehicleTypeName}" already exists in ${countryName}`
            });
        }
        
        await VehicleType.updateVehicleType(vehicleTypeId, vehicleTypeName, vehicleImagePath, countryId);
        
        let successMessage = 'Vehicle type updated successfully';
        if (countryId) {
            const country = await Country.getById(countryId);
            successMessage += ` for ${country?.country_name}!`;
        } else {
            successMessage += ' as Global!';
        }
        
        res.json({ success: true, message: successMessage });
    } catch (error) {
        console.error('Error updating vehicle type:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error updating vehicle type' 
        });
    }
};

// DELETE vehicle type (with dependency check)
exports.deleteVehicleType = async (req, res, next) => {
    try {
        const vehicleTypeId = req.params.id;
        
        // Check if vehicle type has dependencies (brands, categories, models)
        const [brands] = await db.execute('SELECT COUNT(*) as count FROM brands WHERE vehicle_type_id = ?', [vehicleTypeId]);
        const [categories] = await db.execute('SELECT COUNT(*) as count FROM categories WHERE vehicle_type_id = ?', [vehicleTypeId]);
        const [models] = await db.execute('SELECT COUNT(*) as count FROM models WHERE vehicle_type_id = ?', [vehicleTypeId]);
        
        if (brands[0].count > 0 || categories[0].count > 0 || models[0].count > 0) {
            let errorMessage = 'This vehicle type cannot be deleted because it has associated content:\n';
            if (brands[0].count > 0) errorMessage += `\n• ${brands[0].count} Brand(s)`;
            if (categories[0].count > 0) errorMessage += `\n• ${categories[0].count} Categor(ies)`;
            if (models[0].count > 0) errorMessage += `\n• ${models[0].count} Model(s)`;
            
            return res.status(400).json({ 
                success: false, 
                message: errorMessage 
            });
        }
        
        await VehicleType.deleteVehicleType(vehicleTypeId);
        res.json({ success: true, message: 'Vehicle type deleted successfully!' });
    } catch (error) {
        console.error('Error deleting vehicle type:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error deleting vehicle type' 
        });
    }
};

// GET all vehicle types (for API)
exports.getVehicleTypes = async (req, res) => {
    try {
        const vehicleTypes = await VehicleType.getAllVehicleTypes();
        const countries = await Country.getAll();
        
        res.json({ 
            success: true, 
            vehicleTypes,
            countries 
        });
    } catch (error) {
        console.error('Error fetching vehicle types:', error);
        res.status(500).json({ success: false, message: 'Error fetching vehicle types' });
    }
};

// ======================= COUNTRY MANAGEMENT =======================

// GET all countries
exports.getCountries = async (req, res) => {
    try {
        const countries = await Country.getAllIncludingInactive();
        res.json({ success: true, countries });
    } catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ success: false, message: 'Error fetching countries' });
    }
};

// GET single country by ID
exports.getCountryById = async (req, res) => {
    try {
        const country = await Country.getById(req.params.id);
        if (!country) {
            return res.status(404).json({ success: false, message: 'Country not found' });
        }
        res.json({ success: true, country });
    } catch (error) {
        console.error('Error fetching country:', error);
        res.status(500).json({ success: false, message: 'Error fetching country' });
    }
};

// CREATE new country
exports.createCountry = async (req, res) => {
    try {
        const { country_name, currency_name, currency_symbol, currency_code } = req.body;
        
        // Validation
        if (!country_name?.trim() || !currency_name?.trim() || !currency_symbol?.trim() || !currency_code?.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        // Check if country already exists
        const exists = await Country.checkExists(country_name.trim());
        if (exists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Country name already exists' 
            });
        }

        await Country.create({
            country_name: country_name.trim(),
            currency_name: currency_name.trim(),
            currency_symbol: currency_symbol.trim(),
            currency_code: currency_code.trim().toUpperCase()
        });

        res.json({ 
            success: true, 
            message: 'Country created successfully!' 
        });
    } catch (error) {
        console.error('Error creating country:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error creating country' 
        });
    }
};

// UPDATE country
exports.updateCountry = async (req, res) => {
    try {
        const { country_name, currency_name, currency_symbol, currency_code } = req.body;
        const countryId = req.params.id;

        // Validation
        if (!country_name?.trim() || !currency_name?.trim() || !currency_symbol?.trim() || !currency_code?.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }

        // Check if country exists (excluding current)
        const exists = await Country.checkExists(country_name.trim(), countryId);
        if (exists) {
            return res.status(400).json({ 
                success: false, 
                message: 'Country name already exists' 
            });
        }

        await Country.update(countryId, {
            country_name: country_name.trim(),
            currency_name: currency_name.trim(),
            currency_symbol: currency_symbol.trim(),
            currency_code: currency_code.trim().toUpperCase()
        });

        res.json({ 
            success: true, 
            message: 'Country updated successfully!' 
        });
    } catch (error) {
        console.error('Error updating country:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Server error updating country' 
        });
    }
};

// DELETE country (permanent delete - only if no dependencies)
exports.deleteCountry = async (req, res) => {
    try {
        const countryId = req.params.id;
        
        // Check if country has any dependencies
        const dependencies = await Country.getDependencies(countryId);
        const hasDependencies = Object.values(dependencies).some(count => count > 0);
        
        if (hasDependencies) {
            // Build detailed error message
            let errorMessage = 'This country cannot be deleted because it has associated content:\n';
            
            if (dependencies.vehicleTypes > 0) {
                errorMessage += `\n• ${dependencies.vehicleTypes} Vehicle Type(s)`;
            }
            if (dependencies.categories > 0) {
                errorMessage += `\n• ${dependencies.categories} Categor(ies)`;
            }
            if (dependencies.brands > 0) {
                errorMessage += `\n• ${dependencies.brands} Brand(s)`;
            }
            if (dependencies.models > 0) {
                errorMessage += `\n• ${dependencies.models} Model(s)`;
            }
            if (dependencies.articles > 0) {
                errorMessage += `\n• ${dependencies.articles} Article(s)`;
            }
            
            errorMessage += '\n\nPlease delete all associated content first.';
            
            return res.status(400).json({ 
                success: false, 
                message: errorMessage
            });
        }
        
        // If no dependencies, permanently delete
        await Country.delete(countryId);
        
        res.json({ 
            success: true, 
            message: 'Country deleted successfully!' 
        });
    } catch (error) {
        console.error('Error deleting country:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting country: ' + error.message 
        });
    }
};