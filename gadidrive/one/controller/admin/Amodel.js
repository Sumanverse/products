const db = require('../../utils/dbutils');
const path = require('path');
const fs = require('fs');
const rootDir = require('../../utils/pathutil');
const Model = require('../../models/models');

// ---------- HELPER: Safe File Path ----------
const getFilePath = (file) => {
  if (!file) return null;
  let filePath = file.path.replace(/^.*public/, '').replace(/\\/g, '/');
  // Ensure path starts with /
  if (!filePath.startsWith('/')) {
    filePath = '/' + filePath;
  }
  return filePath;
};

// ---------- HELPER: Smart Update System ----------
const smartUpdateModel = async (req, modelId, conn) => {
  const { files = [], body } = req;
  const authorId = req.user.user_id;

  // Get existing model data
  const existingModel = await Model.getModelById(modelId, conn);
  const existingDetails = await Model.getModelDetails(modelId, conn);

  // ========== 1. UPDATE MAIN MODEL ==========
  const {
    country, vehicleType, category, brand, modelName, safetyRating, safetyLink,
    sources, keywords, engineType, startingPrice, releaseYear, seater, status = 'import',
    review, descriptions
  } = body;

  // Get country ID
  const [[ct]] = await conn.execute(
    `SELECT id FROM countries WHERE country_name = ?`,
    [country || existingModel.country_name]
  );
  const countryId = ct?.id || existingModel.country_id;

  // Get vehicle type ID
  const [[vt]] = await conn.execute(
    `SELECT vehicle_type_id FROM vehicletype WHERE vehicle_type_name = ? AND (country_id = ? OR country_id IS NULL)`,
    [vehicleType || existingModel.vehicle_type_name, countryId]
  );
  const vehicleTypeId = vt?.vehicle_type_id || existingModel.vehicle_type_id;

  // Get category ID
  const [[catRow]] = await conn.execute(
    `SELECT category_id FROM categories WHERE name = ? AND vehicle_type_id = ? AND (country_id = ? OR country_id IS NULL)`,
    [category || existingModel.category_name, vehicleTypeId, countryId]
  );
  const categoryId = catRow?.category_id || existingModel.category_id;

  // Get brand ID
  const [[br]] = await conn.execute(
    `SELECT brand_id FROM brands WHERE name = ? AND vehicle_type_id = ? AND (country_id = ? OR country_id IS NULL)`,
    [brand || existingModel.brand_name, vehicleTypeId, countryId]
  );
  const brandId = br?.brand_id || existingModel.brand_id;

  // Handle model image
  const modelImageFile = files.find(f => f.fieldname === 'modelImage');
  let modelImagePath = existingModel.model_image;

  if (modelImageFile) {
    modelImagePath = getFilePath(modelImageFile);
    // Delete old model image if new one is uploaded
    if (existingModel.model_image && existingModel.model_image !== modelImagePath) {
      const oldImagePath = path.join(rootDir, 'public', existingModel.model_image);
      if (fs.existsSync(oldImagePath)) {
        try {
          fs.unlinkSync(oldImagePath);
        } catch (err) {
          console.error(`Error deleting old model image:`, err);
        }
      }
    }
  }

  // Parse starting price
  const parsedStartingPrice = startingPrice ? parseFloat(startingPrice.replace(/[^0-9.-]+/g, '')) : existingModel.starting_price;

  // Update model
  await Model.updateModel(modelId, {
    name: modelName || existingModel.model_name,
    vehicle_type_id: vehicleTypeId,
    category_id: categoryId,
    brand_id: brandId,
    country_id: countryId,
    safety_rating: safetyRating ? parseFloat(safetyRating) : existingModel.safety_rating,
    safety_link: safetyLink || existingModel.safety_link,
    sources: sources || existingModel.sources,
    keywords: keywords || existingModel.keywords || '',
    engine_type: engineType || existingModel.engine_type,
    starting_price: parsedStartingPrice,
    release_year: releaseYear || existingModel.release_year,
    seater: seater || existingModel.seater,
    status: status || existingModel.status,
    review: review || existingModel.review,
    descriptions: descriptions || existingModel.descriptions || ''
  }, modelImagePath, authorId, conn);

  // ========== 2. SMART UPDATE EXTERIOR COLORS ==========
  await smartUpdateExteriorColors(req, modelId, existingDetails, conn);

  // ========== 3. SMART UPDATE INTERIOR COLORS ==========
  await smartUpdateInteriorColors(req, modelId, existingDetails, conn);

  // ========== 4. SMART UPDATE VARIANTS ==========
  await smartUpdateVariants(req, modelId, existingDetails, conn);

  // ========== 5. SMART UPDATE AVAILABLE SITES ==========
  await smartUpdateSites(req, modelId, existingDetails, conn);

  // ========== 6. SMART UPDATE HIDDEN TITLES ==========
  await smartUpdateHiddenTitles(req, modelId, existingDetails, conn);

  // ========== 7. SMART UPDATE ABOUT CONTENTS ==========
  await smartUpdateAboutContents(req, modelId, existingDetails, conn);

  // ========== 8. SMART UPDATE KEY SPECS ==========
  await smartUpdateKeySpecs(req, modelId, existingDetails, conn);

  // ========== 9. SMART UPDATE SPECIFICATIONS ==========
  await smartUpdateSpecifications(req, modelId, existingDetails, conn);

  // ========== 10. SMART UPDATE FAQS ==========
  await smartUpdateFaqs(req, modelId, existingDetails, conn);
};

// ---------- SMART UPDATE KEY SPECS ----------
const smartUpdateKeySpecs = async (req, modelId, existingDetails, conn) => {
  const { body } = req;
  const existingKeySpecs = existingDetails.keyspecs || [];

  // Process submitted keyspecs
  const keyspecKeys = Object.keys(body).filter(k => k.startsWith('keyspecName'));

  for (const key of keyspecKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`keyspecName${idx}`];
    const data = body[`keyspecData${idx}`];
    const keyspecId = existingKeySpecs[idx - 1]?.id;

    if (!name || !name.trim()) continue;

    if (keyspecId) {
      // Update existing keyspec
      await conn.execute(
        `UPDATE keyspecs SET key_spec = ?, key_spec_data = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), data || null, keyspecId]
      );
    } else {
      // Create new keyspec
      await conn.execute(
        `INSERT INTO keyspecs (model_id, key_spec, key_spec_data, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), data || null]
      );
    }
  }

  // Delete keyspecs that were removed
  const submittedIndices = keyspecKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingKeySpecs.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      await conn.execute(`DELETE FROM keyspecs WHERE id = ?`, [existingKeySpecs[i].id]);
    }
  }
};

