const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const adminRouter = require('./routes/adminrouter');
const fullpageRouter = require('./routes/fullpagesrouter');
const publicpagesRouter = require('./routes/publicpagesrouter');
const { auth } = require('./middleware/auth');
const rootDir = require('./utils/pathutil');
const pool = require('./utils/dbutils');

const notFoundController = require('./controller/publicpages/404');
const searchRoutes = require('./routes/search');

const app = express();



app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public', {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, path) => {
        if (path.includes('/Uploads/') || path.includes('/uploads/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'gadidrive-super-secret-key-12345-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    },
    rolling: true,
    name: 'gadidrive.sid'
};

if (process.env.NODE_ENV === 'production') {
    const RedisStore = require('connect-redis')(session);
    const redisClient = require('./config/redis');
    sessionConfig.store = new RedisStore({ client: redisClient });
}

app.use(session(sessionConfig));
app.use(flash());

app.use(async (req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.user = req.session.user || null;
    res.locals.currentUrl = req.originalUrl;

    try {
        const [countries] = await pool.execute('SELECT id, country_name, currency_symbol, currency_code FROM countries');
        res.locals.allCountries = countries;
    } catch (err) {
        console.error('Error fetching global countries:', err);
        res.locals.allCountries = [];
    }
    next();
});

app.use((req, res, next) => {
    if (req.session.user) {
        const now = Date.now();
        if (req.session.lastActivity &&
            (now - req.session.lastActivity) > (60 * 60 * 1000)) {
            req.session.destroy();
            return res.redirect('/signin?message=Auto logged out due to inactivity (1 hour timeout)');
        }
        req.session.lastActivity = now;
    }
    next();
});

const fs = require('fs');
const uploadDirs = [
    'uploads/profiles', 'uploads/vehicle-types', 'uploads/categories',
    'uploads/brands', 'uploads/models', 'uploads/exterior_colors',
    'uploads/interior_colors', 'uploads/specifications', 'uploads/about_contents'
];

uploadDirs.forEach(dir => {
    const fullPath = path.join(__dirname, 'public', dir);
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
    }
});

// Robots.txt manual route (Optional, but good for clarity)
app.get('/robots.txt', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'robots.txt'));
});

