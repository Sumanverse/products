// utils/uploadarticle.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = 'public/uploads/articles';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|gif|webp/;
    if (types.test(file.mimetype) && types.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Images only!'));
    }
  }
}).fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'contentImages', maxCount: 50 }
]);

const { optimizeAfterUpload } = require('./imageOptimizer');

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) return next(err);
    optimizeAfterUpload('article')(req, res, next);
  });
};