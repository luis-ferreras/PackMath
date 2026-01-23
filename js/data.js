import { getSheetURL, DEFAULT_CONFIGS } from './config.js';

// Data stores
export let PRODUCTS = {};
export let ODDS_RAW = [];
export let CHECKLIST = [];

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
            products[row.product_id] = {
                name: row.name || '',
                sport: row.sport || '',
                brand: row.brand || '',
                year: row.year || '',
                configs: { ...DEFAULT_CONFIGS }
            };
        }
    });
    return products;
}

export async function loadData() {
    try {
        const [productsData, oddsData, checklistData] = await Promise.all([
            fetchSheet('products'),
            fetchSheet('odds'),
            fetchSheet('checklist')
        ]);
        PRODUCTS = processProducts(productsData);
        ODDS_RAW = oddsData;
        CHECKLIST = checklistData;
        console.log('✓ Data loaded from Google Sheets');
        return true;
    } catch (error) {
        console.error('✗ Failed to load from Google Sheets:', error.message);
        return false;
    }
}

// Data accessors
export function getAvailableSports() {
    const sports = new Set();
    Object.values(PRODUCTS).forEach(p => sports.add(p.sport));
    return Array.from(sports).sort();
}

export function getYearsBySport(sport) {
    const years = new Set();
    Object.values(PRODUCTS).filter(p => p.sport === sport).forEach(p => years.add(p.year));
    return Array.from(years).sort((a, b) => b.localeCompare(a));
}

export function getProducts(sport, year) {
    return Object.entries(PRODUCTS)
        .filter(([id, p]) => p.sport === sport && p.year === year)
        .map(([id, p]) => ({ id, ...p }));
}

export function getAvailableConfigs(productId) {
    const configs = new Set();
    ODDS_RAW.filter(row => row.product_id === productId).forEach(row => configs.add(row.config));
    return Array.from(configs);
}

export function formatOddsValue(odds) {
    if (!odds) return null;
    const str = String(odds).trim();
    // Filter out spreadsheet errors
    if (str.startsWith('#') || str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
        return null;
    }
    // Return the value as-is - user enters the actual ratio like "1:4" or "2:1"
    return str;
}

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
    ODDS_RAW.filter(row => row.product_id === productId && (row.category === 'autograph_relic' || row.category === 'autograph relic')).forEach(row => {
        const name = row.card_type;
        if (!autoRelics.has(name)) autoRelics.set(name, {});
        autoRelics.get(name)[row.config] = row.odds ? formatOddsValue(row.odds) : null;
    });
    return autoRelics;
}
