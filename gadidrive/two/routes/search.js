// routes/search.js - UPDATED WITH COUNTRY SUPPORT
const express = require('express');
const router = express.Router();
const searchController = require('../controller/search');

// Global search (without country)
router.get('/search', searchController.search);

// Country-specific search
router.get('/:countryname/search', searchController.search);

module.exports = router;