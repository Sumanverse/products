const Brand = require('../../models/brands');
const Model = require('../../models/models');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const db = require('../../utils/dbutils');

exports.getbrandsdetails = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, brandname } = req.params;

        console.log('🔍 BRAND DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, vehicletypename, brandname });
        console.log('📌 Full URL:', req.originalUrl);

        if (!vehicletypename || !brandname) {
            return res.status(404).render('error', {
                message: 'Invalid URL',
                title: 'Page Not Found - gadidrive',
                path: req.path,
                country: null,
                allCountries: []
            });
        }

        // ── Step 1: Get all countries + current country ──────────────────
        let currentCountry = null;
        let allCountries = [];

        allCountries = await Country.getAll();

        if (countryname) {
            currentCountry = allCountries.find(c =>
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );

            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive',
                    path: req.path,
                    country: null,
                    allCountries
                });
            }
        }

        const countryId = currentCountry ? currentCountry.id : null;

        // ── Step 2: Get vehicle type ─────────────────────────────────────
        console.log('🚗 Looking for vehicle type:', vehicletypename);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, countryId);

        if (!vehicleType) {
            console.log('❌ Vehicle type not found:', vehicletypename);
            return res.status(404).render('error', {
                message: `Vehicle type "${vehicletypename}" not found`,
                title: 'Vehicle Type Not Found - gadidrive',
                path: req.path,
                country: currentCountry,
                allCountries
            });
        }
        console.log('✅ Vehicle type found:', vehicleType.vehicle_type_name, '(ID:', vehicleType.vehicle_type_id, ')');

        // ── Step 3: Get brand with vehicle type + country filter ─────────
        const cleanBrandName = brandname.replace(/-/g, ' ');
        console.log('🧹 Clean brand name:', cleanBrandName);

        // ✅ PRIMARY: exact match with vehicleTypeId + countryId
        let brand = await Brand.getBrandByName(cleanBrandName, countryId, vehicleType.vehicle_type_id);
        console.log('📁 Primary lookup:', brand
            ? `Found: ${brand.name} (ID: ${brand.brand_id}, VehicleTypeID: ${brand.vehicle_type_id})`
            : 'Not found');

        // ✅ FALLBACK: try original hyphenated name
        if (!brand) {
            brand = await Brand.getBrandByName(brandname, countryId, vehicleType.vehicle_type_id);
            console.log('📁 Fallback lookup:', brand ? `Found: ${brand.name}` : 'Not found');
        }

        // ── Step 4: Brand not found — 404, NO redirect (Bug 2 fix) ──────
        if (!brand) {
            console.log('❌ Brand not found for this vehicle type + country combination');
            return res.status(404).render('error', {
                message: `Brand "${cleanBrandName}" not found for "${vehicleType.vehicle_type_name}" in ${currentCountry ? currentCountry.country_name : 'Global'}`,
                title: 'Brand Not Found - gadidrive',
                path: req.path,
                country: currentCountry,
                allCountries
            });
        }

        console.log('✅ Brand found:', brand.name, '| VehicleTypeID:', brand.vehicle_type_id);

        // ── Step 5: Fetch models ─────────────────────────────────────────
        console.log('📊 Fetching models — Brand:', brand.name,
            '| VehicleType:', vehicleType.vehicle_type_id,
            '| Country:', countryId);

        const [modelRows] = await db.execute(
            `SELECT m.*,
                    b.name as brand_name,
                    b.brand_id,
                    b.image_path as brand_image_path,
                    b.vehicle_type_id as brand_vehicle_type_id,
                    vt.vehicle_type_name,
                    co.country_name,
                    co.currency_symbol
             FROM models m
             JOIN brands b ON m.brand_id = b.brand_id
             JOIN vehicletype vt ON m.vehicle_type_id = vt.vehicle_type_id
             LEFT JOIN countries co ON m.country_id = co.id
             WHERE LOWER(b.name) = LOWER(?)
               AND m.vehicle_type_id = ?
               AND (m.country_id = ? OR m.country_id IS NULL)
             ORDER BY
               CASE
                 WHEN m.engine_type LIKE '%electric%' THEN 1
                 WHEN m.engine_type LIKE '%hybrid%' THEN 2
                 ELSE 3
               END,
               m.model_name`,
            [brand.name, brand.vehicle_type_id, countryId]
        );

        console.log(`✅ Found ${modelRows.length} models`);

        // ── Step 6: Group models by engine type ──────────────────────────
        const electricModels = modelRows.filter(m => {
            const t = m.engine_type?.toLowerCase() || '';
            return t.includes('electric') && !t.includes('hybrid');
        });

        const hybridModels = modelRows.filter(m => {
            const t = m.engine_type?.toLowerCase() || '';
            return t.includes('hybrid') && !t.includes('phev') && !t.includes('plug-in');
        });

        const phevModels = modelRows.filter(m => {
            const t = m.engine_type?.toLowerCase() || '';
            return t.includes('phev') || t.includes('plug-in hybrid');
        });

        const iceModels = modelRows.filter(m => {
            const t = m.engine_type?.toLowerCase() || '';
            return t === 'ice' || (!t.includes('electric') && !t.includes('hybrid'));
        });

        // ── Step 7: Related brands & categories ─────────────────────────
        const relatedBrands = await Brand.getBrandsByVehicleType(vehicleType.vehicle_type_id, countryId);

        const [categoryRows] = await db.execute(
            `SELECT category_id, name FROM categories
             WHERE vehicle_type_id = ?
               AND (country_id = ? OR country_id IS NULL)
             ORDER BY name ASC LIMIT 4`,
            [brand.vehicle_type_id, countryId]
        );

        // ── Step 7.5: Suggested Brands & Models ─────────────────────────
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

            // 1) Suggested Brands - Try strict first (same type + same price range + same country)
            const [brandRows] = await db.execute(
                `SELECT b.brand_id, b.name, b.image_path,
                        MIN(CASE WHEN m.starting_price > 0 THEN ABS(m.starting_price - ?) ELSE 999999999 END) AS price_diff
                 FROM brands b
                 JOIN models m ON m.brand_id = b.brand_id
                 WHERE b.brand_id != ?
                   AND m.vehicle_type_id = ?
                   AND (m.status = 'published' OR m.status = 'import')
                   AND (m.country_id = ? OR m.country_id IS NULL)
                 GROUP BY b.brand_id, b.name, b.image_path
                 ORDER BY price_diff ASC, b.name ASC
                 LIMIT 8`,
                [targetPrice, brand.brand_id, brand.vehicle_type_id, countryId]
            );
            suggestedBrands = brandRows;

            // Fallback 1: If no brands in same country/price, just get ANY brands of same vehicle type globally
            if (suggestedBrands.length === 0) {
                const [fallbackBrands] = await db.execute(
                    `SELECT DISTINCT b.brand_id, b.name, b.image_path
                     FROM brands b
                     JOIN models m ON m.brand_id = b.brand_id
                     WHERE b.brand_id != ?
                       AND m.vehicle_type_id = ?
                       AND (m.status = 'published' OR m.status = 'import')
                     LIMIT 8`,
                    [brand.brand_id, brand.vehicle_type_id]
                );
                suggestedBrands = fallbackBrands;
            }

            // Fallback 2: Literal last resort (any popular brands)
            if (suggestedBrands.length === 0) {
                const [lastResortBrands] = await db.execute(
                    `SELECT brand_id, name, image_path FROM brands WHERE brand_id != ? LIMIT 8`,
                    [brand.brand_id]
                );
                suggestedBrands = lastResortBrands;
            }

            // 2) Suggested Models - Try strict first
            const [modelSuggestRows] = await db.execute(
                `SELECT m.id, m.model_name, m.model_image, m.starting_price, m.engine_type,
                        m.vehicle_type_id, m.brand_id, m.country_id,
                        b.name AS brand_name,
                        v.vehicle_type_name,
                        co.country_name, co.currency_symbol,
                        ABS(CASE WHEN m.starting_price > 0 THEN m.starting_price ELSE 0 END - ?) AS price_diff
                 FROM models m
                 JOIN brands b ON m.brand_id = b.brand_id
                 JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                 LEFT JOIN countries co ON m.country_id = co.id
                 WHERE m.brand_id != ?
                   AND m.vehicle_type_id = ?
                   AND (m.status = 'published' OR m.status = 'import')
                   AND (m.country_id = ? OR m.country_id IS NULL)
                 ORDER BY (m.starting_price > 0) DESC, price_diff ASC
                 LIMIT 8`,
                [targetPrice, brand.brand_id, brand.vehicle_type_id, countryId]
            );
            suggestedModels = modelSuggestRows;

            // Fallback for models: ignore country if no local matches
            if (suggestedModels.length === 0) {
                const [fallbackModels] = await db.execute(
                    `SELECT m.id, m.model_name, m.model_image, m.starting_price, m.engine_type,
                            b.name AS brand_name, co.currency_symbol
                     FROM models m
                     JOIN brands b ON m.brand_id = b.brand_id
                     LEFT JOIN countries co ON m.country_id = co.id
                     WHERE m.brand_id != ?
                       AND m.vehicle_type_id = ?
                       AND (m.status = 'published' OR m.status = 'import')
                     ORDER BY m.id DESC LIMIT 8`,
                    [brand.brand_id, brand.vehicle_type_id]
                );
                suggestedModels = fallbackModels;
            }

            console.log(`✅ Suggestions: ${suggestedBrands.length} brands, ${suggestedModels.length} models`);
        } catch (err) {
            console.error('❌ Error in Suggestions:', err);
        }

        console.log(`✅ Suggestions: ${suggestedBrands.length} brands, ${suggestedModels.length} models`);

        // ── Step 7.7: Get available countries for hreflang ────────────────
        const availableCountries = await Brand.getCountriesForBrand(
            brand.name, vehicleType.vehicle_type_id
        );
        console.log(`🌍 Available countries for this brand: ${availableCountries.length}`);

        // ── Step 8: Meta & render ────────────────────────────────────────
        const pluralType = vehicleType.vehicle_type_name.endsWith('s')
            ? vehicleType.vehicle_type_name
            : vehicleType.vehicle_type_name + 's';

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Global';

        const canonicalUrl = countryname
            ? `/${countryname}/${vehicletypename}/${brandname}/`
            : `/${vehicletypename}/${brandname}/`;

        console.log('✅ Rendering brandsdetails page with', modelRows.length, 'models');

        return res.render('publicpages/brandsdetails', {
            brand,
            vehicleType,
            vehicletypename,
            brandname,
            country: currentCountry,
            allCountries,
            electricModels,
            iceModels,
            hybridModels,
            phevModels,
            pluralType,
            relatedBrands: relatedBrands.filter(b => b.brand_id != brand.brand_id).slice(0, 4),
            categories: categoryRows,
            suggestedBrands,
            suggestedModels,
            availableCountries, // Added for SEO hreflang
            path: canonicalUrl,
            canonicalUrl,
            title: `All ${brand.name} ${pluralType} in ${countryDisplay} | gadidrive`,
            description: `Explore all ${brand.name} ${pluralType.toLowerCase()} in ${countryDisplay}. Specs, prices, features, and complete buying guide.`,
            keywords: `${brand.name} ${pluralType}, ${brand.name} ${countryDisplay.toLowerCase()}, ${brand.name} price`,
            brandVehicleTypeMismatch: false
        });

    } catch (error) {
        console.error('❌ Error in brand details controller:', error);
        console.error('Error stack:', error.stack);

        res.status(500).render('error', {
            message: 'Server error occurred while loading brand details',
            title: 'Server Error - gadidrive',
            path: req.path,
            country: null,
            allCountries: []
        });
    }
};