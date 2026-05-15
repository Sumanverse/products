const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const db = require('../utils/dbutils');

const PUBLIC_DIR = path.join(__dirname, '../public');
const SEARCH_DIRS = ['Uploads', 'uploads', 'images'];

// UPDATED MAPPINGS BASED ON YOUR SCHEMA CHECK
const TABLE_CONFIGS = {
    'brands': { table: 'brands', pathColumn: 'image_path' },
    'categories': { table: 'categories', pathColumn: 'image_path' },
    'models': { table: 'models', pathColumn: 'model_image' },
    'vehicletype': { table: 'vehicletype', pathColumn: 'vehicle_type_photo_path' },
    'articles': { table: 'articles', pathColumn: 'Article_main_image' },
    'about': { table: 'about_contents', pathColumn: 'image_path' },
    'userdetails': { table: 'userdetails', pathColumn: 'profile_picture' }
};

async function updateDbPath(oldPath, newPath, dirName, rootDirName) {
    const fileName = oldPath;
    const newFileName = newPath;
    
    // We search for variations of the path that might be in your DB
    const variations = [
        `/${rootDirName}/${dirName}/${fileName}`,
        `/${rootDirName.toLowerCase()}/${dirName}/${fileName}`,
        `${rootDirName}/${dirName}/${fileName}`,
        `/${dirName}/${fileName}`
    ];
    
    const targetPath = `/${rootDirName}/${dirName}/${newFileName}`;
    
    const config = TABLE_CONFIGS[dirName] || TABLE_CONFIGS[dirName.replace('-', '')];
    if (!config) return;

    try {
        const query = `
            UPDATE ${config.table} 
            SET ${config.pathColumn} = ? 
            WHERE ${config.pathColumn} IN (?, ?, ?, ?)
        `;
        await db.execute(query, [targetPath, ...variations]);
    } catch (err) {
        // Silently skip if column/table doesn't match for a specific directory
    }
}

async function optimizeDirectory(dirPath, dirname, rootDirName) {
    let count = 0;
    if (!fs.existsSync(dirPath)) return 0;
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            count += await optimizeDirectory(fullPath, dirname, rootDirName);
        } else {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.jpg', '.jpeg', '.png'].includes(ext)) {
                try {
                    const webpName = path.basename(entry.name, ext) + '.webp';
                    const webpPath = path.join(dirPath, webpName);
                    
                    await sharp(fullPath)
                        .resize(1000, null, { withoutEnlargement: true, fit: 'inside' })
                        .webp({ quality: 80 })
                        .toFile(webpPath);
                    
                    await updateDbPath(entry.name, webpName, dirname, rootDirName);
                    fs.unlinkSync(fullPath);
                    count++;
                } catch (error) {}
            }
        }
    }
    return count;
}

async function run() {
    console.log('🚀 Final Deep Migration Started...');
    let total = 0;
    
    for (const rootDir of SEARCH_DIRS) {
        const fullPath = path.join(PUBLIC_DIR, rootDir);
        if (fs.existsSync(fullPath)) {
            const subDirs = fs.readdirSync(fullPath, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);
                
            for (const sub of subDirs) {
                const count = await optimizeDirectory(path.join(fullPath, sub), sub, rootDir);
                if (count > 0) {
                    console.log(`✅ ${sub}: Converted ${count} images.`);
                    total += count;
                }
            }
        }
    }
    console.log(`\n🎉 WebP Conversion Complete! Total: ${total}`);
    process.exit(0);
}

run();
