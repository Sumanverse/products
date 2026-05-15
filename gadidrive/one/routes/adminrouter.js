const express = require('express');
const router = express.Router();

// Controllers
const adminarticle = require('../controller/admin/Aarticle');
const adminbrand = require('../controller/admin/Abrand');
const admincategory = require('../controller/admin/Acategory');
const adminmodel = require('../controller/admin/Amodel');
const adminstudio = require('../controller/admin/Astudio');
const adminlevelam = require('../controller/admin/level3am');
const adminsuperaccount = require('../controller/admin/superaccount');
const profile = require('../controller/admin/profile');

// Middleware
const { auth, requireRole, requirePermission } = require('../middleware/auth');

// UPLOAD MIDDLEWARES
const uploadAdmin = require('../utils/uploadadmin');
const uploadVehicle = require('../utils/uploadVehicle');
const uploadModels = require('../utils/uploadmodels');
const uploadArticle = require('../utils/uploadarticle');
const upload = require('../utils/upload');

// ======================= PROFILE ROUTES =======================
// SECURED: Only accessible to signed in users
router.get('/profile', auth, profile.getProfile);
router.get('/profile/admin', auth, profile.getAdminCategory);

// PROFILE UPDATE ROUTES
router.post('/profile/update-picture', auth, upload.single('profilePicture'), profile.updateProfilePicture);
router.post('/profile/update-name', auth, profile.updateName);
router.post('/profile/update-username', auth, profile.updateUsername);
router.post('/profile/update-bio', auth, profile.updateBio);
router.post('/profile/update-social-media', auth, profile.updateSocialMedia);
router.post('/profile/update-password', auth, profile.updatePassword);

// ======================= ARTICLE ROUTES =======================
// SECURED: Only Level 1 and Level 2 can access

// Main article page
router.get('/article', auth, requirePermission('article'), adminarticle.getadminarticle);

// Create new article
router.post('/article', auth, requirePermission('article'), uploadArticle, adminarticle.postArticle);

// Get articles by country (for filtering)
router.get('/article/country/:countryId', auth, requirePermission('article'), adminarticle.getArticlesByCountry);

// Update article
router.put('/article/:id', auth, requirePermission('article'), uploadArticle, adminarticle.updateArticle);

// Delete article
router.delete('/article/:id', auth, requirePermission('article'), adminarticle.deleteArticle);

// ======================= BRAND ROUTES =======================
// SECURED: Only Level 2 can access

// Main brand page
router.get('/brand', auth, requirePermission('brand'), adminbrand.getAdminBrand);

// Create new brand
router.post('/brand', auth, requirePermission('brand'), adminbrand.postAdminBrand);

// Import existing brand
router.post('/brand/import', auth, requirePermission('brand'), adminbrand.importAdminBrand);

// Get vehicle types by country (for dynamic dropdown)
router.get('/brand/vehicle-types/:countryId', auth, requirePermission('brand'), adminbrand.getVehicleTypesByCountry);

// Get single brand by ID
router.get('/brand/:brandId', auth, requirePermission('brand'), adminbrand.getBrandById);

// Update brand
router.post('/brand/update', auth, requirePermission('brand'), adminbrand.updateAdminBrand);

// Delete brand
router.post('/brand/delete', auth, requirePermission('brand'), adminbrand.deleteAdminBrand);

// Brand Studio Page
router.get('/brand/:brandId/studio', auth, requirePermission('brand'), adminstudio.getBrandContentStudio);

// ======================= CATEGORY ROUTES =======================
// SECURED: Only Level 2 can access

// Main category page
router.get('/category', auth, requirePermission('category'), admincategory.getAdminCategory);

// Create new category
router.post('/category', auth, requirePermission('category'), admincategory.postAdminCategory);

// Import existing category
router.post('/category/import', auth, requirePermission('category'), admincategory.importAdminCategory);

// Get vehicle types by country (for dynamic dropdown)
router.get('/category/vehicle-types/:countryId', auth, requirePermission('category'), admincategory.getVehicleTypesByCountry);

// Get categories by vehicle type (with optional country filter)
router.get('/categories/vehicle-type/:vehicleTypeId', auth, requirePermission('category'), admincategory.getCategoriesByVehicleType);

// Get single category by ID
router.get('/category/:categoryId', auth, requirePermission('category'), admincategory.getCategoryById);

