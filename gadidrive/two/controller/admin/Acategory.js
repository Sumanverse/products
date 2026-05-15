const Category = require('../../models/category');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const upload = require('../../utils/uploadcategory');

exports.getAdminCategory = async (req, res, next) => {
    try {
        const [vehicleTypes, categories, countries] = await Promise.all([
            VehicleType.getAllVehicleTypes(),
            Category.getAllCategories(),
            Country.getAll()
        ]);

        console.log('Vehicle Types:', vehicleTypes);
        console.log('Categories:', categories);
        console.log('Countries:', countries);

        res.render('admin/Acategory', {
            vehicleTypes,
            categories,
            countries,
            user: req.user,
            title: 'Category Admin'
        });
    } catch (error) {
        console.error('Error fetching admin category page:', error);
        res.status(500).render('500', { title: 'Server Error' });
    }
};

// Get vehicle types by country (for AJAX)
exports.getVehicleTypesByCountry = async (req, res) => {
    try {
        const countryId = req.params.countryId ? parseInt(req.params.countryId) : null;
        const vehicleTypes = await VehicleType.getVehicleTypesForMenu(countryId);
        res.json({ success: true, vehicleTypes });
    } catch (error) {
        console.error('Error fetching vehicle types by country:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.postAdminCategory = (req, res) => {
    upload(req, res, async (err) => {
        try {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }

            const { categoryName, vehicleType, countryId } = req.body;
            const categoryImage = req.file ? `/uploads/categories/${req.file.filename}` : null;
            const authorName = req.user.name;
            const selectedCountryId = countryId ? parseInt(countryId) : null;

            console.log('POST Data:', { categoryName, vehicleType, countryId, categoryImage });

            if (!categoryName || !vehicleType) {
                return res.status(400).json({
                    success: false,
                    message: 'Category name and vehicle type are required.'
                });
            }

            // Validate that the vehicle type exists
            const vehicleTypeData = await VehicleType.getVehicleTypeById(vehicleType);
            
            if (!vehicleTypeData) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid vehicle type selected.'
                });
            }

            // IMPORTANT: Validate that the vehicle type belongs to the selected country
            if (selectedCountryId) {
                // If country is selected, vehicle type must either:
                // 1. Belong to that country, OR
                // 2. Be Global (country_id = null)
                if (vehicleTypeData.country_id !== null && vehicleTypeData.country_id !== selectedCountryId) {
                    const country = await Country.getById(selectedCountryId);
                    const vehicleCountry = vehicleTypeData.country_id ? await Country.getById(vehicleTypeData.country_id) : null;
                    
                    return res.status(400).json({
                        success: false,
                        message: `Vehicle type "${vehicleTypeData.vehicle_type_name}" belongs to ${vehicleCountry?.country_name || 'another country'} and cannot be used for ${country?.country_name || 'selected country'}.`
                    });
                }
            } else {
                // If no country selected (Global), vehicle type must be Global
                if (vehicleTypeData.country_id !== null) {
                    const vehicleCountry = await Country.getById(vehicleTypeData.country_id);
                    return res.status(400).json({
                        success: false,
                        message: `Cannot use country-specific vehicle type "${vehicleTypeData.vehicle_type_name}" (${vehicleCountry?.country_name}) for Global category. Please select a country or use a Global vehicle type.`
                    });
                }
            }

            // Check if category already exists for this vehicle type and country
            const exists = await Category.categoryExists(categoryName, vehicleType, selectedCountryId);
            if (exists) {
                let errorMessage = `Category "${categoryName}" already exists`;
                if (selectedCountryId) {
                    const country = await Country.getById(selectedCountryId);
                    errorMessage += ` for ${country?.country_name}`;
                } else {
                    errorMessage += ' as Global';
                }
                errorMessage += ` with vehicle type "${vehicleTypeData.vehicle_type_name}".`;
                
                return res.status(400).json({
                    success: false,
                    message: errorMessage
                });
            }

            await Category.createCategory(categoryName, vehicleType, selectedCountryId, categoryImage, authorName);
            
            let successMessage = 'Category created successfully';
            if (selectedCountryId) {
                const country = await Country.getById(selectedCountryId);
                successMessage += ` for ${country?.country_name}`;
            } else {
                successMessage += ' as Global';
            }
            
            res.json({ success: true, message: successMessage });
        } catch (error) {
            console.error('Error creating category:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Server error.' 
            });
        }
    });
};

