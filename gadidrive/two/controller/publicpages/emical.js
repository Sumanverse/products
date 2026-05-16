// controller/publicpages/emical.js - EMI Calculator Controller with Country Support
const Country = require('../../models/country');
const Model = require('../../models/models');
const Brand = require('../../models/brands');
const db = require('../../utils/dbutils');

exports.getEmiCalculator = async (req, res, next) => {
    try {
        const { countryname } = req.params;
        
        console.log('🧮 EMI CALCULATOR CONTROLLER HIT!');
        console.log('📌 Params received:', { countryname });
        console.log('📌 Full URL:', req.originalUrl);
        
        // Get country details
        let currentCountry = null;
        allCountries = await Country.getAll();
        if (countryname) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
            
            if (!currentCountry) {
                return res.status(404).render('error', {
                    message: `Country "${countryname}" not found`,
                    title: 'Country Not Found - gadidrive'
                });
            }
        }

        const countryDisplay = currentCountry ? currentCountry.country_name : 'Nepal';
        const currencySymbol = currentCountry ? currentCountry.currency_symbol : 'रू';
        const countryPrefix = countryname ? '/' + countryname : '';

        res.render('publicpages/emical', {
            title: countryname ? `EMI Calculator | Calculate Your Vehicle Loan EMI in ${countryDisplay} | GadiDrive` : 'EMI Calculator | Calculate Your Vehicle Loan EMI | GadiDrive',
            description: countryname ? `Calculate your vehicle loan EMI in ${countryDisplay} with our easy-to-use calculator. Get detailed breakdown and charts for car, bike, and other vehicle loans.` : 'Calculate your vehicle loan EMI with our easy-to-use calculator. Get detailed breakdown and charts for car, bike, and other vehicle loans.',
            keywords: `EMI calculator, car loan EMI, bike loan calculator, vehicle finance, loan calculator${countryDisplay ? ' ' + countryDisplay.toLowerCase() : ''}`,
            ogImage: '/images/mainlogo.png',
            canonical: countryname ? `/${countryname}/emicalculator` : '/emicalculator',
            error: null,
            result: null,
            inputData: null,
            chartData: null,
            country: currentCountry,
            allCountries,
            countryDisplay,
            currencySymbol,
            countryPrefix,
            similarModels: [],
            path: countryname ? `/${countryname}/emicalculator` : '/emicalculator'
        });
    } catch (error) {
        console.error('Error in getEmiCalculator:', error);
        res.status(500).render('publicpages/emical', {
            title: 'EMI Calculator | Calculate Your Vehicle Loan EMI',
            description: 'Calculate your vehicle loan EMI with our easy-to-use calculator.',
            keywords: 'EMI calculator, car loan EMI',
            canonical: '/emicalculator',
            error: 'Server error loading EMI calculator',
            result: null,
            inputData: null,
            chartData: null,
            country: null,
            allCountries: [],
            countryDisplay: 'Nepal',
            currencySymbol: 'रू',
            countryPrefix: '',
            similarModels: [],
            path: '/emicalculator'
        });
    }
};

