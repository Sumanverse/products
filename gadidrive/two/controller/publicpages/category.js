// controller/publicpages/category.js
const Category = require('../../models/category');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');

exports.getcategory = async (req, res, next) => {
    try {
        // Get country from URL parameter
        const countryName = req.params.countryname;
        const vehicletypename = req.params.vehicletypename;
        
        console.log('Country from URL:', countryName);
        console.log('Vehicle type from URL:', vehicletypename);
        
        // Get country details
        let currentCountry = null;
        allCountries = await Country.getAll();
        if (countryName) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryName.toLowerCase()
            );
            
            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryName}" not found`,
                    title: 'Country Not Found - gadidrive'
                });
            }
        }
        
        // Get vehicle types for this country (केवल यो country का vehicle types)
        let countryVehicleTypes = [];
        if (currentCountry) {
            countryVehicleTypes = await VehicleType.getVehicleTypesByCountry(currentCountry.id);
        } else {
            // Global page को लागि सबै vehicle types
            countryVehicleTypes = await VehicleType.getAllVehicleTypes();
        }
        console.log('Vehicle types for this country:', countryVehicleTypes.length);
        
        let selectedVehicleType = null;
        let categories = [];

        if (vehicletypename) {
            // Get vehicle type by name with country context
            selectedVehicleType = await VehicleType.getVehicleTypeByName(
                vehicletypename, 
                currentCountry ? currentCountry.id : null
            );
            
            if (selectedVehicleType) {
                // Get categories for this vehicle type and country
                categories = await Category.getCategoriesByVehicleType(
                    selectedVehicleType.vehicle_type_id,
                    currentCountry ? currentCountry.id : null
                );
                console.log('Categories found:', categories.length);
            } else {
                return res.status(404).render('error', {
                    message: `Vehicle type "${vehicletypename}" not found${countryName ? ' in ' + countryName : ''}`,
                    title: 'Vehicle Type Not Found - gadidrive'
                });
            }
        } else {
            // If no vehicle type in URL, redirect to default with country prefix
            const defaultVehicleType = countryVehicleTypes.length > 0 ? countryVehicleTypes[0].vehicle_type_name : 'car';
            const redirectPath = countryName ? 
                `/${countryName}/${defaultVehicleType}/category` : 
                `/${defaultVehicleType}/category`;
            return res.redirect(redirectPath);
        }

        // Format display name
        const displayName = selectedVehicleType?.vehicle_type_name || 'Vehicle';
        const pluralDisplay = displayName.endsWith('s') ? displayName : displayName + 's';
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';

        res.render('./publicpages/category', {
            vehicleTypes: countryVehicleTypes,
            selectedVehicleType: selectedVehicleType,
            vehicletypename: vehicletypename,
            categories: categories,
            country: currentCountry,
            allCountries: allCountries,
            title: `All ${pluralDisplay} Categories in ${countryDisplay}`,
            description: `Browse all ${pluralDisplay.toLowerCase()} categories available in ${countryDisplay}. Find ${pluralDisplay.toLowerCase()} by type, budget, and features.`,
            keywords: `${pluralDisplay.toLowerCase()} categories, ${pluralDisplay.toLowerCase()} types, ${pluralDisplay.toLowerCase()} in ${countryDisplay.toLowerCase()}`,
            path: countryName ? `/${countryName}/${vehicletypename}/category` : `/${vehicletypename}/category`,
            currentPage: 'category'
        });
    } catch (error) {
        console.error('Error in getcategory:', error);
        res.render('./publicpages/category', {
            vehicleTypes: [],
            selectedVehicleType: null,
            vehicletypename: null,
            categories: [],
            country: null,
            allCountries: [],
            title: 'Categories - gadidrive',
            path: '/category',
            currentPage: 'category'
        });
    }
};