// Get categories by vehicle type (with optional country filter)
exports.getCategoriesByVehicleType = async (req, res) => {
    try {
        const { vehicleTypeId } = req.params;
        const countryId = req.query.countryId ? parseInt(req.query.countryId) : null;
        
        const categories = await Category.getCategoriesByVehicleType(vehicleTypeId, countryId);
        res.json({ success: true, categories });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const category = await Category.getCategoryById(categoryId);
        if (!category) return res.status(404).json({ success: false, message: 'Not found.' });
        
        // Get all countries and vehicle types for dropdown
        const [countries, vehicleTypes] = await Promise.all([
            Country.getAll(),
            VehicleType.getAllVehicleTypes()
        ]);
        
        res.json({ 
            success: true, 
            category,
            countries,
            vehicleTypes
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.updateAdminCategory = (req, res) => {
    upload(req, res, async (err) => {
        try {
            if (err) return res.status(400).json({ success: false, message: err.message });
            
            const { categoryId, categoryName, vehicleType, countryId } = req.body;
            const categoryImage = req.file ? `/uploads/categories/${req.file.filename}` : null;
            const authorName = req.user.name;
            const selectedCountryId = countryId ? parseInt(countryId) : null;

            if (!categoryId || !categoryName || !vehicleType) {
                return res.status(400).json({ success: false, message: 'All fields required.' });
            }

            // Validate vehicle type exists
            const vehicleTypeData = await VehicleType.getVehicleTypeById(vehicleType);
            if (!vehicleTypeData) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid vehicle type selected.'
                });
            }

            // Validate vehicle type belongs to selected country
            if (selectedCountryId) {
                if (vehicleTypeData.country_id !== null && vehicleTypeData.country_id !== selectedCountryId) {
                    const country = await Country.getById(selectedCountryId);
                    const vehicleCountry = vehicleTypeData.country_id ? await Country.getById(vehicleTypeData.country_id) : null;
                    
                    return res.status(400).json({
                        success: false,
                        message: `Vehicle type "${vehicleTypeData.vehicle_type_name}" belongs to ${vehicleCountry?.country_name || 'another country'} and cannot be used for ${country?.country_name || 'selected country'}.`
                    });
                }
            } else {
                if (vehicleTypeData.country_id !== null) {
                    const vehicleCountry = await Country.getById(vehicleTypeData.country_id);
                    return res.status(400).json({
                        success: false,
                        message: `Cannot use country-specific vehicle type "${vehicleTypeData.vehicle_type_name}" (${vehicleCountry?.country_name}) for Global category.`
                    });
                }
            }

            // Check if category exists (excluding current)
            const exists = await Category.categoryExists(categoryName, vehicleType, selectedCountryId, categoryId);
            if (exists) {
                let errorMessage = `Category "${categoryName}" already exists`;
                if (selectedCountryId) {
                    const country = await Country.getById(selectedCountryId);
                    errorMessage += ` for ${country?.country_name}`;
                } else {
                    errorMessage += ' as Global';
                }
                errorMessage += ` with vehicle type "${vehicleTypeData.vehicle_type_name}".`;
                
                return res.status(400).json({
                    success: false,
                    message: errorMessage
                });
            }

            await Category.updateCategory(categoryId, categoryName, vehicleType, selectedCountryId, categoryImage, authorName);
            
            let successMessage = 'Category updated successfully';
            if (selectedCountryId) {
                const country = await Country.getById(selectedCountryId);
                successMessage += ` for ${country?.country_name}`;
            } else {
                successMessage += ' as Global';
            }
            
            res.json({ success: true, message: successMessage });
        } catch (error) {
            console.error('Error updating category:', error);
            res.status(500).json({ 
                success: false, 
                message: error.message || 'Server error.' 
            });
        }
    });
};

exports.deleteAdminCategory = async (req, res) => {
    try {
        const { categoryId } = req.body;
        
        // Check if category has dependencies (models)
        const [models] = await require('../../utils/dbutils').execute(
            'SELECT COUNT(*) as count FROM models WHERE category_id = ?', 
            [categoryId]
        );
        
        if (models[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot delete category because it has ${models[0].count} model(s) associated.` 
            });
        }
        
        await Category.deleteCategory(categoryId);
        res.json({ success: true, message: 'Category deleted successfully!' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

exports.importAdminCategory = async (req, res) => {
    try {
        const { sourceCategoryId, targetCountryId, targetVehicleTypeId } = req.body;
        const authorName = req.user.name;

        if (!sourceCategoryId || !targetVehicleTypeId) {
            return res.status(400).json({ success: false, message: 'Source category and target vehicle type are required.' });
        }

        // Validate that target vehicle type exists
        const vehicleTypeData = await VehicleType.getVehicleTypeById(targetVehicleTypeId);
        if (!vehicleTypeData) {
            return res.status(400).json({ success: false, message: 'Invalid target vehicle type selected.' });
        }

        const selectedCountryId = targetCountryId ? parseInt(targetCountryId) : null;
        if (selectedCountryId) {
            if (vehicleTypeData.country_id !== null && vehicleTypeData.country_id !== selectedCountryId) {
                return res.status(400).json({ success: false, message: 'Target vehicle type does not belong to the selected country.' });
            }
        } else {
            if (vehicleTypeData.country_id !== null) {
                return res.status(400).json({ success: false, message: 'Cannot use country-specific vehicle type for Global category.' });
            }
        }

        const result = await Category.importCategory(sourceCategoryId, selectedCountryId, targetVehicleTypeId, authorName);
        
        let successMessage = result.action === 'updated' 
            ? 'Category successfully updated/synced to match the source.' 
            : 'Category successfully imported.';
            
        res.json({ success: true, message: successMessage });
    } catch (error) {
        console.error('Error importing category:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error.' });
    }
};