// controller/publicpages/brands.js
const Brand = require('../../models/brands');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');

exports.getbrands = async (req, res, next) => {
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
        
        // Find selected vehicle type
        let selectedVehicleType = null;
        let brands = [];
        
        if (vehicletypename) {
            // Get vehicle type by name with country context
            selectedVehicleType = await VehicleType.getVehicleTypeByName(
                vehicletypename, 
                currentCountry ? currentCountry.id : null
            );
            
            if (selectedVehicleType) {
                // Get brands for this vehicle type and country
                brands = await Brand.getBrandsByVehicleType(
                    selectedVehicleType.vehicle_type_id,
                    currentCountry ? currentCountry.id : null
                );
                console.log('Brands found:', brands.length);
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
                `/${countryName}/${defaultVehicleType}/brands` : 
                `/${defaultVehicleType}/brands`;
            return res.redirect(redirectPath);
        }
        
        // Format vehicle type name for display
        const displayName = selectedVehicleType.vehicle_type_name;
        const pluralDisplay = displayName.endsWith('s') ? displayName : displayName + 's';
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        
        res.render('./publicpages/brands', {
            vehicleTypes: countryVehicleTypes, // यो country का vehicle types मात्र
            brands: brands,
            selectedVehicleType: selectedVehicleType,
            vehicletypename: vehicletypename,
            country: currentCountry,
            allCountries: allCountries,
            title: `All ${pluralDisplay} Brands in ${countryDisplay} | gadidrive`,
            description: `Explore all ${pluralDisplay.toLowerCase()} brands available in ${countryDisplay}. Find detailed information about ${pluralDisplay.toLowerCase()} models, prices, and specifications.`,
            keywords: `${pluralDisplay.toLowerCase()} brands, ${pluralDisplay.toLowerCase()} in ${countryDisplay.toLowerCase()}, new ${pluralDisplay.toLowerCase()}, ${pluralDisplay.toLowerCase()} prices`,
            path: countryName ? `/${countryName}/${vehicletypename}/brands/` : `/${vehicletypename}/brands/`,
            ogImage: '/images/mainlogo.png',
            currentPage: 'brands'
        });
        
    } catch (error) {
        console.error('Error in brands controller:', error);
        next(error);
    }
};