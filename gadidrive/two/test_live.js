const https = require('https');

function fetch(url, followRedirect = false) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, (res) => {
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && !followRedirect) {
                resolve({ statusCode: res.statusCode, location: res.headers.location });
                return;
            }
            if ([301, 302, 303, 307, 308].includes(res.statusCode) && followRedirect) {
                return fetch(new URL(res.headers.location, url).href, true).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, data }));
        });
        req.on('error', reject);
    });
}

async function run() {
    try {
        console.log('--- HOMEPAGE CHECKS ---');
        let res = await fetch('https://gadidrive.com/');
        let html = res.data;
        console.log('A1. <title>:', html.match(/<title>(.*?)<\/title>/)?.[1]);
        console.log('A2. og:title:', html.match(/<meta property=\"og:title\" content=\"(.*?)\"/)?.[1] || html.match(/<meta property=\"og:title\" content=\'(.*?)\'/)?.[1]);
        console.log('A3. og:image:', html.match(/<meta property=\"og:image\" content=\"(.*?)\"/)?.[1] || html.match(/<meta property=\"og:image\" content=\'(.*?)\'/)?.[1]);
        console.log('A4. Regular Updates:', html.includes('Regular Updates'));
        console.log('A4. 24/7 Updates (should be false):', html.includes('24/7 Updates'));
        console.log('A5. Full footer visible (has gadidrive-footer):', html.includes('gadidrive-footer'));
        console.log('A6. Contact Us link:', html.match(/href=\"(\/contact)\"/)?.[1]);
        console.log('A7. Privacy Policy link:', html.match(/href=\"(\/privacy-policy)\"/)?.[1]);
        console.log('A8. Terms of Service link:', html.match(/href=\"(\/terms)\"/)?.[1]);
        console.log('A9. Switch Country Nepal:', html.includes('value=\"nepal\"') || html.includes('value=\"nepal/\"'));
        console.log('A10. Worldwide copyright:', html.includes('worldwide'));
        console.log('A11. Facebook link:', html.includes('facebook.com'));

        console.log('\n--- EMICALCULATOR CHECKS ---');
        res = await fetch('https://gadidrive.com/emicalculator');
        html = res.data;
        console.log('B1. <title>:', html.match(/<title>(.*?)<\/title>/)?.[1]);
        console.log('B2. og:title:', html.match(/<meta property=\"og:title\" content=\"(.*?)\"/)?.[1]);
        console.log('B3. og:image:', html.match(/<meta property=\"og:image\" content=\"(.*?)\"/)?.[1]);
        console.log('B4. meta desc:', html.match(/<meta name=\"description\" content=\"(.*?)\"/)?.[1]);
        console.log('B5. Full footer:', html.includes('gadidrive-footer'));
        console.log('B6. Terms link:', html.match(/href=\"(\/terms)\"/)?.[1]);
        console.log('B7. Switch Country Nepal:', html.includes('value=\"nepal\"') || html.includes('value=\"nepal/\"'));
        console.log('B8. Worldwide copyright:', html.includes('worldwide'));
        
        console.log('\n--- ABOUT PAGE CHECKS ---');
        res = await fetch('https://gadidrive.com/about');
        html = res.data;
        console.log('C1. Privacy Policy gone:', !html.includes('🛡️ Privacy Policy'));
        console.log('C2. Terms of Service gone:', !html.includes('📄 Terms of Service'));
        console.log('C3. Our Story exists:', html.includes('Our Story'));

        console.log('\n--- REDIRECTS AND SPECS CHECKS ---');
        // Check D1 and D2 on spec page
        res = await fetch('https://gadidrive.com/nepal/car/toyota/camry/specs/performance-and-engine/');
        html = res.data;
        console.log('D1/D2. Has /brand/ links (should be false):', html.includes('/brand/toyota/'));
        
        res = await fetch('https://gadidrive.com/nepal/car/brand/toyota/camry/');
        console.log('D3. Model redirect code:', res.statusCode, 'Location:', res.location);
        
        res = await fetch('https://gadidrive.com/nepal/car/brand/toyota/camry/specs/performance-and-engine/');
        console.log('D4. Spec redirect code:', res.statusCode, 'Location:', res.location);

        console.log('\n--- SITEMAP CHECKS ---');
        res = await fetch('https://gadidrive.com/sitemap.xml');
        console.log('E1. Sitemap status:', res.statusCode);
        console.log('E2. Has nepal camry:', res.data.includes('/nepal/car/toyota/camry/'));
        console.log('E3. Has india camry:', res.data.includes('/india/car/toyota/camry/'));
        console.log('E4. Has brand page:', res.data.includes('/nepal/car/toyota/'));
        console.log('E5. Has category page:', res.data.includes('/nepal/car/suv/'));
        console.log('E6. Has about page:', res.data.includes('/about'));
        const urlCount = (res.data.match(/<url>/g) || []).length;
        console.log('E7. Total URLs:', urlCount, ' (>100?)');

        console.log('\n--- SCHEMA CHECKS ---');
        res = await fetch('https://gadidrive.com/nepal/car/toyota/camry/');
        html = res.data;
        console.log('F1. Has JSON-LD script:', html.includes('application/ld+json'));
        console.log('F2. Has Vehicle:', html.includes('\"@type\":\"Vehicle\"') || html.includes('\"@type\": \"Vehicle\"'));
        console.log('F3. Has Toyota:', html.includes('Toyota'));
        console.log('F4. Has price:', html.includes('price'));
        console.log('F5. Has FAQPage:', html.includes('\"@type\":\"FAQPage\"') || html.includes('\"@type\": \"FAQPage\"'));
        console.log('F6. Has BreadcrumbList:', html.includes('\"@type\":\"BreadcrumbList\"') || html.includes('\"@type\": \"BreadcrumbList\"'));

        console.log('\n--- ROBOTS.TXT CHECKS ---');
        res = await fetch('https://gadidrive.com/robots.txt');
        console.log('G1. Robots status:', res.statusCode);
        console.log('G2. Sitemap present:', res.data.includes('Sitemap: https://gadidrive.com/sitemap.xml'));
        console.log('G3. Allow present:', res.data.includes('Allow: /'));
        console.log('G. Contains sort/filter/page:', res.data.includes('/*?sort=') && res.data.includes('/*?filter=') && res.data.includes('/*?page='));

    } catch (err) {
        console.error(err);
    }
}
run();