exports.calculateEMI = async (req, res, next) => {
    try {
        const { countryname } = req.params;
        const {
            price,
            downPayment,
            downPaymentPercentage,
            loanAmount,
            interestRate,
            tenure,
            tenureType
        } = req.body;

        console.log('🧮 EMI CALCULATION REQUEST');
        console.log('📌 Country:', countryname);
        console.log('📌 Body:', req.body);
        
        // Get country details
        let currentCountry = null;
        let allCountries = [];
        let currencySymbol = 'रू';
        let countryDisplay = 'Nepal';
        let countryPrefix = '';
        
        allCountries = await Country.getAll();
        if (countryname) {
            currentCountry = allCountries.find(c => 
                c.country_name.toLowerCase() === countryname.toLowerCase()
            );
            
            if (currentCountry) {
                currencySymbol = currentCountry.currency_symbol;
                countryDisplay = currentCountry.country_name;
                countryPrefix = '/' + countryname;
            }
        }

        // SEO variables for all responses
        const seoData = {
            title: countryname ? `EMI Calculator Results | Calculate Your Vehicle Loan EMI in ${countryDisplay} | GadiDrive` : 'EMI Calculator Results | Calculate Your Vehicle Loan EMI | GadiDrive',
            description: countryname ? `Calculate your vehicle loan EMI in ${countryDisplay} with our easy-to-use calculator. Get detailed breakdown and charts for car, bike, and other vehicle loans.` : 'Calculate your vehicle loan EMI with our easy-to-use calculator. Get detailed breakdown and charts for car, bike, and other vehicle loans.',
            keywords: `EMI calculator, car loan EMI, bike loan calculator, vehicle finance, loan calculator${countryDisplay ? ' ' + countryDisplay.toLowerCase() : ''}`,
            ogImage: '/images/mainlogo.png',
            canonical: countryname ? `/${countryname}/emicalculator` : '/emicalculator'
        };

        // Input validation
        const errors = [];
        
        if (!loanAmount || isNaN(loanAmount) || parseFloat(loanAmount) <= 0) {
            errors.push('Valid loan amount is required');
        }
        
        if (!interestRate || isNaN(interestRate) || parseFloat(interestRate) <= 0) {
            errors.push('Valid interest rate is required');
        }
        
        if (!tenure || isNaN(tenure) || parseInt(tenure) <= 0) {
            errors.push('Valid tenure is required');
        }
        
        if (!tenureType || (tenureType !== 'months' && tenureType !== 'years')) {
            errors.push('Valid tenure type (months/years) is required');
        }

        if (errors.length > 0) {
            return res.render('publicpages/emical', {
                ...seoData,
                error: errors.join(', '),
                result: null,
                inputData: req.body,
                chartData: null,
                country: currentCountry,
                allCountries,
                countryDisplay,
                currencySymbol,
                countryPrefix,
                similarModels: [],
                path: countryname ? `/${countryname}/emicalculator` : '/emicalculator'
            });
        }

        // Convert to numbers
        const loanAmountNum = parseFloat(loanAmount);
        const interestRateNum = parseFloat(interestRate);
        const tenureNum = parseInt(tenure);
        
        // Calculate months
        let months = tenureType === 'years' ? tenureNum * 12 : tenureNum;
        
        // Validate months
        if (months > 360) { months = 360; }
        if (months < 1) { months = 1; }

        // Monthly interest rate
        const monthlyRate = (interestRateNum / 12) / 100;

        // Calculate EMI
        let emi = 0;
        let totalPayment = 0;
        let totalInterest = 0;

        if (months === 1) {
            totalInterest = loanAmountNum * monthlyRate;
            totalPayment = loanAmountNum + totalInterest;
            emi = totalPayment;
        } else {
            emi = loanAmountNum * monthlyRate * 
                  Math.pow(1 + monthlyRate, months) / 
                  (Math.pow(1 + monthlyRate, months) - 1);
            
            totalPayment = emi * months;
            totalInterest = totalPayment - loanAmountNum;
        }

        // Prepare result object
        const result = {
            emi: emi,
            totalPayment: totalPayment,
            totalInterest: totalInterest,
            loanAmount: loanAmountNum,
            interestRate: interestRateNum,
            tenure: months,
            tenureNum: tenureNum,
            tenureType: tenureType,
            tenureDisplay: tenureType === 'years' ? 
                `${tenureNum} year${tenureNum > 1 ? 's' : ''}` : 
                `${tenureNum} month${tenureNum > 1 ? 's' : ''}`
        };

        // Calculate price and down payment with percentage logic
        let hasPriceInfo = false;
        let priceNum = 0;
        let downPaymentNum = 0;
        let calculatedDownPaymentPercentage = 0;
        
        // Check if price is provided
        if (price && parseFloat(price) > 0) {
            priceNum = parseFloat(price);
            
            if (downPaymentPercentage && parseFloat(downPaymentPercentage) >= 0 && parseFloat(downPaymentPercentage) <= 100) {
                calculatedDownPaymentPercentage = parseFloat(downPaymentPercentage);
                downPaymentNum = (priceNum * calculatedDownPaymentPercentage) / 100;
            } else if (downPayment && parseFloat(downPayment) >= 0) {
                downPaymentNum = parseFloat(downPayment);
                calculatedDownPaymentPercentage = (downPaymentNum / priceNum * 100);
            }
            
            if (priceNum > 0 && (downPaymentNum > 0 || calculatedDownPaymentPercentage > 0)) {
                hasPriceInfo = true;
                result.price = priceNum;
                result.downPayment = downPaymentNum;
                result.downPaymentPercentage = calculatedDownPaymentPercentage.toFixed(2);
                result.calculatedLoanAmount = priceNum - downPaymentNum;
            }
        }

        // Prepare chart data
        let chartData = null;
        if (hasPriceInfo) {
            chartData = {
                labels: ['Down Payment', 'Loan Principal', 'Total Interest'],
                datasets: [{
                    data: [downPaymentNum, loanAmountNum, totalInterest],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b'],
                    borderColor: ['#1d4ed8', '#059669', '#d97706'],
                    borderWidth: 2
                }]
            };
        } else {
            chartData = {
                labels: ['Principal Amount', 'Total Interest'],
                datasets: [{
                    data: [loanAmountNum, totalInterest],
                    backgroundColor: ['#dc2626', '#3b82f6'],
                    borderColor: ['#b91c1c', '#1d4ed8'],
                    borderWidth: 2
                }]
            };
        }

        // Convert chart data to JSON string
        let chartDataString = 'null';
        try {
            chartDataString = JSON.stringify(chartData);
        } catch (err) {
            console.error('Error stringifying chart data:', err);
        }

        // Fetch recommendations based on calculated results
        let similarModels = [];
        if (hasPriceInfo) {
            const countryCondition = currentCountry ? `(m.country_id = ${currentCountry.id} OR m.country_id IS NULL)` : `m.country_id IS NULL`;
            try {
                const [rows] = await db.execute(`
                    SELECT m.*, b.name AS brand_name, v.vehicle_type_name
                    FROM models m
                    JOIN brands b ON m.brand_id = b.brand_id
                    JOIN vehicletype v ON m.vehicle_type_id = v.vehicle_type_id
                    WHERE m.status IN ('published', 'import')
                    AND ${countryCondition}
                    AND m.starting_price IS NOT NULL
                    AND ABS(m.starting_price - ?) <= ?
                    ORDER BY ABS(m.starting_price - ?) ASC
                    LIMIT 16
                `, [priceNum, priceNum * 0.3, priceNum]); // within 30%
                similarModels = rows;
            } catch (err) {
                console.error('Error fetching similar models:', err);
            }
        }

        res.render('publicpages/emical', {
            ...seoData,
            error: null,
            result: result,
            inputData: req.body,
            chartData: chartDataString,
            country: currentCountry,
            allCountries,
            countryDisplay,
            currencySymbol,
            countryPrefix,
            similarModels,
            path: countryname ? `/${countryname}/emicalculator` : '/emicalculator'
        });

    } catch (error) {
        console.error('Error in calculateEMI:', error);
        res.status(500).render('publicpages/emical', {
            title: 'EMI Calculator | Calculate Your Vehicle Loan EMI',
            description: 'Calculate your vehicle loan EMI with our easy-to-use calculator.',
            keywords: 'EMI calculator, car loan EMI',
            canonical: '/emicalculator',
            error: 'Error calculating EMI. Please try again.',
            result: null,
            inputData: req.body,
            chartData: null,
            country: null,
            allCountries: [],
            countryDisplay: 'Nepal',
            currencySymbol: 'रू',
            countryPrefix: '',
            similarModels: [],
            path: '/emicalculator'
        });
    }
};