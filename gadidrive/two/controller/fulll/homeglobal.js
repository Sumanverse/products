const Country = require('../../models/country');

exports.getGlobalHome = async (req, res, next) => {
    try {
        // Get all active countries
        const countries = await Country.getAll();
        
        console.log('🌍 Global home page - Countries found:', countries.length);

        res.render('publicpages/index', {
            title: 'GadiDrive - Global Automotive Information',
            path: '/',
            countries: countries,
            currentPage: 'global-home',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });

    } catch (error) {
        console.error('❌ Global home page error:', error);
        res.status(500).render('publicpages/index', {
            title: 'GadiDrive - Global Automotive Information',
            path: '/',
            countries: [],
            currentPage: 'global-home',
            success_msg: req.flash('success_msg'),
            error_msg: req.flash('error_msg')
        });
    }
};