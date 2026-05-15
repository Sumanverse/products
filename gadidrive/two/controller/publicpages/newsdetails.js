// controller/publicpages/newsdetails.js - UPDATED with country support
const db = require('../../utils/dbutils');
const Country = require('../../models/country');

exports.getnewsdetails = async (req, res, next) => {
    try {
        const { countryname, articleId, articleTitle } = req.params;
        
        console.log('📰 NEWS DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, articleId, articleTitle });
        console.log('📌 Full URL:', req.originalUrl);
        
        if (!articleId) {
            return res.status(400).render('error', { 
                message: 'Article ID is required',
                title: 'Error - GadiDrive'
            });
        }

        // Get country details
        let currentCountry = null;
        let allCountries = [];
        
        if (countryname) {
            allCountries = await Country.getAll();
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

        // Get article with author name from JOIN query
        const [articles] = await db.query(
            `SELECT 
                a.Article_id, 
                a.Article_title, 
                a.Article_main_image, 
                a.published_date,
                a.author_id,
                a.sources,
                a.country_id,
                c.country_name,
                c.currency_symbol,
                u.name AS author_name,
                u.user_id AS author_user_id,
                u.username AS author_username
            FROM articles a 
            LEFT JOIN usertable u ON a.author_id = u.user_id
            LEFT JOIN countries c ON a.country_id = c.id
            WHERE a.Article_id = ?`,
            [articleId]
        );

        console.log('Articles found:', articles?.length || 0);

        if (!articles || articles.length === 0) {
            return res.status(404).render('error', { 
                message: 'Article not found',
                title: 'Article Not Found - GadiDrive'
            });
        }

        const article = articles[0];
        
        // Verify article belongs to this country (or is global)
        if (countryname && article.country_id && article.country_id !== currentCountry.id) {
            console.log('❌ Article does not belong to this country');
            const correctUrl = article.country_name ? 
                `/${article.country_name.toLowerCase()}/news/${articleId}-${articleTitle}` : 
                `/news/${articleId}-${articleTitle}`;
            
            return res.redirect(301, correctUrl);
        }
        
        // Get article contents
        const [contents] = await db.query(
            `SELECT * FROM article_contents WHERE article_id = ? ORDER BY content_order`,
            [articleId]
        );
        
        article.contents = contents;

        // Get recommended articles (same country or global)
        let recommendedArticles = [];
        if (currentCountry) {
            const [recArticles] = await db.query(
                `SELECT 
                    a.Article_id, 
                    a.Article_title, 
                    a.Article_main_image,
                    a.published_date,
                    u.name AS author_name
                FROM articles a 
                LEFT JOIN usertable u ON a.author_id = u.user_id
                WHERE a.Article_id != ? 
                  AND (a.country_id = ? OR a.country_id IS NULL)
                ORDER BY a.published_date DESC 
                LIMIT 4`,
                [articleId, currentCountry.id]
            );
            recommendedArticles = recArticles;
        } else {
            const [recArticles] = await db.query(
                `SELECT 
                    a.Article_id, 
                    a.Article_title, 
                    a.Article_main_image,
                    a.published_date,
                    u.name AS author_name
                FROM articles a 
                LEFT JOIN usertable u ON a.author_id = u.user_id
                WHERE a.Article_id != ? 
                ORDER BY a.published_date DESC 
                LIMIT 4`,
                [articleId]
            );
            recommendedArticles = recArticles;
        }

        // Format published date for SEO
        const publishedDate = article.published_date 
            ? new Date(article.published_date)
            : new Date();
            
        const formattedDate = publishedDate.toISOString();
        const readableDate = publishedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Country prefix for links
        const countryPrefix = countryname ? '/' + countryname : '';

        // SEO Meta Data
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const seoTitle = `${article.Article_title} - News from ${countryDisplay} | GadiDrive`;
        const seoDescription = article.contents && article.contents.length > 0 
            ? article.contents.find(c => c.type === 'article')?.value?.substring(0, 160) + '...' 
            : `Read ${article.Article_title} on our news platform.`;
        
        // Current URL with SEO-friendly format
        const currentUrl = countryname 
            ? `${req.protocol}://${req.get('host')}/${countryname}/news/${articleId}-${articleTitle}`
            : `${req.protocol}://${req.get('host')}/news/${articleId}-${articleTitle}`;

        res.render('./publicpages/newsdetails', {
            title: seoTitle,
            article: article,
            recommendedArticles: recommendedArticles || [],
            publishedDate: readableDate,
            publishedDateISO: formattedDate,
            currentUrl: currentUrl,
            seoDescription: seoDescription,
            authorName: article.author_name || 'Staff Writer',
            authorUserId: article.author_user_id,
            authorUsername: article.author_username,
            country: currentCountry,
            allCountries,
            countryDisplay,
            countryPrefix,
            path: countryname ? `/${countryname}/news/${articleId}-${articleTitle}` : `/news/${articleId}-${articleTitle}`
        });
    } catch (err) {
        console.error('Error fetching news details:', err);
        res.status(500).render('error', { 
            message: 'Failed to load news article',
            title: 'Error - GadiDrive'
        });
    }
};