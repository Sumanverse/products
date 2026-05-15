// routes/publicpagesrouter.js
const express = require('express');
const router = express.Router();
const db = require('../utils/dbutils');

// Controller imports
const countryHome = require('../controller/fulll/home');
const brands = require('../controller/publicpages/brands');
const brandsdetails = require('../controller/publicpages/brandsdetails');
const category = require('../controller/publicpages/category');
const categorydetails = require('../controller/publicpages/categorydetails');
const compare = require('../controller/publicpages/compare');
const modeldetails = require('../controller/publicpages/modeldetails');
const modelspecsdetails = require('../controller/publicpages/modelspecsdetails');
const modelvariantsdetails = require('../controller/publicpages/modelvariantsdetails');
const news = require('../controller/publicpages/news');
const newsdetails = require('../controller/publicpages/newsdetails');
const authorprofile = require('../controller/publicpages/authorprofile');
const emical = require('../controller/publicpages/emical');
const notFoundController = require('../controller/publicpages/404');

const priceListController = require('../controller/publicpages/priceList');
const brandPriceListController = require('../controller/publicpages/brandPriceList');

console.log('🔍 Public Pages Router - Controller Check:');
console.log('- countryHome:', countryHome ? '✅' : '❌');
console.log('  - getCountryHome:', countryHome && countryHome.getCountryHome ? '✅' : '❌');
console.log('- brands:', brands ? '✅' : '❌');
console.log('- brandsdetails:', brandsdetails ? '✅' : '❌');
console.log('- category:', category ? '✅' : '❌');
console.log('- categorydetails:', categorydetails ? '✅' : '❌');
console.log('- compare:', compare ? '✅' : '❌');
console.log('- modeldetails:', modeldetails ? '✅' : '❌');
console.log('- modelspecsdetails:', modelspecsdetails ? '✅' : '❌');
console.log('- modelvariantsdetails:', modelvariantsdetails ? '✅' : '❌');
console.log('- news:', news ? '✅' : '❌');
console.log('- newsdetails:', newsdetails ? '✅' : '❌');
console.log('- authorprofile:', authorprofile ? '✅' : '❌');
console.log('- emical:', emical ? '✅' : '❌');
console.log('- priceList:', priceListController ? '✅' : '❌');
console.log('- brandPriceList:', brandPriceListController ? '✅' : '❌');
console.log('- notFoundController:', notFoundController ? '✅' : '❌');

router.use((req, res, next) => {
    console.log('🔥 Public Router hit:', req.method, req.url);
    next();
});

// =====================================================================
// PRICE LIST ROUTES
// =====================================================================

