// controller/fulll/privacy.js
const Country = require('../../models/country');

exports.getPrivacyPolicy = async (req, res, next) => {
    try {
        const allCountries = await Country.getAll();
        
        res.render('privacy', {
            title: 'Privacy Policy',
            path: '/privacy-policy',
            description: 'GadiDrive Privacy Policy - Learn how we collect, use, and protect your data. We value your privacy and are committed to transparency.',
            keywords: 'GadiDrive privacy policy, data protection, cookie policy, user privacy',
            currentPage: 'privacy',
            country: null,
            allCountries: allCountries,
            allVehicleTypes: []
        });
    } catch (error) {
        console.error('Error in privacy policy page:', error);
        res.status(500).render('privacy', {
            title: 'Privacy Policy',
            path: '/privacy-policy',
            description: 'GadiDrive Privacy Policy',
            keywords: 'privacy policy',
            currentPage: 'privacy',
            country: null,
            allCountries: [],
            allVehicleTypes: []
        });
    }
};
