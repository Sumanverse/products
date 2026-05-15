// utils/upload.js - FINAL WORKING VERSION
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../public/uploads/profiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + unique + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/image\/(jpeg|jpg|png|gif|webp)/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Image file matra allowed!'), false);
        }
    }
});

const { optimizeAfterUpload } = require('./imageOptimizer');

module.exports = {
    single: (fieldname) => {
        const uploadMiddleware = upload.single(fieldname);
        return (req, res, next) => {
            uploadMiddleware(req, res, (err) => {
                if (err) return next(err);
                optimizeAfterUpload('profile')(req, res, next);
            });
        };
    }
};