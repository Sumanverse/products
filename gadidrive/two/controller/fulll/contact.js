// controller/fulll/contact.js
const Country = require('../../models/country');

exports.getContact = async (req, res, next) => {
    try {
        const allCountries = await Country.getAll();
        
        res.render('contact', {
            title: 'Contact Us',
            path: '/contact',
            description: 'Get in touch with GadiDrive. Contact us for inquiries, feedback, partnerships, or advertising. We are here to help automotive enthusiasts worldwide.',
            keywords: 'contact GadiDrive, GadiDrive email, GadiDrive support, automotive inquiries',
            currentPage: 'contact',
            country: null,
            allCountries: allCountries,
            allVehicleTypes: []
        });
    } catch (error) {
        console.error('Error in contact page:', error);
        res.status(500).render('contact', {
            title: 'Contact Us',
            path: '/contact',
            description: 'Contact GadiDrive',
            keywords: 'contact GadiDrive',
            currentPage: 'contact',
            country: null,
            allCountries: [],
            allVehicleTypes: []
        });
    }
};
