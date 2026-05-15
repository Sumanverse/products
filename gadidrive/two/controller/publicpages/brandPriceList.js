const db = require('../../utils/dbutils');
const Country = require('../../models/country');
const VehicleType = require('../../models/vehicletype');
const Brand = require('../../models/brands');

// ==================== BRAND PRICE LIST ====================
exports.getBrandPriceList = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, brandname } = req.params;

        // ================= COUNTRY =================
        let country = null;
        let countrySlug = '';

        if (countryname && !['car', 'bike', 'truck', 'bus'].includes(countryname)) {
            country = await Country.getByName(countryname);
            if (country) {
                countrySlug = country.country_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            }
        }

        // ================= VEHICLE TYPE =================
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) {
            return res.status(404).render('error', {
                title: 'Vehicle Type Not Found',
                message: `Vehicle type "${vehicletypename}" not found`,
                country,
                allCountries: await Country.getAll(),
                path: req.path
            });
        }

        // ================= BRAND =================
        const cleanBrandName = brandname.replace(/-/g, ' ');
        const brand = await Brand.getBrandByName(cleanBrandName, country?.id, vehicleType.vehicle_type_id);

        if (!brand) {
            return res.status(404).render('error', {
                title: 'Brand Not Found',
                message: `Brand "${cleanBrandName}" not found`,
                country,
                allCountries: await Country.getAll(),
                path: req.path
            });
        }

        const brandSlug = brand.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

        // ================= MODELS =================
        const models = await getModelsWithVariants(brand.brand_id, country?.id, brand.vehicle_type_id);
        const totalModels = models.length;
        const totalVariants = models.reduce((acc, m) => acc + (m.variants?.length || 0), 0);

        // ================= PRICE RANGE LOGIC =================
        let minPrice = Infinity;
        let maxPrice = 0;

        models.forEach(model => {
            const prices = model.variants?.length > 0 
                ? model.variants.map(v => parseFloat(v.variant_price) || 0)
                : [parseFloat(model.starting_price) || 0];
            
            prices.forEach(p => {
                if (p > 0) {
                    minPrice = Math.min(minPrice, p);
                    maxPrice = Math.max(maxPrice, p);
                }
            });
        });

        const currency = country?.currency_symbol || '$';
        const formattedMinPrice = minPrice !== Infinity ? new Intl.NumberFormat('en-IN').format(minPrice) : 'N/A';
        const priceRange = (minPrice !== Infinity && maxPrice > 0)
            ? `${currency}${formattedMinPrice} - ${currency}${new Intl.NumberFormat('en-IN').format(maxPrice)}`
            : 'Price not available';

        // ================= CLEAN SEO CTR OPTIMIZATION =================
        const year = new Date().getFullYear();

        // Optimized Title: Focus on Brand + Country + Year (Clean)
        const seoTitle = country
            ? `${brand.name} Price in ${country.country_name} ${year} - Latest Model List`
            : `${brand.name} Price List ${year} - All Models & Variants`;

        // Optimized Description: Clean but informative
        const seoDescription = country
            ? `Latest ${brand.name} ${vehicleType.vehicle_type_name} prices in ${country.country_name} for ${year}. Compare ${totalModels} models starting from ${currency}${formattedMinPrice}. See full specs and variant details.`
            : `Get the updated ${brand.name} ${vehicleType.vehicle_type_name} price list for ${year}. Full details of ${totalModels} models and ${totalVariants} variants with latest specifications.`;

        const seoKeywords = `${brand.name} price ${country?.country_name || ''}, ${brand.name} ${vehicleType.vehicle_type_name} cost ${year}, ${brand.name} model list`;

        // ================= CANONICAL URL =================
        const canonicalUrl = countrySlug
            ? `/${countrySlug}/${vehicletypename}/${brandSlug}/price-list/`
            : `/${vehicletypename}/${brandSlug}/price-list/`;

        // ================= RECOMMENDATIONS =================
        const recommendedBrands = await getSimilarBrands(brand.vehicle_type_id, brand.brand_id, country?.id);
        
        // Calculate average price of current brand models for price-based recommendations
        const avgPrice = models.length > 0 
            ? models.reduce((sum, m) => sum + (parseFloat(m.starting_price) || 0), 0) / models.length 
            : 0;
        const similarPriceModels = await getSimilarPriceModels(avgPrice, brand.vehicle_type_id, brand.brand_id, country?.id);

        // Filter vehicle types for this country and exclude current one
        const allVehicleTypesRaw = country ? await VehicleType.getVehicleTypesByCountry(country.id) : await VehicleType.getAllVehicleTypes();
        const allVehicleTypes = allVehicleTypesRaw.filter(vt => vt.vehicle_type_id != brand.vehicle_type_id);
        const allCountries = await Country.getAll();

        // Get available countries for hreflang
        const availableCountries = await Brand.getCountriesForBrand(brand.name, vehicleType.vehicle_type_id);

        // ================= RENDER =================
        res.render('publicpages/brandPriceList', {
            seoTitle,
            seoDescription,
            seoKeywords,
            canonicalUrl,
            ogImage: brand.image_path || 'https://gadidrive.com/images/mainlogo.png',
            path: req.path,
            country,
            countryName: country?.country_name || 'Global',
            currencySymbol: currency,
            vehicleType,
            brand,
            models,
            recommendedBrands,
            similarPriceModels,
            totalModels,
            totalVariants,
            priceRange,
            allCountries,
            availableCountries, // Added for SEO hreflang
            vehicleTypes: allVehicleTypes,
            regionSlug: countrySlug,
            currentYear: year
        });

    } catch (error) {
        console.error('❌ Error in getBrandPriceList:', error);
        next(error);
    }
};