// ---------- SMART UPDATE FAQS ----------
const smartUpdateFaqs = async (req, modelId, existingDetails, conn) => {
  const { body } = req;
  const existingFaqs = existingDetails.faqs || [];

  // Helper: safely get single string value (multer can return array if duplicate field names)
  const getField = (val) => {
    if (Array.isArray(val)) return val[0] || '';
    return val || '';
  };

  // Process submitted faqs
  const faqKeys = Object.keys(body).filter(k => k.startsWith('faqQuestion'));
  console.log('🔍 FAQ DEBUG - faqKeys found:', faqKeys);
  console.log('🔍 FAQ DEBUG - existingFaqs count:', existingFaqs.length);

  for (const key of faqKeys) {
    const idx = key.match(/\d+/)[0];
    const question = getField(body[`faqQuestion${idx}`]);
    const answer = getField(body[`faqAnswer${idx}`]);
    const faqId = existingFaqs[Number(idx) - 1]?.id;

    console.log(`🔍 FAQ[${idx}] - question: "${question}", answer: "${answer}", existingId: ${faqId}`);

    if (!question.trim()) continue;

    try {
      if (faqId) {
        // Update existing faq
        await conn.execute(
          `UPDATE model_faqs SET question = ?, answer = ?, updated_at = NOW() WHERE id = ?`,
          [question.trim(), answer.trim(), faqId]
        );
        console.log(`✅ FAQ updated id=${faqId}`);
      } else {
        // Create new faq
        await conn.execute(
          `INSERT INTO model_faqs (model_id, question, answer, created_at)
           VALUES (?, ?, ?, NOW())`,
          [modelId, question.trim(), answer.trim()]
        );
        console.log(`✅ FAQ inserted for model_id=${modelId}`);
      }
    } catch (faqErr) {
      console.error(`❌ FAQ save error at index ${idx}:`, faqErr);
      throw faqErr;
    }
  }

  // Delete faqs that were removed
  const submittedIndices = faqKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingFaqs.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      await conn.execute(`DELETE FROM model_faqs WHERE id = ?`, [existingFaqs[i].id]);
      console.log(`🗑️ FAQ deleted id=${existingFaqs[i].id}`);
    }
  }
};

// ---------- SMART UPDATE EXTERIOR COLORS ----------
const smartUpdateExteriorColors = async (req, modelId, existingDetails, conn) => {
  const { files = [], body } = req;
  const existingColors = existingDetails.exteriorColors || [];

  // Process submitted exterior colors
  const exteriorKeys = Object.keys(body).filter(k => k.startsWith('exteriorColorName'));

  for (const key of exteriorKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`exteriorColorName${idx}`];
    const colorId = existingColors[idx - 1]?.id;

    if (!name || !name.trim()) continue;

    const colorImgFile = files.find(f => f.fieldname === `exteriorColorImage${idx}`);
    let colorImagePath = existingColors[idx - 1]?.color_image;

    // Handle new color image upload
    if (colorImgFile) {
      colorImagePath = getFilePath(colorImgFile);

      // Delete old color image if exists and is different
      if (existingColors[idx - 1]?.color_image && existingColors[idx - 1]?.color_image !== colorImagePath) {
        const oldImagePath = path.join(rootDir, 'public', existingColors[idx - 1].color_image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error(`Error deleting old color image:`, err);
          }
        }
      }
    }

    if (colorId) {
      // Update existing color
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;
      await conn.execute(
        `UPDATE exterior_colors SET color_name = ?, color_image = ?, updated_at = NOW() WHERE id = ?`,
        [name, img, colorId]
      );

    } else {
      // Create new color
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;
      const [res] = await conn.execute(
        `INSERT INTO exterior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      const newColorId = res.insertId;

    }
  }

  // Delete colors that were removed
  const submittedIndices = exteriorKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingColors.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      // Delete color and its images
      await deleteColorWithImages('exterior', existingColors[i].id, conn);
    }
  }
};

// ---------- SMART UPDATE INTERIOR COLORS ----------
const smartUpdateInteriorColors = async (req, modelId, existingDetails, conn) => {
  const { files = [], body } = req;
  const existingColors = existingDetails.interiorColors || [];

  // Process submitted interior colors
  const interiorKeys = Object.keys(body).filter(k => k.startsWith('interiorColorName'));

  for (const key of interiorKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`interiorColorName${idx}`];
    const colorId = existingColors[idx - 1]?.id;

    if (!name || !name.trim()) continue;

    const colorImgFile = files.find(f => f.fieldname === `interiorColorImage${idx}`);
    let colorImagePath = existingColors[idx - 1]?.color_image;

    // Handle new color image upload
    if (colorImgFile) {
      colorImagePath = getFilePath(colorImgFile);

      // Delete old color image if exists and is different
      if (existingColors[idx - 1]?.color_image && existingColors[idx - 1]?.color_image !== colorImagePath) {
        const oldImagePath = path.join(rootDir, 'public', existingColors[idx - 1].color_image);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error(`Error deleting old color image:`, err);
          }
        }
      }
    }

    if (colorId) {
      // Update existing color
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;
      await conn.execute(
        `UPDATE interior_colors SET color_name = ?, color_image = ?, updated_at = NOW() WHERE id = ?`,
        [name, img, colorId]
      );

    } else {
      // Create new color
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;
      const [res] = await conn.execute(
        `INSERT INTO interior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      const newColorId = res.insertId;

    }
  }

  // Delete colors that were removed
  const submittedIndices = interiorKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingColors.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      // Delete color and its images
      await deleteColorWithImages('interior', existingColors[i].id, conn);
    }
  }
};


// ---------- HELPER: Delete Color with Images ----------
const deleteColorWithImages = async (type, colorId, conn) => {
  const colorTable = type === 'exterior' ? 'exterior_colors' : 'interior_colors';

  // Get color image
  const [color] = await conn.execute(`SELECT color_image FROM ${colorTable} WHERE id = ?`, [colorId]);
  if (color[0]?.color_image) {
    const colorImagePath = path.join(rootDir, 'public', color[0].color_image);
    if (fs.existsSync(colorImagePath)) {
      try {
        fs.unlinkSync(colorImagePath);
      } catch (err) {
        console.error(`Error deleting color image:`, err);
      }
    }
  }

  await conn.execute(`DELETE FROM ${colorTable} WHERE id = ?`, [colorId]);
};

