const db = require('../utils/dbutils');

async function check() {
    const tables = ['brands', 'articles', 'models', 'categories', 'vehicletype'];
    console.log('🔍 Checking Database Schema...\n');

    for (const table of tables) {
        try {
            const [rows] = await db.execute(`DESCRIBE ${table}`);
            console.log(`📋 Table: ${table}`);
            rows.forEach(row => {
                if (row.Field.toLowerCase().includes('image') || row.Field.toLowerCase().includes('photo') || row.Field.toLowerCase().includes('logo')) {
                    console.log(`   - ✅ Found Column: ${row.Field}`);
                }
            });
            console.log('');
        } catch (err) {
            console.log(`❌ Table ${table} not found or error: ${err.message}\n`);
        }
    }
    process.exit(0);
}

check();
