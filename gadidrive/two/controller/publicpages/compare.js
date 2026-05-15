// controller/publicpages/compare.js
const Model = require('../../models/models');
const Country = require('../../models/country');
const db = require('../../utils/dbutils');

exports.getcompare = async (req, res, next) => {
    try {
        const { countryname } = req.params;
        
        console.log('⚖️ COMPARE CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname });
        console.log('📌 Full URL:', req.originalUrl);
        
        // Get country details
        let currentCountry = null;
        allCountries = await Country.getAll();
        if (countryname) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
            
            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive'
                });
            }
        }

        // Get vehicle types for dropdown (with country filter)
        const vehicleTypes = await getVehicleTypes(currentCountry ? currentCountry.id : null);
        
        // Get popular models for recommendations (with country filter) - FIXED
        let popularModels = [];
        try {
            popularModels = await Model.getPopularModels(8, currentCountry ? currentCountry.id : null);
            console.log(`✅ Found ${popularModels.length} popular models`);
        } catch (err) {
            console.error('Error fetching popular models:', err);
            popularModels = [];
        }
        
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const currencySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';
        const countryPrefix = countryname ? '/' + countryname : '';

        res.render('./publicpages/compare', {
            vehicleTypes: vehicleTypes || [],
            popularModels: popularModels || [],
            selectedModels: [],
            comparisonData: null,
            currentPage: 'compare',
            country: currentCountry,
            allCountries,
            countryDisplay,
            currencySymbol,
            countryPrefix,
            path: countryname ? `/${countryname}/compare` : '/compare',
            title: `Compare Vehicles Side-by-Side in ${countryDisplay} | GadiDrive`,
            description: `Compare multiple vehicles side-by-side with detailed specifications, features, and prices in ${countryDisplay}. Compare cars, bikes, and scooters to find the best one.`,
            ogImage: '/images/mainlogo.png',
            keywords: `vehicle comparison ${countryDisplay.toLowerCase()}, car compare, bike compare, price comparison ${countryDisplay.toLowerCase()}, GadiDrive comparison`
        });
    } catch (error) {
        console.error('Error in compare controller:', error);
        res.render('./publicpages/compare', {
            vehicleTypes: [],
            popularModels: [],
            selectedModels: [],
            comparisonData: null,
            error: 'Error loading comparison page',
            country: null,
            allCountries: [],
            countryDisplay: 'Nepal',
            currencySymbol: 'रू',
            countryPrefix: '',
            path: '/compare',
            title: 'Compare Vehicles Side-by-Side | GadiDrive',
            description: 'Compare multiple vehicles side-by-side with detailed specifications, features, and prices.',
            keywords: 'vehicle comparison, car compare, bike compare, price comparison'
        });
    }
};

// Get vehicle types with country filter
async function getVehicleTypes(countryId = null) {
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
        
        query += ` ORDER BY vehicle_type_name`;
        
        const [rows] = await db.execute(query, params);
        return rows;
    } catch (error) {
        console.error('Error fetching vehicle types:', error);
        return [];
    }
}

// Get brands by vehicle type with country filter
exports.getBrandsByVehicleType = async (req, res, next) => {
    try {
        const { vehicleTypeId } = req.params;
        const { countryname } = req.query;
        
        let countryId = null;
        if (countryname) {
            const country = await Country.getByName(countryname);
            countryId = country?.id || null;
        }
        
        const [brands] = await db.execute(`
            SELECT DISTINCT b.brand_id, b.name 
            FROM brands b
            JOIN models m ON b.brand_id = m.brand_id
            WHERE m.vehicle_type_id = ?
              AND (m.country_id = ? OR m.country_id IS NULL)
            ORDER BY b.name
        `, [vehicleTypeId, countryId]);
        
        res.json({
            success: true,
            brands: brands || []
        });
    } catch (error) {
        console.error('Error fetching brands:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching brands'
        });
    }
};

// Get models by brand and vehicle type with country filter
exports.getModelsByBrand = async (req, res, next) => {
    try {
        const { vehicleTypeId, brandId } = req.params;
        const { countryname } = req.query;
        
        let countryId = null;
        if (countryname) {
            const country = await Country.getByName(countryname);
            countryId = country?.id || null;
        }
        
        const [models] = await db.execute(`
            SELECT m.id, m.model_name, m.model_image, m.starting_price
            FROM models m
            WHERE m.vehicle_type_id = ? AND m.brand_id = ?
              AND (m.status = 'published' OR m.status = 'import')
              AND (m.country_id = ? OR m.country_id IS NULL)
            ORDER BY m.model_name
        `, [vehicleTypeId, brandId, countryId]);
        
        // Format price with currency
        const formattedModels = models.map(model => ({
            ...model,
            formatted_price: model.starting_price ? 
                new Intl.NumberFormat('en-IN').format(model.starting_price) : null
        }));
        
        res.json({
            success: true,
            models: formattedModels || []
        });
    } catch (error) {
        console.error('Error fetching models:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching models'
        });
    }
};

