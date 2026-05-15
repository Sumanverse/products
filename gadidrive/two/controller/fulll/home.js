// controller/fulll/home.js - COUNTRY HOME PAGE CONTROLLER
const VehicleType = require('../../models/vehicletype');
const Category = require('../../models/category');
const Brand = require('../../models/brands');
const Model = require('../../models/models');
const Article = require('../../models/Article');
const Country = require('../../models/country');

exports.getCountryHome = async (req, res, next) => {
    try {
        const countryName = req.params.countryname;
        console.log(`🌍 Loading home page for country: ${countryName}`);

        // Get all countries for footer selector
        const allCountries = await Country.getAll();
        console.log('All countries fetched:', allCountries.length);

        // Get current country details
        const currentCountry = allCountries.find(c => 
            c.country_name.toLowerCase() === countryName.toLowerCase()
        );

        if (!currentCountry) {
            return res.status(404).render('error', {
                title: 'Country Not Found - GadiDrive',
                message: `Country "${countryName}" not found`,
                path: req.path,
                country: null,
                allCountries: allCountries,
                suggestion: 'Please check the country name or select from the list below.'
            });
        }

        // Get all data with proper error handling for this country
        let vehicleTypes = [], allArticles = [], categories = [], brands = [], models = [];
        
        // 1. Get vehicle types for this country
        try {
            vehicleTypes = await VehicleType.getVehicleTypesByCountry(currentCountry.id);
            console.log('Vehicle types found for country:', vehicleTypes.length);
        } catch (err) {
            console.error('Error fetching vehicle types:', err);
        }
        
        // 2. Get articles for this country
        try {
            allArticles = await Article.findAll(currentCountry.id); // Pass country ID
            console.log('Articles found for country:', allArticles.length);
            
            // Fix image paths
            if (Array.isArray(allArticles) && allArticles.length > 0) {
                allArticles.forEach(article => {
                    if (article.Article_main_image && !article.Article_main_image.startsWith('/')) {
                        article.Article_main_image = `/uploads/articles/${article.Article_main_image}`;
                    }
                });
            }
        } catch (err) {
            console.error('Error fetching articles:', err);
            allArticles = [];
        }
        
        // 3. Get categories for this country
        try {
            categories = await Category.getCategoriesByCountry(currentCountry.id);
            console.log('Categories found for country:', categories.length);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
        
        // 4. Get brands for this country
        try {
            brands = await Brand.getBrandsByCountry(currentCountry.id);
            console.log('Brands found for country:', brands.length);
        } catch (err) {
            console.error('Error fetching brands:', err);
        }
        
        // 5. Get models for this country
        try {
            models = await Model.getModelsByCountry(currentCountry.id);
            console.log('Models found for country:', models ? models.length : 0);
            
            // If no models for this country, try global models
            if (!models || models.length === 0) {
                const allModels = await Model.getAllModels();
                if (Array.isArray(allModels)) {
                    models = allModels.filter(m => m.country_id === null);
                }
                console.log('Global models after filter:', models ? models.length : 0);
            }
        } catch (err) {
            console.error('Error fetching models:', err);
            try {
                const allModels = await Model.getAllModels();
                if (Array.isArray(allModels)) {
                    models = allModels.filter(m => m.country_id === null);
                }
            } catch (fallbackErr) {
                console.error('Fallback also failed:', fallbackErr);
                models = [];
            }
        }

        // Process the data with safety checks
        const popularVehicleTypes = Array.isArray(vehicleTypes) ? vehicleTypes.slice(0, 8) : [];
        const popularArticles = Array.isArray(allArticles) ? allArticles.slice(0, 3) : [];
        const popularCategories = Array.isArray(categories) ? categories.slice(0, 8) : [];
        const popularBrands = Array.isArray(brands) ? brands.slice(0, 8) : [];
        const popularModels = Array.isArray(models) ? models.slice(0, 8) : [];

        // Get random articles for different sections
        const getRandomArticles = (startIndex, count) => {
            if (!Array.isArray(allArticles) || allArticles.length === 0) return [];
            
            if (allArticles.length <= startIndex + count) {
                const availableCount = allArticles.length - startIndex;
                if (availableCount > 0) {
                    return allArticles.slice(startIndex, startIndex + availableCount);
                }
                return allArticles.slice(0, count);
            }
            return allArticles.slice(startIndex, startIndex + count);
        };

        const articlesAfterCategories = getRandomArticles(2, 2);
        const articlesAfterBrands = getRandomArticles(4, 2);
        const articlesAfterModels = getRandomArticles(6, 2);

        console.log('✅ Sending data to template:', {
            country: currentCountry.country_name,
            allCountries: allCountries.length,
            vehicleTypes: popularVehicleTypes.length,
            articlesAfterVehicleTypes: popularArticles.length,
            categories: popularCategories.length,
            articlesAfterCategories: articlesAfterCategories.length,
            brands: popularBrands.length,
            articlesAfterBrands: articlesAfterBrands.length,
            models: popularModels.length,
            articlesAfterModels: articlesAfterModels.length
        });

        res.render('publicpages/home', {
            title: `${currentCountry.country_name} - GadiDrive Automotive Information`,
            path: `/${countryName}`,
            country: currentCountry,
            allCountries: allCountries,
            vehicleTypes: popularVehicleTypes,
            articlesAfterVehicleTypes: popularArticles,
            categories: popularCategories,
            articlesAfterCategories: articlesAfterCategories,
            brands: popularBrands,
            articlesAfterBrands: articlesAfterBrands,
            models: popularModels,
            articlesAfterModels: articlesAfterModels,
            allVehicleTypes: vehicleTypes,
            currentPage: 'country-home' 
        });

    } catch (error) {
        console.error('❌ Country home page error:', error);
        
        // Fallback: कमसेकम allCountries त पठाउने
        let allCountries = [];
        try {
            allCountries = await Country.getAll();
        } catch (err) {
            console.error('Error fetching countries in error handler:', err);
        }
        
        res.status(500).render('error', {  // यहाँ error page render गर्ने
            title: 'Error - GadiDrive',
            message: 'Failed to load country page. Please try again.',
            path: req.path,
            country: null,
            allCountries: allCountries,
            error: error.message,
            suggestion: 'There was a technical issue. Please try again later.'
        });
    }
};