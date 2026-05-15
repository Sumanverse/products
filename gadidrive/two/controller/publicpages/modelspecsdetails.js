const Model = require('../../models/models');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const Brand = require('../../models/brands');
const db = require('../../utils/dbutils');

exports.getmodelspecsdetails = async (req, res) => {
    try {
        const { countryname, vehicletypename, brandname, modelname, specificationstitlename } = req.params;
        
        console.log('🔍 SPECIFICATION DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, vehicletypename, brandname, modelname, specificationstitlename });
        console.log('📌 Full URL:', req.originalUrl);
        
        if (!vehicletypename || !brandname || !modelname || !specificationstitlename) {
            return res.status(404).render('error', {
                message: 'Invalid URL',
                title: 'Page Not Found - gadidrive',
                path: req.path
            });
        }

        // Get country details
        let currentCountry = null;
        let allCountries = [];
        
        if (countryname) {
            allCountries = await Country.getAll();
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
            
            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive',
                    path: req.path
                });
            }
        }

        // Get vehicle type by name with country context
        const vehicleType = await VehicleType.getVehicleTypeByName(
            vehicletypename, 
            currentCountry ? currentCountry.id : null
        );
        
        if (!vehicleType) {
            return res.status(404).render('error', {
                message: `Vehicle type "${vehicletypename}" not found${countryname ? ' in ' + countryname : ''}`,
                title: 'Vehicle Type Not Found - gadidrive',
                path: req.path
            });
        }
        console.log('✅ Vehicle type found:', vehicleType.vehicle_type_name);

        // Country prefix for links
        const countryPrefix = countryname ? '/' + countryname : '';

        // Clean names (replace hyphens with spaces)
        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');
        const cleanSpecTitle = specificationstitlename.replace(/-/g, ' ');

        console.log(`🔍 Looking for: Brand="${cleanBrandName}", Model="${cleanModelName}", Spec="${cleanSpecTitle}"`);

        let model, specification, specDetails;
        let otherSpecifications = [];

        // Get model with details
        const conn = await db.getConnection();
        try {
            // Method 1: Try with cleaned names and country context
            console.log('📁 Method 1: Trying with cleaned names');
            const [models] = await conn.execute(
                `SELECT m.*, b.name AS brand_name, u.name AS author_name,
                        v.vehicle_type_name, c.name AS category_name,
                        co.country_name, co.currency_symbol
                 FROM models m
                 JOIN brands b ON m.brand_id = b.brand_id
                 JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                 JOIN categories c ON m.category_id = c.category_id
                 LEFT JOIN countries co ON m.country_id = co.id
                 LEFT JOIN usertable u ON m.author_id = u.user_id
                 WHERE LOWER(b.name) = LOWER(?) AND LOWER(m.model_name) = LOWER(?)
                   AND (m.country_id = ? OR m.country_id IS NULL)`,
                [cleanBrandName, cleanModelName, currentCountry ? currentCountry.id : null]
            );
            
            console.log(`📁 Method 1 result: ${models.length} models found`);
            
            if (models.length > 0) {
                model = models[0];
                console.log('✅ Model found (method 1):', model.model_name);
            } else {
                // Method 2 for model: Try with original names
                console.log('📁 Method 2: Trying with original names');
                const [modelsOriginal] = await conn.execute(
                    `SELECT m.*, b.name AS brand_name, u.name AS author_name,
                            v.vehicle_type_name, c.name AS category_name,
                            co.country_name, co.currency_symbol
                     FROM models m
                     JOIN brands b ON m.brand_id = b.brand_id
                     JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                     JOIN categories c ON m.category_id = c.category_id
                     LEFT JOIN countries co ON m.country_id = co.id
                     LEFT JOIN usertable u ON m.author_id = u.user_id
                     WHERE LOWER(b.name) = LOWER(?) AND LOWER(m.model_name) = LOWER(?)
                       AND (m.country_id = ? OR m.country_id IS NULL)`,
                    [brandname, modelname, currentCountry ? currentCountry.id : null]
                );
                
                console.log(`📁 Method 2 result: ${modelsOriginal.length} models found`);
                
                if (modelsOriginal.length > 0) {
                    model = modelsOriginal[0];
                    console.log('✅ Model found (method 2):', model.model_name);
                }
            }

            // If model not found, show error
            if (!model) {
                console.log('❌ Model not found');
                return res.status(404).render('error', {
                    message: `Model "${modelname}" not found for ${brandname}${countryname ? ' in ' + countryname : ''}`,
                    title: 'Model Not Found - gadidrive',
                    path: req.path
                });
            }

            // Verify model belongs to this vehicle type
            if (model.vehicle_type_id !== vehicleType.vehicle_type_id) {
                console.log('❌ Model does not belong to this vehicle type');
                
                // Find the correct vehicle type
                const correctVehicleType = await VehicleType.getVehicleTypeById(model.vehicle_type_id);
                
                if (correctVehicleType) {
                    // Redirect to correct URL (SEO-friendly format)
                    const redirectUrl = countryname 
                        ? `/${countryname}/${correctVehicleType.vehicle_type_name}/${brandname}/${modelname}/specs/${specificationstitlename}/`
                        : `/${correctVehicleType.vehicle_type_name}/${brandname}/${modelname}/specs/${specificationstitlename}/`;
                    
                    console.log(`🔄 Redirecting to correct URL: ${redirectUrl}`);
                    return res.redirect(301, redirectUrl);
                }
            }

            // Verify model belongs to this country (or is global)
            if (model.country_id && model.country_id !== (currentCountry ? currentCountry.id : null)) {
                console.log('❌ Model does not belong to this country');
                
                const correctCountry = model.country_id ? await Country.getById(model.country_id) : null;
                
                if (correctCountry) {
                    const redirectUrl = `/${correctCountry.country_name.toLowerCase()}/${vehicletypename}/${brandname}/${modelname}/specs/${specificationstitlename}/`;
                    console.log(`🔄 Redirecting to correct URL: ${redirectUrl}`);
                    return res.redirect(301, redirectUrl);
                }
            }

            console.log('✅ Model verified:', model.model_name);

            // ========== FIND SPECIFICATION ==========
            
            // Method 1: Try with cleaned title
            console.log('📋 Method 1: Looking for spec with cleaned title');
            const [specs1] = await conn.execute(
                `SELECT s.* FROM specifications s
                 WHERE s.model_id = ? AND LOWER(s.title) = LOWER(?)`,
                [model.id, cleanSpecTitle]
            );
            
            if (specs1.length > 0) {
                specification = specs1[0];
                console.log('✅ Specification found (method 1):', specification.title);
                specDetails = await Model.getSpecificationDetails(specification.id);
            } else {
                // Method 2: Try with original title (with hyphens)
                console.log('📋 Method 2: Trying with original title');
                const [specs2] = await conn.execute(
                    `SELECT s.* FROM specifications s
                     WHERE s.model_id = ? AND LOWER(s.title) = LOWER(?)`,
                    [model.id, specificationstitlename]
                );
                
                if (specs2.length > 0) {
                    specification = specs2[0];
                    console.log('✅ Specification found (method 2):', specification.title);
                    specDetails = await Model.getSpecificationDetails(specification.id);
                } else {
                    // Method 3: Try LIKE search
                    console.log('📋 Method 3: Trying LIKE search');
                    const [specs3] = await conn.execute(
                        `SELECT s.* FROM specifications s
                         WHERE s.model_id = ? AND LOWER(s.title) LIKE LOWER(?)`,
                        [model.id, `%${cleanSpecTitle}%`]
                    );
                    
                    if (specs3.length > 0) {
                        specification = specs3[0];
                        console.log('✅ Specification found (method 3):', specification.title);
                        specDetails = await Model.getSpecificationDetails(specification.id);
                    } else {
                        // Method 4: Try to find by ID if it's a number
                        if (!isNaN(cleanSpecTitle)) {
                            console.log('📋 Method 4: Trying to find by ID');
                            const [specs4] = await conn.execute(
                                `SELECT s.* FROM specifications s
                                 WHERE s.model_id = ? AND s.id = ?`,
                                [model.id, parseInt(cleanSpecTitle)]
                            );
                            
                            if (specs4.length > 0) {
                                specification = specs4[0];
                                console.log('✅ Specification found (method 4):', specification.title);
                                specDetails = await Model.getSpecificationDetails(specification.id);
                            }
                        }
                        
                        // Method 5: Get the first specification for this model
                        if (!specification) {
                            console.log('📋 Method 5: Getting first specification for this model');
                            const [firstSpec] = await conn.execute(
                                `SELECT s.* FROM specifications s
                                 WHERE s.model_id = ?
                                 ORDER BY s.id ASC
                                 LIMIT 1`,
                                [model.id]
                            );
                            
                            if (firstSpec.length > 0) {
                                specification = firstSpec[0];
                                console.log('✅ Specification found (method 5 - first spec):', specification.title);
                                specDetails = await Model.getSpecificationDetails(specification.id);
                                
                                // Redirect to correct URL
                                const correctSpecSlug = specification.title.toLowerCase().replace(/\s+/g, '-');
                                const redirectUrl = countryname 
                                    ? `/${countryname}/${vehicletypename}/${brandname}/${modelname}/specs/${correctSpecSlug}/`
                                    : `/${vehicletypename}/${brandname}/${modelname}/specs/${correctSpecSlug}/`;
                                
                                console.log(`🔄 Redirecting to correct specification: ${redirectUrl}`);
                                return res.redirect(301, redirectUrl);
                            }
                        }
                    }
                }
            }

            // If still not found, check if this might be a variant instead
            if (!specification) {
                console.log('❌ Specification not found');
                
                // Check if this might be a variant instead
                const [variantCheck] = await conn.execute(
                    `SELECT * FROM variants WHERE model_id = ? AND LOWER(name) = LOWER(?)`,
                    [model.id, cleanSpecTitle]
                );
                
                if (variantCheck.length > 0) {
                    console.log('⚠️ This appears to be a variant, redirecting to variant page');
                    const variantUrl = countryname 
                        ? `/${countryname}/${vehicletypename}/${brandname}/${modelname}/${specificationstitlename}/`
                        : `/${vehicletypename}/${brandname}/${modelname}/${specificationstitlename}/`;
                    return res.redirect(301, variantUrl);
                }
                
                return res.status(404).render('error', {
                    message: `Specification "${specificationstitlename}" not found for ${model.brand_name} ${model.model_name}${countryname ? ' in ' + countryname : ''}`,
                    title: 'Specification Not Found - gadidrive',
                    path: req.path
                });
            }

            console.log('✅ Specification found:', specification.title);

            // Get other specifications for this model
            const [otherSpecs] = await conn.execute(
                `SELECT s.* FROM specifications s
                 WHERE s.model_id = ? AND s.id != ?
                 ORDER BY s.created_at DESC
                 LIMIT 6`,
                [model.id, specification.id]
            );
            
            otherSpecifications = otherSpecs;

        } finally {
            conn.release();
        }

        // Get similar models for recommendations (with country context)
        let similarModels = [];
        try {
            similarModels = await Model.getSimilarModels(model.id, currentCountry ? currentCountry.id : null);
            console.log(`✅ Found ${similarModels.length} similar models`);
        } catch (err) {
            console.error('Error fetching similar models:', err);
        }

        // ── Step 7.5: Get available countries for hreflang ────────────────
        const availableCountries = await Model.getCountriesForModel(
            model.model_name, model.brand_name, vehicleType.vehicle_type_id
        );
        console.log(`🌍 Available countries for this spec: ${availableCountries.length}`);

        // Format dates
        const createdDate = new Date(model.created_at);
        const publishedDateISO = createdDate.toISOString();
        const publishedDate = createdDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const currencySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';

        // Generate canonical URL (SEO-friendly format)
        const canonicalUrl = countryname 
            ? `/${countryname}/${vehicletypename}/${brandname}/${modelname}/specs/${specificationstitlename}/`
            : `/${vehicletypename}/${brandname}/${modelname}/specs/${specificationstitlename}/`;

        // SEO data
        const seoTitle = `${specification.title} of ${model.brand_name} ${model.model_name} in ${countryDisplay} | gadidrive`;
        const seoDescription = `${specification.title} specifications for ${model.brand_name} ${model.model_name} in ${countryDisplay}. Check detailed technical specifications, features, and more. ${model.starting_price ? 'Priced at ' + currencySymbol + ' ' + new Intl.NumberFormat('en-IN').format(model.starting_price) : ''}`;
        const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

        console.log('✅ Rendering specification details page');

        res.render('publicpages/modelspecsdetails', {
            title: seoTitle,
            model: model,
            vehicleType: vehicleType,
            vehicletypename,
            brandname,
            modelname,
            specificationstitlename,
            specification: specification,
            country: currentCountry,
            allCountries,
            specificationLists: specDetails?.specificationLists || [],
            specContents: specDetails?.specContents || [],
            otherSpecifications: otherSpecifications,
            availableCountries, // Added for SEO hreflang
            similarModels: similarModels || [],
            seoDescription: seoDescription,
            currentUrl: currentUrl,
            canonicalUrl: canonicalUrl,
            publishedDateISO: publishedDateISO,
            publishedDate: publishedDate,
            authorName: model.author_name || 'gadidrive Team',
            countryDisplay,
            currencySymbol,
            path: canonicalUrl
        });

    } catch (error) {
        console.error('❌ Error fetching specification details:', error);
        console.error('Error stack:', error.stack);
        res.status(500).render('error', {
            message: 'Server error occurred while loading specification details',
            title: 'Server Error - gadidrive',
            path: req.path
        });
    }
};