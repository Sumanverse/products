// utils/uploadmodels.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDirs = {
  model: 'public/uploads/models',
  color: 'public/uploads/colors',
  spec: 'public/uploads/specs',
  about: 'public/uploads/about'
};

// Create directories
Object.values(uploadDirs).forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir = uploadDirs.model;
    if (file.fieldname.includes('exterior') || file.fieldname.includes('interior')) {
      dir = uploadDirs.color;
    } else if (file.fieldname.includes('specPhoto')) {
      dir = uploadDirs.spec;
    } else if (file.fieldname.includes('aboutPhoto')) {
      dir = uploadDirs.about;
    }
    cb(null, path.join(__dirname, '..', dir));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  cb(null, ext && mime);
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter
}).any(); // Accept all fields

const { optimizeAfterUpload } = require('./imageOptimizer');

module.exports = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) return next(err);
    optimizeAfterUpload('model')(req, res, next);
  });
};