// Get model details for comparison
exports.getModelDetails = async (req, res, next) => {
    try {
        const { modelId } = req.params;
        const { countryname } = req.query;
        
        let countryId = null;
        let currencySymbol = 'रू';
        
        if (countryname) {
            const country = await Country.getByName(countryname);
            countryId = country?.id || null;
            currencySymbol = country?.currency_symbol || 'रू';
        }
        
        const model = await Model.getModelById(modelId);
        if (!model) {
            return res.status(404).json({
                success: false,
                message: 'Model not found'
            });
        }
        
        // Verify model belongs to this country (or is global)
        if (countryId && model.country_id && model.country_id !== countryId) {
            return res.status(404).json({
                success: false,
                message: 'Model not available in this country'
            });
        }
        
        const details = await Model.getModelDetails(modelId);
        
        // Format price with currency
        const formattedPrice = model.starting_price ? 
            `${currencySymbol} ${new Intl.NumberFormat('en-IN').format(model.starting_price)}` : 'Price not available';
        
        res.json({
            success: true,
            model: {
                ...model,
                formatted_price: formattedPrice,
                details: details
            }
        });
    } catch (error) {
        console.error('Error fetching model details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching model details'
        });
    }
};

// Handle comparison
exports.postCompare = async (req, res, next) => {
    try {
        const { modelIds } = req.body;
        const { countryname } = req.query;
        
        console.log('📊 POST COMPARE - Models:', modelIds, 'Country:', countryname);
        
        if (!modelIds || !Array.isArray(modelIds) || modelIds.length < 2 || modelIds.length > 4) {
            return res.status(400).json({
                success: false,
                message: 'Please select 2 to 4 vehicles to compare'
            });
        }

        // Get country details for currency
        let countryId = null;
        let currencySymbol = 'रू';
        if (countryname) {
            const country = await Country.getByName(countryname);
            countryId = country?.id || null;
            currencySymbol = country?.currency_symbol || 'रू';
        }

        // Get models data
        const models = [];
        for (const modelId of modelIds) {
            try {
                const model = await Model.getModelById(modelId);
                if (model) {
                    // Verify model belongs to this country (or is global)
                    if (countryId && model.country_id && model.country_id !== countryId) {
                        console.log(`⚠️ Model ${modelId} not available in ${countryname}`);
                        continue; // Skip models not in this country
                    }
                    
                    const details = await Model.getModelDetails(modelId);
                    const formattedPrice = model.starting_price ? 
                        `${currencySymbol} ${new Intl.NumberFormat('en-IN').format(model.starting_price)}` : 'Not Available';
                    
                    models.push({
                        ...model,
                        formatted_price: formattedPrice,
                        details: details
                    });
                }
            } catch (err) {
                console.error(`Error fetching model ${modelId}:`, err);
            }
        }

        if (models.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Could not find selected models in this country'
            });
        }

        // Generate comparison data
        const comparisonData = generateComparisonData(models, currencySymbol);
        
        // Get popular models for recommendations (with country filter) - FIXED
        let popularModels = [];
        try {
            popularModels = await Model.getPopularModels(8, countryId);
            console.log(`✅ Found ${popularModels.length} popular models for recommendations`);
        } catch (err) {
            console.error('Error fetching popular models:', err);
            popularModels = [];
        }

        res.json({
            success: true,
            comparisonData: comparisonData,
            popularModels: popularModels || []
        });

    } catch (error) {
        console.error('Error in postCompare:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing comparison'
        });
    }
};