app.get('/sitemap.xml', async (req, res) => {
    try {
        const [countries] = await pool.execute('SELECT id, LOWER(country_name) as name FROM countries WHERE status = 1');
        
        // Fetch valid country-resource mappings
        const [categories] = await pool.execute(`
            SELECT DISTINCT LOWER(co.country_name) as country_name, LOWER(c.name) as cat_name, LOWER(vt.vehicle_type_name) as vt_name 
            FROM categories c 
            JOIN vehicletype vt ON c.vehicle_type_id = vt.vehicle_type_id
            CROSS JOIN countries co
            WHERE (c.country_id = co.id OR c.country_id IS NULL) AND co.status = 1
        `);
        const [brands] = await pool.execute(`
            SELECT DISTINCT LOWER(co.country_name) as country_name, LOWER(b.name) as brand_name, LOWER(vt.vehicle_type_name) as vt_name 
            FROM brands b 
            JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
            CROSS JOIN countries co
            WHERE (b.country_id = co.id OR b.country_id IS NULL) AND co.status = 1
        `);
        const [models] = await pool.execute(`
            SELECT DISTINCT LOWER(co.country_name) as country_name, LOWER(m.model_name) as model_name, LOWER(b.name) as brand_name, LOWER(vt.vehicle_type_name) as vt_name 
            FROM models m 
            JOIN brands b ON m.brand_id = b.brand_id 
            JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
            CROSS JOIN countries co
            WHERE (m.country_id = co.id OR m.country_id IS NULL) AND co.status = 1
        `);
        const [specs] = await pool.execute(`
            SELECT DISTINCT LOWER(co.country_name) as country_name, LOWER(s.title) as spec_title, LOWER(m.model_name) as model_name, LOWER(b.name) as brand_name, LOWER(vt.vehicle_type_name) as vt_name 
            FROM specifications s 
            JOIN models m ON s.model_id = m.id 
            JOIN brands b ON m.brand_id = b.brand_id 
            JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
            CROSS JOIN countries co
            WHERE (m.country_id = co.id OR m.country_id IS NULL) AND co.status = 1
        `);
        const [news] = await pool.execute('SELECT Article_id, Article_title FROM articles');

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        const siteUrl = 'https://gadidrive.com';

        // 1. Static Global Pages
        const globalStatics = ['/', '/about', '/news', '/compare', '/emicalculator'];
        globalStatics.forEach(p => {
            xml += `\n  <url><loc>${siteUrl}${p}</loc><priority>1.0</priority></url>`;
        });

        // 2. Country Specific Loop
        countries.forEach(ct => {
            const countrySlug = encodeURIComponent(ct.name);

            // A. Country Home & Statics
            xml += `\n  <url><loc>${siteUrl}/${countrySlug}</loc><priority>0.9</priority></url>`;
            ['news', 'compare', 'emicalculator'].forEach(p => {
                xml += `\n  <url><loc>${siteUrl}/${countrySlug}/${p}</loc><priority>0.7</priority></url>`;
            });
        });

        // 3. Entity Specific Sitemaps (Filtered by valid country mapping)
        
        // B. Categories
        categories.forEach(c => {
            const countrySlug = encodeURIComponent(c.country_name);
            const vtSlug = encodeURIComponent(c.vt_name.replace(/\s+/g, '-'));
            const catSlug = encodeURIComponent(c.cat_name.replace(/\s+/g, '-'));
            xml += `\n  <url><loc>${siteUrl}/${countrySlug}/${vtSlug}/${catSlug}/</loc><priority>0.8</priority></url>`;
        });

        // C. Brands
        brands.forEach(b => {
            const countrySlug = encodeURIComponent(b.country_name);
            const vtSlug = encodeURIComponent(b.vt_name.replace(/\s+/g, '-'));
            const brandSlug = encodeURIComponent(b.brand_name.replace(/\s+/g, '-'));
            xml += `\n  <url><loc>${siteUrl}/${countrySlug}/${vtSlug}/${brandSlug}/</loc><priority>0.8</priority></url>`;
        });

        // D. Models
        models.forEach(m => {
            const countrySlug = encodeURIComponent(m.country_name);
            const vtSlug = encodeURIComponent(m.vt_name.replace(/\s+/g, '-'));
            const brandSlug = encodeURIComponent(m.brand_name.replace(/\s+/g, '-'));
            const modelSlug = encodeURIComponent(m.model_name.replace(/\s+/g, '-'));
            xml += `\n  <url><loc>${siteUrl}/${countrySlug}/${vtSlug}/${brandSlug}/${modelSlug}/</loc><priority>0.9</priority></url>`;
        });

        // E. Specifications
        specs.forEach(s => {
            const countrySlug = encodeURIComponent(s.country_name);
            const vtSlug = encodeURIComponent(s.vt_name.replace(/\s+/g, '-'));
            const brandSlug = encodeURIComponent(s.brand_name.replace(/\s+/g, '-'));
            const modelSlug = encodeURIComponent(s.model_name.replace(/\s+/g, '-'));
            const specSlug = encodeURIComponent(s.spec_title.replace(/\s+/g, '-'));
            xml += `\n  <url><loc>${siteUrl}/${countrySlug}/${vtSlug}/${brandSlug}/${modelSlug}/specs/${specSlug}/</loc><priority>0.6</priority></url>`;
        });

        // 4. Global News Articles
        news.forEach(n => {
            const slug = n.Article_title ? n.Article_title.replace(/\s+/g, '-').toLowerCase() : 'news';
            xml += `\n  <url><loc>${siteUrl}/news/${n.Article_id}-${encodeURIComponent(slug)}</loc><priority>0.8</priority></url>`;
        });

        xml += `\n</urlset>`;

        res.set('Content-Type', 'application/xml');
        res.status(200).send(xml);

    } catch (err) {
        console.error("Sitemap Error:", err);
        res.status(500).send("Database Error: " + err.message);
    }
});

// app.js मा यो顺序 महत्त्वपूर्ण छ:
app.use('/admin', auth, adminRouter);           // Admin routes - पहिले
app.use('/', fullpageRouter);                   // Global home page (/) - दोस्रो
app.use('/', searchRoutes);                       // Search routes - तेस्रो
app.use('/', publicpagesRouter);                   // Country pages (/:countryname) - अन्तिम

app.get('/notfound', notFoundController.getNotFound);

app.get('/logout', (req, res) => {
    const userName = req.session.user ? req.session.user.name : 'User';

    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.clearCookie('gadidrive.sid');
        res.clearCookie('token');
        res.clearCookie('gadidrive_user');

        res.redirect(`/signin?message=${encodeURIComponent(`${userName} successfully logged out`)}`);
    });
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err);

    res.status(500).send(`
        <div style="padding: 20px; font-family: sans-serif;">
            <h1>500 - Server Error</h1>
            <p>Something went wrong on our end. Please try again later.</p>
            ${process.env.NODE_ENV === 'development' ? `<pre>${err.stack}</pre>` : ''}
            <a href="/">Go back to Home</a>
        </div>
    `);
});

app.use((req, res) => {
    if (req.session.user) {
        return res.redirect('/profile');
    }
    res.redirect('/notfound');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`ðŸš€ Server running on http://localhost:${port}`);
});