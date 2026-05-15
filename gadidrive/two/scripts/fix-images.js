const db = require('../utils/dbutils');

async function fix() {
    console.log('🔧 Fixing Broken Image Links...\n');
    
    const mappings = [
        { table: 'brands', column: 'image_path' },
        { table: 'articles', column: 'Article_main_image' },
        { table: 'models', column: 'model_image' },
        { table: 'categories', column: 'image_path' },
        { table: 'vehicletype', column: 'vehicle_type_photo_path' }
    ];

    for (const m of mappings) {
        try {
            // This query finds any path ending in .png, .jpg, or .jpeg and changes it to .webp
            const query = `
                UPDATE ${m.table} 
                SET ${m.column} = REPLACE(REPLACE(REPLACE(${m.column}, '.png', '.webp'), '.jpg', '.webp'), '.jpeg', '.webp')
                WHERE ${m.column} LIKE '%.png' 
                   OR ${m.column} LIKE '%.jpg' 
                   OR ${m.column} LIKE '%.jpeg'
            `;
            const [result] = await db.execute(query);
            console.log(`✅ Updated ${result.affectedRows} links in ${m.table} (${m.column})`);
        } catch (err) {
            console.log(`❌ Error in ${m.table}: ${err.message}`);
        }
    }
    
    console.log('\n✨ All links updated! Please refresh your website.');
    process.exit(0);
}

fix();
