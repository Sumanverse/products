// utils/uploadVehicle.js
const multer = require('multer');
const path = require('path');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = path.join(__dirname, '../public/uploads/vehicle-types');
            require('fs').mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, 'vehicle-' + Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        cb(null, ext && mime);
    }
}).single('vehicle_type_photo');

const { optimizeAfterUpload } = require('./imageOptimizer');

module.exports = (req, res, next) => {
    upload(req, res, (err) => {
        if (err) return next(err);
        optimizeAfterUpload('vehicle')(req, res, next);
    });
};