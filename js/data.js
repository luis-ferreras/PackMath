import { getSheetURL, YEAR_TABS, DEFAULT_CONFIGS, MASTER_LIST_URL, getProductSheetURL } from './config.js';

// Data stores
export let PRODUCTS = {};
export let SLUGS = {}; // slug → product_id mapping
export let MASTER_LIST = []; // Master list index (product -> sheet mapping)
export let CONFIGURATIONS = [];

// Per-product data caches (lazy loaded from Master List)
const CHECKLIST_CACHE = {}; // product_id -> checklist array
const ODDS_CACHE = {}; // product_id -> odds array
const CONFIG_CACHE = {}; // product_id -> config array

// Legacy support - these will be populated from per-product data as needed
export let ODDS_RAW = [];
export let CHECKLIST = [];

// Generate URL-friendly slug from product name
function generateSlug(year, brand, productId) {
    const parts = [year, brand, productId].filter(Boolean);
    return parts.join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with hyphens
        .replace(/-+/g, '-')           // Collapse multiple hyphens
        .replace(/^-|-$/g, '');        // Trim leading/trailing hyphens
}

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

// Fetch a single tab from a sheet
async function fetchSheetTab(sheetKey, tabName) {
    const url = getSheetURL(sheetKey, tabName);
    if (!url) return [];

    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch ${sheetKey}/${tabName}: ${response.status}`);
            return [];
        }
        const csvText = await response.text();
        const data = parseCSV(csvText);

        // Add the year tab name to each row
        data.forEach(row => {
            row._yearTab = tabName;
        });

        return data;
    } catch (error) {
        console.warn(`Error fetching ${sheetKey}/${tabName}:`, error.message);
        return [];
    }
}

// Fetch all year tabs from a sheet and combine them
async function fetchAllYearTabs(sheetKey) {
    const allData = [];

    // Fetch all year tabs in parallel (YEAR_TABS is an object mapping tab name to gid)
    const tabNames = Object.keys(YEAR_TABS);
    const results = await Promise.all(
        tabNames.map(yearTab => fetchSheetTab(sheetKey, yearTab))
    );

    // Combine all results
    results.forEach(data => {
        allData.push(...data);
    });

    return allData;
}

// Fetch the Master List index
async function fetchMasterList() {
    try {
        const response = await fetch(MASTER_LIST_URL);
        if (!response.ok) {
            console.warn(`Failed to fetch Master List: ${response.status}`);
            return [];
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.warn('Error fetching Master List:', error.message);
        return [];
    }
}

// Get Master List entry for a product by slug
export function getMasterListEntry(productSlug) {
    return MASTER_LIST.find(entry => entry.slug === productSlug);
}

// Fetch checklist data for a specific product from its sheet
async function fetchProductChecklist(sheetId, gid) {
    const url = getProductSheetURL(sheetId, gid);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch checklist: ${response.status}`);
            return [];
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.warn('Error fetching checklist:', error.message);
        return [];
    }
}

