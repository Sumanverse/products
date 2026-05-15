// utils/uploadcategory.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/categories');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed!'));
    }
}).single('categoryImage');

const { optimizeAfterUpload } = require('./imageOptimizer');

module.exports = (req, res, next) => {
    upload(req, res, (err) => {
        if (err) return next(err);
        optimizeAfterUpload('category')(req, res, next);
    });
};