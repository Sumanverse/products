// controller/fulll/terms.js
const Country = require('../../models/country');

exports.getTerms = async (req, res, next) => {
    try {
        const allCountries = await Country.getAll();
        
        res.render('terms', {
            title: 'Terms of Service',
            path: '/terms',
            description: 'GadiDrive Terms of Service - Read our terms and conditions for using the GadiDrive automotive information platform.',
            keywords: 'GadiDrive terms of service, terms and conditions, usage policy, disclaimer',
            currentPage: 'terms',
            country: null,
            allCountries: allCountries,
            allVehicleTypes: []
        });
    } catch (error) {
        console.error('Error in terms page:', error);
        res.status(500).render('terms', {
            title: 'Terms of Service',
            path: '/terms',
            description: 'GadiDrive Terms of Service',
            keywords: 'terms of service',
            currentPage: 'terms',
            country: null,
            allCountries: [],
            allVehicleTypes: []
        });
    }
};
