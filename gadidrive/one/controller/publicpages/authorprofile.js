// controller/publicpages/authorprofile.js
const Article = require('../../models/Article');
const UserDetails = require('../../models/userdetails');
const db = require('../../utils/dbutils');
const Country = require('../../models/country'); // For footer only

exports.getAuthorProfile = async (req, res) => {
    try {
        const { username, authorid } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        
        console.log('👤 Author Profile Request:', { username, authorid });
        
        // Get all countries for footer (no country in URL)
        const allCountries = await Country.getAll();
        
        // Get author by ID
        const author = await UserDetails.getUserById(authorid);
        
        if (!author) {
            return res.status(404).render('error', { 
                message: 'Author not found',
                error: { status: 404 },
                title: 'Author Not Found - GadiDrive'
            });
        }
        
        // Generate username from author's name
        const generatedUsername = author.name.toLowerCase().replace(/\s+/g, '');
        console.log('Generated username:', generatedUsername);
        
        // Verify username matches
        if (generatedUsername !== username.toLowerCase()) {
            console.log('🔄 Redirecting to correct URL...');
            return res.redirect(301, `/@${generatedUsername}-${authorid}`);
        }

        // Get author's articles
        const allArticles = await Article.findAll(); // Get all articles (no country filter)
        const authorArticles = allArticles.filter(article => 
            article.author_id == authorid
        );

        // Pagination
        const totalArticles = authorArticles.length;
        const totalPages = Math.ceil(totalArticles / limit);
        const paginatedArticles = authorArticles.slice(offset, offset + limit);

        // Format articles
        const formattedArticles = paginatedArticles.map(article => ({
            ...article,
            formattedDate: article.published_date ? 
                new Date(article.published_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                }) : 'No date'
        }));

        res.render('publicpages/authorprofile', {
            author: {
                ...author,
                username: generatedUsername
            },
            articles: formattedArticles,
            currentPage: page,
            totalPages: totalPages,
            userid: authorid,
            authorid: authorid,
            allCountries: allCountries, // For footer
            title: `${author.name} - GadiDrive Author`,
            description: author.bio || `Read articles by ${author.name} on GadiDrive - Nepal's leading automotive platform.`,
            keywords: `${author.name}, GadiDrive author, automotive articles, car news, bike news`,
            currentUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
            path: `/@${generatedUsername}-${authorid}`,
            country: null // No country context
        });

    } catch (error) {
        console.error('❌ Error in author profile:', error);
        res.status(500).render('error', { 
            message: 'Server error occurred while loading author profile',
            error: { status: 500 },
            title: 'Server Error - GadiDrive'
        });
    }
};