// Update category
router.post('/category/update', auth, requirePermission('category'), admincategory.updateAdminCategory);

// Delete category
router.post('/category/delete', auth, requirePermission('category'), admincategory.deleteAdminCategory);

// ======================= MODEL ROUTES =======================
// SECURED: Only Level 2 can access

// Main model page
router.get('/model', auth, requirePermission('model'), adminmodel.getadminmodel);

// Get filter data for models (categories and brands by vehicle type)
router.get('/model/filter-data', auth, requirePermission('model'), adminmodel.getFilterData);

// Get vehicle types by country (for dynamic dropdown) - NEW
router.get('/model/vehicle-types/:countryId', auth, requirePermission('model'), adminmodel.getVehicleTypesByCountry);

// Get filtered models
router.get('/model/filter-models', auth, requirePermission('model'), adminmodel.getFilteredModels);

// Get model download data (JSON)
router.get('/model/:modelId/download-data', auth, requirePermission('model'), adminmodel.getModelDownloadData);

// Content Studio Standalone Page
router.get('/model/:modelId/studio', auth, requirePermission('model'), adminstudio.getModelContentStudio);

// Get single model by ID
router.get('/model/:modelId', auth, requirePermission('model'), adminmodel.getModelById);

// Create new model
router.post('/model', auth, requirePermission('model'), uploadModels, adminmodel.postAdminModel);

// Update model
router.post('/model/update/:modelId', auth, requirePermission('model'), uploadModels, adminmodel.updateAdminModel);

// Delete model
router.post('/model/delete/:modelId', auth, requirePermission('model'), adminmodel.deleteAdminModel);

// Get all models (filtered)
router.get('/models', auth, requirePermission('model'), adminmodel.getFilteredModels);

// ======================= SUPERACCOUNT ROUTES =======================
// SECURED: Only Superadmin can access (using superaccount permission)

// Main Super Account Page
router.get('/superaccount', auth, requirePermission('superaccount'), adminsuperaccount.getadminsuperaccount);

// USER OPERATIONS
router.post('/superaccount/save-user', auth, requirePermission('superaccount'), uploadAdmin, adminsuperaccount.createUser);
router.get('/superaccount/edit-user/:id', auth, requirePermission('superaccount'), adminsuperaccount.getUserById);
router.put('/superaccount/update-user/:id', auth, requirePermission('superaccount'), uploadAdmin, adminsuperaccount.updateUser);
router.delete('/superaccount/delete-user/:id', auth, requirePermission('superaccount'), adminsuperaccount.deleteUser);

// VEHICLE TYPE OPERATIONS
router.post('/superaccount/save-vehicle-type', auth, requirePermission('superaccount'), uploadVehicle, adminsuperaccount.createVehicleType);
router.get('/superaccount/edit-vehicle-type/:id', auth, requirePermission('superaccount'), adminsuperaccount.getVehicleTypeById);
router.put('/superaccount/update-vehicle-type/:id', auth, requirePermission('superaccount'), uploadVehicle, adminsuperaccount.updateVehicleType);
router.delete('/superaccount/delete-vehicle-type/:id', auth, requirePermission('superaccount'), adminsuperaccount.deleteVehicleType);

// ======================= COUNTRY MANAGEMENT ROUTES =======================
// SECURED: Only Superadmin can access

// Get all countries
router.get('/superaccount/countries', auth, requirePermission('superaccount'), adminsuperaccount.getCountries);

// Get single country by ID
router.get('/superaccount/country/:id', auth, requirePermission('superaccount'), adminsuperaccount.getCountryById);

// Create new country
router.post('/superaccount/country/create', auth, requirePermission('superaccount'), adminsuperaccount.createCountry);

// Update country
router.put('/superaccount/country/update/:id', auth, requirePermission('superaccount'), adminsuperaccount.updateCountry);

// Delete country (permanent - checks dependencies)
router.delete('/superaccount/country/delete/:id', auth, requirePermission('superaccount'), adminsuperaccount.deleteCountry);

// ======================= LOGOUT ROUTE =======================
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Logout error:', err);
            return res.redirect('/admin/superaccount');
        }

        res.clearCookie('token');
        res.clearCookie('gadidrive.sid');

        res.redirect('/signin?message=Successfully logged out');
    });
});

module.exports = router;