const db = require('../utils/dbutils');
const path = require('path');
const fs = require('fs');
const rootDir = require('../utils/pathutil');

class Model {
  // ---------- connection helper ----------  
  static async _getConn(provided) {
    if (provided) return { conn: provided, release: false };
    const conn = await db.getConnection();
    return { conn, release: true };
  }

  static async _release({ conn, release }) {
    if (release && conn) conn.release();
  }

  // ---------- CHECK IF MODEL EXISTS IN COUNTRY ----------
  static async modelExistsInCountry(modelName, brandId, countryId, excludeId = null) {
    let query = `SELECT id FROM models 
                 WHERE LOWER(model_name) = LOWER(?) 
                 AND brand_id = ? 
                 AND (country_id = ? OR (country_id IS NULL AND ? IS NULL))`;
    let params = [modelName, brandId, countryId, countryId];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const [rows] = await db.execute(query, params);
    return rows.length > 0;
  }

  // ---------- GET MODELS BY COUNTRY ----------
  static async getModelsByCountry(countryId) {
    try {
      const [rows] = await db.execute(`
        SELECT m.*, v.vehicle_type_name, c.name AS category_name,
               b.name AS brand_name, u.name AS author_name,
               co.country_name, co.currency_symbol
        FROM models m
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN brands b ON m.brand_id = b.brand_id
        LEFT JOIN countries co ON m.country_id = co.id
        LEFT JOIN usertable u ON m.author_id = u.user_id
        WHERE m.country_id = ? OR m.country_id IS NULL
        ORDER BY m.created_at DESC
      `, [countryId]);
      return rows;
    } catch (error) {
      console.error('Error in getModelsByCountry:', error);
      throw error;
    }
  }

  // ---------- GET MODELS WITH FILTERS ----------
  static async getModelsWithFilters(vehicleTypeId = null, brandId = null, countryId = null) {
    try {
      let query = `
        SELECT m.*, v.vehicle_type_name, c.name AS category_name,
               b.name AS brand_name, u.name AS author_name,
               co.country_name, co.currency_symbol
        FROM models m
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN brands b ON m.brand_id = b.brand_id
        LEFT JOIN countries co ON m.country_id = co.id
        LEFT JOIN usertable u ON m.author_id = u.user_id
        WHERE 1=1
      `;
      let params = [];

      if (vehicleTypeId) {
        query += ` AND m.vehicle_type_id = ?`;
        params.push(vehicleTypeId);
      }

      if (brandId) {
        query += ` AND m.brand_id = ?`;
        params.push(brandId);
      }

      if (countryId) {
        query += ` AND (m.country_id = ? OR m.country_id IS NULL)`;
        params.push(countryId);
      }

      query += ` ORDER BY m.created_at DESC`;

      const [rows] = await db.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in getModelsWithFilters:', error);
      throw error;
    }
  }

