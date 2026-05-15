// utils/imageOptimizer.js - Central Image Optimization Module
// Converts uploaded images to WebP format with compression and resizing
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Size configurations for different image types
const SIZE_CONFIG = {
    model: { maxWidth: 1200, quality: 80 },
    brand: { maxWidth: 600, quality: 80 },
    category: { maxWidth: 600, quality: 80 },
    vehicle: { maxWidth: 600, quality: 80 },
    color: { maxWidth: 800, quality: 80 },
    spec: { maxWidth: 1200, quality: 80 },
    about: { maxWidth: 1200, quality: 80 },
    article: { maxWidth: 1200, quality: 80 },
    profile: { maxWidth: 300, quality: 80 }
};

/**
 * Optimize a single image file - convert to WebP, compress, resize
 * @param {string} filePath - Full path to the uploaded file
 * @param {string} type - Image type (model, brand, category, etc.)
 * @returns {Promise<string>} - New filename (with .webp extension)
 */
async function optimizeImage(filePath, type = 'model') {
    try {
        const config = SIZE_CONFIG[type] || SIZE_CONFIG.model;
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const baseName = path.basename(filePath, ext);
        const webpFileName = baseName + '.webp';
        const webpFilePath = path.join(dir, webpFileName);

        // Read and optimize with sharp
        await sharp(filePath)
            .resize(config.maxWidth, null, {
                withoutEnlargement: true,  // Don't upscale small images
                fit: 'inside'              // Maintain aspect ratio
            })
            .webp({ quality: config.quality })
            .toFile(webpFilePath);

        // Delete original file (PNG/JPG)
        if (filePath !== webpFilePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        console.log(`✅ Image optimized: ${path.basename(filePath)} → ${webpFileName}`);
        return webpFileName;
    } catch (error) {
        console.error(`❌ Image optimization failed for ${filePath}:`, error.message);
        // If optimization fails, keep original file
        return path.basename(filePath);
    }
}

/**
 * Middleware wrapper - optimizes files after multer upload
 * @param {string} type - Image type for size config
 * @returns {Function} Express middleware
 */
function optimizeAfterUpload(type = 'model') {
    return async (req, res, next) => {
        try {
            // Handle single file upload (req.file)
            if (req.file) {
                const newFileName = await optimizeImage(req.file.path, type);
                req.file.filename = newFileName;
                req.file.path = path.join(path.dirname(req.file.path), newFileName);
            }

            // Handle multiple files upload (req.files as array)
            if (req.files && Array.isArray(req.files)) {
                for (const file of req.files) {
                    const fileType = getTypeFromFieldname(file.fieldname, type);
                    const newFileName = await optimizeImage(file.path, fileType);
                    file.filename = newFileName;
                    file.path = path.join(path.dirname(file.path), newFileName);
                }
            }

            // Handle multiple files upload (req.files as object with field names)
            if (req.files && !Array.isArray(req.files)) {
                for (const fieldName of Object.keys(req.files)) {
                    for (const file of req.files[fieldName]) {
                        const fileType = getTypeFromFieldname(fieldName, type);
                        const newFileName = await optimizeImage(file.path, fileType);
                        file.filename = newFileName;
                        file.path = path.join(path.dirname(file.path), newFileName);
                    }
                }
            }

            next();
        } catch (error) {
            console.error('Image optimization middleware error:', error);
            next(); // Don't block request if optimization fails
        }
    };
}

/**
 * Determine image type from field name
 */
function getTypeFromFieldname(fieldname, defaultType) {
    if (fieldname.includes('exterior') || fieldname.includes('interior')) return 'color';
    if (fieldname.includes('spec')) return 'spec';
    if (fieldname.includes('about')) return 'about';
    if (fieldname.includes('model')) return 'model';
    if (fieldname.includes('brand')) return 'brand';
    if (fieldname.includes('category')) return 'category';
    if (fieldname.includes('profile')) return 'profile';
    if (fieldname.includes('vehicle')) return 'vehicle';
    if (fieldname.includes('article') || fieldname.includes('mainImage') || fieldname.includes('contentImage')) return 'article';
    return defaultType;
}

module.exports = { optimizeImage, optimizeAfterUpload, SIZE_CONFIG };