// Function to generate comparison data
function generateComparisonData(models, currencySymbol = 'रू') {
    const allSpecs = new Set();
    const modelsData = [];
    
    // Collect all unique specifications from all models
    models.forEach(model => {
        // Add basic model specs to the set
        if (model.engine_type) allSpecs.add('Engine Type');
        if (model.power) allSpecs.add('Power');
        if (model.torque) allSpecs.add('Torque');
        if (model.ground_clearance) allSpecs.add('Ground Clearance');
        if (model.dimensions) allSpecs.add('Dimensions');
        if (model.drive_type) allSpecs.add('Drive Type');
        if (model.seater) allSpecs.add('Seating Capacity');
        if (model.total_airbags) allSpecs.add('Total Airbags');
        if (model.boot_space) allSpecs.add('Boot Space');
        if (model.range_mileage) allSpecs.add(model.engine_type && model.engine_type.toLowerCase().includes('electric') ? 'Range' : 'Mileage');
        if (model.battery_capacity) allSpecs.add('Battery Capacity');
        if (model.cylinders) allSpecs.add('Cylinders');
        if (model.fuel_tank) allSpecs.add('Fuel Tank Capacity');
        if (model.starting_price) allSpecs.add('Price');
        if (model.safety_rating) allSpecs.add('Safety Rating');
        if (model.release_year) allSpecs.add('Launch Year');
        if (model.engine) allSpecs.add('Engine');

        // Add detailed specifications
        if (model.details && model.details.specifications) {
            model.details.specifications.forEach(spec => {
                const specLists = model.details.specificationLists.filter(
                    list => list.specification_id === spec.id
                );
                specLists.forEach(list => {
                    allSpecs.add(list.title);
                });
            });
        }
    });

    // Prepare models data with specification values
    models.forEach(model => {
        const modelSpecs = {};
        const modelSpecValues = {};
        
        // Add basic specs with values
        if (model.engine_type) {
            modelSpecs['Engine Type'] = true;
            modelSpecValues['Engine Type'] = model.engine_type;
        }
        if (model.power) {
            modelSpecs['Power'] = true;
            modelSpecValues['Power'] = model.power;
        }
        if (model.torque) {
            modelSpecs['Torque'] = true;
            modelSpecValues['Torque'] = model.torque;
        }
        if (model.ground_clearance) {
            modelSpecs['Ground Clearance'] = true;
            modelSpecValues['Ground Clearance'] = model.ground_clearance;
        }
        if (model.dimensions) {
            modelSpecs['Dimensions'] = true;
            modelSpecValues['Dimensions'] = model.dimensions;
        }
        if (model.drive_type) {
            modelSpecs['Drive Type'] = true;
            modelSpecValues['Drive Type'] = model.drive_type;
        }
        if (model.seater) {
            modelSpecs['Seating Capacity'] = true;
            modelSpecValues['Seating Capacity'] = model.seater + ' Seater';
        }
        if (model.total_airbags) {
            modelSpecs['Total Airbags'] = true;
            modelSpecValues['Total Airbags'] = model.total_airbags;
        }
        if (model.boot_space) {
            modelSpecs['Boot Space'] = true;
            modelSpecValues['Boot Space'] = model.boot_space;
        }
        if (model.range_mileage) {
            const specName = model.engine_type && model.engine_type.toLowerCase().includes('electric') ? 'Range' : 'Mileage';
            modelSpecs[specName] = true;
            modelSpecValues[specName] = model.range_mileage;
        }
        if (model.battery_capacity) {
            modelSpecs['Battery Capacity'] = true;
            modelSpecValues['Battery Capacity'] = model.battery_capacity;
        }
        if (model.cylinders) {
            modelSpecs['Cylinders'] = true;
            modelSpecValues['Cylinders'] = model.cylinders;
        }
        if (model.fuel_tank) {
            modelSpecs['Fuel Tank Capacity'] = true;
            modelSpecValues['Fuel Tank Capacity'] = model.fuel_tank;
        }
        if (model.starting_price) {
            modelSpecs['Price'] = true;
            modelSpecValues['Price'] = model.formatted_price;
        }
        if (model.safety_rating) {
            modelSpecs['Safety Rating'] = true;
            modelSpecValues['Safety Rating'] = model.safety_rating + ' Stars';
        }
        if (model.release_year) {
            modelSpecs['Launch Year'] = true;
            modelSpecValues['Launch Year'] = model.release_year;
        }
        if (model.engine) {
            modelSpecs['Engine'] = true;
            modelSpecValues['Engine'] = model.engine;
        }
        
        // Add detailed specifications with values
        if (model.details && model.details.specifications) {
            model.details.specifications.forEach(spec => {
                const specLists = model.details.specificationLists.filter(
                    list => list.specification_id === spec.id
                );
                specLists.forEach(list => {
                    // For specifications, just track availability
                    modelSpecs[list.title] = true;
                    // Store the specification value if available
                    const specContent = model.details.specContents.find(
                        sc => sc.list_id === list.id && sc.type === 'text'
                    );
                    if (specContent) {
                        modelSpecValues[list.title] = specContent.value;
                    }
                });
            });
        }

        modelsData.push({
            id: model.id,
            name: model.model_name,
            brand: model.brand_name,
            image: model.model_image,
            vehicle_type_name: model.vehicle_type_name || 'car',
            specs: modelSpecs,
            specValues: modelSpecValues,
            basicInfo: {
                engine_type: model.engine_type,
                power: model.power,
                torque: model.torque,
                ground_clearance: model.ground_clearance,
                dimensions: model.dimensions,
                drive_type: model.drive_type,
                seater: model.seater,
                total_airbags: model.total_airbags,
                boot_space: model.boot_space,
                range_mileage: model.range_mileage,
                battery_capacity: model.battery_capacity,
                cylinders: model.cylinders,
                fuel_tank: model.fuel_tank,
                starting_price: model.formatted_price,
                safety_rating: model.safety_rating ? model.safety_rating + ' Stars' : null,
                release_year: model.release_year,
                engine: model.engine
            }
        });
    });

    // Calculate scores
    const totalSpecs = allSpecs.size;
    modelsData.forEach(model => {
        const score = Object.keys(model.specs).length;
        model.score = score;
        model.scorePercentage = totalSpecs > 0 ? Math.round((score / totalSpecs) * 100) : 0;
    });

    // Sort by score (highest first)
    modelsData.sort((a, b) => b.score - a.score);

    return {
        specifications: Array.from(allSpecs),
        models: modelsData,
        totalSpecifications: totalSpecs
    };
}