router.get('/:countryname/:vehicletypename/:brandname/price-list/', async (req, res, next) => {
    console.log('💰 Brand Price List Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');
    try {
        brandPriceListController.getBrandPriceList(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/:countryname/:vehicletypename/price-list/', async (req, res, next) => {
    console.log('💰 Vehicle Type Price List Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');
    try {
        priceListController.getVehicleTypePriceList(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/:vehicletypename/:brandname/price-list/', async (req, res, next) => {
    console.log('💰 Global Brand Price List Route - Params:', req.params);
    try {
        brandPriceListController.getBrandPriceList(req, res, next);
    } catch (error) {
        next(error);
    }
});

router.get('/:vehicletypename/price-list/', async (req, res, next) => {
    console.log('💰 Global Vehicle Type Price List Route - Params:', req.params);
    try {
        priceListController.getVehicleTypePriceList(req, res, next);
    } catch (error) {
        next(error);
    }
});

// =====================================================================
// SEO-FRIENDLY ROUTES (Country-based)
// =====================================================================

// ----- CATEGORY DETAILS -----
router.get('/:countryname/:vehicletypename/:categoryname/', async (req, res, next) => {
    console.log('📁 SEO Friendly Category Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list', 'specs'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');

    try {
        const { countryname, vehicletypename, categoryname } = req.params;
        const Category = require('../models/category');
        const Country = require('../models/country');
        const VehicleType = require('../models/vehicletype');

        const country = await Country.getByName(countryname);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) return next('route');

        const cleanCategoryName = categoryname.replace(/-/g, ' ');
        const cat = await Category.getCategoryByName(cleanCategoryName, country?.id);

        if (cat) {
            console.log('✅ This is a CATEGORY');
            return categorydetails.getcategorydetails(req, res, next);
        }
        next('route');
    } catch (error) {
        console.error('Error in category detection:', error);
        next('route');
    }
});

// ----- BRAND DETAILS -----
router.get('/:countryname/:vehicletypename/:brandname/', async (req, res, next) => {
    console.log('🏷️ SEO Friendly Brand Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list', 'specs'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');

    try {
        const { countryname, vehicletypename, brandname } = req.params;
        const Brand = require('../models/brands');
        const Country = require('../models/country');
        const VehicleType = require('../models/vehicletype');

        const country = await Country.getByName(countryname);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const brand = await Brand.getBrandByName(cleanBrandName, country?.id, vehicleType.vehicle_type_id);

        if (brand) {
            console.log('✅ This is a BRAND');
            return brandsdetails.getbrandsdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        console.error('Error in brand detection:', error);
        next('route');
    }
});

// ✅ FIXED: MODEL DETAILS — vehicleTypeId pass gareko
router.get('/:countryname/:vehicletypename/:brandname/:modelname/', async (req, res, next) => {
    console.log('🚗 SEO Friendly Model Route - Params:', req.params);
    try {
        const { countryname, vehicletypename, brandname, modelname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const Country = require('../models/country');
        const VehicleType = require('../models/vehicletype');

        const country = await Country.getByName(countryname);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, country?.id, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko — model detection fix
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, country?.id, vehicleType.vehicle_type_id
        );
        if (model) {
            console.log('✅ This is a MODEL');
            return modeldetails.getmodeldetails(req, res, next);
        }
        next('route');
    } catch (error) {
        console.error('Error in model detection:', error);
        next('route');
    }
});

// ✅ FIXED: VARIANT DETAILS — vehicleTypeId pass gareko
router.get('/:countryname/:vehicletypename/:brandname/:modelname/:variantname/', async (req, res, next) => {
    console.log('🔧 SEO Friendly Variant Route - Params:', req.params);
    try {
        const { countryname, vehicletypename, brandname, modelname, variantname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const Country = require('../models/country');
        const VehicleType = require('../models/vehicletype');

        const country = await Country.getByName(countryname);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, country?.id, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, country?.id, vehicleType.vehicle_type_id
        );
        if (model) {
            console.log('✅ This is a VARIANT');
            return modelvariantsdetails.getvariantdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        console.error('Error in variant detection:', error);
        next('route');
    }
});

// ✅ FIXED: SPECIFICATION DETAILS — vehicleTypeId pass gareko
router.get('/:countryname/:vehicletypename/:brandname/:modelname/specs/:specname/', async (req, res, next) => {
    console.log('📊 SEO Friendly Specs Route - Params:', req.params);
    try {
        const { countryname, vehicletypename, brandname, modelname, specname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const Country = require('../models/country');
        const VehicleType = require('../models/vehicletype');

        const country = await Country.getByName(countryname);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, country?.id);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, country?.id, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, country?.id, vehicleType.vehicle_type_id
        );
        if (model) {
            console.log('✅ This is a SPECIFICATION');
            req.params.specificationstitlename = specname;
            return modelspecsdetails.getmodelspecsdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        console.error('Error in spec detection:', error);
        next('route');
    }
});

// =====================================================================
// REDIRECT OLD ROUTES TO NEW SEO-FRIENDLY ROUTES
// =====================================================================

router.get('/:countryname/:vehicletypename/brand/:brandname/', (req, res) => {
    const { countryname, vehicletypename, brandname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname', (req, res) => {
    const { countryname, vehicletypename, brandname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname/', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname/:variantname/', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname, variantname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/${variantname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname/:variantname', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname, variantname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/${variantname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname/specs/:specname/', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname, specname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/specs/${specname}/`);
});

router.get('/:countryname/:vehicletypename/brand/:brandname/:modelname/specs/:specname', (req, res) => {
    const { countryname, vehicletypename, brandname, modelname, specname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${brandname}/${modelname}/specs/${specname}/`);
});

router.get('/:countryname/:vehicletypename/category/:categoryname/', (req, res) => {
    const { countryname, vehicletypename, categoryname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${categoryname}/`);
});

router.get('/:countryname/:vehicletypename/category/:categoryname', (req, res) => {
    const { countryname, vehicletypename, categoryname } = req.params;
    res.redirect(301, `/${countryname}/${vehicletypename}/${categoryname}/`);
});

// =====================================================================
// REDIRECT FOR NON-TRAILING SLASH (PRICE LIST)
// =====================================================================

router.get('/:countryname/:vehicletypename/:brandname/price-list', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/${req.params.brandname}/price-list/`);
});

router.get('/:countryname/:vehicletypename/price-list', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/price-list/`);
});

router.get('/:vehicletypename/:brandname/price-list', (req, res) => {
    res.redirect(301, `/${req.params.vehicletypename}/${req.params.brandname}/price-list/`);
});

router.get('/:vehicletypename/price-list', (req, res) => {
    res.redirect(301, `/${req.params.vehicletypename}/price-list/`);
});

router.get('/:countryname/:vehicletypename/:brandname/pricelist/', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/${req.params.brandname}/price-list/`);
});

router.get('/:countryname/:vehicletypename/:brandname/pricelist', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/${req.params.brandname}/price-list/`);
});

router.get('/:countryname/:vehicletypename/pricelist/', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/price-list/`);
});

router.get('/:countryname/:vehicletypename/pricelist', (req, res) => {
    res.redirect(301, `/${req.params.countryname}/${req.params.vehicletypename}/price-list/`);
});

// =====================================================================
// SPECIAL ROUTES (@ prefix)
// =====================================================================

router.get('/@:username-:authorid', (req, res, next) => {
    console.log('👤 Author Profile Route - Params:', req.params);
    authorprofile.getAuthorProfile(req, res, next);
});

// =====================================================================
// GLOBAL STATIC ROUTES (without country)
// =====================================================================

router.get('/news', (req, res, next) => {
    console.log('📰 Global News Route');
    news.getnews(req, res, next);
});

router.get('/news/:articleId-:articleTitle', (req, res, next) => {
    newsdetails.getnewsdetails(req, res, next);
});

router.get('/emicalculator', (req, res, next) => {
    console.log('🧮 Global EMI Calculator Route');
    emical.getEmiCalculator(req, res, next);
});

router.post('/emicalculator/calculate', (req, res, next) => {
    emical.calculateEMI(req, res, next);
});

router.get('/compare', (req, res, next) => {
    console.log('⚖️ Global Compare Route');
    compare.getcompare(req, res, next);
});

router.post('/compare', (req, res, next) => {
    compare.postCompare(req, res, next);
});

router.get('/compare/brands/:vehicleTypeId', (req, res, next) => {
    compare.getBrandsByVehicleType(req, res, next);
});

router.get('/compare/models/:vehicleTypeId/:brandId', (req, res, next) => {
    compare.getModelsByBrand(req, res, next);
});

router.get('/compare/model/:modelId', (req, res, next) => {
    compare.getModelDetails(req, res, next);
});

// =====================================================================
// STATIC ROUTES WITH COUNTRY PREFIX
// =====================================================================

router.get('/:countryname/news', (req, res, next) => {
    news.getnews(req, res, next);
});

router.get('/:countryname/news/:articleId-:articleTitle', (req, res, next) => {
    newsdetails.getnewsdetails(req, res, next);
});

router.get('/:countryname/emicalculator', (req, res, next) => {
    emical.getEmiCalculator(req, res, next);
});

router.post('/:countryname/emicalculator/calculate', (req, res, next) => {
    emical.calculateEMI(req, res, next);
});

router.get('/:countryname/compare', (req, res, next) => {
    compare.getcompare(req, res, next);
});

router.post('/:countryname/compare', (req, res, next) => {
    compare.postCompare(req, res, next);
});

// =====================================================================
// BRANDS & CATEGORY LISTING ROUTES
// =====================================================================

router.get('/:countryname/:vehicletypename/brands', (req, res, next) => {
    console.log('🏷️ Country Brands Route - Params:', req.params);
    brands.getbrands(req, res, next);
});

router.get('/:vehicletypename/brands', (req, res, next) => {
    console.log('🏷️ Global Brands Route - Params:', req.params);
    brands.getbrands(req, res, next);
});

router.get('/:countryname/:vehicletypename/category', (req, res, next) => {
    console.log('📁 Country Category Route - Params:', req.params);
    category.getcategory(req, res, next);
});

router.get('/:vehicletypename/category', (req, res, next) => {
    console.log('📁 Global Category Route - Params:', req.params);
    category.getcategory(req, res, next);
});

// =====================================================================
// GLOBAL VEHICLE ROUTES — BACKWARD COMPATIBILITY
// =====================================================================

router.get('/:vehicletypename/brand/:brandname/', (req, res) => {
    const { vehicletypename, brandname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/`);
});

router.get('/:vehicletypename/brand/:brandname', (req, res) => {
    const { vehicletypename, brandname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname/', (req, res) => {
    const { vehicletypename, brandname, modelname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname', (req, res) => {
    const { vehicletypename, brandname, modelname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname/:variantname/', (req, res) => {
    const { vehicletypename, brandname, modelname, variantname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/${variantname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname/:variantname', (req, res) => {
    const { vehicletypename, brandname, modelname, variantname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/${variantname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname/specs/:specname/', (req, res) => {
    const { vehicletypename, brandname, modelname, specname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/specs/${specname}/`);
});

router.get('/:vehicletypename/brand/:brandname/:modelname/specs/:specname', (req, res) => {
    const { vehicletypename, brandname, modelname, specname } = req.params;
    res.redirect(301, `/${vehicletypename}/${brandname}/${modelname}/specs/${specname}/`);
});

router.get('/:vehicletypename/category/:categoryname/', (req, res) => {
    const { vehicletypename, categoryname } = req.params;
    res.redirect(301, `/${vehicletypename}/${categoryname}/`);
});

router.get('/:vehicletypename/category/:categoryname', (req, res) => {
    const { vehicletypename, categoryname } = req.params;
    res.redirect(301, `/${vehicletypename}/${categoryname}/`);
});

// =====================================================================
// GLOBAL SEO-FRIENDLY ROUTES (without country)
// =====================================================================

// ----- GLOBAL CATEGORY DETAILS -----
router.get('/:vehicletypename/:categoryname/', async (req, res, next) => {
    console.log('📁 Global SEO Friendly Category Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list', 'specs'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');

    try {
        const { vehicletypename, categoryname } = req.params;
        const Category = require('../models/category');
        const VehicleType = require('../models/vehicletype');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        if (!vehicleType) return next('route');

        const cleanCategoryName = categoryname.replace(/-/g, ' ');
        const cat = await Category.getCategoryByName(cleanCategoryName);

        if (cat) {
            return categorydetails.getcategorydetails(req, res, next);
        }
        next('route');
    } catch (error) {
        next('route');
    }
});

// ----- GLOBAL BRAND DETAILS -----
router.get('/:vehicletypename/:brandname/', async (req, res, next) => {
    console.log('🏷️ Global SEO Friendly Brand Route - Params:', req.params);
    const reservedPaths = ['brands', 'category', 'compare', 'news', 'emicalculator', 'price-list', 'specs'];
    if (reservedPaths.includes(req.params.vehicletypename)) return next('route');

    try {
        const { vehicletypename, brandname } = req.params;
        const Brand = require('../models/brands');
        const VehicleType = require('../models/vehicletype');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const brand = await Brand.getBrandByName(cleanBrandName, null, vehicleType.vehicle_type_id);

        if (brand) {
            return brandsdetails.getbrandsdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        next('route');
    }
});

// ✅ FIXED: GLOBAL MODEL DETAILS — vehicleTypeId pass gareko
router.get('/:vehicletypename/:brandname/:modelname/', async (req, res, next) => {
    console.log('🚗 Global SEO Friendly Model Route - Params:', req.params);
    try {
        const { vehicletypename, brandname, modelname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const VehicleType = require('../models/vehicletype');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, null, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, null, vehicleType.vehicle_type_id
        );
        if (model) {
            return modeldetails.getmodeldetails(req, res, next);
        }
        next('route');
    } catch (error) {
        next('route');
    }
});

// ✅ FIXED: GLOBAL VARIANT DETAILS — vehicleTypeId pass gareko
router.get('/:vehicletypename/:brandname/:modelname/:variantname/', async (req, res, next) => {
    console.log('🔧 Global SEO Friendly Variant Route - Params:', req.params);
    try {
        const { vehicletypename, brandname, modelname, variantname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const VehicleType = require('../models/vehicletype');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, null, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, null, vehicleType.vehicle_type_id
        );
        if (model) {
            return modelvariantsdetails.getvariantdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        next('route');
    }
});

// ✅ FIXED: GLOBAL SPECS DETAILS — vehicleTypeId pass gareko
router.get('/:vehicletypename/:brandname/:modelname/specs/:specname/', async (req, res, next) => {
    console.log('📊 Global SEO Friendly Specs Route - Params:', req.params);
    try {
        const { vehicletypename, brandname, modelname, specname } = req.params;
        const Model = require('../models/models');
        const Brand = require('../models/brands');
        const VehicleType = require('../models/vehicletype');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        if (!vehicleType) return next('route');

        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');

        const brand = await Brand.getBrandByName(cleanBrandName, null, vehicleType.vehicle_type_id);
        if (!brand) return next('route');

        // ✅ vehicleTypeId pass gareko
        const model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, null, vehicleType.vehicle_type_id
        );
        if (model) {
            req.params.specificationstitlename = specname;
            return modelspecsdetails.getmodelspecsdetails(req, res, next);
        }
        next('route');
    } catch (error) {
        next('route');
    }
});

// =====================================================================
// COUNTRY HOME PAGE
// =====================================================================

router.get('/:countryname', (req, res, next) => {
    console.log('🌍 Country Home Route - Params:', req.params);
    const reservedPaths = ['news', 'compare', 'emicalculator', 'about', 'signin', 'admin'];
    if (reservedPaths.includes(req.params.countryname)) return next('route');

    if (countryHome && countryHome.getCountryHome) {
        countryHome.getCountryHome(req, res, next);
    } else {
        console.error('❌ countryHome.getCountryHome is not available');
        res.status(500).render('error', {
            title: 'Server Error - GadiDrive',
            message: 'Server configuration error',
            path: req.path,
            country: null
        });
    }
});

// =====================================================================
// DISAMBIGUATION MIDDLEWARE
// =====================================================================

router.get('/:vehicletypename/:name', async (req, res, next) => {
    const { vehicletypename, name } = req.params;
    console.log('🔍 DISAMBIGUATION MIDDLEWARE - Checking:', { vehicletypename, name });

    try {
        const VehicleType = require('../models/vehicletype');
        const Country = require('../models/country');

        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename);
        const allCountries = await Country.getAll();

        if (!vehicleType) {
            return res.status(404).render('error', {
                title: 'Vehicle Type Not Found - GadiDrive',
                message: `Vehicle type "${vehicletypename}" not found`,
                path: req.path,
                country: null,
                allCountries
            });
        }

        const cleanName = name.replace(/-/g, ' ');

        const [categoryRows] = await db.execute(
            `SELECT category_id, name, vehicle_type_id 
             FROM categories 
             WHERE LOWER(name) = LOWER(?) AND vehicle_type_id = ?`,
            [cleanName, vehicleType.vehicle_type_id]
        );

        if (categoryRows.length > 0) {
            console.log('✅ This is a CATEGORY:', categoryRows[0].name);
            req.params.categoryname = name;
            return categorydetails.getcategorydetails(req, res, next);
        }

        const [brandRows] = await db.execute(
            `SELECT brand_id, name, vehicle_type_id 
             FROM brands 
             WHERE LOWER(name) = LOWER(?) AND vehicle_type_id = ?`,
            [cleanName, vehicleType.vehicle_type_id]
        );

        if (brandRows.length > 0) {
            console.log('✅ This is a BRAND:', brandRows[0].name);
            req.params.brandname = name;
            return brandsdetails.getbrandsdetails(req, res, next);
        }

        return res.status(404).render('error', {
            title: 'Not Found - GadiDrive',
            message: `"${name}" not found as category or brand in ${vehicletypename}`,
            path: req.path,
            country: null,
            allCountries,
            suggestion: 'Check the spelling or browse our categories and brands.'
        });

    } catch (error) {
        console.error('❌ Error in disambiguation middleware:', error);
        let allCountries = [];
        try {
            const Country = require('../models/country');
            allCountries = await Country.getAll();
        } catch (err) {
            console.error('Error fetching countries:', err);
        }
        res.status(500).render('error', {
            title: 'Server Error - GadiDrive',
            message: 'An error occurred while processing your request',
            path: req.path,
            country: null,
            allCountries,
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
});

// =====================================================================
// 404 HANDLER
// =====================================================================

router.use(function(req, res) {
    console.log('❌ 404 - Route not found:', req.url);

    const urlParts = req.url.split('/').filter(part => part.length > 0);
    let countryname = null;

    if (urlParts.length >= 1) {
        const firstPart = urlParts[0];
        const reservedPaths = ['news', 'compare', 'emicalculator', 'about', 'signin', 'admin', 'privacy-policy', 'terms', 'contact'];
        if (!firstPart.startsWith('@') && !reservedPaths.includes(firstPart)) {
            countryname = firstPart;
        }
    }

    req.params = { countryname };
    notFoundController.getNotFound(req, res);
});

module.exports = router;