// ---------- SMART UPDATE VARIANTS ----------
const smartUpdateVariants = async (req, modelId, existingDetails, conn) => {
  const { body } = req;
  const existingVariants = existingDetails.variants || [];

  const variantKeys = Object.keys(body).filter(k => k.startsWith('variantName'));

  for (const key of variantKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`variantName${idx}`];
    const price = body[`variantPrice${idx}`];
    const variantId = existingVariants[idx - 1]?.id;

    if (!name || !name.trim()) continue;

    const parsedPrice = price ? parseFloat(price.replace(/[^0-9.-]+/g, '')) : null;

    if (variantId) {
      // Update existing variant
      await conn.execute(
        `UPDATE variants SET name = ?, price = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), parsedPrice, variantId]
      );
    } else {
      // Create new variant
      await conn.execute(
        `INSERT INTO variants (model_id, name, price, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), parsedPrice]
      );
    }
  }

  // Delete variants that were removed
  const submittedIndices = variantKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingVariants.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      await conn.execute(`DELETE FROM variants WHERE id = ?`, [existingVariants[i].id]);
    }
  }
};

// ---------- SMART UPDATE AVAILABLE SITES ----------
const smartUpdateSites = async (req, modelId, existingDetails, conn) => {
  const { body } = req;
  const existingSites = existingDetails.availableSites || [];

  const siteKeys = Object.keys(body).filter(k => k.startsWith('siteName'));

  for (const key of siteKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`siteName${idx}`];
    const link = body[`siteLink${idx}`];
    const siteId = existingSites[idx - 1]?.id;

    if (!name || !name.trim()) continue;

    if (siteId) {
      // Update existing site
      await conn.execute(
        `UPDATE available_sites SET name = ?, link_phone = ?, updated_at = NOW() WHERE id = ?`,
        [name.trim(), link || null, siteId]
      );
    } else {
      // Create new site
      await conn.execute(
        `INSERT INTO available_sites (model_id, name, link_phone, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), link || null]
      );
    }
  }

  // Delete sites that were removed
  const submittedIndices = siteKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingSites.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      await conn.execute(`DELETE FROM available_sites WHERE id = ?`, [existingSites[i].id]);
    }
  }
};

// ---------- SMART UPDATE HIDDEN TITLES ----------
const smartUpdateHiddenTitles = async (req, modelId, existingDetails, conn) => {
  const { body } = req;

  // Get existing hidden titles
  const existingHiddenTitles = await Model.getHiddenTitlesByModelId(modelId, conn);

  // Process submitted hidden titles
  const hiddenTitleKeys = Object.keys(body).filter(k => k.startsWith('hiddenTitle'));

  for (const key of hiddenTitleKeys) {
    const idx = key.match(/\d+/)[0];
    const title = body[`hiddenTitle${idx}`];
    const hiddenTitleId = existingHiddenTitles[idx - 1]?.id;

    if (!title || !title.trim()) continue;

    if (hiddenTitleId) {
      // Update existing hidden title
      await conn.execute(
        `UPDATE hidden_titles SET hidden_title = ?, updated_at = NOW() WHERE id = ?`,
        [title.trim(), hiddenTitleId]
      );
    } else {
      // Create new hidden title
      await Model.addHiddenTitle(modelId, title.trim(), conn);
    }
  }

  // Delete hidden titles that were removed
  const submittedIndices = hiddenTitleKeys.map(k => parseInt(k.match(/\d+/)[0]));
  for (let i = 0; i < existingHiddenTitles.length; i++) {
    if (!submittedIndices.includes(i + 1)) {
      await Model.deleteHiddenTitle(existingHiddenTitles[i].id, conn);
    }
  }
};

// ---------- SMART UPDATE ABOUT CONTENTS ----------
const smartUpdateAboutContents = async (req, modelId, existingDetails, conn) => {
  const { files = [], body } = req;
  const existingContents = existingDetails.aboutContents || [];

  const contentKeys = Object.keys(body).filter(k => k.startsWith('aboutContentType'));

  let order = 0;
  for (const key of contentKeys) {
    const idx = key.match(/\d+/)[0];
    const type = body[`aboutContentType${idx}`];
    const contentId = existingContents[order]?.id;

    if (!type) continue;

    if (type === 'article') {
      const value = body[`aboutContent${idx}`];

      if (contentId && existingContents[order]?.type === 'article') {
        // Update existing article
        await conn.execute(
          `UPDATE about_contents SET value = ?, updated_at = NOW() WHERE id = ?`,
          [value || null, contentId]
        );
      } else {
        // Create new article or replace different type
        if (contentId) {
          // Delete old content if it was a different type
          if (existingContents[order]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[order].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old about image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM about_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO about_contents (model_id, type, content_order, value, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [modelId, 'article', order, value || null]
        );
      }
    }
    else if (type === 'photo') {
      const file = files.find(f => f.fieldname === `aboutPhoto${idx}`);
      const source = body[`aboutSource${idx}`] || null;
      const value = body[`aboutContent${idx}`] || null;

      const imagePath = file ? getFilePath(file) : (contentId ? existingContents[order]?.image_path : null);
      const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

      if (contentId && existingContents[order]?.type === 'photo') {
        // Update existing photo
        if (file && existingContents[order]?.image_path !== img) {
          // Delete old image if new one uploaded
          if (existingContents[order]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[order].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old about image:`, err);
              }
            }
          }
        }

        await conn.execute(
          `UPDATE about_contents SET value = ?, image_path = ?, source = ?, updated_at = NOW() WHERE id = ?`,
          [value, img, source, contentId]
        );
      } else {
        // Create new photo or replace different type
        if (contentId) {
          // Delete old content if it was a different type
          if (existingContents[order]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[order].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old about image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM about_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO about_contents (model_id, type, content_order, value, image_path, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [modelId, 'photo', order, value, img, source]
        );
      }
    }
    else if (type === 'link') {
      const value = body[`aboutContent${idx}`];

      if (contentId && existingContents[order]?.type === 'link') {
        // Update existing link
        await conn.execute(
          `UPDATE about_contents SET value = ?, updated_at = NOW() WHERE id = ?`,
          [value || null, contentId]
        );
      } else {
        // Create new link or replace different type
        if (contentId) {
          // Delete old content if it was a different type
          if (existingContents[order]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[order].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old about image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM about_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO about_contents (model_id, type, content_order, value, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [modelId, 'link', order, value || null]
        );
      }
    }

    order++;
  }

  // Delete contents that were removed
  if (existingContents.length > order) {
    for (let i = order; i < existingContents.length; i++) {
      if (existingContents[i]?.image_path) {
        const oldImagePath = path.join(rootDir, 'public', existingContents[i].image_path);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error(`Error deleting removed about image:`, err);
          }
        }
      }
      await conn.execute(`DELETE FROM about_contents WHERE id = ?`, [existingContents[i].id]);
    }
  }
};

