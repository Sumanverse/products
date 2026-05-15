// controller/search.js
const db = require('../utils/dbutils');
const Country = require('../models/country');

exports.search = async (req, res) => {
    const { countryname } = req.params;
    const query = (req.query.q || '').toString().trim();
    
    console.log('🔍 SEARCH CONTROLLER HIT!');
    console.log('📌 Country:', countryname);
    console.log('📌 Query:', query);
    console.log('📌 Full URL:', req.originalUrl);
    
    // Get country details for error cases
    let allCountries = [];
    try {
        allCountries = await Country.getAll();
    } catch (err) {
        console.error('Error fetching countries:', err);
    }
    
    if (!query) {
        // If no query, redirect to appropriate home page
        if (countryname) {
            return res.redirect(`/${countryname}`);
        }
        return res.redirect('/');
    }
    
    // Get country details
    let currentCountry = null;
    
    if (countryname) {
        currentCountry = allCountries.find(c => 
            c.country_name.toLowerCase() === countryname.toLowerCase()
        );
        
        if (!currentCountry) {
            return res.status(404).render('error', {
                title: 'Country Not Found - GadiDrive',
                message: `Country "${countryname}" not found`,
                path: req.path,
                country: null,
                allCountries: allCountries,
                suggestion: 'Please check the country name.'
            });
        }
    }
    
    const searchTerm = `%${query}%`;
    let results = [];

    try {
        // Get country ID for filtering
        const countryId = currentCountry ? currentCountry.id : null;
        
        // 1. VEHICLE TYPES - with country filter
        const [vtypes] = await db.query(
            `SELECT 
                'Vehicle Type' AS type, 
                vehicle_type_id AS id, 
                vehicle_type_name AS title, 
                vehicle_type_photo_path AS image,
                vehicle_type_name AS slug_name,
                vehicle_type_name AS vehicle_type_name
             FROM vehicletype 
             WHERE (vehicle_type_name LIKE ? OR LOWER(vehicle_type_name) LIKE LOWER(?))
               AND (country_id = ? OR country_id IS NULL)
             LIMIT 10`,
            [searchTerm, searchTerm, countryId]
        );

        // 2. BRANDS - with country filter
        const [brands] = await db.query(
            `SELECT 
                'Brand' AS type, 
                b.brand_id AS id, 
                b.name AS title,
                b.name AS brand_name,
                b.image_path AS image,
                b.name AS slug_name,
                v.vehicle_type_name,
                v.vehicle_type_id
             FROM brands b
             JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
             WHERE (b.name LIKE ? OR LOWER(b.name) LIKE LOWER(?))
               AND (b.country_id = ? OR b.country_id IS NULL)
             ORDER BY 
                CASE 
                    WHEN b.name = ? THEN 1
                    WHEN b.name LIKE ? THEN 2
                    ELSE 3
                END
             LIMIT 10`,
            [searchTerm, searchTerm, countryId, query, `${query}%`]
        );

        // 3. CATEGORIES - with country filter
        const [categories] = await db.query(
            `SELECT 
                'Category' AS type, 
                c.category_id AS id, 
                c.name AS title,
                c.name AS category_name,
                c.image_path AS image,
                c.name AS slug_name,
                v.vehicle_type_name,
                v.vehicle_type_id
             FROM categories c
             JOIN vehicletype v ON c.vehicle_type_id = v.vehicle_type_id
             WHERE (c.name LIKE ? OR LOWER(c.name) LIKE LOWER(?))
               AND (c.country_id = ? OR c.country_id IS NULL)
             LIMIT 10`,
            [searchTerm, searchTerm, countryId]
        );

        // 4. MODELS - with country filter
        const [models] = await db.query(
            `SELECT 
                'Model' AS type, 
                m.id, 
                CONCAT(b.name, ' ', m.model_name) AS title,
                b.name AS brand_name,
                m.model_name AS model_name,
                m.model_image AS image,
                m.model_name AS slug_name,
                v.vehicle_type_name,
                v.vehicle_type_id,
                b.brand_id
             FROM models m 
             JOIN brands b ON m.brand_id = b.brand_id 
             JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
             WHERE (m.model_name LIKE ? OR b.name LIKE ? OR CONCAT(b.name, ' ', m.model_name) LIKE ?
                    OR LOWER(m.model_name) LIKE LOWER(?) OR LOWER(b.name) LIKE LOWER(?) 
                    OR LOWER(CONCAT(b.name, ' ', m.model_name)) LIKE LOWER(?))
               AND (m.country_id = ? OR m.country_id IS NULL)
             LIMIT 20`,
            [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, countryId]
        );

        // 5. NEWS/ARTICLES - with country filter
        const [articles] = await db.query(
            `SELECT 
                'News' AS type, 
                Article_id AS id, 
                Article_title AS title, 
                Article_main_image AS image,
                Article_title AS slug_name,
                country_id
             FROM articles 
             WHERE (Article_title LIKE ? OR LOWER(Article_title) LIKE LOWER(?))
               AND (country_id = ? OR country_id IS NULL)
             LIMIT 10`,
            [searchTerm, searchTerm, countryId]
        );

        // 6. AUTHORS - no country filter (global)
        const [authors] = await db.query(
            `SELECT 
                'Author' AS type, 
                user_id AS id, 
                name AS title,
                username,
                profile_picture AS image,
                name AS slug_name
             FROM usertable 
             WHERE name LIKE ? OR username LIKE ? OR LOWER(name) LIKE LOWER(?) OR LOWER(username) LIKE LOWER(?)
             LIMIT 10`,
            [searchTerm, searchTerm, searchTerm, searchTerm]
        );

        // 7. PRICE LISTS - specifically if query contains 'price' or 'list'
        let priceLists = [];
        if (query.toLowerCase().includes('price') || query.toLowerCase().includes('list')) {
            const cleanQuery = query.toLowerCase().replace('price', '').replace('list', '').trim();
            const cleanSearchTerm = `%${cleanQuery}%`;

            const [brandPriceLists] = await db.query(
                `SELECT 
                    'Price List' AS type, 
                    b.brand_id AS id, 
                    CONCAT(b.name, ' Price List') AS title,
                    b.name AS brand_name,
                    b.image_path AS image,
                    b.name AS slug_name,
                    v.vehicle_type_name,
                    v.vehicle_type_id
                 FROM brands b
                 JOIN vehicletype v ON b.vehicle_type_id = v.vehicle_type_id
                 WHERE (b.name LIKE ? OR LOWER(b.name) LIKE LOWER(?))
                   AND (b.country_id = ? OR b.country_id IS NULL)
                 LIMIT 5`,
                [cleanSearchTerm, cleanSearchTerm, countryId]
            );
            priceLists = brandPriceLists;
        }

        // Combine all results
        results = [...vtypes, ...priceLists, ...brands, ...categories, ...models, ...articles, ...authors];
        
        console.log(`✅ Search results found: ${results.length}`);

        // FUNCTION: Create URL-friendly slug
        const createSlug = (text) => {
            if (!text) return '';
            return text
                .toString()
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^\w\-]+/g, '')
                .replace(/\-\-+/g, '-')
                .replace(/^-+/, '')
                .replace(/-+$/, '');
        };

        // Country prefix for URLs
        const countryPrefix = countryname ? '/' + countryname : '';

        // Generate CORRECT URLs for each result based on NEW structure
        results.forEach(item => {
            if (item.type === 'Vehicle Type') {
                // /:countryname?/:vehicletypename/brands/
                item.url = `${countryPrefix}/${item.slug_name || createSlug(item.title)}/brands/`;
            }
            else if (item.type === 'Price List') {
                // /:countryname?/:vehicletypename/:brandname/price-list/
                const vehicleType = item.vehicle_type_name || 'car';
                const brandSlug = createSlug(item.brand_name || item.title.replace(' Price List', ''));
                item.url = `${countryPrefix}/${vehicleType}/${brandSlug}/price-list/`;
            }
            else if (item.type === 'Brand') {
                // /:countryname?/:vehicletypename/brand/:brandname/
                const vehicleType = item.vehicle_type_name || 'car';
                const brandSlug = createSlug(item.brand_name || item.title);
                item.url = `${countryPrefix}/${vehicleType}/brand/${brandSlug}/`;
            }
            else if (item.type === 'Category') {
                // /:countryname?/:vehicletypename/category/:categoryname/
                const vehicleType = item.vehicle_type_name || 'car';
                const categorySlug = createSlug(item.category_name || item.title);
                item.url = `${countryPrefix}/${vehicleType}/category/${categorySlug}/`;
            }
            else if (item.type === 'Model') {
                // /:countryname?/:vehicletypename/brand/:brandname/:modelname/
                const vehicleType = item.vehicle_type_name || 'car';
                const brandSlug = createSlug(item.brand_name || '');
                const modelSlug = createSlug(item.model_name || item.title);
                item.url = `${countryPrefix}/${vehicleType}/brand/${brandSlug}/${modelSlug}/`;
            }
            else if (item.type === 'News') {
                // /:countryname?/news/:articleId-:articleTitle
                const articleSlug = createSlug(item.title);
                item.url = `${countryPrefix}/news/${item.id}-${articleSlug}`;
            }
            else if (item.type === 'Author') {
                // /@:username-:authorid (no country prefix)
                const username = item.username || item.title;
                const cleanUsername = createSlug(username);
                item.url = `/@${cleanUsername}-${item.id}`;
            }
        });

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';

        // Render the search results page (REMOVE 'publicpages/' from path)
        res.render('search', {
            title: `Search: ${query} in ${countryDisplay} - GadiDrive`,
            description: `Search results for "${query}" in ${countryDisplay}. Find vehicles, brands, categories, and news.`,
            keywords: `search, ${query}, ${countryDisplay.toLowerCase()}, vehicles, brands, news`,
            query: query,
            results: results,
            country: currentCountry,
            allCountries: allCountries,
            countryDisplay: countryDisplay,
            countryPrefix: countryPrefix,
            path: countryname ? `/${countryname}/search?q=${encodeURIComponent(query)}` : `/search?q=${encodeURIComponent(query)}`,
            currentUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`
        });

    } catch (err) {
        console.error('❌ Search Error:', err);
        
        // Render error page (with path variable)
        res.render('error', {
            title: 'Search Error - GadiDrive',
            message: 'Search temporarily unavailable. Please try again.',
            path: req.path,
            country: currentCountry,
            allCountries: allCountries,
            error: err.message
        });
    }
};