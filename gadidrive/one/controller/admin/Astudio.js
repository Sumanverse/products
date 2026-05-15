const db = require('../../utils/db');

const getModelContentStudio = async (req, res) => {
  const { modelId } = req.params;
  let conn;
  try {
    conn = await db.getConnection();

    // 1. Get Model basic info with joins
    const [[model]] = await conn.execute(`
            SELECT m.*, b.name as brand_name, b.image_path as brand_image, vt.vehicle_type_name, c.name as category_name, co.country_name, co.currency_symbol
            FROM models m
            JOIN brands b ON m.brand_id = b.brand_id
            JOIN vehicletype vt ON m.vehicle_type_id = vt.vehicle_type_id
            LEFT JOIN categories c ON m.category_id = c.category_id
            LEFT JOIN countries co ON m.country_id = co.id
            WHERE m.id = ?
        `, [modelId]);

    if (!model) {
      return res.status(404).send('Model not found');
    }

    // Fix image path
    if (model.model_image && !model.model_image.startsWith('/') && !model.model_image.startsWith('http')) {
      model.model_image = '/' + model.model_image;
    }

    // Null-safety defaults for template rendering
    model.model_name = model.model_name || 'Untitled Model';
    model.brand_name = model.brand_name || 'Unknown Brand';
    model.vehicle_type_name = model.vehicle_type_name || 'car';
    model.country_name = model.country_name || 'Nepal';
    model.category_name = model.category_name || 'Unknown';
    model.currency_symbol = model.currency_symbol || 'रु';
    model.starting_price = model.starting_price || 0;
    model.model_image = model.model_image || '/uploads/models/placeholder.png';

    // 2. Get Key Specs
    const [keyspecs] = await conn.execute(`
            SELECT key_spec, key_spec_data 
            FROM keyspecs 
            WHERE model_id = ? 
            ORDER BY id
        `, [modelId]);

    // Render standalone page
    res.render('admin/Astudio', {
      user: req.user,
      title: `Content Studio | ${model.model_name}`,
      model,
      keyspecs
    });

  } catch (err) {
    console.error('Error loading Content Studio:', err.message, err.stack);
    res.status(500).send('Internal Server Error');
  } finally {
    if (conn) conn.release();
  }
};

const getBrandContentStudio = async (req, res) => {
  const { brandId } = req.params;
  let conn;
  try {
    conn = await db.getConnection();

    // 1. Get Brand info
    const [[brand]] = await conn.execute(`
      SELECT b.*, vt.vehicle_type_name, co.country_name 
      FROM brands b
      JOIN vehicletype vt ON b.vehicle_type_id = vt.vehicle_type_id
      LEFT JOIN countries co ON b.country_id = co.id
      WHERE b.brand_id = ?
    `, [brandId]);

    if (!brand) {
      return res.status(404).send('Brand not found');
    }

    // Fix image path
    if (brand.image_path && !brand.image_path.startsWith('/') && !brand.image_path.startsWith('http')) {
      brand.image_path = '/' + brand.image_path;
    }

    brand.name = brand.name || 'Unknown Brand';
    brand.vehicle_type_name = brand.vehicle_type_name || 'vehicle';
    brand.country_name = brand.country_name || 'Nepal';
    brand.image_path = brand.image_path || '/images/placeholder.png';

    // 2. Get Models for this brand
    // Fallback to imported models if none are published just to show something in admin testing
    const [models] = await conn.execute(`
      SELECT m.*, co.currency_symbol
      FROM models m
      LEFT JOIN countries co ON m.country_id = co.id
      WHERE m.brand_id = ?
      ORDER BY m.model_name ASC
    `, [brandId]);

    // Fix model image paths and default prices
    models.forEach(m => {
      if (m.model_image && !m.model_image.startsWith('/') && !m.model_image.startsWith('http')) {
        m.model_image = '/' + m.model_image;
      }
      m.model_image = m.model_image || '/uploads/models/placeholder.png';
      m.currency_symbol = m.currency_symbol || 'रु';
      m.starting_price = m.starting_price || 0;
    });

    res.render('admin/Abrandstudio', {
      user: req.user,
      title: `Brand Studio | ${brand.name}`,
      brand,
      models
    });

  } catch (err) {
    console.error('Error loading Brand Content Studio:', err.message, err.stack);
    res.status(500).send('Internal Server Error');
  } finally {
    if (conn) conn.release();
  }
};

module.exports = {
  getModelContentStudio,
  getBrandContentStudio
};
