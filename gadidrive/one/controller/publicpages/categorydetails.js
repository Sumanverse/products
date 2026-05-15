const Category = require('../../models/category');
const Model = require('../../models/models');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const db = require('../../utils/dbutils');
const fs = require('fs');
const path = require('path');

exports.getcategorydetails = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, categoryname } = req.params;

        // Debug logs
        console.log('🔍 CATEGORY DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, vehicletypename, categoryname });
        console.log('📌 Full URL:', req.originalUrl);

        // Validate parameters
        if (!vehicletypename || !categoryname) {
            console.log('❌ Invalid URL: Missing parameters');
            return res.status(404).render('error', {
                message: 'Invalid URL',
                title: 'Page Not Found - gadidrive',
                path: req.path
            });
        }

        // Get country details
        let currentCountry = null;
        let allCountries = [];

        if (countryname) {
            allCountries = await Country.getAll();
            currentCountry = allCountries.find(c =>
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );

            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive',
                    path: req.path
                });
            }
        }

        // Step 1: Get vehicle type by name with country context
        console.log('🚗 Looking for vehicle type:', vehicletypename);
        const vehicleType = await VehicleType.getVehicleTypeByName(
            vehicletypename,
            currentCountry ? currentCountry.id : null
        );

        if (!vehicleType) {
            console.log('❌ Vehicle type not found:', vehicletypename);
            return res.status(404).render('error', {
                message: `Vehicle type "${vehicletypename}" not found${countryname ? ' in ' + countryname : ''}`,
                title: 'Vehicle Type Not Found - gadidrive',
                path: req.path
            });
        }
        console.log('✅ Vehicle type found:', vehicleType.vehicle_type_name, '(ID:', vehicleType.vehicle_type_id, ')');

        // Step 2: Clean category name (remove hyphens)
        const cleanCategoryName = categoryname.replace(/-/g, ' ');
        console.log('🧹 Clean category name:', cleanCategoryName);

        // Step 3: Try to find category by various methods with country context
        let category = null;

        // Method 1: Try with cleaned name (spaces instead of hyphens) and country
        category = await Category.getCategoryByName(cleanCategoryName, currentCountry ? currentCountry.id : null);
        console.log('📁 Method 1 result:', category ? `Found: ${category.name} (ID: ${category.category_id}, VehicleTypeID: ${category.vehicle_type_id})` : 'Not found');

        // Method 2: Try with original name (with hyphens)
        if (!category) {
            category = await Category.getCategoryByName(categoryname, currentCountry ? currentCountry.id : null);
            console.log('📁 Method 2 result:', category ? `Found: ${category.name}` : 'Not found');
        }

        // Method 3: Try case-insensitive search with direct query including country
        if (!category) {
            console.log('📁 Method 3: Trying direct database query with country');
            const [rows] = await db.execute(
                `SELECT c.*, v.vehicle_type_name, co.country_name, co.currency_symbol
                 FROM categories c
                 JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
                 LEFT JOIN countries co ON c.country_id = co.id
                 WHERE LOWER(c.name) = LOWER(?) 
                   AND (c.country_id = ? OR c.country_id IS NULL)`,
                [cleanCategoryName, currentCountry ? currentCountry.id : null]
            );

            if (rows.length > 0) {
                category = rows[0];
                console.log('✅ Found via direct query:', category.name);
            }
        }

        // If still not found, return 404
        if (!category) {
            console.log('❌ Category not found in database:', categoryname);
            return res.status(404).render('error', {
                message: `Category "${categoryname}" not found${countryname ? ' in ' + countryname : ''}`,
                title: 'Category Not Found - gadidrive',
                path: req.path
            });
        }

        console.log('✅ Category found:', category.name);
        console.log('Category vehicle_type_id:', category.vehicle_type_id);
        console.log('Vehicle type ID from URL:', vehicleType.vehicle_type_id);

        // Step 4: Check if category belongs to this vehicle type
        if (category.vehicle_type_id !== vehicleType.vehicle_type_id) {
            console.log('⚠️ WARNING: Category does NOT belong to this vehicle type!');

            // Find the correct vehicle type for this category
            const correctVehicleType = await VehicleType.getVehicleTypeById(category.vehicle_type_id);

            if (correctVehicleType) {
                // Redirect to correct URL (SEO-friendly format)
                const redirectUrl = countryname
                    ? `/${countryname}/${correctVehicleType.vehicle_type_name}/${categoryname}/`
                    : `/${correctVehicleType.vehicle_type_name}/${categoryname}/`;

                console.log(`🔄 Redirecting to correct URL: ${redirectUrl}`);
                return res.redirect(301, redirectUrl);
            }

            // If can't find correct vehicle type, show error
            const pluralType = vehicleType.vehicle_type_name.endsWith('s') ? vehicleType.vehicle_type_name : vehicleType.vehicle_type_name + 's';
            const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';

            return res.render('publicpages/categorydetails', {
                category: category,
                vehicleType: vehicleType,
                vehicletypename: vehicletypename,
                categoryname: categoryname,
                country: currentCountry,
                allCountries: allCountries,
                electricModels: [],
                iceModels: [],
                hybridModels: [],
                phevModels: [],
                pluralType: pluralType,
                relatedCategories: [],
                path: countryname ? `/${countryname}/${vehicletypename}/${categoryname}/` : `/${vehicletypename}/${categoryname}/`,
                title: `All ${category.name} ${pluralType} in ${countryDisplay} | gadidrive`,
                description: `Explore ${category.name} ${pluralType.toLowerCase()} available in ${countryDisplay}. Find detailed specifications, prices, features.`,
                keywords: `${category.name} ${pluralType}, ${category.name} models, ${category.name} ${countryDisplay.toLowerCase()}`,
                categoryVehicleTypeMismatch: true
            });
        }

        console.log('✅ Category belongs to this vehicle type - proceeding to fetch models');

        // Step 5: Get models in this category for this country
        console.log('📊 Fetching models for category ID:', category.category_id);

        const [modelRows] = await db.execute(
            `SELECT m.*, 
                    b.name as brand_name,
                    b.brand_id,
                    b.image_path as brand_image_path,
                    v.vehicle_type_name,
                    co.country_name,
                    co.currency_symbol
             FROM models m
             JOIN brands b ON m.brand_id = b.brand_id
             JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
             LEFT JOIN countries co ON m.country_id = co.id
             WHERE m.category_id = ? 
               AND (m.country_id = ? OR m.country_id IS NULL)
             ORDER BY 
               CASE 
                 WHEN m.engine_type LIKE '%electric%' THEN 1
                 WHEN m.engine_type LIKE '%hybrid%' THEN 2
                 ELSE 3 
               END,
               b.name, m.model_name`,
            [category.category_id, currentCountry ? currentCountry.id : null]
        );

        console.log(`✅ Found ${modelRows.length} models in this category for ${countryname || 'Nepal'}`);

        // Step 6: Classify models by engine type
        const electricModels = modelRows.filter(m =>
            m.engine_type && /electric/i.test(m.engine_type) && !/hybrid|phev/i.test(m.engine_type)
        );

        const iceModels = modelRows.filter(m =>
            !m.engine_type ||
            /(petrol|gasoline|diesel)/i.test(m.engine_type) ||
            (!/electric|hybrid|phev/i.test(m.engine_type))
        );

        const hybridModels = modelRows.filter(m =>
            m.engine_type && /hybrid/i.test(m.engine_type) && !/phev|plug-in/i.test(m.engine_type)
        );

        const phevModels = modelRows.filter(m =>
            m.engine_type && (/phev|plug-in|plugin/i.test(m.engine_type))
        );

        console.log('Model counts:', {
            electric: electricModels.length,
            ice: iceModels.length,
            hybrid: hybridModels.length,
            phev: phevModels.length
        });

        // ── Step 7: Suggested Categories, Brands & Models ──────────────
        let suggestedCategories = [];
        let suggestedBrands = [];
        let suggestedModels = [];

        try {
            const pricedModels = modelRows.filter(m => m.starting_price && parseFloat(m.starting_price) > 0);
            const hasPrices = pricedModels.length > 0;
            let targetPrice = 0;
            if (hasPrices) {
                const prices = pricedModels.map(m => parseFloat(m.starting_price));
                targetPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            }

            const currentCountryId = currentCountry ? currentCountry.id : null;

            // 1) Suggested Categories - Try with country first
            const [catRows] = await db.execute(
                `SELECT category_id, name, image_path FROM categories
                 WHERE category_id != ?
                   AND vehicle_type_id = ?
                   AND (country_id = ? OR country_id IS NULL)
                 ORDER BY name ASC LIMIT 8`,
                [category.category_id, vehicleType.vehicle_type_id, currentCountryId]
            );
            suggestedCategories = catRows;

            // Fallback for categories: try global if country-specific is empty
            if (suggestedCategories.length === 0) {
                const [fallbackCatRows] = await db.execute(
                    `SELECT category_id, name, image_path FROM categories
                     WHERE category_id != ?
                       AND vehicle_type_id = ?
                     ORDER BY name ASC LIMIT 8`,
                    [category.category_id, vehicleType.vehicle_type_id]
                );
                suggestedCategories = fallbackCatRows;
            }

            // 2) Suggested Brands - Brands associated with this vehicle type
            const [brandRows] = await db.execute(
                `SELECT DISTINCT b.brand_id, b.name, b.image_path
                 FROM brands b
                 JOIN models m ON m.brand_id = b.brand_id
                 WHERE m.vehicle_type_id = ?
                   AND (m.status = 'published' OR m.status = 'import')
                   AND (m.country_id = ? OR m.country_id IS NULL)
                 LIMIT 8`,
                [vehicleType.vehicle_type_id, currentCountryId]
            );
            suggestedBrands = brandRows;

            // Fallback for brands: try any brand associated with this vehicle type
            if (suggestedBrands.length === 0) {
                const [fallbackBrandRows] = await db.execute(
                    `SELECT brand_id, name, image_path FROM brands
                     WHERE vehicle_type_id = ?
                     ORDER BY name ASC LIMIT 12`,
                    [vehicleType.vehicle_type_id]
                );
                suggestedBrands = fallbackBrandRows;
            }

            // 3) Suggested Models - Try with country first
            const [modelSuggestRows] = await db.execute(
                `SELECT m.id, m.model_name, m.model_image, m.starting_price, m.engine_type,
                        m.vehicle_type_id, m.brand_id, m.country_id,
                        b.name AS brand_name,
                        v.vehicle_type_name,
                        co.country_name, co.currency_symbol,
                        ABS(CASE WHEN m.starting_price > 0 THEN m.starting_price ELSE 0 END - ?) AS price_diff
                 FROM models m
                 LEFT JOIN brands b ON m.brand_id = b.brand_id
                 LEFT JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                 LEFT JOIN countries co ON m.country_id = co.id
                 WHERE m.category_id != ?
                   AND m.vehicle_type_id = ?
                   AND (m.status = 'published' OR m.status = 'import')
                   AND (m.country_id = ? OR m.country_id IS NULL)
                 ORDER BY (m.starting_price > 0) DESC, price_diff ASC
                 LIMIT 8`,
                [targetPrice, category.category_id, vehicleType.vehicle_type_id, currentCountryId]
            );
            suggestedModels = modelSuggestRows;

            // Fallback for models: ignore country and category constraints, just same type
            if (suggestedModels.length === 0) {
                const [fallbackModelRows] = await db.execute(
                    `SELECT m.id, m.model_name, m.model_image, m.starting_price, m.engine_type,
                            b.name AS brand_name, co.currency_symbol,
                            ABS(CASE WHEN m.starting_price > 0 THEN m.starting_price ELSE 0 END - ?) AS price_diff
                     FROM models m
                     LEFT JOIN brands b ON m.brand_id = b.brand_id
                     LEFT JOIN countries co ON m.country_id = co.id
                     WHERE m.vehicle_type_id = ?
                       AND (m.status = 'published' OR m.status = 'import')
                     ORDER BY (m.starting_price > 0) DESC, price_diff ASC LIMIT 8`,
                    [targetPrice, vehicleType.vehicle_type_id]
                );
                suggestedModels = fallbackModelRows;
            }

            // Ultimate Fallback: Any published models if still empty
            if (suggestedModels.length === 0) {
                const [ultimateModels] = await db.execute(
                    `SELECT m.id, m.model_name, m.model_image, m.starting_price, m.engine_type,
                            b.name AS brand_name, co.currency_symbol, v.vehicle_type_name
                     FROM models m
                     LEFT JOIN brands b ON m.brand_id = b.brand_id
                     LEFT JOIN countries co ON m.country_id = co.id
                     LEFT JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                     ORDER BY m.id DESC LIMIT 8`
                );
                suggestedModels = ultimateModels;
            }

            // DEBUG FOR USER: If still empty, use current page models
            if (suggestedModels.length === 0 && modelRows && modelRows.length > 0) {
                console.log('⚠️ Forced suggestedModels from modelRows');
                suggestedModels = modelRows;
            }

            const debugInfo = {
                timestamp: new Date().toISOString(),
                vtId,
                country: currentCountryId,
                cats: suggestedCategories.length,
                brands: suggestedBrands.length,
                models: suggestedModels.length,
                category_id: category.category_id
            };
            fs.appendFileSync(path.join(__dirname, '../../debug_suggestions.txt'), JSON.stringify(debugInfo) + '\n');

            console.log(`✅ Suggestions DEBUG: vtId=${vtId}, country=${currentCountryId}`);
            console.log(`✅ Results: cats=${suggestedCategories.length}, brands=${suggestedBrands.length}, models=${suggestedModels.length}`);
        } catch (err) {
            console.error('❌ Error in Category Suggestions:', err);
        }

        // ── Step 7.5: Get available countries for hreflang ────────────────
        const availableCountries = await Category.getCountriesForCategory(
            category.name, vehicleType.vehicle_type_id
        );
        console.log(`🌍 Available countries for this category: ${availableCountries.length}`);

        // Step 8: Define plural type and country display
        const pluralType = vehicleType.vehicle_type_name.endsWith('s') ?
            vehicleType.vehicle_type_name :
            vehicleType.vehicle_type_name + 's';

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';

        // Step 9: Generate canonical URL (SEO-friendly format)
        const canonicalUrl = countryname
            ? `/${countryname}/${vehicletypename}/${categoryname}/`
            : `/${vehicletypename}/${categoryname}/`;

        // Step 10: Render the page
        console.log('✅ Rendering categorydetails page with', modelRows.length, 'models');

        res.render('publicpages/categorydetails', {
            category,
            vehicleType,
            vehicletypename,
            categoryname,
            country: currentCountry,
            allCountries,
            electricModels,
            iceModels,
            hybridModels,
            phevModels,
            suggestedCategories,
            suggestedBrands,
            suggestedModels,
            availableCountries, // Added for SEO hreflang
            pluralType,
            path: canonicalUrl,
            canonicalUrl: canonicalUrl,
            title: `All ${category.name} ${pluralType} in ${countryDisplay} | gadidrive`,
            description: `Explore all ${category.name.toLowerCase()} ${pluralType.toLowerCase()} in ${countryDisplay}. Check out the latest models, prices, and specifications of Electric, Hybrid, and ICE ${category.name} models on GadiDrive.`,
            keywords: `${category.name} ${pluralType} ${countryDisplay.toLowerCase()}, ${category.name} car price ${countryDisplay.toLowerCase()}, ${category.name} electric, GadiDrive`,
            currentPage: 'category',
            categoryVehicleTypeMismatch: false
        });

    } catch (error) {
        console.error('❌ Error in categorydetails controller:', error);
        console.error('Error stack:', error.stack);

        res.status(500).render('error', {
            message: 'Server error occurred while loading category details',
            title: 'Server Error - gadidrive',
            path: req.path
        });
    }
};