// Google Sheets Configuration
// Each data type has its own spreadsheet, with tabs for each year

export const SHEETS = {
    products: {
        id: '1K4mhDFB1X3l-NDINas885FM0s50voB9nlQI2rssUbJ4',
        name: 'Products'
    },
    configuration: {
        id: '1JtECxSnhnyTLAAH_NnZSbJdU6x2wWHvlgWOvm9NMYJY',
        name: 'Box Configuration'
    },
    odds: {
        id: '1kISedg6ukK8gL_0BUURKKScCTOkNcGYsYNEZTQU5c8s',
        name: 'Odds'
    },
    checklist: {
        id: '1Fg2HOJfQXo7p8J24YiilX2VTWhcs2uEao7x3NXZAE4Y',
        name: 'Checklist'
    }
};

// Year tabs to fetch from each sheet
// Add new years here as they become available
export const YEAR_TABS = [
    '2025-26'
    // '2024-25',
    // '2026-27',
];

export const DEFAULT_CONFIGS = {
    hobby: { name: 'Hobby Box', packs: 20, cardsPerPack: 4 },
    jumbo: { name: 'Jumbo Box', packs: 12, cardsPerPack: 13 },
    breaker: { name: 'Breaker Box', packs: 10, cardsPerPack: 20 },
    value: { name: 'Value Box', packs: 6, cardsPerPack: 6 },
    hanger: { name: 'Hanger Box', packs: 1, cardsPerPack: 30 },
    mega: { name: 'Mega Box', packs: 7, cardsPerPack: 5 }
};

// Build URL to fetch a specific tab from a specific sheet
export function getSheetURL(sheetKey, tabName) {
    const sheet = SHEETS[sheetKey];
    if (!sheet) {
        console.error(`Unknown sheet: ${sheetKey}`);
        return null;
    }
    return `https://docs.google.com/spreadsheets/d/${sheet.id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}