// ==================== HELPER FUNCTION ====================
async function getModelsWithVariants(brandId, countryId, vehicleTypeId) {
    try {
        const safeCountryId = countryId || null;
        const [models] = await db.execute(`
            SELECT m.id as model_id, m.model_name, m.starting_price, m.model_image, 
                   m.engine_type, m.seater, m.status, m.release_year, m.safety_rating
            FROM models m
            WHERE m.brand_id = ?
                AND m.vehicle_type_id = ?
                AND (m.country_id = ? OR m.country_id IS NULL)
                AND (m.status = 'published' OR m.status = 'import')
            ORDER BY m.starting_price ASC
        `, [brandId, vehicleTypeId, safeCountryId]);

        for (let model of models) {
            const [variants] = await db.execute(`
                SELECT id as variant_id, name as variant_name, price as variant_price
                FROM variants
                WHERE model_id = ?
                ORDER BY price ASC
            `, [model.model_id]);
            model.variants = variants;
            model.variant_count = variants.length;
        }
        return models;
    } catch (error) {
        console.error('❌ Error in getModelsWithVariants:', error);
        return [];
    }
}

// Get similar brands (same vehicle type, excluding current brand)
async function getSimilarBrands(vehicleTypeId, excludeBrandId, countryId) {
    try {
        const safeCountryId = countryId || null;
        const [brands] = await db.execute(`
            SELECT 
                b.brand_id,
                b.name as brand_name,
                b.image_path,
                COUNT(m.id) as model_count,
                MIN(m.starting_price) as min_price
            FROM brands b
            LEFT JOIN models m ON m.brand_id = b.brand_id
                AND (m.country_id = ? OR m.country_id IS NULL)
                AND (m.status = 'published' OR m.status = 'import')
            WHERE b.vehicle_type_id = ?
                AND b.brand_id != ?
                AND (b.country_id = ? OR b.country_id IS NULL)
            GROUP BY b.brand_id, b.name, b.image_path
            HAVING model_count > 0
            ORDER BY model_count DESC, b.name ASC
            LIMIT 8
        `, [safeCountryId, vehicleTypeId, excludeBrandId, safeCountryId]);
        return brands;
    } catch (error) {
        console.error('❌ Error in getSimilarBrands:', error);
        return [];
    }
}

// Get models in a similar price range
async function getSimilarPriceModels(price, vehicleTypeId, excludeBrandId, countryId) {
    try {
        const safeCountryId = countryId || null;
        const [models] = await db.execute(`
            SELECT * FROM (
                SELECT 
                    m.id as model_id,
                    m.model_name,
                    m.starting_price,
                    m.model_image,
                    b.name as brand_name,
                    ROW_NUMBER() OVER(PARTITION BY b.brand_id ORDER BY ABS(m.starting_price - ?) ASC) as rn
                FROM models m
                JOIN brands b ON m.brand_id = b.brand_id
                WHERE b.vehicle_type_id = ?
                    AND m.brand_id != ?
                    AND (m.country_id = ? OR m.country_id IS NULL)
                    AND (m.status = 'published' OR m.status = 'import')
                    AND m.starting_price BETWEEN ? * 0.6 AND ? * 1.4
            ) t WHERE rn = 1
            ORDER BY ABS(starting_price - ?) ASC
            LIMIT 5
        `, [price, vehicleTypeId, excludeBrandId, safeCountryId, price, price, price]);
        return models;
    } catch (error) {
        console.error('Error in getSimilarPriceModels:', error);
        return [];
    }
}