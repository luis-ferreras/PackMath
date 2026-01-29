import { getSheetURL, DEFAULT_CONFIGS } from './config.js';

// Data stores
export let PRODUCTS = {};
export let ODDS_RAW = [];
export let CHECKLIST = [];
export let CONFIGURATIONS = [];

// CSV Parsing
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result.map(s => s.replace(/^"|"$/g, ''));
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length === 0) return [];
    const headers = parseCSVLine(lines[0]);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, index) => {
            row[header.trim()] = values[index] ? values[index].trim() : '';
        });
        data.push(row);
    }
    return data;
}

// Data fetching
async function fetchSheet(tabName) {
    const url = getSheetURL(tabName);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${tabName}`);
    const csvText = await response.text();
    return parseCSV(csvText);
}

function processProducts(rows) {
    const products = {};
    rows.forEach(row => {
        if (row.product_id) {
            // Build configs from Configuration sheet for this product
            const productConfigs = {};
            CONFIGURATIONS
                .filter(c => c.product_id === row.product_id)
                .forEach(c => {
                    productConfigs[c.config] = {
                        name: c.config,
                        packs: parseInt(c.packs_per_box) || 0,
                        cardsPerPack: parseInt(c.cards_per_pack) || 0,
                        boxesPerCase: parseInt(c.boxes_per_case) || 0
                    };
                });

            // Fall back to DEFAULT_CONFIGS if no Configuration data exists
            const configs = Object.keys(productConfigs).length > 0
                ? productConfigs
                : { ...DEFAULT_CONFIGS };

            products[row.product_id] = {
                id: row.product_id,
                name: row.name || '',
                sport: row.sport || '',
                brand: row.brand || '',
                year: row.year || '',
                configs
            };
        }
    });
    return products;
}

// Get configuration info for a specific product and config
export function getConfigInfo(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    // Check product's configs first
    if (product.configs[config]) {
        return product.configs[config];
    }

    // Fall back to DEFAULT_CONFIGS
    if (DEFAULT_CONFIGS[config]) {
        return DEFAULT_CONFIGS[config];
    }

    return { packs: 0, cardsPerPack: 0, boxesPerCase: 0 };
}

export async function loadData() {
    try {
        const [productsData, oddsData, checklistData, configData] = await Promise.all([
            fetchSheet('products'),
            fetchSheet('odds'),
            fetchSheet('checklist'),
            fetchSheet('Configuration')
        ]);
        CONFIGURATIONS = configData;
        PRODUCTS = processProducts(productsData);
        ODDS_RAW = oddsData;
        CHECKLIST = checklistData;
        console.log('Data loaded:', Object.keys(PRODUCTS).length, 'products');
        return true;
    } catch (error) {
        console.error('Failed to load data:', error.message);
        return false;
    }
}

// ========================================
// Data Accessors
// ========================================

export function getAvailableSports() {
    const sports = new Set();
    Object.values(PRODUCTS).forEach(p => sports.add(p.sport));
    return Array.from(sports).sort();
}

export function getAllProducts() {
    return Object.values(PRODUCTS).sort((a, b) => {
        // Sort by year desc, then by name
        if (b.year !== a.year) return b.year.localeCompare(a.year);
        return a.name.localeCompare(b.name);
    });
}

export function getProductsBySport(sport) {
    return getAllProducts().filter(p => p.sport === sport);
}

export function searchProducts(query, sportFilter = null) {
    const q = query.toLowerCase().trim();
    if (!q) return sportFilter ? getProductsBySport(sportFilter) : getAllProducts();

    let products = Object.values(PRODUCTS);

    // Apply sport filter if provided
    if (sportFilter) {
        products = products.filter(p => p.sport === sportFilter);
    }

    // Search by name, brand, year, sport
    return products.filter(p => {
        const searchStr = `${p.name} ${p.brand} ${p.year} ${p.sport}`.toLowerCase();
        return searchStr.includes(q);
    }).sort((a, b) => {
        // Prioritize exact matches in name
        const aNameMatch = a.name.toLowerCase().includes(q);
        const bNameMatch = b.name.toLowerCase().includes(q);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        // Then sort by year desc
        return b.year.localeCompare(a.year);
    });
}

export function getProduct(productId) {
    return PRODUCTS[productId] || null;
}

export function getAvailableConfigs(productId) {
    const configs = new Set();
    ODDS_RAW.filter(row => row.product_id === productId).forEach(row => configs.add(row.config));
    return Array.from(configs);
}

// ========================================
// Odds Formatting
// ========================================

export function formatOddsValue(odds) {
    if (!odds) return null;
    const str = String(odds).trim();
    // Filter out spreadsheet errors
    if (str.startsWith('#') || str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
        return null;
    }

    // Parse and format odds with abbreviations for large numbers
    if (str.includes(':')) {
        const parts = str.split(':');
        if (parts.length === 2) {
            const prefix = parts[0].trim();
            const num = parseFloat(parts[1].trim());

            if (!isNaN(num)) {
                let formatted;
                if (num >= 1000000) {
                    const millions = num / 1000000;
                    formatted = millions >= 10 ? Math.round(millions) + 'M' : millions.toFixed(1) + 'M';
                } else if (num >= 1000) {
                    const thousands = num / 1000;
                    formatted = thousands >= 10 ? Math.round(thousands) + 'K' : thousands.toFixed(1) + 'K';
                } else if (num >= 100) {
                    formatted = Math.round(num).toString();
                } else {
                    formatted = num % 1 === 0 ? num.toString() : num.toFixed(1);
                }
                return `${prefix}:${formatted}`;
            }
        }
    }

    return str;
}

// ========================================
// Product Stats (for hero card)
// ========================================

export function getProductStats(productId, config) {
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config);

    const parallels = filtered.filter(row => row.category === 'base').length;
    const inserts = filtered.filter(row => row.category === 'insert').length;
    const autographs = filtered.filter(row => row.category === 'autograph').length;
    const relics = filtered.filter(row => row.category === 'relic').length;
    const autoRelics = filtered.filter(row => {
        const cat = (row.category || '').toLowerCase().trim();
        return cat === 'autograph_relic' || cat === 'autograph relic' || cat === 'auto relic' || cat === 'auto_relic';
    }).length;

    return {
        parallels,
        inserts,
        autographs,
        relics,
        autoRelics,
        total: parallels + inserts + autographs + relics + autoRelics
    };
}

// ========================================
// Odds Data Accessors
// ========================================

export function getOddsForProduct(productId, config) {
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config);
    const baseParallels = filtered.filter(row => row.category === 'base').map(row => ({
        name: row.parallel || row.card_type,
        odds: row.odds ? formatOddsValue(row.odds) : null,
        numbered: row.numbered || null
    }));
    const inserts = filtered.filter(row => row.category === 'insert').map(row => ({
        name: row.card_type,
        odds: row.odds ? formatOddsValue(row.odds) : null,
        type: row.parallel === 'SSP' ? 'ssp' : 'insert',
        checklist: row.checklist ? parseInt(row.checklist) : null
    }));
    const autographs = filtered.filter(row => row.category === 'autograph').map(row => ({
        name: row.card_type,
        odds: row.odds ? formatOddsValue(row.odds) : null,
        checklist: row.checklist ? parseInt(row.checklist) : null
    }));
    return {
        base_parallels: baseParallels.length > 0 ? baseParallels : null,
        inserts: inserts.length > 0 ? inserts : null,
        autographs: autographs.length > 0 ? autographs : null
    };
}

export function getAllParallelsForProduct(productId) {
    const parallels = new Map();
    ODDS_RAW.filter(row => row.product_id === productId && row.category === 'base').forEach(row => {
        const name = row.parallel || row.card_type;
        if (!parallels.has(name)) parallels.set(name, {});
        parallels.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return parallels;
}

export function getAllInsertsForProduct(productId) {
    const inserts = new Map();
    ODDS_RAW.filter(row => row.product_id === productId && row.category === 'insert').forEach(row => {
        const name = row.card_type;
        if (!inserts.has(name)) inserts.set(name, { isSSP: row.parallel === 'SSP' });
        inserts.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return inserts;
}

export function getAllAutographsForProduct(productId) {
    const autos = new Map();
    ODDS_RAW.filter(row => row.product_id === productId && row.category === 'autograph').forEach(row => {
        const name = row.card_type;
        if (!autos.has(name)) autos.set(name, {});
        autos.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return autos;
}

export function getAllRelicsForProduct(productId) {
    const relics = new Map();
    ODDS_RAW.filter(row => row.product_id === productId && row.category === 'relic').forEach(row => {
        const name = row.card_type;
        if (!relics.has(name)) relics.set(name, {});
        relics.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return relics;
}

export function getAllAutoRelicsForProduct(productId) {
    const autoRelics = new Map();
    ODDS_RAW.filter(row => {
        if (row.product_id !== productId) return false;
        const cat = (row.category || '').toLowerCase().trim();
        return cat === 'autograph_relic' || cat === 'autograph relic' || cat === 'auto relic' || cat === 'auto_relic';
    }).forEach(row => {
        const name = row.card_type;
        if (!autoRelics.has(name)) autoRelics.set(name, {});
        autoRelics.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return autoRelics;
}

// ========================================
// Checklist Accessors
// ========================================

export function getChecklistForProduct(productId) {
    return CHECKLIST.filter(row => row.product_id === productId);
}
