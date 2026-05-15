const Country = require('../../models/country');

exports.getNotFound = async (req, res) => {
    try {
        const { countryname } = req.params;
        
        console.log('❌ 404 Controller Hit!');
        console.log('📌 Params:', { countryname });
        console.log('📌 URL:', req.originalUrl);
        
        const allCountries = await Country.getAll();
        
        let currentCountry = null;
        if (countryname) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
        }
        
        res.status(404).render('404', {
            title: '404 - Page Not Found | GadiDrive',
            message: 'The page you are looking for does not exist.',
            path: req.path,
            country: currentCountry,
            allCountries: allCountries
        });
        
    } catch (error) {
        console.error('Error in 404 controller:', error);
        res.status(404).render('404', {
            title: '404 - Page Not Found | GadiDrive',
            message: 'The page you are looking for does not exist.',
            path: req.path,
            country: null,
            allCountries: []
        });
    }
}