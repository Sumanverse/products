// controller/admin/Aarticle.js - WITH COUNTRY SUPPORT
const Article = require('../../models/Article');
const Country = require('../../models/country');
const path = require('path');
const fs = require('fs');

exports.getadminarticle = async (req, res) => {
  try {
    // Get all articles and countries for the filter dropdown
    const [articles, countries] = await Promise.all([
      Article.findAll(),
      Country.getAll()
    ]);
    
    res.render('admin/Aarticle', { 
      articles, 
      countries,
      user: req.user 
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// NEW: Get articles filtered by country (for AJAX)
exports.getArticlesByCountry = async (req, res) => {
  try {
    const countryId = req.params.countryId ? parseInt(req.params.countryId) : null;
    const articles = await Article.findAll(countryId);
    res.json({ success: true, articles });
  } catch (error) {
    console.error('Error fetching articles by country:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.postArticle = async (req, res) => {
  try {
    const { articleTitle, contentData, sources, countryId } = req.body; // NEW: Added countryId
    const mainImage = req.files['mainImage']?.[0]?.filename;
    const contentImages = req.files['contentImages'] || [];

    if (!mainImage) return res.status(400).json({ error: 'Main image required' });

    const contents = JSON.parse(contentData);
    let imgIdx = 0;
    const processed = contents.map(c => {
      if (c.type === 'photo' && contentImages[imgIdx]) {
        return { 
          type: 'photo', 
          image_path: contentImages[imgIdx++].filename, 
          image_source: c.image_source || '' 
        };
      }
      return { type: c.type, value: c.value || null };
    });

    // NEW: Parse countryId
    const selectedCountryId = countryId ? parseInt(countryId) : null;

    await Article.create(
      { 
        title: articleTitle, 
        mainImage, 
        author_id: req.user.user_id,
        sources: sources || '',
        countryId: selectedCountryId // NEW: Pass countryId
      },
      processed
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Publish failed' });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const id = req.params.id;
    const { articleTitle, contentData, sources, countryId } = req.body; // NEW: Added countryId
    const newMainFile = req.files['mainImage']?.[0];
    const uploadedFiles = req.files['contentImages'] || [];

    const existing = await Article.findById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // Main Image
    let mainImage = existing.Article_main_image;
    if (newMainFile) {
      mainImage = newMainFile.filename;
      if (existing.Article_main_image) {
        const oldPath = path.join('public', existing.Article_main_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    // Content processing (same as before)
    const contents = JSON.parse(contentData);
    const processed = [];
    let fileIndex = 0;
    const oldPhotos = existing.contents
      .filter(c => c.type === 'photo')
      .map(c => ({ path: c.image_path, source: c.image_source }));
    let oldPhotoIndex = 0;

    for (const block of contents) {
      if (block.type === 'photo') {
        const hasNewFile = fileIndex < uploadedFiles.length;

        if (hasNewFile) {
          const newFile = uploadedFiles[fileIndex];
          const newFilename = newFile.filename;

          const oldPhoto = oldPhotos[oldPhotoIndex];
          if (oldPhoto?.path) {
            const oldPath = path.join('public', oldPhoto.path);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          }

          processed.push({
            type: 'photo',
            image_path: newFilename,
            image_source: block.image_source || ''
          });

          fileIndex++;
          oldPhotoIndex++;
        } else {
          const oldPhoto = oldPhotos[oldPhotoIndex];
          processed.push({
            type: 'photo',
            image_path: oldPhoto?.path || null,
            image_source: block.image_source || oldPhoto?.source || ''
          });
          oldPhotoIndex++;
        }
      } else {
        processed.push({ type: block.type, value: block.value || null });
      }
    }

    // NEW: Parse countryId
    const selectedCountryId = countryId ? parseInt(countryId) : null;

    await Article.update(
      id, 
      { 
        title: articleTitle, 
        mainImage, 
        sources: sources || '',
        countryId: selectedCountryId // NEW: Pass countryId
      }, 
      processed
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    const id = req.params.id;
    const article = await Article.findById(id);
    if (!article) return res.status(404).json({ error: 'Not found' });

    if (article.Article_main_image) {
      const p = path.join('public', article.Article_main_image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    article.contents.forEach(c => {
      if (c.image_path) {
        const p = path.join('public', c.image_path);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    });

    await Article.delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Delete failed' });
  }
};