// Google Sheets Configuration

// Master List - index of all products with their sheet IDs
// Published CSV URL for the master list
export const MASTER_LIST_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ6kdOB0F4zknv__ahr_Iks6PtD0-RztgqNJYVcMwrmMzKcycMD7cUCrLPmDXM7VpNlhvz0TbfW1KDh/pub?gid=0&single=true&output=csv';

// Legacy sheets (products and configuration still use the old system)
export const SHEETS = {
    products: {
        id: '1K4mhDFB1X3l-NDINas885FM0s50voB9nlQI2rssUbJ4',
        name: 'Products'
    },
    configuration: {
        id: '1JtECxSnhnyTLAAH_NnZSbJdU6x2wWHvlgWOvm9NMYJY',
        name: 'Box Configuration'
    }
};

// Build URL to fetch a specific tab from a product's sheet (using sheet ID and gid)
export function getProductSheetURL(sheetId, gid) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

// Year tabs to fetch from each sheet
// Each entry maps tab name to its gid (sheet ID within the spreadsheet)
// gid=0 is typically the first sheet
export const YEAR_TABS = {
    '2025-26': 0
    // '2024-25': 123456789,  // Add gid when creating new year tabs
    // '2026-27': 987654321,
};

export const DEFAULT_CONFIGS = {
    hobby: { name: 'Hobby Box', packs: 20, cardsPerPack: 4 },
    jumbo: { name: 'Jumbo Box', packs: 12, cardsPerPack: 13 },
    breaker: { name: 'Breaker Box', packs: 10, cardsPerPack: 20 },
    value: { name: 'Value Box', packs: 6, cardsPerPack: 6 },
    hanger: { name: 'Hanger Box', packs: 1, cardsPerPack: 30 },
    mega: { name: 'Mega Box', packs: 7, cardsPerPack: 5 }
};

// Build URL to fetch a specific tab from a specific sheet
// Uses /export?format=csv&gid= which is more reliable than gviz endpoint
export function getSheetURL(sheetKey, tabName) {
    const sheet = SHEETS[sheetKey];
    if (!sheet) {
        console.error(`Unknown sheet: ${sheetKey}`);
        return null;
    }
    const gid = YEAR_TABS[tabName];
    if (gid === undefined) {
        console.error(`Unknown tab: ${tabName}`);
        return null;
    }
    return `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv&gid=${gid}`;
}
