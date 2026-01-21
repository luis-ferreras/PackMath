// Odds parsing and formatting
// Converts any odds format to a "1 in X" number for calculations
// Examples: "1:4" -> 4, "2:1" -> 0.5, "1:50" -> 50, "3:1" -> 0.33
export function parseOdds(oddsStr) {
    if (!oddsStr) return null;

    // Handle string input
    const str = String(oddsStr).trim();

    // Filter out spreadsheet errors (#DIV/0!, #N/A, #REF!, #VALUE!, etc.)
    if (str.startsWith('#') || str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
        return null;
    }

    // If it contains a colon, parse as ratio
    if (str.includes(':')) {
        const parts = str.split(':');
        if (parts.length !== 2) return null;
        const [left, right] = parts.map(s => parseFloat(s.trim()));
        if (isNaN(left) || isNaN(right) || right === 0 || left === 0) return null;
        // "1:4" means 1 in 4, so return 4
        // "2:1" means 2 in 1, so return 0.5 (1 in 0.5)
        return right / left;
    }

    // If it's just a number, assume it's "1:X"
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) return num;

    return null;
}

export function formatOdds(oddsStr) {
    return oddsStr || '—';
}

// Color constants
const colors = {
    emerald: '#10b981',
    blue: '#3b82f6',
    violet: '#8b5cf6',
    amber: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444'
};

// Rarity helpers - return inline style colors
export function getRarityColor(oddsStr) {
    const odds = parseOdds(oddsStr);
    if (!odds || odds < 1) return colors.emerald;
    if (odds <= 20) return colors.emerald;
    if (odds <= 100) return colors.blue;
    if (odds <= 500) return colors.violet;
    if (odds <= 2000) return colors.amber;
    if (odds <= 10000) return colors.orange;
    return colors.red;
}

export function getRarityBg(oddsStr) {
    const odds = parseOdds(oddsStr);
    if (!odds || odds < 1) return colors.emerald;
    if (odds <= 20) return colors.emerald;
    if (odds <= 100) return colors.blue;
    if (odds <= 500) return colors.violet;
    if (odds <= 2000) return colors.amber;
    if (odds <= 10000) return colors.orange;
    return colors.red;
}

export function getRarityTier(oddsStr) {
    const odds = parseOdds(oddsStr);
    if (!odds || odds <= 10) return { name: 'Common', color: 'emerald', hex: colors.emerald };
    if (odds <= 50) return { name: 'Uncommon', color: 'blue', hex: colors.blue };
    if (odds <= 200) return { name: 'Rare', color: 'violet', hex: colors.violet };
    return { name: 'Chase', color: 'orange', hex: colors.orange };
}

// Export colors for use in other modules
export { colors };