  // ---------- CREATE ----------
  static async createModel(data, imagePath, authorId, conn) {
    const {
      name, vehicle_type_id, category_id, brand_id, country_id,
      safety_rating, safety_link, sources, keywords = '', engine_type, starting_price,
      release_year, seater, status = 'import', review, descriptions = ''
    } = data;

    const connObj = await this._getConn(conn);
    try {
      // Check for duplicate model in same country
      const [dup] = await connObj.conn.execute(
        `SELECT id FROM models WHERE model_name = ? AND brand_id = ? AND (country_id = ? OR (country_id IS NULL AND ? IS NULL))`,
        [name, brand_id, country_id, country_id]
      );
      if (dup.length) throw new Error(`Model "${name}" already exists for this brand in this country`);

      // Ensure image path starts with /
      const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

      const [res] = await connObj.conn.execute(
        `INSERT INTO models
         (model_name, vehicle_type_id, category_id, brand_id, country_id, model_image,
          safety_rating, safety_link, sources, keywords, engine_type,
          review, starting_price, release_year, seater, descriptions, 
          author_id, published_date, created_at, updated_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?)`,
        [
          name,
          vehicle_type_id || null,
          category_id || null,
          brand_id || null,
          country_id || null,
          img,
          safety_rating || null,
          safety_link || null,
          sources || null,
          keywords || '',
          engine_type || null,
          review || null,
          starting_price || null,
          release_year || null,
          seater || null,
          descriptions || '',
          authorId,
          status || 'import'
        ]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- KEY SPECS ----------
  static async createKeySpec(modelId, { key_spec, key_spec_data }, conn) {
    if (!key_spec || !key_spec.trim()) return null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO keyspecs (model_id, key_spec, key_spec_data, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, key_spec.trim(), key_spec_data || null]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  static async getKeySpecsByModelId(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        `SELECT * FROM keyspecs WHERE model_id = ? ORDER BY id`,
        [modelId]
      );
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  static async updateKeySpec(id, { key_spec, key_spec_data }, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `UPDATE keyspecs SET key_spec = ?, key_spec_data = ?, updated_at = NOW() WHERE id = ?`,
        [key_spec.trim(), key_spec_data || null, id]
      );
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteKeySpec(id, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(`DELETE FROM keyspecs WHERE id = ?`, [id]);
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteAllKeySpecsByModelId(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(`DELETE FROM keyspecs WHERE model_id = ?`, [modelId]);
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- EXTERIOR ----------
  static async createExteriorColor(modelId, { name }, imagePath, conn) {
    const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO exterior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- INTERIOR ----------
  static async createInteriorColor(modelId, { name }, imagePath, conn) {
    const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO interior_colors (model_id, color_name, color_image, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name, img]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- VARIANT / SITE ----------
  static async createVariant(modelId, { name, price }, conn) {
    if (!name || !name.trim()) return;

    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `INSERT INTO variants (model_id, name, price, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), price || null]
      );
    } finally {
      await this._release(connObj);
    }
  }

  static async createAvailableSite(modelId, { name, link }, conn) {
    if (!name || !name.trim()) return;

    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `INSERT INTO available_sites (model_id, name, link_phone, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, name.trim(), link || null]
      );
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- SPEC ----------
  static async createSpecification(modelId, { title }, conn) {
    if (!title || !title.trim()) return null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO specifications (model_id, title, created_at)
         VALUES (?, ?, NOW())`,
        [modelId, title.trim()]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  static async createSpecificationList(specId, { title }, conn) {
    if (!title || !title.trim()) return null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO specification_lists (specification_id, title, created_at)
         VALUES (?, ?, NOW())`,
        [specId, title.trim()]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  static async createSpecContent(listId, { type, value, image_path, source }, conn) {
    if (!type) return;

    const img = image_path ? (image_path.startsWith('/') ? image_path : '/' + image_path) : null;

    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `INSERT INTO spec_contents (list_id, type, value, image_path, source, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [listId, type, value || null, img, source || null]
      );
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- ABOUT ----------
  static async createAboutContent(modelId, { type, value, image_path, source }, order, conn) {
    if (!type) return;

    const img = image_path ? (image_path.startsWith('/') ? image_path : '/' + image_path) : null;

    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `INSERT INTO about_contents
         (model_id, type, content_order, value, image_path, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [modelId, type, order, value || null, img, source || null]
      );
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- FAQS ----------
  static async createFaq(modelId, { question, answer }, conn) {
    if (!question || !question.trim()) return null;

    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        `INSERT INTO model_faqs (model_id, question, answer, created_at)
         VALUES (?, ?, ?, NOW())`,
        [modelId, question.trim(), answer ? answer.trim() : '']
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  static async getFaqsByModelId(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        `SELECT * FROM model_faqs WHERE model_id = ? ORDER BY id ASC`,
        [modelId]
      );
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  static async updateFaq(id, { question, answer }, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(
        `UPDATE model_faqs SET question = ?, answer = ?, updated_at = NOW() WHERE id = ?`,
        [question.trim(), answer ? answer.trim() : '', id]
      );
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteFaq(id, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(`DELETE FROM model_faqs WHERE id = ?`, [id]);
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteAllFaqsByModelId(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute(`DELETE FROM model_faqs WHERE model_id = ?`, [modelId]);
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- READ ----------
  static async getModelById(id, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        `SELECT m.*, v.vehicle_type_name, c.name AS category_name,
                b.name AS brand_name, u.name AS author_name,
                co.country_name, co.currency_symbol
         FROM models m
         JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
         JOIN categories c ON m.category_id = c.category_id
         JOIN brands b ON m.brand_id = b.brand_id
         LEFT JOIN countries co ON m.country_id = co.id
         LEFT JOIN usertable u ON m.author_id = u.user_id
         WHERE m.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      await this._release(connObj);
    }
  }

  static async getModelDetails(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      // exterior colors
      const [exteriorColors] = await connObj.conn.execute(
        `SELECT * FROM exterior_colors WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      // interior colors
      const [interiorColors] = await connObj.conn.execute(
        `SELECT * FROM interior_colors WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      // variants
      const [variants] = await connObj.conn.execute(
        `SELECT * FROM variants WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      // available sites
      const [availableSites] = await connObj.conn.execute(
        `SELECT * FROM available_sites WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      // keyspecs
      const [keyspecs] = await connObj.conn.execute(
        `SELECT * FROM keyspecs WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      // specifications with full hierarchy
      const [specifications] = await connObj.conn.execute(
        `SELECT * FROM specifications WHERE model_id = ? ORDER BY id`,
        [modelId]
      );

      const [specificationLists] = await connObj.conn.execute(
        `SELECT sl.* FROM specification_lists sl
         JOIN specifications s ON sl.specification_id = s.id
         WHERE s.model_id = ? ORDER BY sl.id`,
        [modelId]
      );

      const [specContents] = await connObj.conn.execute(
        `SELECT sc.* FROM spec_contents sc
         JOIN specification_lists sl ON sc.list_id = sl.id
         JOIN specifications s ON sl.specification_id = s.id
         WHERE s.model_id = ? ORDER BY sc.id`,
        [modelId]
      );

      // faqs
      const [faqs] = await connObj.conn.execute(
        `SELECT * FROM model_faqs WHERE model_id = ? ORDER BY id ASC`,
        [modelId]
      );

      // about contents
      const [aboutContents] = await connObj.conn.execute(
        `SELECT * FROM about_contents WHERE model_id = ? ORDER BY content_order ASC`,
        [modelId]
      );

      return {
        exteriorColors,
        interiorColors,
        variants,
        availableSites,
        keyspecs,
        specifications,
        specificationLists,
        specContents,
        faqs,
        aboutContents
      };
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- UPDATE ----------
  static async updateModel(id, data, imagePath, authorId, conn) {
    const {
      name, vehicle_type_id, category_id, brand_id, country_id,
      safety_rating, safety_link, sources, keywords, engine_type, starting_price,
      release_year, seater, status, review, descriptions
    } = data;

    const connObj = await this._getConn(conn);
    try {
      // Ensure image path starts with /
      const img = imagePath ? (imagePath.startsWith('/') ? imagePath : '/' + imagePath) : null;

      let updateQuery;
      let params;

      if (img) {
        // Get old image path before update
        const [old] = await connObj.conn.execute(`SELECT model_image FROM models WHERE id = ?`, [id]);
        const oldImage = old[0]?.model_image;

        // Delete old image if it exists and is different from new one
        if (oldImage && oldImage !== img) {
          const oldImagePath = path.join(rootDir, 'public', oldImage);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }

        updateQuery = `
          UPDATE models SET
            model_name = ?, vehicle_type_id = ?, category_id = ?, brand_id = ?, country_id = ?,
            model_image = ?,
            safety_rating = ?, safety_link = ?, sources = ?, keywords = ?, engine_type = ?,
            review = ?,
            starting_price = ?, release_year = ?, seater = ?, descriptions = ?, author_id = ?, status = ?, updated_at = NOW()
          WHERE id = ?
        `;

        params = [
          name || null, vehicle_type_id || null, category_id || null, brand_id || null, country_id || null,
          img,
          safety_rating || null, safety_link || null, sources || null, keywords || null, engine_type || null,
          review || null,
          starting_price || null, release_year || null, seater || null, descriptions || null, authorId, status || 'import',
          id
        ];
      } else {
        // No new image - keep the existing one
        updateQuery = `
          UPDATE models SET
            model_name = ?, vehicle_type_id = ?, category_id = ?, brand_id = ?, country_id = ?,
            safety_rating = ?, safety_link = ?, sources = ?, keywords = ?, engine_type = ?,
            review = ?,
            starting_price = ?, release_year = ?, seater = ?, descriptions = ?, author_id = ?, status = ?, updated_at = NOW()
          WHERE id = ?
        `;

        params = [
          name || null, vehicle_type_id || null, category_id || null, brand_id || null, country_id || null,
          safety_rating || null, safety_link || null, sources || null, keywords || null, engine_type || null,
          review || null,
          starting_price || null, release_year || null, seater || null, descriptions || null, authorId, status || 'import',
          id
        ];
      }

      await connObj.conn.execute(updateQuery, params);
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- DELETE RELATED DATA ONLY ----------
  static async deleteRelatedDataOnly(modelId, conn) {
    const connObj = await this._getConn(conn);
    const c = connObj.conn;

    try {
      // 1. Delete spec contents → lists → specs
      await c.execute(`
        DELETE sc FROM spec_contents sc
        JOIN specification_lists sl ON sc.list_id = sl.id
        JOIN specifications s ON sl.specification_id = s.id
        WHERE s.model_id = ?`, [modelId]);

      await c.execute(`
        DELETE sl FROM specification_lists sl
        JOIN specifications s ON sl.specification_id = s.id
        WHERE s.model_id = ?`, [modelId]);

      await c.execute(`DELETE FROM specifications WHERE model_id = ?`, [modelId]);

      // 2. Delete keyspecs
      await c.execute(`DELETE FROM keyspecs WHERE model_id = ?`, [modelId]);

      // 3. Delete direct children
      const directTables = [
        'about_contents', 'available_sites', 'variants',
        'exterior_colors', 'interior_colors', 'model_faqs'
      ];

      for (const table of directTables) {
        await c.execute(`DELETE FROM ${table} WHERE model_id = ?`, [modelId]);
      }

      // 4. Hidden titles
      await c.execute(`DELETE FROM hidden_titles WHERE model_id = ?`, [modelId]);
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET IMAGE PATHS FOR MODEL ----------
  static async getModelImagePaths(modelId, conn) {
    const connObj = await this._getConn(conn);
    try {
      // Get model image
      const [model] = await connObj.conn.execute(
        `SELECT model_image FROM models WHERE id = ?`,
        [modelId]
      );

      const modelImage = model[0]?.model_image;
      const imagePaths = modelImage ? [modelImage] : [];

      // Get exterior color images
      const [exteriorColors] = await connObj.conn.execute(
        `SELECT color_image FROM exterior_colors WHERE model_id = ? AND color_image IS NOT NULL`,
        [modelId]
      );

      exteriorColors.forEach(color => {
        if (color.color_image) imagePaths.push(color.color_image);
      });

      // Get interior color images
      const [interiorColors] = await connObj.conn.execute(
        `SELECT color_image FROM interior_colors WHERE model_id = ? AND color_image IS NOT NULL`,
        [modelId]
      );

      interiorColors.forEach(color => {
        if (color.color_image) imagePaths.push(color.color_image);
      });

      // Get about content images
      const [aboutContents] = await connObj.conn.execute(
        `SELECT image_path FROM about_contents 
         WHERE model_id = ? AND type = 'photo' AND image_path IS NOT NULL`,
        [modelId]
      );

      aboutContents.forEach(content => {
        if (content.image_path) imagePaths.push(content.image_path);
      });

      // Get spec content images
      const [specContents] = await connObj.conn.execute(
        `SELECT sc.image_path FROM spec_contents sc
         JOIN specification_lists sl ON sc.list_id = sl.id
         JOIN specifications s ON sl.specification_id = s.id
         WHERE s.model_id = ? AND sc.type = 'photo' AND sc.image_path IS NOT NULL`,
        [modelId]
      );

      specContents.forEach(content => {
        if (content.image_path) imagePaths.push(content.image_path);
      });

      return imagePaths.filter((path, index, self) =>
        path && self.indexOf(path) === index
      );
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- FULL DELETE ----------
  static async deleteModel(id, conn) {
    const connObj = await this._getConn(conn);
    try {
      // Get all image paths for this model
      const imagePaths = await this.getModelImagePaths(id, connObj.conn);

      // Delete all related data
      await this.deleteRelatedDataOnly(id, connObj.conn);

      // Delete model image files
      for (const imagePath of imagePaths) {
        if (imagePath) {
          const fullPath = path.join(rootDir, 'public', imagePath);
          if (fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (err) {
              console.error(`Error deleting file ${fullPath}:`, err);
            }
          }
        }
      }

      // Delete the model record
      await connObj.conn.execute(`DELETE FROM models WHERE id = ?`, [id]);
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET CATEGORIES BY VEHICLE TYPE ----------
  static async getCategoriesByVehicleType(vehicleTypeId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        `SELECT category_id, name FROM categories WHERE vehicle_type_id = ? ORDER BY name`,
        [vehicleTypeId]
      );
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET BRANDS BY VEHICLE TYPE ----------
  static async getBrandsByVehicleType(vehicleTypeId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        `SELECT brand_id, name FROM brands WHERE vehicle_type_id = ? ORDER BY name`,
        [vehicleTypeId]
      );
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET MODELS BY BRAND ID ----------
  static async getModelsByBrandId(brandId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(`
        SELECT m.*, v.vehicle_type_name, c.name AS category_name,
               b.name AS brand_name, u.name AS author_name,
               co.country_name
        FROM models m
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN brands b ON m.brand_id = b.brand_id
        LEFT JOIN countries co ON m.country_id = co.id
        LEFT JOIN usertable u ON m.author_id = u.user_id
        WHERE m.brand_id = ? AND (m.status = 'published' OR m.status = 'import')
        ORDER BY 
          CASE 
            WHEN m.engine_type LIKE '%electric%' THEN 1
            ELSE 2 
          END,
          m.starting_price ASC
      `, [brandId]);
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET POPULAR MODELS ----------
  static async getPopularModels(limit = 4, countryId = null) {
    const connObj = await this._getConn();
    try {
      const limitNum = parseInt(limit);
      let query = `
        SELECT m.*, b.name AS brand_name, v.vehicle_type_name
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        WHERE m.status IN ('published', 'import')
      `;
      let params = [];
      
      if (countryId) {
        query += ` AND (m.country_id = ? OR m.country_id IS NULL)`;
        params.push(countryId);
      }
      
      query += ` ORDER BY m.views DESC, m.created_at DESC LIMIT ?`;
      params.push(limitNum);

      const [rows] = await connObj.conn.execute(query, params);
      return rows;
    } catch (error) {
      console.error('Error in getPopularModels:', error);
      return [];
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET MODELS BY CATEGORY ID ----------
  static async getModelsByCategoryId(categoryId, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(`
        SELECT m.*, v.vehicle_type_name, c.name AS category_name,
               b.name AS brand_name, u.name AS author_name,
               co.country_name
        FROM models m
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN brands b ON m.brand_id = b.brand_id
        LEFT JOIN countries co ON m.country_id = co.id
        LEFT JOIN usertable u ON m.author_id = u.user_id
        WHERE m.category_id = ?
        ORDER BY 
          CASE 
            WHEN m.engine_type LIKE '%electric%' THEN 1
            ELSE 2 
          END,
          m.starting_price ASC
      `, [categoryId]);
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET ALL MODELS FOR COMPARISON ----------
  static async getAllModelsForComparison(conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(`
        SELECT m.id, m.model_name, m.brand_id, m.model_image, m.starting_price,
               b.name AS brand_name, v.vehicle_type_name, c.name AS category_name,
               co.country_name
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        JOIN categories c ON m.category_id = c.category_id
        LEFT JOIN countries co ON m.country_id = co.id
        WHERE m.status = 'published' OR m.status = 'import'
        ORDER BY b.name, m.model_name
      `);
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET SIMILAR MODELS ----------
  static async getSimilarModels(currentModelId, countryId = null, conn = null) {
    const connObj = await this._getConn(conn);
    try {
      const [current] = await connObj.conn.execute(
        `SELECT id, brand_id, category_id, vehicle_type_id, starting_price, country_id 
         FROM models WHERE id = ?`,
        [currentModelId]
      );

      if (current.length === 0) return [];

      const { brand_id, category_id, vehicle_type_id, starting_price, country_id } = current[0];
      const price = starting_price || 0;

      const [rows] = await connObj.conn.execute(`
        SELECT 
          m.id,
          m.model_name,
          m.model_image,
          m.starting_price,
          b.name AS brand_name,
          c.name AS category_name,
          v.vehicle_type_name,
          co.country_name
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        LEFT JOIN countries co ON m.country_id = co.id
        WHERE m.id != ?
          AND m.status IN ('published', 'import')
          AND (m.country_id = ? OR m.country_id IS NULL)
          AND (
            m.brand_id = ? 
            OR m.category_id = ? 
            OR m.vehicle_type_id = ?
            OR (m.starting_price IS NOT NULL AND ABS(m.starting_price - ?) <= 7000000)
          )
        ORDER BY 
          CASE 
            WHEN m.brand_id = ? THEN 1
            WHEN m.category_id = ? THEN 2  
            WHEN m.vehicle_type_id = ? THEN 3
            ELSE 4 
          END,
          ABS(m.starting_price - ?) ASC
        LIMIT 12
      `, [
        currentModelId,
        countryId || country_id || null,
        brand_id, category_id, vehicle_type_id, price,
        brand_id, category_id, vehicle_type_id, price
      ]);

      return rows;
    } catch (error) {
      console.error('getSimilarModels error:', error.message);
      return [];
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- GET SIMILAR MODELS FROM OTHER BRANDS ----------
  static async getSimilarModelsFromOtherBrands(currentModelId, countryId = null, conn = null) {
    const connObj = await this._getConn(conn);
    try {
      const [current] = await connObj.conn.execute(
        `SELECT brand_id, category_id, vehicle_type_id, starting_price, country_id 
         FROM models WHERE id = ?`,
        [currentModelId]
      );

      if (current.length === 0) return [];

      const { brand_id, category_id, vehicle_type_id, starting_price, country_id } = current[0];
      const price = starting_price || 0;

      const [rows] = await connObj.conn.execute(`
        SELECT 
          m.id,
          m.model_name,
          m.model_image,
          m.starting_price,
          b.name AS brand_name,
          c.name AS category_name,
          v.vehicle_type_name,
          co.country_name
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN categories c ON m.category_id = c.category_id
        JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
        LEFT JOIN countries co ON m.country_id = co.id
        WHERE m.id != ?
          AND m.brand_id != ?
          AND m.status IN ('published', 'import')
          AND (m.country_id = ? OR m.country_id IS NULL)
          AND (
            m.category_id = ? 
            OR m.vehicle_type_id = ?
            OR (m.starting_price IS NOT NULL AND ABS(m.starting_price - ?) <= 10000000)
          )
        ORDER BY 
          CASE 
            WHEN m.category_id = ? THEN 1  
            WHEN m.vehicle_type_id = ? THEN 2
            ELSE 3 
          END,
          ABS(m.starting_price - ?) ASC
        LIMIT 12
      `, [
        currentModelId,
        brand_id, // exclude this brand
        countryId || country_id || null,
        category_id, vehicle_type_id, price,
        category_id, vehicle_type_id, price
      ]);

      return rows;
    } catch (error) {
      console.error('getSimilarModelsFromOtherBrands error:', error.message);
      return [];
    } finally {
      await this._release(connObj);
    }
  }

  // ---------- HIDDEN TITLES ----------
  static async getHiddenTitlesByModelId(model_id, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [rows] = await connObj.conn.execute(
        'SELECT * FROM hidden_titles WHERE model_id = ? ORDER BY id ASC',
        [model_id]
      );
      return rows;
    } finally {
      await this._release(connObj);
    }
  }

  static async addHiddenTitle(model_id, hidden_title, conn) {
    const connObj = await this._getConn(conn);
    try {
      const [res] = await connObj.conn.execute(
        'INSERT INTO hidden_titles (model_id, hidden_title) VALUES (?, ?)',
        [model_id, hidden_title]
      );
      return res.insertId;
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteHiddenTitle(id, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute('DELETE FROM hidden_titles WHERE id = ?', [id]);
    } finally {
      await this._release(connObj);
    }
  }

  static async deleteAllHiddenTitlesByModelId(model_id, conn) {
    const connObj = await this._getConn(conn);
    try {
      await connObj.conn.execute('DELETE FROM hidden_titles WHERE model_id = ?', [model_id]);
    } finally {
      await this._release(connObj);
    }
  }

  static async getModelByBrandAndName(brandName, modelName, countryId = null, vehicleTypeId = null) {
    try {
      console.log('🔍 getModelByBrandAndName:', { brandName, modelName, countryId, vehicleTypeId });

      let query = `
            SELECT m.*, v.vehicle_type_name, c.name AS category_name,
                   b.name AS brand_name, u.name AS author_name,
                   co.country_name, co.currency_symbol
            FROM models m
            JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
            JOIN categories c ON m.category_id = c.category_id
            JOIN brands b ON m.brand_id = b.brand_id
            LEFT JOIN countries co ON m.country_id = co.id
            LEFT JOIN usertable u ON m.author_id = u.user_id
            WHERE LOWER(b.name) = LOWER(?)
              AND (
                LOWER(m.model_name) = LOWER(?)
                OR LOWER(REPLACE(m.model_name, ' ', '-')) = LOWER(?)
              )
        `;
      let params = [brandName, modelName, modelName];

      // ✅ vehicleTypeId filter
      if (vehicleTypeId) {
        query += ` AND m.vehicle_type_id = ?`;
        params.push(vehicleTypeId);
      }

      // ✅ countryId filter — same country first, global fallback
      if (countryId) {
        query += ` AND (m.country_id = ? OR m.country_id IS NULL)`;
        params.push(countryId);
      }

      // Country-specific model lai priority (NULL last)
      query += ` ORDER BY m.country_id IS NULL ASC LIMIT 1`;

      const [rows] = await db.execute(query, params);

      if (rows.length > 0) {
        console.log('✅ Model found:', rows[0].model_name, '| Country:', rows[0].country_name);
        return rows[0];
      } else {
        console.log('❌ Model not found');
        return null;
      }
    } catch (error) {
      console.error('Error in getModelByBrandAndName:', error);
      throw error;
    }
  }

  static async getSpecificationDetails(specId) {
    const connObj = await this._getConn();
    try {
      // Get specification
      const [specs] = await connObj.conn.execute(
        `SELECT * FROM specifications WHERE id = ?`,
        [specId]
      );

      if (specs.length === 0) return null;
      const specification = specs[0];

      // Get specification lists
      const [specificationLists] = await connObj.conn.execute(
        `SELECT * FROM specification_lists 
         WHERE specification_id = ?
         ORDER BY created_at ASC`,
        [specId]
      );

      // Get spec contents
      let specContents = [];
      if (specificationLists.length > 0) {
        const listIds = specificationLists.map(list => list.id);
        const placeholders = listIds.map(() => '?').join(',');

        const [contents] = await connObj.conn.execute(
          `SELECT * FROM spec_contents 
           WHERE list_id IN (${placeholders})
           ORDER BY created_at ASC`,
          listIds
        );
        specContents = contents;
      }

      return {
        specification,
        specificationLists,
        specContents
      };
    } finally {
      await this._release(connObj);
    }
  }

  // Get countries where this model exists (by name, brand, and vehicle type)
  static async getCountriesForModel(modelName, brandName, vehicleTypeId) {
    try {
      const [rows] = await db.execute(`
        SELECT DISTINCT c.id, c.country_name, c.currency_symbol
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN countries c ON m.country_id = c.id
        JOIN vehicletype vt ON m.vehicle_type_id = vt.vehicle_type_id
        WHERE (LOWER(m.model_name) = LOWER(?) OR LOWER(REPLACE(m.model_name, ' ', '-')) = LOWER(?))
        AND (LOWER(b.name) = LOWER(?) OR LOWER(REPLACE(b.name, ' ', '-')) = LOWER(?))
        AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
        UNION
        SELECT NULL as id, 'Global' as country_name, NULL as currency_symbol
        FROM models m
        JOIN brands b ON m.brand_id = b.brand_id
        JOIN vehicletype vt ON m.vehicle_type_id = vt.vehicle_type_id
        WHERE (LOWER(m.model_name) = LOWER(?) OR LOWER(REPLACE(m.model_name, ' ', '-')) = LOWER(?))
        AND (LOWER(b.name) = LOWER(?) OR LOWER(REPLACE(b.name, ' ', '-')) = LOWER(?))
        AND LOWER(vt.vehicle_type_name) = (SELECT LOWER(vehicle_type_name) FROM vehicletype WHERE vehicle_type_id = ?)
        AND m.country_id IS NULL
      `, [modelName, modelName, brandName, brandName, vehicleTypeId, modelName, modelName, brandName, brandName, vehicleTypeId]);
      return rows;
    } catch (error) {
      console.error('Error in getCountriesForModel:', error);
      return [];
    }
  }
}

module.exports = Model;