const Model = require('../../models/models');
const VehicleType = require('../../models/vehicletype');
const Country = require('../../models/country');
const Brand = require('../../models/brands');

exports.getmodeldetails = async (req, res, next) => {
    try {
        const { countryname, vehicletypename, brandname, modelname } = req.params;

        console.log('🔍 MODEL DETAILS CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname, vehicletypename, brandname, modelname });
        console.log('📌 Full URL:', req.originalUrl);

        if (!vehicletypename || !brandname || !modelname) {
            return res.status(404).render('error', {
                message: 'Invalid URL',
                title: 'Page Not Found - gadidrive',
                path: req.path,
                country: null,
                allCountries: []
            });
        }

        // ── Step 1: Country ──────────────────────────────────────────────
        let currentCountry = null;
        let allCountries = [];

        allCountries = await Country.getAll();

        if (countryname) {
            currentCountry = allCountries.find(c =>
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );

            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive',
                    path: req.path,
                    country: null,
                    allCountries
                });
            }
        }

        const countryId = currentCountry ? currentCountry.id : null;

        // ── Step 2: Vehicle type ─────────────────────────────────────────
        console.log('🚗 Looking for vehicle type:', vehicletypename);
        const vehicleType = await VehicleType.getVehicleTypeByName(vehicletypename, countryId);

        if (!vehicleType) {
            return res.status(404).render('error', {
                message: `Vehicle type "${vehicletypename}" not found`,
                title: 'Vehicle Type Not Found - gadidrive',
                path: req.path,
                country: currentCountry,
                allCountries
            });
        }
        console.log('✅ Vehicle type found:', vehicleType.vehicle_type_name, '(ID:', vehicleType.vehicle_type_id, ')');

        // ── Step 3: Clean names ──────────────────────────────────────────
        const cleanBrandName = brandname.replace(/-/g, ' ');
        const cleanModelName = modelname.replace(/-/g, ' ');
        console.log(`🔍 Looking for: Brand="${cleanBrandName}", Model="${cleanModelName}"`);

        // ── Step 4: Get model — countryId + vehicleTypeId pass gareko ────
        // ✅ PRIMARY: clean names + country + vehicle type
        let model = await Model.getModelByBrandAndName(
            cleanBrandName, cleanModelName, countryId, vehicleType.vehicle_type_id
        );
        console.log('📁 Primary lookup:', model ? `Found: ${model.model_name}` : 'Not found');

        // ✅ FALLBACK: original hyphenated names
        if (!model) {
            model = await Model.getModelByBrandAndName(
                brandname, modelname, countryId, vehicleType.vehicle_type_id
            );
            console.log('📁 Fallback lookup:', model ? `Found: ${model.model_name}` : 'Not found');
        }

        // ── Step 5: Not found — 404, NO redirect (redirect loop fix) ────
        if (!model) {
            console.log('❌ Model not found for this country + vehicle type combination');
            return res.status(404).render('error', {
                message: `Model "${cleanModelName}" not found for ${cleanBrandName} in ${currentCountry ? currentCountry.country_name : 'Global'}`,
                title: 'Model Not Found - gadidrive',
                path: req.path,
                country: currentCountry,
                allCountries
            });
        }

        console.log('✅ Model found:', model.model_name, '| Country:', model.country_name);

        // ── Step 6: Fetch model details ──────────────────────────────────
        console.log('📊 Fetching model details for ID:', model.id);
        const modelDetails = await Model.getModelDetails(model.id) || {};
        console.log('✅ Model details fetched');

        // ── Step 6.5: Auto-Generate and Merge FAQs ──────────────────────
        const autoFaqs = [];
        const countrySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';

        if (model.starting_price) {
            autoFaqs.push({
                question: `What is the price of the ${model.brand_name} ${model.model_name} in ${currentCountry ? currentCountry.country_name : 'Nepal'}?`,
                answer: `The starting price of the ${model.brand_name} ${model.model_name} is ${countrySymbol}${model.starting_price}.`
            });
        }
        if (model.engine_type) {
            const engineFormatted = model.engine_type.charAt(0).toUpperCase() + model.engine_type.slice(1);
            autoFaqs.push({
                question: `What type of engine does the ${model.brand_name} ${model.model_name} have?`,
                answer: `The ${model.brand_name} ${model.model_name} comes with an ${engineFormatted} engine.`
            });
        }
        if (model.seater) {
            autoFaqs.push({
                question: `What is the seating capacity of the ${model.brand_name} ${model.model_name}?`,
                answer: `The ${model.brand_name} ${model.model_name} has a seating capacity of ${model.seater}.`
            });
        }

        // Add some keyspecs to auto-generated FAQs
        if (modelDetails.keyspecs && modelDetails.keyspecs.length > 0) {
            const firstSpec = modelDetails.keyspecs[0];
            autoFaqs.push({
                question: `What is the ${firstSpec.key_spec} of the ${model.brand_name} ${model.model_name}?`,
                answer: `The ${firstSpec.key_spec} of the ${model.brand_name} ${model.model_name} is ${firstSpec.key_spec_data}.`
            });
        }

        const mergedFaqs = [...(modelDetails.faqs || []), ...autoFaqs];
        // Ensure unique questions to avoid duplication
        const uniqueFaqsMap = new Map();
        mergedFaqs.forEach(faq => {
            if (faq.question && faq.answer) {
                // Use a normalized question string to prevent duplicates like "what is..." and "What is..."
                uniqueFaqsMap.set(faq.question.toLowerCase().trim(), faq);
            }
        });
        modelDetails.faqs = Array.from(uniqueFaqsMap.values());


        // ── Step 7: Popular + Similar + Brand Models ────────────────────
        const popularModels = await Model.getPopularModels(5) || [];

        let similarModels = [];
        let brandModels = [];
        let relatedBrands = [];

        try {
            // 1. Similar models from OTHER brands (Competitors)
            similarModels = await Model.getSimilarModelsFromOtherBrands(model.id) || [];
            console.log(`🔍 Similar Models (Competitors) count: ${similarModels.length}`);

            // Fallback: If no competitors found, get similar models including same brand
            if (similarModels.length === 0) {
                similarModels = await Model.getSimilarModels(model.id, countryId) || [];
                console.log(`🔍 Fallback Similar Models count: ${similarModels.length}`);
            }

            // 2. More models from the SAME brand
            if (model.brand_id) {
                const allBrandModels = await Model.getModelsByBrandId(model.brand_id) || [];
                brandModels = allBrandModels.filter(m => m.id !== model.id).slice(0, 8);
                console.log(`🔍 Brand Models count for brand ${model.brand_id}: ${brandModels.length}`);
            }

            // 3. Similar brands (logos)
            if (vehicleType) {
                const allBrands = await Brand.getBrandsByVehicleType(vehicleType.vehicle_type_id, countryId) || [];
                relatedBrands = allBrands.filter(b => b.brand_id !== model.brand_id).slice(0, 12);
                console.log(`🔍 Related Brands count: ${relatedBrands.length}`);
            }
        } catch (err) {
            console.error('❌ Recommendations error:', err);
        }

        // ── Step 7.5: Get available countries for hreflang ────────────────
        const availableCountries = await Model.getCountriesForModel(
            model.model_name, model.brand_name, vehicleType.vehicle_type_id
        );
        console.log(`🌍 Available countries for this model: ${availableCountries.length}`);

        // ── Step 8: Meta & render ────────────────────────────────────────
        const hiddenTitles = model.hidden_titles || [];
        const reviewVideo = model.review || null;

        const canonicalUrl = countryname
            ? `/${countryname}/${vehicletypename}/${brandname}/${modelname}/`
            : `/${vehicletypename}/${brandname}/${modelname}/`;

        const publishedDate = model.published_date
            ? new Date(model.published_date).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
            })
            : 'Recently';

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Global';
        const currencySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';

        const CONTROLLER_VERSION = "April-16-v5-STABLE";
        console.log(`🚀 RENDERING WITH VERSION: ${CONTROLLER_VERSION}`);

        return res.render('publicpages/modeldetails', {
            error: null,
            model,
            vehicleType,
            vehicletypename,
            brandname,
            modelname,
            country: currentCountry,
            allCountries,
            modelDetails,
            popularModels,
            similarModels,
            brandModels,
            relatedBrands,
            availableCountries, // Added for SEO hreflang
            CONTROLLER_VERSION, // Dynamic version marker
            hiddenTitles,
            reviewVideo,
            canonicalUrl,
            publishedDate,
            currencySymbol,
            countryDisplay,
            title: `${model.brand_name} ${model.model_name} Price, Specs, Features in ${countryDisplay} | gadidrive`,
            description: model.descriptions || `Check out ${model.brand_name} ${model.model_name} detailed specifications, price, features, and reviews in ${countryDisplay}.`,
            keywords: `${model.brand_name} ${model.model_name}, ${model.brand_name} ${model.model_name} ${countryDisplay.toLowerCase()}, ${model.brand_name} ${model.model_name} price`,
            path: canonicalUrl
        });

    } catch (error) {
        console.error('❌ Error in getmodeldetails:', error);
        console.error('Error stack:', error.stack);
        res.status(500).render('error', {
            message: 'Server error occurred while loading model details',
            title: 'Server Error - gadidrive',
            path: req.path,
            country: null,
            allCountries: []
        });
    }
};