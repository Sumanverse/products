const db = require('../../utils/dbutils');
const Country = require('../../models/country');
const VehicleType = require('../../models/vehicletype');
const Brand = require('../../models/brands'); // Fixed: brands.js to brand.js
const Model = require('../../models/models');

// ==================== VEHICLE TYPE PRICE LIST ====================
exports.getVehicleTypePriceList = async (req, res, next) => {
    try {
        const { countryname, vehicletypename } = req.params;

        // Get country data if countryname exists
        let country = null;
        let countryPrefix = '';
        if (countryname && !['car', 'bike', 'truck', 'bus'].includes(countryname)) {
            country = await Country.getByName(countryname);
            if (country) {
                countryPrefix = '/' + country.country_name.toLowerCase();
            }
        }

        // Get vehicle type
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) {
            return res.status(404).render('error', {
                title: 'Vehicle Type Not Found',
                message: `Vehicle type "${vehicletypename}" not found`,
                country: country,
                allCountries: await Country.getAll(),
                path: req.path
            });
        }

        // Get all brands for this vehicle type with their models
        const brands = await getBrandsWithModels(vehicleType.vehicle_type_id, country?.id);

        // Get all vehicle types for this country
        let vehicleTypes = country ? await VehicleType.getVehicleTypesByCountry(country.id) : await VehicleType.getAllVehicleTypes();

        // Get all countries for footer
        const allCountries = await Country.getAll();

        // SEO Meta Data
        const seoTitle = country
            ? `${vehicleType.vehicle_type_name} Price List in ${country.country_name} - GadiDrive`
            : `${vehicleType.vehicle_type_name} Price List - GadiDrive`;

        const seoDescription = country
            ? `Check complete price list of all ${vehicleType.vehicle_type_name} brands and models in ${country.country_name}. Find prices, specifications, and details.`
            : `Check complete price list of all ${vehicleType.vehicle_type_name} brands and models. Find prices, specifications, and details.`;

        // Get recommendations
        const recommendedBrands = await getSimilarBrands(vehicleType.vehicle_type_id, null, country?.id);
        const popularModels = await getPopularModels(vehicleType.vehicle_type_id, country?.id);

        // Get available countries for hreflang
        const availableCountries = await VehicleType.getCountriesForVehicleType(vehicleType.vehicle_type_name);

        res.render('publicpages/priceList', {
            title: seoTitle,
            description: seoDescription,
            path: req.path,
            pageType: 'vehicleType',
            country: country,
            vehicleType: vehicleType,
            brands: brands,
            recommendedBrands: recommendedBrands,
            popularModels: popularModels,
            vehicleTypes: vehicleTypes,
            allCountries: allCountries,
            availableCountries: availableCountries, // Added for SEO hreflang
            canonical: `${countryPrefix}/${vehicletypename}/price-list/`
        });

    } catch (error) {
        console.error('Error in getVehicleTypePriceList:', error);
        next(error);
    }
};

// ==================== BRAND PRICE LIST ====================
exports.getBrandPriceList = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, brandname } = req.params;

        // Get country data if countryname exists
        let country = null;
        let countryPrefix = '';
        if (countryname && !['car', 'bike', 'truck', 'bus'].includes(countryname)) {
            country = await Country.getByName(countryname);
            if (country) {
                countryPrefix = '/' + country.country_name.toLowerCase();
            }
        }

        // Get vehicle type
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) {
            return res.status(404).render('error', {
                title: 'Vehicle Type Not Found',
                message: `Vehicle type "${vehicletypename}" not found`,
                country: country,
                allCountries: await Country.getAll(),
                path: req.path
            });
        }

        // Get brand
        const cleanBrandName = brandname.replace(/-/g, ' ');
        const brand = await Brand.getBrandByName(cleanBrandName, country?.id);
        if (!brand) {
            return res.status(404).render('error', {
                title: 'Brand Not Found',
                message: `Brand "${cleanBrandName}" not found`,
                country: country,
                allCountries: await Country.getAll(),
                path: req.path
            });
        }

        // Get all models of this brand
        const models = await getModelsWithStartingPrice(brand.brand_id, country?.id);

        // Get all vehicle types for this country
        let vehicleTypes = country ? await VehicleType.getVehicleTypesByCountry(country.id) : await VehicleType.getAllVehicleTypes();

        // Get all countries for footer
        const allCountries = await Country.getAll();

        // SEO Meta Data
        const seoTitle = country
            ? `${brand.name} ${vehicleType.vehicle_type_name} Price List in ${country.country_name} - GadiDrive`
            : `${brand.name} ${vehicleType.vehicle_type_name} Price List - GadiDrive`;

        const seoDescription = country
            ? `Check complete price list of all ${brand.name} ${vehicleType.vehicle_type_name} models in ${country.country_name}. Find prices, specifications, and details.`
            : `Check complete price list of all ${brand.name} ${vehicleType.vehicle_type_name} models. Find prices, specifications, and details.`;

        // Get recommendations
        const recommendedBrands = await getSimilarBrands(vehicleType.vehicle_type_id, brand.brand_id, country?.id);
        const popularModels = await getPopularModels(vehicleType.vehicle_type_id, country?.id, brand.brand_id);

        // Get available countries for hreflang
        const availableCountries = await Brand.getCountriesForBrand(brand.name, vehicleType.vehicle_type_id);

        res.render('publicpages/priceList', {
            title: seoTitle,
            description: seoDescription,
            path: req.path,
            pageType: 'brand',
            country: country,
            vehicleType: vehicleType,
            brand: brand,
            models: models,
            recommendedBrands: recommendedBrands,
            popularModels: popularModels,
            vehicleTypes: vehicleTypes,
            allCountries: allCountries,
            availableCountries: availableCountries, // Added for SEO hreflang
            canonical: `${countryPrefix}/${vehicletypename}/${brandname}/price-list/`
        });

    } catch (error) {
        console.error('Error in getBrandPriceList:', error);
        next(error);
    }
};