// Fetch odds data for a specific product from its sheet
async function fetchProductOdds(sheetId, gid) {
    const url = getProductSheetURL(sheetId, gid);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch odds: ${response.status}`);
            return [];
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.warn('Error fetching odds:', error.message);
        return [];
    }
}

// Fetch config data for a specific product from its sheet
async function fetchProductConfig(sheetId, gid) {
    const url = getProductSheetURL(sheetId, gid);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`Failed to fetch config: ${response.status}`);
            return [];
        }
        const csvText = await response.text();
        return parseCSV(csvText);
    } catch (error) {
        console.warn('Error fetching config:', error.message);
        return [];
    }
}

// Load checklist for a product (with caching)
export async function loadChecklistForProduct(productSlug) {
    // Return cached data if available
    if (CHECKLIST_CACHE[productSlug]) {
        return CHECKLIST_CACHE[productSlug];
    }

    const entry = getMasterListEntry(productSlug);
    if (!entry || !entry.sheet) {
        console.warn(`No Master List entry found for: ${productSlug}`);
        return [];
    }

    const checklist = await fetchProductChecklist(entry.sheet, entry.checklist_gid || 0);

    // Normalize column names and set product_id on each row for filtering
    checklist.forEach(row => {
        // Map type -> set_type (category like BASE, INSERT)
        if (!row.set_type && row.type) {
            row.set_type = row.type;
        }
        // Map number -> card_num
        if (!row.card_num && row.number) {
            row.card_num = row.number;
        }
        row.product_id = productSlug;
    });

    CHECKLIST_CACHE[productSlug] = checklist;

    // Also update legacy CHECKLIST array for compatibility
    checklist.forEach(row => {
        if (!CHECKLIST.find(c => c === row)) {
            CHECKLIST.push(row);
        }
    });

    return checklist;
}

// Load odds for a product (with caching)
export async function loadOddsForProduct(productSlug) {
    // Return cached data if available
    if (ODDS_CACHE[productSlug]) {
        return ODDS_CACHE[productSlug];
    }

    const entry = getMasterListEntry(productSlug);
    if (!entry || !entry.sheet || !entry.odds_gid) {
        console.warn(`No Master List entry or odds_gid found for: ${productSlug}`);
        return [];
    }

    const odds = await fetchProductOdds(entry.sheet, entry.odds_gid);

    // Normalize column names (support both old and new Google Sheets column names)
    odds.forEach(row => {
        // Map box -> config (box type: hobby, retail, etc.)
        // Normalize to lowercase and trim whitespace
        if (row.box && (!row.config || !row.config.trim())) {
            row.config = row.box.toLowerCase().trim();
        }
        // Legacy: Map set_type -> config
        if (row.set_type && (!row.config || !row.config.trim())) {
            row.config = row.set_type.toLowerCase().trim();
        }
        // Map type -> category (card category: base, insert, autograph, relic)
        // Normalize to lowercase and trim whitespace
        if (row.type && (!row.category || !row.category.trim())) {
            row.category = row.type.toLowerCase().trim();
        }
        // Legacy: Map box_config -> category
        if (row.box_config && (!row.category || !row.category.trim())) {
            row.category = row.box_config.toLowerCase().trim();
        }
        // Map set_name -> card_type (the card type name: Base, Rookie Autographs, etc.)
        if (!row.card_type && row.set_name) {
            row.card_type = row.set_name;
        }
        // Map numbered -> out_of (the /XX numbering)
        if (!row.out_of && row.numbered) {
            row.out_of = row.numbered;
        }
        // Set product_id for filtering
        row.product_id = productSlug;
    });

    // Debug: log normalized odds data
    console.log('Loaded odds for', productSlug, ':', odds.length, 'rows');
    if (odds.length > 0) {
        console.log('Sample row:', { config: odds[0].config, category: odds[0].category, card_type: odds[0].card_type });
    }

    ODDS_CACHE[productSlug] = odds;

    // Also update legacy ODDS_RAW array for compatibility
    odds.forEach(row => {
        if (!ODDS_RAW.find(o => o === row)) {
            ODDS_RAW.push(row);
        }
    });

    return odds;
}

// Load config for a product (with caching)
export async function loadConfigForProduct(productSlug) {
    // Return cached data if available
    if (CONFIG_CACHE[productSlug]) {
        return CONFIG_CACHE[productSlug];
    }

    const entry = getMasterListEntry(productSlug);
    if (!entry || !entry.sheet || !entry.config_gid) {
        console.warn(`No Master List entry or config_gid found for: ${productSlug}`);
        return [];
    }

    const config = await fetchProductConfig(entry.sheet, entry.config_gid);

    // Normalize column names (support various naming conventions)
    config.forEach(row => {
        // Normalize box_config / box / config -> box_config
        if (!row.box_config) {
            row.box_config = row.box || row.config || '';
        }
        // Normalize to lowercase for consistency
        if (row.box_config) {
            row.box_config = row.box_config.toLowerCase().trim();
        }
        // Set product_id for filtering
        row.product_id = productSlug;
    });

    console.log('Loaded config for', productSlug, ':', config.length, 'rows');
    if (config.length > 0) {
        console.log('Sample config row:', { box_config: config[0].box_config, packs_per_box: config[0].packs_per_box });
    }

    CONFIG_CACHE[productSlug] = config;

    return config;
}

// Check if config data is loaded for a product
export function isConfigLoaded(productId) {
    return !!CONFIG_CACHE[productId];
}

// Get cached config for a product (after loading)
export function getConfigRawForProduct(productId) {
    return CONFIG_CACHE[productId] || [];
}

function processProducts(rows) {
    const products = {};
    const slugs = {};

    rows.forEach(row => {
        // Support both old column names (product_url, product_id) and new ones (slug, name)
        const productId = row.slug || row.product_url || row.product_id;

        if (productId) {
            // Build configs from Configuration sheet for this product
            const productConfigs = {};
            CONFIGURATIONS
                .filter(c => c.product_id === productId)
                .forEach(c => {
                    productConfigs[c.box_config] = {
                        name: c.box_config,
                        packs: parseInt(c.packs_per_box) || 0,
                        cardsPerPack: parseInt(c.cards_per_pack) || 0,
                        boxesPerCase: parseInt(c.boxes_per_case) || 0
                    };
                });

            // Fall back to DEFAULT_CONFIGS if no Configuration data exists
            const configs = Object.keys(productConfigs).length > 0
                ? productConfigs
                : { ...DEFAULT_CONFIGS };

            // Year comes from the tab name (e.g., "2025-26"), or extract from product name
            let year = row._yearTab || '';
            // If no year tab, try to extract year from the product name (e.g., "2025-26 Topps...")
            if (!year) {
                const yearMatch = (row.name || row.product_id || '').match(/^(\d{4}(-\d{2})?)/);
                if (yearMatch) {
                    year = yearMatch[1];
                }
            }
            // Support both old (product_brand) and new (brand) column names
            const brand = row.brand || row.product_brand || '';
            // Support both old (release_date) and new (release) column names
            const releaseDate = row.release || row.release_date || '';

            // Display name: use 'name' column (new) or 'product_id' (old) for the friendly name
            const displayProductName = row.name || row.product_id || productId;

            // Build display name: [year] [brand] [product_id]
            const displayName = [year, brand, displayProductName].filter(Boolean).join(' ');

            // Generate URL slug from slug column (new), product_url (old), or generate one
            const slug = row.slug || row.product_url || generateSlug(year, brand, displayProductName);

            // Support both old (product_sport) and new (sport) column names
            const sport = row.sport || row.product_sport || '';

            products[productId] = {
                id: productId,
                slug: slug,
                name: displayName,
                sport: sport,
                brand: brand,
                year: year,
                url: row.slug || row.product_url || '',
                releaseDate: releaseDate,
                configs
            };

            // Store reverse lookup (slug -> internal ID)
            slugs[slug] = productId;
        }
    });

    // Update global SLUGS
    Object.assign(SLUGS, slugs);

    return products;
}

// Get configuration info for a specific product and config
export function getConfigInfo(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    // Normalize config name to lowercase for matching
    const normalizedConfig = (config || '').toLowerCase().trim();

    // First, check per-product config cache (from product's Config tab)
    if (CONFIG_CACHE[productId]) {
        const cachedConfig = CONFIG_CACHE[productId].find(
            c => c.box_config === normalizedConfig
        );
        if (cachedConfig) {
            return {
                name: cachedConfig.box_config,
                packs: parseInt(cachedConfig.packs_per_box) || 0,
                cardsPerPack: parseInt(cachedConfig.cards_per_pack) || 0,
                boxesPerCase: parseInt(cachedConfig.boxes_per_case) || 0
            };
        }
    }

    // Check product's configs (from legacy Configuration sheet)
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
        // Fetch Master List, products, and configuration in parallel
        const [masterListData, productsData, configData] = await Promise.all([
            fetchMasterList(),
            fetchAllYearTabs('products'),
            fetchAllYearTabs('configuration')
        ]);

        MASTER_LIST = masterListData;
        CONFIGURATIONS = configData;
        PRODUCTS = processProducts(productsData);

        // Debug: expose to window for console access
        window.DEBUG_DATA = { PRODUCTS, MASTER_LIST, CONFIGURATIONS, ODDS_RAW, CHECKLIST };

        console.log('Data loaded:', Object.keys(PRODUCTS).length, 'products');
        console.log('  - Master List entries:', MASTER_LIST.length);
        console.log('  - Configurations:', CONFIGURATIONS.length);
        console.log('  - Master List slugs:', MASTER_LIST.map(e => e.slug));
        console.log('  - Product IDs:', Object.keys(PRODUCTS));

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

export function getProductBySlug(slug) {
    const productId = SLUGS[slug];
    return productId ? PRODUCTS[productId] : null;
}

export function getProductSlug(productId) {
    const product = PRODUCTS[productId];
    return product ? product.slug : null;
}

export function getAvailableConfigs(productId) {
    const configs = new Set();
    ODDS_RAW.filter(row => row.product_id === productId).forEach(row => configs.add(row.config));
    return Array.from(configs);
}

// ========================================
// Odds Formatting
// ========================================

// Fix corrupted odds values that Google Sheets converted from "1:111" to decimals
// Google interprets "1:111" as time (1 hour 111 minutes) and converts to decimal (fraction of day)
// This function detects and converts them back to the original "1:X" format
function fixCorruptedOdds(value) {
    if (!value) return value;

    const str = String(value).trim();

    // If it already has a colon, it's probably fine
    if (str.includes(':')) return str;

    // Check if it's a decimal that looks like a corrupted time value
    const num = parseFloat(str);
    if (isNaN(num)) return str;

    // Decimals between 0 and 1 are likely corrupted "1:X" values where X > 59
    // Google converts "1:111" to 171 minutes / 1440 minutes per day = 0.11875
    if (num > 0 && num < 1) {
        const totalMinutes = Math.round(num * 1440); // Convert back to minutes
        // Original format was "1:X" where X = totalMinutes - 60
        const oddsValue = totalMinutes - 60;
        if (oddsValue > 59) { // Only fix if it was actually an invalid time (minutes > 59)
            return `1:${oddsValue}`;
        }
    }

    return str;
}

export function formatOddsValue(odds) {
    if (!odds) return null;

    // First, fix any corrupted decimal values
    const fixedOdds = fixCorruptedOdds(odds);

    const str = String(fixedOdds).trim();
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
        name: row.card_type || 'Base',
        odds: row.odds ? formatOddsValue(row.odds) : null,
        numbered: row.out_of || null  // out_of = numbered to /XX
    }));
    const inserts = filtered.filter(row => row.category === 'insert').map(row => ({
        name: row.card_type,
        odds: row.odds ? formatOddsValue(row.odds) : null,
        type: row.parallel === 'SSP' ? 'ssp' : 'insert',
        numbered: row.out_of || null
    }));
    const autographs = filtered.filter(row => row.category === 'autograph').map(row => ({
        name: row.card_type,
        odds: row.odds ? formatOddsValue(row.odds) : null,
        numbered: row.out_of || null
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
        // For base category, use parallel name first (e.g., "Zodiac", "Refractor"),
        // then fall back to card_type, then "Base"
        const name = row.parallel || row.card_type || 'Base';
        if (!parallels.has(name)) parallels.set(name, {});
        parallels.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return parallels;
}

// Returns parallels grouped by set (card_type), then by parallel name
// Structure: Map<setName, Map<parallelName, {config: odds}>>
export function getAllParallelsBySetForProduct(productId) {
    const setMap = new Map();
    ODDS_RAW.filter(row => row.product_id === productId && row.category === 'base').forEach(row => {
        const setName = row.card_type || 'Base';
        const parallelName = row.parallel || 'Base';

        if (!setMap.has(setName)) setMap.set(setName, new Map());
        const parallels = setMap.get(setName);

        if (!parallels.has(parallelName)) parallels.set(parallelName, {});
        parallels.get(parallelName)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return setMap;
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

// Synchronous accessor - returns cached data or empty array
// Call loadChecklistForProduct() first to ensure data is loaded
export function getChecklistForProduct(productId) {
    // Check cache first (keyed by slug)
    if (CHECKLIST_CACHE[productId]) {
        return CHECKLIST_CACHE[productId];
    }
    // Fall back to legacy filter (for backwards compatibility)
    return CHECKLIST.filter(row => row.product_id === productId);
}

// Check if checklist data is loaded for a product
export function isChecklistLoaded(productId) {
    return !!CHECKLIST_CACHE[productId];
}

// Check if odds data is loaded for a product
export function isOddsLoaded(productId) {
    return !!ODDS_CACHE[productId];
}

// Get cached odds for a product (after loading)
export function getOddsRawForProduct(productId) {
    if (ODDS_CACHE[productId]) {
        return ODDS_CACHE[productId];
    }
    // Fall back to legacy filter
    return ODDS_RAW.filter(row => row.product_id === productId);
}
