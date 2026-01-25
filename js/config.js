// Google Sheets Configuration
export const SHEET_ID = '1m_snihKKWJEGRfwaNdoIiR4-eMrO0YYmm7mnD_8HteQ';

export const SHEET_GIDS = {
    products: 0,
    odds: 2126001521,
    checklist: 444343756
};

export const DEFAULT_CONFIGS = {
    hobby: { name: 'Hobby Box', packs: 20, cardsPerPack: 4 },
    jumbo: { name: 'Jumbo Box', packs: 12, cardsPerPack: 13 },
    breaker: { name: 'Breaker Box', packs: 10, cardsPerPack: 20 },
    value: { name: 'Value Box', packs: 6, cardsPerPack: 6 },
    hanger: { name: 'Hanger Box', packs: 1, cardsPerPack: 30 },
    mega: { name: 'Mega Box', packs: 7, cardsPerPack: 5 }
};

export function getSheetURL(tabName) {
    const gid = SHEET_GIDS[tabName];
    if (gid !== undefined) {
        return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    }
    // Fetch by sheet name for sheets not in SHEET_GIDS
    return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}
