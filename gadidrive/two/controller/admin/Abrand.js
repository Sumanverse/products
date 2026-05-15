const Brand = require('../../models/brands');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const upload = require('../../utils/uploadbrand');

exports.getAdminBrand = async (req, res) => {
    try {
        const [brands, vehicleTypes, countries] = await Promise.all([
            Brand.getAllBrands(),
            VehicleType.getAllVehicleTypes(),
            Country.getAll()
        ]);

        console.log('Brands:', brands);
        console.log('Vehicle Types:', vehicleTypes);
        console.log('Countries:', countries);

        res.render('admin/Abrand', {
            brands,
            vehicleTypes,
            countries,
            user: req.user,
            title: 'Brand Admin'
        });
    } catch (error) {
        console.error('Error:', error);
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

exports.postAdminBrand = (req, res) => {
    upload(req, res, async (err) => {
        try {
            if (err) return res.status(400).json({ success: false, message: err.message });

            const { brandName, vehicleType, countryId } = req.body;
            const brandImage = req.file ? `/uploads/brands/${req.file.filename}` : null;
            const authorName = req.user.name;
            const selectedCountryId = countryId ? parseInt(countryId) : null;

            console.log('POST Data:', { brandName, vehicleType, countryId, brandImage });

            if (!brandName || !vehicleType) {
                return res.status(400).json({ success: false, message: 'Brand name and vehicle type required.' });
            }

            // Validate that the vehicle type exists
            const vehicleTypeData = await VehicleType.getVehicleTypeById(vehicleType);
            if (!vehicleTypeData) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid vehicle type selected.'
                });
            }

            // Validate that the vehicle type belongs to the selected country
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
                        message: `Cannot use country-specific vehicle type "${vehicleTypeData.vehicle_type_name}" (${vehicleCountry?.country_name}) for Global brand. Please select a country or use a Global vehicle type.`
                    });
                }
            }

            // Check if brand already exists
            const exists = await Brand.brandExists(brandName, vehicleType, selectedCountryId);
            if (exists) {
                let errorMessage = `Brand "${brandName}" already exists`;
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

            await Brand.createBrand(brandName, vehicleType, selectedCountryId, brandImage, authorName);
            
            let successMessage = 'Brand created successfully';
            if (selectedCountryId) {
                const country = await Country.getById(selectedCountryId);
                successMessage += ` for ${country?.country_name}`;
            } else {
                successMessage += ' as Global';
            }
            
            res.json({ success: true, message: successMessage });
        } catch (error) {
            console.error('Error creating brand:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
};

exports.getBrandById = async (req, res) => {
    try {
        const brand = await Brand.getBrandById(req.params.brandId);
        if (!brand) return res.status(404).json({ success: false, message: 'Not found' });
        
        // Get all countries and vehicle types for dropdown
        const [countries, vehicleTypes] = await Promise.all([
            Country.getAll(),
            VehicleType.getAllVehicleTypes()
        ]);
        
        res.json({ 
            success: true, 
            brand,
            countries,
            vehicleTypes
        });
    } catch (error) {
        console.error('Error fetching brand:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateAdminBrand = (req, res) => {
    upload(req, res, async (err) => {
        try {
            if (err) return res.status(400).json({ success: false, message: err.message });

            const { brandId, brandName, vehicleType, countryId } = req.body;
            const brandImage = req.file ? `/uploads/brands/${req.file.filename}` : null;
            const authorName = req.user.name;
            const selectedCountryId = countryId ? parseInt(countryId) : null;

            if (!brandId || !brandName || !vehicleType) {
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
                        message: `Cannot use country-specific vehicle type "${vehicleTypeData.vehicle_type_name}" (${vehicleCountry?.country_name}) for Global brand.`
                    });
                }
            }

            // Check if brand exists (excluding current)
            const exists = await Brand.brandExists(brandName, vehicleType, selectedCountryId, brandId);
            if (exists) {
                let errorMessage = `Brand "${brandName}" already exists`;
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

            await Brand.updateBrand(brandId, brandName, vehicleType, selectedCountryId, brandImage, authorName);
            
            let successMessage = 'Brand updated successfully';
            if (selectedCountryId) {
                const country = await Country.getById(selectedCountryId);
                successMessage += ` for ${country?.country_name}`;
            } else {
                successMessage += ' as Global';
            }
            
            res.json({ success: true, message: successMessage });
        } catch (error) {
            console.error('Error updating brand:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    });
};

exports.deleteAdminBrand = async (req, res) => {
    try {
        const { brandId } = req.body;
        await Brand.deleteBrand(brandId);
        res.json({ success: true, message: 'Brand deleted successfully!' });
    } catch (error) {
        console.error('Error deleting brand:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.importAdminBrand = async (req, res) => {
    try {
        const { sourceBrandId, targetCountryId, targetVehicleTypeId } = req.body;
        const authorName = req.user.name;

        if (!sourceBrandId || !targetVehicleTypeId) {
            return res.status(400).json({ success: false, message: 'Source brand and target vehicle type are required.' });
        }

        // Validate that target vehicle type belongs to target country
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
                return res.status(400).json({ success: false, message: 'Cannot use country-specific vehicle type for Global brand.' });
            }
        }

        const result = await Brand.importBrand(sourceBrandId, selectedCountryId, targetVehicleTypeId, authorName);
        
        let successMessage = result.action === 'updated' 
            ? 'Brand successfully updated/synced to match the source.' 
            : 'Brand successfully imported.';
            
        res.json({ success: true, message: successMessage });
    } catch (error) {
        console.error('Error importing brand:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};