// ---------- SMART UPDATE SPECIFICATIONS ----------
const smartUpdateSpecifications = async (req, modelId, existingDetails, conn) => {
  const { files = [], body } = req;
  const existingSpecs = existingDetails.specifications || [];
  const existingLists = existingDetails.specificationLists || [];
  const existingContents = existingDetails.specContents || [];

  // Process specifications
  const specKeys = Object.keys(body).filter(k => k.startsWith('specTitle'));

  for (const specIdx in specKeys) {
    const sIdx = parseInt(specIdx) + 1;
    const key = specKeys[specIdx];
    const title = body[key];
    const specId = existingSpecs[specIdx]?.id;

    if (!title || !title.trim()) continue;

    if (specId) {
      // Update existing specification
      await conn.execute(
        `UPDATE specifications SET title = ?, updated_at = NOW() WHERE id = ?`,
        [title.trim(), specId]
      );
    } else {
      // Create new specification
      const [res] = await conn.execute(
        `INSERT INTO specifications (model_id, title, created_at)
         VALUES (?, ?, NOW())`,
        [modelId, title.trim()]
      );
      const newSpecId = res.insertId;

      // Process lists for new specification
      await processSpecListsForNewSpec(req, newSpecId, sIdx, files, body, conn);
      continue;
    }

    // Process lists for existing specification
    const listKeys = Object.keys(body).filter(k => k.startsWith(`specListTitle${sIdx}_`));
    const existingSpecLists = existingLists.filter(list => list.specification_id === specId);

    for (const listIdx in listKeys) {
      const lIdx = parseInt(listIdx) + 1;
      const listKey = listKeys[listIdx];
      const listTitle = body[listKey];
      const listId = existingSpecLists[listIdx]?.id;

      if (!listTitle || !listTitle.trim()) continue;

      if (listId) {
        // Update existing list
        await conn.execute(
          `UPDATE specification_lists SET title = ?, updated_at = NOW() WHERE id = ?`,
          [listTitle.trim(), listId]
        );

        // Process contents for this list
        await processSpecContents(req, listId, sIdx, lIdx, files, body,
          existingContents.filter(c => c.list_id === listId), conn);
      } else {
        // Create new list
        const [listRes] = await conn.execute(
          `INSERT INTO specification_lists (specification_id, title, created_at)
           VALUES (?, ?, NOW())`,
          [specId, listTitle.trim()]
        );
        const newListId = listRes.insertId;

        // Process contents for new list
        await processSpecContents(req, newListId, sIdx, lIdx, files, body, [], conn);
      }
    }

    // Delete lists that were removed
    if (existingSpecLists.length > listKeys.length) {
      for (let i = listKeys.length; i < existingSpecLists.length; i++) {
        // Delete contents first
        const listContents = existingContents.filter(c => c.list_id === existingSpecLists[i].id);
        for (const content of listContents) {
          if (content.image_path) {
            const oldImagePath = path.join(rootDir, 'public', content.image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [content.id]);
        }
        await conn.execute(`DELETE FROM specification_lists WHERE id = ?`, [existingSpecLists[i].id]);
      }
    }
  }

  // Delete specifications that were removed
  if (existingSpecs.length > specKeys.length) {
    for (let i = specKeys.length; i < existingSpecs.length; i++) {
      // Get all lists for this spec
      const specLists = existingLists.filter(list => list.specification_id === existingSpecs[i].id);

      // Delete all contents for these lists
      for (const list of specLists) {
        const listContents = existingContents.filter(c => c.list_id === list.id);
        for (const content of listContents) {
          if (content.image_path) {
            const oldImagePath = path.join(rootDir, 'public', content.image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [content.id]);
        }
        await conn.execute(`DELETE FROM specification_lists WHERE id = ?`, [list.id]);
      }

      await conn.execute(`DELETE FROM specifications WHERE id = ?`, [existingSpecs[i].id]);
    }
  }
};

// ---------- HELPER: Process Spec Lists for New Specification ----------
const processSpecListsForNewSpec = async (req, specId, sIdx, files, body, conn) => {
  const listKeys = Object.keys(body).filter(k => k.startsWith(`specListTitle${sIdx}_`));

  for (const listIdx in listKeys) {
    const lIdx = parseInt(listIdx) + 1;
    const listKey = listKeys[listIdx];
    const listTitle = body[listKey];

    if (!listTitle || !listTitle.trim()) continue;

    const [listRes] = await conn.execute(
      `INSERT INTO specification_lists (specification_id, title, created_at)
       VALUES (?, ?, NOW())`,
      [specId, listTitle.trim()]
    );
    const listId = listRes.insertId;

    // Process contents for new list
    await processSpecContents(req, listId, sIdx, lIdx, files, body, [], conn);
  }
};

// ---------- HELPER: Process Specification Contents ----------
const processSpecContents = async (req, listId, sIdx, lIdx, files, body, existingContents, conn) => {
  const contentKeys = Object.keys(body).filter(k => k.startsWith(`specContentType${sIdx}_${lIdx}_`));

  for (const contentIdx in contentKeys) {
    const cIdx = parseInt(contentIdx) + 1;
    const contentKey = contentKeys[contentIdx];
    const type = body[contentKey];
    const contentId = existingContents[contentIdx]?.id;

    if (!type) continue;

    if (type === 'article') {
      const value = body[`specContent${sIdx}_${lIdx}_${cIdx}`];

      if (contentId && existingContents[contentIdx]?.type === 'article') {
        // Update existing article
        await conn.execute(
          `UPDATE spec_contents SET value = ?, updated_at = NOW() WHERE id = ?`,
          [value || null, contentId]
        );
      } else {
        // Create new article or replace different type
        if (contentId) {
          // Delete old content if different type
          if (existingContents[contentIdx]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[contentIdx].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO spec_contents (list_id, type, value, created_at)
           VALUES (?, ?, ?, NOW())`,
          [listId, 'article', value || null]
        );
      }
    }
    else if (type === 'photo') {
      const file = files.find(f => f.fieldname === `specPhoto${sIdx}_${lIdx}_${cIdx}`);
      const source = body[`specSource${sIdx}_${lIdx}_${cIdx}`] || null;
      const value = body[`specContent${sIdx}_${lIdx}_${cIdx}`] || null;

      const imagePath = file ? getFilePath(file) : (contentId ? existingContents[contentIdx]?.image_path : null);
      const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

      if (contentId && existingContents[contentIdx]?.type === 'photo') {
        // Update existing photo
        if (file && existingContents[contentIdx]?.image_path !== img) {
          // Delete old image if new one uploaded
          if (existingContents[contentIdx]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[contentIdx].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
        }

        await conn.execute(
          `UPDATE spec_contents SET value = ?, image_path = ?, source = ?, updated_at = NOW() WHERE id = ?`,
          [value, img, source, contentId]
        );
      } else {
        // Create new photo or replace different type
        if (contentId) {
          // Delete old content if different type
          if (existingContents[contentIdx]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[contentIdx].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO spec_contents (list_id, type, value, image_path, source, created_at)
           VALUES (?, ?, ?, ?, ?, NOW())`,
          [listId, 'photo', value, img, source]
        );
      }
    }
    else if (type === 'link') {
      const value = body[`specContent${sIdx}_${lIdx}_${cIdx}`];

      if (contentId && existingContents[contentIdx]?.type === 'link') {
        // Update existing link
        await conn.execute(
          `UPDATE spec_contents SET value = ?, updated_at = NOW() WHERE id = ?`,
          [value || null, contentId]
        );
      } else {
        // Create new link or replace different type
        if (contentId) {
          // Delete old content if different type
          if (existingContents[contentIdx]?.image_path) {
            const oldImagePath = path.join(rootDir, 'public', existingContents[contentIdx].image_path);
            if (fs.existsSync(oldImagePath)) {
              try {
                fs.unlinkSync(oldImagePath);
              } catch (err) {
                console.error(`Error deleting old spec image:`, err);
              }
            }
          }
          await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [contentId]);
        }

        await conn.execute(
          `INSERT INTO spec_contents (list_id, type, value, created_at)
           VALUES (?, ?, ?, NOW())`,
          [listId, 'link', value || null]
        );
      }
    }
  }

  // Delete contents that were removed
  if (existingContents.length > contentKeys.length) {
    for (let i = contentKeys.length; i < existingContents.length; i++) {
      if (existingContents[i]?.image_path) {
        const oldImagePath = path.join(rootDir, 'public', existingContents[i].image_path);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (err) {
            console.error(`Error deleting removed spec image:`, err);
          }
        }
      }
      await conn.execute(`DELETE FROM spec_contents WHERE id = ?`, [existingContents[i].id]);
    }
  }
};

// ========== MAIN CONTROLLER FUNCTIONS ==========

// ---------- GET: render admin page ----------
const getadminmodel = async (req, res) => {
  let conn;
  try {
    conn = await db.getConnection();
    const [vehicleTypes] = await conn.execute(`SELECT * FROM vehicletype ORDER BY vehicle_type_name`);
    const [categories] = await conn.execute(`SELECT * FROM categories ORDER BY name`);
    const [brands] = await conn.execute(`SELECT * FROM brands ORDER BY name`);
    const [countries] = await conn.execute(`SELECT * FROM countries WHERE status = 1 ORDER BY country_name`);

    res.render('admin/Amodels', {
      title: 'Model Admin',
      path: '/admin/model',
      vehicleTypes,
      categories,
      brands,
      countries,
      model: null,
      details: null,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error loading admin model page:', err);
    req.flash('error_msg', 'Failed to load page.');
    res.redirect('/admin/model');
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET: Filter Data (Categories and Brands by Vehicle Type) ----------
const getFilterData = async (req, res) => {
  const { vehicleTypeId, countryId } = req.query;
  let conn;

  try {
    if (!vehicleTypeId) {
      return res.status(400).json({ error: 'Vehicle type ID is required' });
    }

    conn = await db.getConnection();

    // Get categories for this vehicle type, optionally filtered by country
    let categorySql = `SELECT category_id, name FROM categories WHERE vehicle_type_id = ?`;
    let categoryParams = [vehicleTypeId];

    if (countryId) {
      categorySql += ` AND (country_id = ? OR country_id IS NULL)`;
      categoryParams.push(countryId);
    }
    categorySql += ` ORDER BY name`;

    const [categories] = await conn.execute(categorySql, categoryParams);

    // Get brands for this vehicle type, optionally filtered by country
    let brandSql = `SELECT brand_id, name FROM brands WHERE vehicle_type_id = ?`;
    let brandParams = [vehicleTypeId];

    if (countryId) {
      brandSql += ` AND (country_id = ? OR country_id IS NULL)`;
      brandParams.push(countryId);
    }
    brandSql += ` ORDER BY name`;

    const [brands] = await conn.execute(brandSql, brandParams);

    res.json({
      categories,
      brands
    });
  } catch (err) {
    console.error('Error loading filter data:', err);
    res.status(500).json({ error: 'Failed to load filter data' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET: Filter Models ----------
const getFilteredModels = async (req, res) => {
  const { vehicleTypeId, brandId, countryId } = req.query;
  let conn;

  try {
    if (!vehicleTypeId || !brandId) {
      return res.status(400).json({ error: 'Vehicle type ID and Brand ID are required' });
    }

    conn = await db.getConnection();

    let sql = `
      SELECT m.*, v.vehicle_type_name, c.name AS category_name, b.name AS brand_name,
             co.country_name, co.currency_symbol, co.currency_code,
             COALESCE(m.model_image, '/images/placeholder.png') AS model_image
      FROM models m
      JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
      JOIN categories c ON m.category_id = c.category_id
      JOIN brands b ON m.brand_id = b.brand_id
      LEFT JOIN countries co ON m.country_id = co.id
      WHERE m.vehicle_type_id = ? AND m.brand_id = ?
    `;

    let params = [vehicleTypeId, brandId];

    if (countryId) {
      sql += ` AND m.country_id = ?`;
      params.push(countryId);
    }

    sql += ` ORDER BY m.model_name`;

    const [rows] = await conn.execute(sql, params);

    // Format the data and render HTML
    const formatted = [];
    for (const row of rows) {
      const model = {
        ...row,
        model_image: row.model_image && row.model_image !== '/images/placeholder.png' ?
          (row.model_image.startsWith('/') ? row.model_image : '/' + row.model_image) :
          '/images/placeholder.png'
      };

      // Render the partial as a string
      const htmlMarkup = await new Promise((resolve) => {
        res.render('partials/modelbox', {
          model,
          isAdmin: true,
          country: row.country_name ? {
            country_name: row.country_name,
            currency_symbol: row.currency_symbol,
            currency_code: row.currency_code
          } : null
        }, (err, html) => {
          if (err) {
            console.error('Error rendering partial:', err);
            resolve('');
          } else {
            resolve(html);
          }
        });
      });

      formatted.push({
        ...model,
        html_markup: htmlMarkup
      });
    }

    res.json(formatted);
  } catch (err) {
    console.error('Error loading filtered models:', err);
    res.status(500).json({ error: 'Failed to load models' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET: Get Vehicle Types by Country ----------
const getVehicleTypesByCountry = async (req, res) => {
  const { countryId } = req.params;
  let conn;

  try {
    conn = await db.getConnection();

    const [vehicleTypes] = await conn.execute(`
      SELECT vehicle_type_id, vehicle_type_name 
      FROM vehicletype 
      WHERE country_id = ? OR country_id IS NULL
      ORDER BY vehicle_type_name
    `, [countryId || null]);

    res.json(vehicleTypes);
  } catch (err) {
    console.error('Error loading vehicle types by country:', err);
    res.status(500).json({ error: 'Failed to load vehicle types' });
  } finally {
    if (conn) conn.release();
  }
};

// ---------- GET: edit model ----------
const getModelById = async (req, res) => {
  const modelId = req.params.modelId;
  let conn;

  try {
    conn = await db.getConnection();
    const model = await Model.getModelById(modelId, conn);

    if (!model) {
      req.flash('error_msg', 'Model not found.');
      return res.redirect('/admin/model');
    }

    const details = await Model.getModelDetails(modelId, conn);
    // Add hidden titles to details
    const hiddenTitles = await Model.getHiddenTitlesByModelId(modelId, conn);
    if (details) {
      details.hiddenTitles = hiddenTitles;
    }

    const [vehicleTypes] = await conn.execute(`SELECT * FROM vehicletype ORDER BY vehicle_type_name`);
    const [categories] = await conn.execute(`SELECT * FROM categories ORDER BY name`);
    const [brands] = await conn.execute(`SELECT * FROM brands ORDER BY name`);
    const [countries] = await conn.execute(`SELECT * FROM countries WHERE status = 1 ORDER BY country_name`);

    // Fix image paths
    if (model.model_image && !model.model_image.startsWith('/')) {
      model.model_image = '/' + model.model_image;
    }

    if (details) {
      const fixPath = (img) => {
        if (!img) return null;
        return img.startsWith('/') ? img : '/' + img;
      };

      if (details.exteriorColors) {
        details.exteriorColors.forEach(c => {
          c.color_image = fixPath(c.color_image);
        });
      }

      if (details.interiorColors) {
        details.interiorColors.forEach(c => {
          c.color_image = fixPath(c.color_image);
        });
      }

      if (details.exteriorColorImages) {
        details.exteriorColorImages.forEach(i => {
          i.image_path = fixPath(i.image_path);
        });
      }

      if (details.interiorColorImages) {
        details.interiorColorImages.forEach(i => {
          i.image_path = fixPath(i.image_path);
        });
      }

      if (details.aboutContents) {
        details.aboutContents.forEach(c => {
          c.image_path = fixPath(c.image_path);
        });
      }

      if (details.specContents) {
        details.specContents.forEach(c => {
          c.image_path = fixPath(c.image_path);
        });
      }
    }

    res.render('admin/Amodels', {
      title: 'Edit Model',
      path: '/admin/model',
      model,
      details: details || {},
      vehicleTypes,
      categories,
      brands,
      countries,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('Error loading model:', err);
    req.flash('error_msg', 'Failed to load model.');
    res.redirect('/admin/model');
  } finally {
    if (conn) conn.release();
  }
};

// ---------- POST: create model ----------
const postAdminModel = async (req, res) => {
  let conn;

  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const {
      country, vehicleType, category, brand, modelName, safetyRating, safetyLink,
      sources, engineType, startingPrice, releaseYear, seater, status = 'import',
      review, descriptions
    } = req.body;

    const authorId = req.user.user_id;

    // Validate required fields
    if (!country || !vehicleType || !category || !brand || !modelName || !engineType || !startingPrice) {
      throw new Error('All required fields must be filled: Country, Vehicle Type, Category, Brand, Model Name, Engine Type, and Starting Price');
    }

    // Get country ID
    const [[ct]] = await conn.execute(
      `SELECT id FROM countries WHERE country_name = ?`,
      [country]
    );
    if (!ct) throw new Error(`Country "${country}" not found`);
    const countryId = ct.id;

    // Get vehicle type ID
    const [[vt]] = await conn.execute(
      `SELECT vehicle_type_id FROM vehicletype WHERE vehicle_type_name = ? AND (country_id = ? OR country_id IS NULL)`,
      [vehicleType, countryId]
    );
    if (!vt) throw new Error(`Vehicle type "${vehicleType}" not found for this country`);
    const vehicleTypeId = vt.vehicle_type_id;

    // Get category ID
    const [[catRow]] = await conn.execute(
      `SELECT category_id FROM categories WHERE name = ? AND vehicle_type_id = ? AND (country_id = ? OR country_id IS NULL)`,
      [category, vehicleTypeId, countryId]
    );
    if (!catRow) throw new Error(`Category "${category}" not found for this vehicle type and country`);
    const categoryId = catRow.category_id;

    // Get brand ID
    const [[br]] = await conn.execute(
      `SELECT brand_id FROM brands WHERE name = ? AND vehicle_type_id = ? AND (country_id = ? OR country_id IS NULL)`,
      [brand, vehicleTypeId, countryId]
    );
    if (!br) throw new Error(`Brand "${brand}" not found for this vehicle type and country`);
    const brandId = br.brand_id;

    // Handle model image
    const modelImageFile = req.files?.find(f => f.fieldname === 'modelImage');
    if (!modelImageFile) {
      throw new Error('Model image is required');
    }
    const modelImagePath = getFilePath(modelImageFile);

    // Check if model already exists in this country
    const modelExists = await Model.modelExistsInCountry(modelName, brandId, countryId);
    if (modelExists) {
      throw new Error(`Model "${modelName}" already exists for this brand in ${country}`);
    }

    // Parse starting price
    const parsedStartingPrice = startingPrice ? parseFloat(startingPrice.replace(/[^0-9.-]+/g, '')) : null;
    if (parsedStartingPrice && isNaN(parsedStartingPrice)) {
      throw new Error('Invalid starting price format');
    }

    // Create model with country_id
    const modelId = await Model.createModel({
      name: modelName,
      vehicle_type_id: vehicleTypeId,
      category_id: categoryId,
      brand_id: brandId,
      country_id: countryId,
      safety_rating: safetyRating ? parseFloat(safetyRating) : null,
      safety_link: safetyLink || null,
      sources: sources || null,
      keywords: '',
      engine_type: engineType,
      starting_price: parsedStartingPrice,
      release_year: releaseYear || null,
      seater: seater || null,
      status: status || 'import',
      review: review || null,
      descriptions: descriptions || ''
    }, modelImagePath, authorId, conn);

    // Insert all related data
    await insertAllRelatedData(req, modelId, conn);
    await conn.commit();

    req.flash('success_msg', `Model published successfully for ${country}!`);
    res.redirect('/admin/model');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('❌ Error creating model FULL:', err);
    req.flash('error_msg', 'Create failed: ' + (err.message || 'Unknown error'));
    res.redirect('/admin/model');
  } finally {
    if (conn) conn.release();
  }
};

// ---------- POST: update model ----------
const updateAdminModel = async (req, res) => {
  const modelId = req.params.modelId;
  let conn;

  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const { country } = req.body;

    // Get existing model to check country
    const existingModel = await Model.getModelById(modelId, conn);

    // If country is changed, check for duplicate
    if (country && existingModel.country_name !== country) {
      const [[ct]] = await conn.execute(
        `SELECT id FROM countries WHERE country_name = ?`,
        [country]
      );
      const newCountryId = ct.id;

      const modelExists = await Model.modelExistsInCountry(
        req.body.modelName || existingModel.model_name,
        existingModel.brand_id,
        newCountryId,
        modelId
      );

      if (modelExists) {
        throw new Error(`Model "${req.body.modelName || existingModel.model_name}" already exists for this brand in ${country}`);
      }
    }

    await smartUpdateModel(req, modelId, conn);
    await conn.commit();

    req.flash('success_msg', 'Model updated successfully!');
    res.redirect('/admin/model');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('❌ Error updating model FULL:', err);
    req.flash('error_msg', 'Update failed: ' + (err.message || 'Unknown error'));
    res.redirect('/admin/model/' + modelId);
  } finally {
    if (conn) conn.release();
  }
};

// ---------- DELETE: model ----------
const deleteAdminModel = async (req, res) => {
  const modelId = req.params.modelId;
  let conn;

  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    await Model.deleteModel(modelId, conn);
    await conn.commit();

    req.flash('success_msg', 'Model deleted successfully.');
    res.redirect('/admin/model');
  } catch (err) {
    if (conn) await conn.rollback();
    console.error('Error deleting model:', err);
    req.flash('error_msg', 'Failed to delete model.');
    res.redirect('/admin/model');
  } finally {
    if (conn) conn.release();
  }
};

// ---------- HELPER: Insert all related data (for CREATE only) ----------
const insertAllRelatedData = async (req, modelId, conn) => {
  const { files = [], body } = req;

  // Insert colors
  await insertColors(req, modelId, conn);

  // Insert variants
  const variantKeys = Object.keys(body).filter(k => k.startsWith('variantName'));
  for (const key of variantKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`variantName${idx}`];
    const price = body[`variantPrice${idx}`];

    if (name && name.trim()) {
      const parsedPrice = price ? parseFloat(price.replace(/[^0-9.-]+/g, '')) : null;
      await conn.execute(
        `INSERT INTO variants (model_id, name, price, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), parsedPrice]
      );
    }
  }

  // Insert sites
  const siteKeys = Object.keys(body).filter(k => k.startsWith('siteName'));
  for (const key of siteKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`siteName${idx}`];
    const link = body[`siteLink${idx}`];

    if (name && name.trim()) {
      await conn.execute(
        `INSERT INTO available_sites (model_id, name, link_phone, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), link || null]
      );
    }
  }

  // Insert keyspecs
  const keyspecKeys = Object.keys(body).filter(k => k.startsWith('keyspecName'));
  for (const key of keyspecKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`keyspecName${idx}`];
    const data = body[`keyspecData${idx}`];

    if (name && name.trim()) {
      await conn.execute(
        `INSERT INTO keyspecs (model_id, key_spec, key_spec_data, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), data || null]
      );
    }
  }

  // Insert hidden titles
  const hiddenTitleKeys = Object.keys(body).filter(k => k.startsWith('hiddenTitle'));
  for (const key of hiddenTitleKeys) {
    const idx = key.match(/\d+/)[0];
    const title = body[`hiddenTitle${idx}`];

    if (title && title.trim()) {
      await Model.addHiddenTitle(modelId, title.trim(), conn);
    }
  }

  // Insert about contents
  await insertAboutContents(req, modelId, conn);

  // Insert specifications
  await insertSpecifications(req, modelId, conn);

  // Insert faqs
  await insertFaqs(req, modelId, conn);
};

// ---------- HELPER: Insert faqs (for CREATE only) ----------
const insertFaqs = async (req, modelId, conn) => {
  const { body } = req;
  const faqKeys = Object.keys(body).filter(k => k.startsWith('faqQuestion'));
  console.log('🔍 insertFaqs DEBUG - faqKeys:', faqKeys);

  // Helper: safely get single string value
  const getField = (val) => {
    if (Array.isArray(val)) return val[0] || '';
    return val || '';
  };

  for (const key of faqKeys) {
    const idx = key.match(/\d+/)[0];
    const question = getField(body[`faqQuestion${idx}`]);
    const answer = getField(body[`faqAnswer${idx}`]);

    console.log(`🔍 insertFaq[${idx}] - question: "${question}", answer: "${answer}"`);

    if (question.trim()) {
      try {
        await conn.execute(
          `INSERT INTO model_faqs (model_id, question, answer, created_at)
           VALUES (?, ?, ?, NOW())`,
          [modelId, question.trim(), answer.trim()]
        );
        console.log(`✅ FAQ inserted for model_id=${modelId}`);
      } catch (faqErr) {
        console.error(`❌ insertFaq error:`, faqErr);
        throw faqErr;
      }
    }
  }
};

// ---------- HELPER: Insert colors (for CREATE only) ----------
const insertColors = async (req, modelId, conn) => {
  const { files = [], body } = req;

  // Process exterior colors
  const exteriorKeys = Object.keys(body).filter(k => k.startsWith('exteriorColorName'));
  for (const key of exteriorKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`exteriorColorName${idx}`];

    if (name && name.trim()) {
      const colorImgFile = files.find(f => f.fieldname === `exteriorColorImage${idx}`);
      const colorImagePath = colorImgFile ? getFilePath(colorImgFile) : null;
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;

      const [res] = await conn.execute(
        `INSERT INTO exterior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      const colorId = res.insertId;
    }
  }

  // Process interior colors
  const interiorKeys = Object.keys(body).filter(k => k.startsWith('interiorColorName'));
  for (const key of interiorKeys) {
    const idx = key.match(/\d+/)[0];
    const name = body[`interiorColorName${idx}`];

    if (name && name.trim()) {
      const colorImgFile = files.find(f => f.fieldname === `interiorColorImage${idx}`);
      const colorImagePath = colorImgFile ? getFilePath(colorImgFile) : null;
      const img = colorImagePath ? (colorImagePath.startsWith('/') ? colorImagePath : '/' + colorImagePath) : null;

      const [res] = await conn.execute(
        `INSERT INTO interior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      const colorId = res.insertId;
    }
  }
};

// ---------- HELPER: Insert about contents (for CREATE only) ----------
const insertAboutContents = async (req, modelId, conn) => {
  const { files = [], body } = req;
  const keys = Object.keys(body).filter(k => k.startsWith('aboutContentType'));

  let order = 0;
  for (const key of keys) {
    const idx = key.match(/\d+/)[0];
    const type = body[`aboutContentType${idx}`];

    if (!type) continue;

    if (type === 'article' && body[`aboutContent${idx}`]) {
      await conn.execute(
        `INSERT INTO about_contents (model_id, type, content_order, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [modelId, 'article', order, body[`aboutContent${idx}`]]
      );
      order++;
    } else if (type === 'photo') {
      const file = files.find(f => f.fieldname === `aboutPhoto${idx}`);
      const source = body[`aboutSource${idx}`] || null;
      const content = body[`aboutContent${idx}`] || null;

      const imagePath = file ? getFilePath(file) : null;
      const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

      if (imagePath || content) {
        await conn.execute(
          `INSERT INTO about_contents
           (model_id, type, content_order, value, image_path, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [modelId, 'photo', order, content, img, source]
        );
        order++;
      }
    } else if (type === 'link' && body[`aboutContent${idx}`]) {
      await conn.execute(
        `INSERT INTO about_contents (model_id, type, content_order, value, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [modelId, 'link', order, body[`aboutContent${idx}`]]
      );
      order++;
    }
  }
};

// ---------- HELPER: Insert specifications (for CREATE only) ----------
const insertSpecifications = async (req, modelId, conn) => {
  const { files = [], body } = req;
  const specKeys = Object.keys(body).filter(k => k.startsWith('specTitle'));

  for (const key of specKeys) {
    const sIdx = key.match(/\d+/)[0];
    const title = body[`specTitle${sIdx}`];

    if (!title || !title.trim()) continue;

    const [specRes] = await conn.execute(
      `INSERT INTO specifications (model_id, title, created_at)
       VALUES (?, ?, NOW())`,
      [modelId, title.trim()]
    );
    const specId = specRes.insertId;

    const listKeys = Object.keys(body).filter(k => k.startsWith(`specListTitle${sIdx}_`));

    for (const lk of listKeys) {
      const lIdx = lk.match(/_(\d+)/)[1];
      const listTitle = body[`specListTitle${sIdx}_${lIdx}`];

      if (!listTitle || !listTitle.trim()) continue;

      const [listRes] = await conn.execute(
        `INSERT INTO specification_lists (specification_id, title, created_at)
         VALUES (?, ?, NOW())`,
        [specId, listTitle.trim()]
      );
      const listId = listRes.insertId;

      const contentKeys = Object.keys(body).filter(k => k.startsWith(`specContentType${sIdx}_${lIdx}_`));

      for (const ck of contentKeys) {
        const cIdx = ck.match(/_(\d+)$/)[1];
        const cType = body[`specContentType${sIdx}_${lIdx}_${cIdx}`];

        if (!cType) continue;

        if (cType === 'article' && body[`specContent${sIdx}_${lIdx}_${cIdx}`]) {
          await conn.execute(
            `INSERT INTO spec_contents (list_id, type, value, created_at)
             VALUES (?, ?, ?, NOW())`,
            [listId, 'article', body[`specContent${sIdx}_${lIdx}_${cIdx}`]]
          );
        } else if (cType === 'photo') {
          const file = files.find(f => f.fieldname === `specPhoto${sIdx}_${lIdx}_${cIdx}`);
          const source = body[`specSource${sIdx}_${lIdx}_${cIdx}`] || null;
          const content = body[`specContent${sIdx}_${lIdx}_${cIdx}`] || null;

          const imagePath = file ? getFilePath(file) : null;
          const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

          if (imagePath || content) {
            await conn.execute(
              `INSERT INTO spec_contents (list_id, type, value, image_path, source, created_at)
               VALUES (?, ?, ?, ?, ?, NOW())`,
              [listId, 'photo', content, img, source]
            );
          }
        } else if (cType === 'link' && body[`specContent${sIdx}_${lIdx}_${cIdx}`]) {
          await conn.execute(
            `INSERT INTO spec_contents (list_id, type, value, created_at)
             VALUES (?, ?, ?, NOW())`,
            [listId, 'link', body[`specContent${sIdx}_${lIdx}_${cIdx}`]]
          );
        }
      }
    }
  }
};

// ---------- GET: Model Download Data (JSON) ----------
const getModelDownloadData = async (req, res) => {
  const modelId = req.params.modelId;
  let conn;

  try {
    conn = await db.getConnection();

    // Get basic model info with country details
    const [[model]] = await conn.execute(`
      SELECT m.*, v.vehicle_type_name, c.name AS category_name, b.name AS brand_name,
             co.country_name, co.currency_symbol, co.currency_code,
             COALESCE(m.model_image, '/images/placeholder.png') AS model_image
      FROM models m
      JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
      JOIN categories c ON m.category_id = c.category_id
      JOIN brands b ON m.brand_id = b.brand_id
      LEFT JOIN countries co ON m.country_id = co.id
      WHERE m.id = ?
    `, [modelId]);

    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }

    // Fix image path
    if (model.model_image && !model.model_image.startsWith('/') && !model.model_image.startsWith('http')) {
      model.model_image = '/' + model.model_image;
    }

    // Get key specs
    const [keyspecs] = await conn.execute(`
      SELECT key_spec, key_spec_data 
      FROM keyspecs 
      WHERE model_id = ? 
      ORDER BY id
    `, [modelId]);

    res.json({
      success: true,
      model,
      keyspecs
    });
  } catch (err) {
    console.error('Error fetching model download data:', err);
    res.status(500).json({ error: 'Failed to fetch data' });
  } finally {
    if (conn) conn.release();
  }
};


module.exports = {
  getadminmodel,
  getFilterData,
  getFilteredModels,
  getModelById,
  getVehicleTypesByCountry,
  postAdminModel,
  updateAdminModel,
  deleteAdminModel,
  getModelDownloadData
};