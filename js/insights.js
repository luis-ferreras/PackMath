import { PRODUCTS, ODDS_RAW, getOddsForProduct, getAvailableConfigs, getAllParallelsForProduct, formatOddsValue } from './data.js';
import { parseOdds } from './utils.js';

export function findSleeperHit(productId, config) {
    const odds = getOddsForProduct(productId, config);
    if (odds.base_parallels && odds.base_parallels.length > 1) {
        const sorted = odds.base_parallels.filter(p => p.odds).sort((a, b) => parseOdds(b.odds) - parseOdds(a.odds));
        if (sorted.length >= 2) {
            const rarest = sorted[0];
            const secondRarest = sorted[1];
            const rarestOdds = parseOdds(rarest.odds);
            const secondOdds = parseOdds(secondRarest.odds);
            if (rarestOdds > secondOdds * 3) {
                return {
                    card: rarest.name,
                    odds: rarest.odds,
                    reason: `${Math.round(rarestOdds / secondOdds)}x rarer than ${secondRarest.name}`,
                    comparison: 'Overlooked parallel that\'s harder to pull than most realize'
                };
            }
        }
    }
    return null;
}

export function findBestValueConfig(productId, parallelName) {
    const configs = getAvailableConfigs(productId);
    let bestConfig = null;
    let bestOdds = Infinity;
    configs.forEach(config => {
        const row = ODDS_RAW.find(r => r.product_id === productId && r.config === config && (r.parallel === parallelName || r.card_type === parallelName));
        if (row && row.odds) {
            const odds = parseOdds(row.odds);
            if (odds && odds < bestOdds) { bestOdds = odds; bestConfig = config; }
        }
    });
    return bestConfig ? { config: bestConfig, odds: formatOddsValue(`1:${bestOdds}`) } : null;
}

export function findChaseCards(productId, config) {
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config && row.odds);
    return filtered.map(row => ({
        name: row.parallel || row.card_type,
        category: row.category,
        odds: formatOddsValue(row.odds),
        oddsNum: parseOdds(row.odds)
    })).filter(c => c.oddsNum && c.oddsNum >= 200).sort((a, b) => b.oddsNum - a.oddsNum).slice(0, 5);
}

export function calculateExpectedHits(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return [];
    const configInfo = product.configs[config];
    if (!configInfo) return [];
    // Use packs for calculation (odds are per pack, not per card)
    const totalPacks = configInfo.packs;
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config && row.category === 'base' && row.odds);
    return filtered.map(row => {
        const odds = parseOdds(row.odds);
        if (!odds) return null;
        const expected = totalPacks / odds;
        return {
            name: row.parallel || row.card_type,
            odds: formatOddsValue(row.odds),
            expected: expected,
            display: expected >= 1 ? expected.toFixed(1) : `${(expected * 100).toFixed(0)}%`
        };
    }).filter(Boolean).sort((a, b) => b.expected - a.expected);
}

export function groupByRarityTier(productId, config) {
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config && row.odds);
    const tiers = { common: [], uncommon: [], rare: [], chase: [] };
    filtered.forEach(row => {
        const odds = parseOdds(row.odds);
        if (!odds) return;
        const item = { name: row.parallel || row.card_type, category: row.category, odds: formatOddsValue(row.odds) };
        if (odds <= 10) tiers.common.push(item);
        else if (odds <= 50) tiers.uncommon.push(item);
        else if (odds <= 200) tiers.rare.push(item);
        else tiers.chase.push(item);
    });
    return tiers;
}
