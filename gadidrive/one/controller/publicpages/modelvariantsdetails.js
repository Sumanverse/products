const Model = require('../../models/models');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const Brand = require('../../models/brands');
const db = require('../../utils/dbutils');

exports.getvariantdetails = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, brandname, modelname, variantname } = req.params;
        
        console.log('🔍 VARIANT DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, vehicletypename, brandname, modelname, variantname });
        console.log('📌 Full URL:', req.originalUrl);
        
        if (!vehicletypename || !brandname || !modelname || !variantname) {
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

        // Clean parameters (replace hyphens with spaces)
        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');
        const cleanVariantName = variantname.replace(/-/g, ' ');

        console.log(`🔍 Looking for: Brand="${cleanBrandName}", Model="${cleanModelName}", Variant="${cleanVariantName}"`);
        
        // Get the model by brand and name with country context
        let model = await Model.getModelByBrandAndName(cleanBrandName, cleanModelName, currentCountry ? currentCountry.id : null);
        console.log('📁 Model search result (method 1):', model ? model.model_name : 'Not found');
        
        if (!model) {
            console.log('🔄 Trying with original names:', { brandname, modelname });
            model = await Model.getModelByBrandAndName(brandname, modelname, currentCountry ? currentCountry.id : null);
            console.log('📁 Model search result (method 2):', model ? model.model_name : 'Not found');
        }

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
                    ? `/${countryname}/${correctVehicleType.vehicle_type_name}/${brandname}/${modelname}/${variantname}/`
                    : `/${correctVehicleType.vehicle_type_name}/${brandname}/${modelname}/${variantname}/`;
                
                console.log(`🔄 Redirecting to correct URL: ${redirectUrl}`);
                return res.redirect(301, redirectUrl);
            }
        }

        // Verify model belongs to this country (or is global)
        if (model.country_id && model.country_id !== (currentCountry ? currentCountry.id : null)) {
            console.log('❌ Model does not belong to this country');
            
            const correctCountry = model.country_id ? await Country.getById(model.country_id) : null;
            
            if (correctCountry) {
                const redirectUrl = `/${correctCountry.country_name.toLowerCase()}/${vehicletypename}/${brandname}/${modelname}/${variantname}/`;
                console.log(`🔄 Redirecting to correct URL: ${redirectUrl}`);
                return res.redirect(301, redirectUrl);
            }
        }

        console.log('✅ Model found:', model.model_name);

        // Get model details (including variants)
        const modelDetails = await Model.getModelDetails(model.id) || {};
        
        console.log('Model ID:', model.id);
        console.log('Total variants in database:', modelDetails.variants ? modelDetails.variants.length : 0);
        
        // Find the specific variant
        let variant = null;
        
        // Method 1: Try with cleaned name
        if (modelDetails.variants) {
            variant = modelDetails.variants.find(v => 
                v.name.toLowerCase() === cleanVariantName.toLowerCase()
            );
            console.log('📁 Variant search method 1:', variant ? variant.name : 'Not found');
        }

        // Method 2: Try with original name
        if (!variant && modelDetails.variants) {
            variant = modelDetails.variants.find(v => 
                v.name.toLowerCase() === variantname.toLowerCase()
            );
            console.log('📁 Variant search method 2:', variant ? variant.name : 'Not found');
        }

        // Method 3: Try partial match
        if (!variant && modelDetails.variants) {
            variant = modelDetails.variants.find(v => 
                v.name.toLowerCase().includes(cleanVariantName.toLowerCase()) ||
                cleanVariantName.toLowerCase().includes(v.name.toLowerCase())
            );
            console.log('📁 Variant search method 3:', variant ? variant.name : 'Not found');
        }

        if (!variant) {
            console.log('❌ Variant not found');
            return res.status(404).render('error', {
                message: `Variant "${variantname}" not found`,
                title: 'Variant Not Found - gadidrive',
                path: req.path
            });
        }

        console.log('✅ Found variant:', variant.name);

        // Get other variants for this model (excluding current variant)
        const otherVariants = modelDetails.variants?.filter(v => 
            v.id !== variant.id
        ) || [];

        console.log('Other variants count:', otherVariants.length);
        
        // Get similar models (with country context)
        const similarModels = await Model.getSimilarModels(model.id, currentCountry ? currentCountry.id : null) || [];
        const popularModels = await Model.getPopularModels(5, currentCountry ? currentCountry.id : null) || [];

        // ── Step 7.5: Get available countries for hreflang ────────────────
        const availableCountries = await Model.getCountriesForModel(
            model.model_name, model.brand_name, vehicleType.vehicle_type_id
        );
        console.log(`🌍 Available countries for this variant: ${availableCountries.length}`);

        // Generate canonical URL (SEO-friendly format)
        const canonicalUrl = countryname 
            ? `/${countryname}/${vehicletypename}/${brandname}/${modelname}/${variantname}/`
            : `/${vehicletypename}/${brandname}/${modelname}/${variantname}/`;

        // Generate SEO data
        const now = new Date();
        const months = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
        const updated = `(updated ${months[now.getMonth()]} ${now.getFullYear()})`;
        
        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const currencySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';
        
        const displayPrice = variant.price ? `${currencySymbol} ${new Intl.NumberFormat('en-IN').format(variant.price)}` : 'Coming Soon';
        
        const seoDescription = `Check out ${model.brand_name} ${model.model_name} ${variant.name} specifications, price, and features in ${countryDisplay}. ${variant.price ? 'Priced at ' + displayPrice : 'Price coming soon'}. View all details about this variant.`;
        
        const seoTitle = `${model.brand_name} ${model.model_name} ${variant.name} Price in ${countryDisplay} ${now.getFullYear()} | GadiDrive`;

        console.log('✅ Rendering variant details page');
        
        res.render('publicpages/modelvariantsdetails', {
            error: null,
            model,
            vehicleType,
            vehicletypename,
            brandname,
            modelname,
            variantname,
            variant,
            country: currentCountry,
            allCountries,
            modelDetails,
            otherVariants,
            similarModels,
            popularModels,
            availableCountries, // Added for SEO hreflang
            updated,
            canonicalUrl,
            currencySymbol,
            countryDisplay,
            seoDescription,
            title: seoTitle,
            description: seoDescription,
            keywords: `${model.brand_name} ${model.model_name} ${variant.name}, ${model.brand_name} ${model.model_name} variant, ${variant.name} price ${countryDisplay.toLowerCase()}, ${variant.name} specifications`,
            path: canonicalUrl
        });

    } catch (error) {
        console.error('❌ Error in getvariantdetails:', error);
        console.error('Error stack:', error.stack);
        res.status(500).render('error', {
            message: 'Server error occurred while loading variant details',
            title: 'Server Error - gadidrive',
            path: req.path
        });
    }
};