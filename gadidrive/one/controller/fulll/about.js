// controller/fulll/about.js
const Country = require('../../models/country');

exports.getabout = async (req, res, next) => {
    try {
        // Get all countries for footer selector
        const allCountries = await Country.getAll();
        
        res.render('about', {
            title: 'About GadiDrive | Nepal\'s Leading Automotive Information Hub',
            path: '/about',  // यो path पठाउनुहोस्
            description: 'Learn about GadiDrive, Nepal\'s fastest-growing automotive platform. We provide accurate car and bike specifications, comparisons, and latest news for vehicle enthusiasts.',
            keywords: 'About GadiDrive, GadiDrive Nepal, best car website Nepal, bike specs Nepal, automotive portal Kathmandu',
            currentPage: 'about',
            country: null,  // Global page को लागि
            allCountries: allCountries, // Footer selector को लागि
            allVehicleTypes: [] // Navbar को लागि (optional)
        });
    } catch (error) {
        console.error('Error in about page:', error);
        res.status(500).render('about', {
            title: 'About GadiDrive',
            path: '/about',
            description: 'Learn about GadiDrive',
            keywords: 'About GadiDrive',
            currentPage: 'about',
            country: null,
            allCountries: [],
            allVehicleTypes: []
        });
    }
};