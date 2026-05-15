// controller/publicpages/news.js
const Article = require('../../models/Article');
const Country = require('../../models/country');

exports.getnews = async (req, res, next) => {
    try {
        const { countryname } = req.params;
        
        console.log('📰 NEWS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname });
        console.log('📌 Full URL:', req.originalUrl);
        
        // Get country details
        let currentCountry = null;
        allCountries = await Country.getAll();
        if (countryname) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
            
            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive'
                });
            }
        }

        // Pagination parameters
        const page = parseInt(req.query.page) || 1;
        const limit = 8; // 8 articles per page (2 columns × 4 rows)
        const offset = (page - 1) * limit;

        // Get total count and paginated articles for this country
        const allArticles = await Article.findAll(currentCountry ? currentCountry.id : null);
        const totalArticles = allArticles.length;
        const totalPages = Math.ceil(totalArticles / limit);
        
        // Get articles for current page
        const paginatedArticles = allArticles.slice(offset, offset + limit);
        
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const countryPrefix = countryname ? '/' + countryname : '';

        res.render('./publicpages/news', {
            title: `${countryDisplay} - Latest Automotive News`,
            ogImage: '/images/mainlogo.png',
            description: `Stay updated with the latest automobile news in ${countryDisplay}. Read about new vehicle launches, reviews, and price updates.`,
            keywords: `${countryDisplay} automotive news, car news ${countryDisplay.toLowerCase()}, bike news ${countryDisplay.toLowerCase()}`,
            articles: paginatedArticles,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            currentPage: page,
            totalArticles: totalArticles,
            country: currentCountry,
            allCountries,
            countryDisplay,
            countryPrefix,
            path: countryname ? `/${countryname}/news` : '/news',
            currentUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`
        });
    } catch (err) {
        console.error('Error fetching news:', err);
        res.status(500).render('error', { 
            message: 'Failed to load news',
            title: 'Error - GadiDrive'
        });
    }
};