// ==================== HELPER FUNCTIONS ====================

// Get all brands with their models (starting price only)
async function getBrandsWithModels(vehicleTypeId, countryId) {
    try {
        const [brands] = await db.execute(`
            SELECT 
                b.brand_id,
                b.name as brand_name,
                b.image_path as brand_image
            FROM brands b
            WHERE b.vehicle_type_id = ?
                AND (b.country_id = ? OR b.country_id IS NULL)
            ORDER BY b.name ASC
        `, [vehicleTypeId, countryId || null]);

        for (let brand of brands) {
            const [models] = await db.execute(`
                SELECT 
                    m.id as model_id,
                    m.model_name,
                    m.starting_price,
                    m.model_image,
                    m.engine_type,
                    m.seater,
                    m.status,
                    m.release_year
                FROM models m
                WHERE m.brand_id = ?
                    AND (m.country_id = ? OR m.country_id IS NULL)
                    AND (m.status = 'published' OR m.status = 'import')
                ORDER BY m.starting_price ASC
            `, [brand.brand_id, countryId || null]);

            brand.models = models;
            brand.model_count = models.length;
        }

        return brands;
    } catch (error) {
        console.error('Error in getBrandsWithModels:', error);
        return [];
    }
}

// Get all models of a brand (starting price only)
async function getModelsWithStartingPrice(brandId, countryId) {
    try {
        const [models] = await db.execute(`
            SELECT 
                m.id as model_id,
                m.model_name,
                m.starting_price,
                m.model_image,
                m.engine_type,
                m.seater,
                m.status,
                m.release_year,
                m.safety_rating
            FROM models m
            WHERE m.brand_id = ?
                AND (m.country_id = ? OR m.country_id IS NULL)
                AND (m.status = 'published' OR m.status = 'import')
            ORDER BY m.starting_price ASC
        `, [brandId, countryId || null]);

        return models;
    } catch (error) {
        console.error('Error in getModelsWithStartingPrice:', error);
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
        console.error('Error in getSimilarBrands:', error);
        return [];
    }
}

// Get popular models (same vehicle type)
async function getPopularModels(vehicleTypeId, countryId, excludeBrandId = null) {
    try {
        const safeCountryId = countryId || null;
        const [models] = await db.execute(`
            SELECT * FROM (
                SELECT 
                    m.id as model_id,
                    m.model_name,
                    m.starting_price,
                    m.model_image,
                    b.brand_id,
                    b.name as brand_name,
                    ROW_NUMBER() OVER(PARTITION BY b.brand_id ORDER BY m.release_year DESC, m.starting_price DESC) as rn
                FROM models m
                JOIN brands b ON m.brand_id = b.brand_id
                WHERE b.vehicle_type_id = ?
                    AND (? IS NULL OR b.brand_id != ?)
                    AND (m.country_id = ? OR m.country_id IS NULL)
                    AND (m.status = 'published' OR m.status = 'import')
            ) t WHERE rn = 1
            ORDER BY starting_price DESC
            LIMIT 5
        `, [vehicleTypeId, excludeBrandId, excludeBrandId, safeCountryId]);
        return models;
    } catch (error) {
        console.error('Error in getPopularModels:', error);
        return [];
    }
}