import { PRODUCTS, ODDS_RAW, CHECKLIST, getOddsForProduct, getAvailableConfigs, getAllParallelsForProduct, getAllAutographsForProduct, formatOddsValue, getConfigInfo } from './data.js';
import { parseOdds } from './utils.js';

// Helper to get display name for a card row
// For base parallels: use parallel name or "Standard" if empty
// For other categories: use card_type
function getCardDisplayName(row) {
    if (row.category === 'base') {
        return row.parallel || 'Standard';
    }
    return row.card_type || row.parallel || 'Unknown';
}

// Improved Sleeper Hit - finds undervalued cards that aren't obvious
export function findSleeperHit(productId, config) {
    const odds = getOddsForProduct(productId, config);
    if (!odds.base_parallels || odds.base_parallels.length < 3) return null;

    const sorted = odds.base_parallels
        .filter(p => p.odds)
        .map(p => ({ ...p, oddsNum: parseOdds(p.odds) }))
        .sort((a, b) => b.oddsNum - a.oddsNum);

    if (sorted.length < 3) return null;

    // Skip the obvious choices (top 2 rarest) and look for hidden gems
    // Find cards in the "sweet spot" - rare but not the rarest, often overlooked
    const candidates = sorted.slice(2, Math.min(8, sorted.length));

    // Look for a card that's significantly rarer than the one after it
    for (let i = 0; i < candidates.length - 1; i++) {
        const current = candidates[i];
        const next = candidates[i + 1];

        // If this card is 2x+ rarer than next but gets overlooked
        if (current.oddsNum > next.oddsNum * 2 && current.oddsNum >= 50) {
            // Avoid generic/obvious names
            const obviousNames = ['gold', 'silver', 'base', 'common', 'refractor', 'prizm', 'chrome'];
            const isObvious = obviousNames.some(n => current.name.toLowerCase().includes(n));

            if (!isObvious) {
                return {
                    card: current.name,
                    odds: current.odds,
                    oddsNum: current.oddsNum,
                    reason: `Often overlooked - ${Math.round(current.oddsNum / next.oddsNum)}x rarer than ${next.name}`,
                    comparison: 'Hidden gem that collectors often undervalue'
                };
            }
        }
    }

    // Fallback: find mid-tier card with good value
    const midTier = sorted.find(p => p.oddsNum >= 30 && p.oddsNum <= 150);
    if (midTier) {
        return {
            card: midTier.name,
            odds: midTier.odds,
            oddsNum: midTier.oddsNum,
            reason: 'Solid mid-tier pull with good collectability',
            comparison: 'Not the flashiest, but a smart target'
        };
    }

    return null;
}

// Product Value Score (1-10)
export function calculateProductScore(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const configInfo = getConfigInfo(productId, config);
    const packsPerBox = configInfo.packs || 0;
    const allCards = ODDS_RAW.filter(r => r.product_id === productId && r.config === config && r.odds);

    if (allCards.length === 0) return null;

    // Calculate metrics
    const chaseCount = allCards.filter(r => parseOdds(r.odds) >= 200).length;
    const rareCount = allCards.filter(r => {
        const o = parseOdds(r.odds);
        return o >= 50 && o < 200;
    }).length;
    const autoOdds = allCards.find(r => r.category === 'autograph');

    // Score components (each 0-10, weighted)
    let varietyScore = Math.min(10, allCards.length / 5); // More variety = better
    let chaseScore = Math.min(10, chaseCount * 2); // Chase cards add excitement

    // Hit score uses log scale: 1:4=10, 1:16=8, 1:64=6, 1:256=4, 1:1024=2, 1:4096+=0
    let hitScore = 3; // Default if no autos
    if (autoOdds) {
        const oddsNum = parseOdds(autoOdds.odds);
        hitScore = Math.max(0, Math.min(10, 12 - Math.log2(oddsNum)));
    }

    let valueScore = Math.min(10, packsPerBox / 2); // More packs = better base value

    const totalScore = (varietyScore * 0.2 + chaseScore * 0.3 + hitScore * 0.3 + valueScore * 0.2);

    return {
        score: Math.round(totalScore * 10) / 10,
        maxScore: 10,
        breakdown: {
            variety: Math.round(varietyScore * 10) / 10,
            chase: Math.round(chaseScore * 10) / 10,
            hits: Math.round(hitScore * 10) / 10,
            value: Math.round(valueScore * 10) / 10
        },
        verdict: totalScore >= 7 ? 'Excellent' : totalScore >= 5 ? 'Good' : totalScore >= 3 ? 'Average' : 'Below Average'
    };
}

// Variance/Risk Rating
export function calculateVariance(productId, config) {
    const allCards = ODDS_RAW.filter(r => r.product_id === productId && r.config === config && r.odds);
    if (allCards.length === 0) return null;

    const odds = allCards.map(r => parseOdds(r.odds)).filter(Boolean);
    const maxOdds = Math.max(...odds);
    const minOdds = Math.min(...odds);
    const spread = maxOdds / minOdds;

    // High spread = high variance (boom or bust)
    const chaseCards = odds.filter(o => o >= 200).length;
    const guaranteedHits = odds.filter(o => o <= 5).length;

    let riskLevel, description;
    if (spread > 500 && chaseCards >= 3) {
        riskLevel = 'High';
        description = 'Boom or bust - big swings between boxes';
    } else if (spread > 100) {
        riskLevel = 'Medium';
        description = 'Some variance - occasional big hits possible';
    } else {
        riskLevel = 'Low';
        description = 'Consistent pulls - predictable results';
    }

    return {
        riskLevel,
        description,
        spread: Math.round(spread),
        chaseCards,
        guaranteedHits
    };
}

// Break-even Calculator - boxes needed for X% chance of chase card
export function calculateBreakeven(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const configInfo = getConfigInfo(productId, config);
    const packsPerBox = configInfo.packs || 0;
    const chaseCards = ODDS_RAW.filter(r =>
        r.product_id === productId &&
        r.config === config &&
        r.odds &&
        parseOdds(r.odds) >= 200
    ).map(r => ({
        name: getCardDisplayName(r),
        odds: parseOdds(r.odds),
        oddsDisplay: formatOddsValue(r.odds)
    })).sort((a, b) => a.odds - b.odds);

    if (chaseCards.length === 0) return null;

    // For each chase card, calculate boxes for 50% probability
    const results = chaseCards.slice(0, 3).map(card => {
        // P(at least 1) = 1 - (1 - 1/odds)^packs
        // For 50%: 0.5 = 1 - (1 - 1/odds)^packs
        // packs = ln(0.5) / ln(1 - 1/odds)
        const packsNeeded = Math.log(0.5) / Math.log(1 - 1/card.odds);
        const boxesNeeded = Math.ceil(packsNeeded / packsPerBox);

        return {
            name: card.name,
            odds: card.oddsDisplay,
            boxesFor50: boxesNeeded,
            boxesFor75: Math.ceil((Math.log(0.25) / Math.log(1 - 1/card.odds)) / packsPerBox)
        };
    });

    return results;
}

// Config Comparison
export function compareConfigs(productId) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const configs = getAvailableConfigs(productId);
    if (configs.length < 2) return null;

    const comparison = configs.map(config => {
        const configInfo = getConfigInfo(productId, config);
        const packs = configInfo.packs || 0;

        const allOdds = ODDS_RAW.filter(r => r.product_id === productId && r.config === config && r.odds);
        const autoRow = allOdds.find(r => r.category === 'autograph');
        const chaseCount = allOdds.filter(r => parseOdds(r.odds) >= 100).length;

        // Calculate expected chase hits per box
        let expectedChase = 0;
        allOdds.filter(r => parseOdds(r.odds) >= 50).forEach(r => {
            expectedChase += packs / parseOdds(r.odds);
        });

        return {
            config,
            packs,
            autoOdds: autoRow ? formatOddsValue(autoRow.odds) : 'N/A',
            autoOddsNum: autoRow ? parseOdds(autoRow.odds) : Infinity,
            chaseCount,
            expectedChase: Math.round(expectedChase * 100) / 100
        };
    });

    // Find best for autos
    const bestAuto = comparison.reduce((a, b) => a.autoOddsNum < b.autoOddsNum ? a : b);

    return {
        configs: comparison,
        bestForAutos: bestAuto.config,
        insight: comparison.length === 2 ?
            `${comparison[0].config} has ${comparison[0].autoOddsNum < comparison[1].autoOddsNum ? 'better' : 'worse'} auto odds (${comparison[0].autoOdds} vs ${comparison[1].autoOdds})` :
            `${bestAuto.config} offers the best auto odds at ${bestAuto.autoOdds}`
    };
}

// Sweet Spot Analysis - optimal box count
export function findSweetSpot(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const configInfo = getConfigInfo(productId, config);
    const packsPerBox = configInfo.packs || 0;

    // Find the "signature" chase card (hardest auto or parallel)
    const allOdds = ODDS_RAW.filter(r => r.product_id === productId && r.config === config && r.odds);
    const targetCard = allOdds
        .map(r => ({ name: getCardDisplayName(r), odds: parseOdds(r.odds) }))
        .filter(r => r.odds >= 100 && r.odds <= 1000)
        .sort((a, b) => b.odds - a.odds)[0];

    if (!targetCard) return null;

    // Calculate probability at different box counts
    const boxCounts = [1, 3, 5, 10, 15, 20];
    const probabilities = boxCounts.map(boxes => {
        const packs = boxes * packsPerBox;
        const prob = 1 - Math.pow(1 - 1/targetCard.odds, packs);
        return { boxes, probability: Math.round(prob * 100) };
    });

    // Sweet spot is where you hit ~50% probability
    const sweetSpot = probabilities.find(p => p.probability >= 50) || probabilities[probabilities.length - 1];

    return {
        targetCard: targetCard.name,
        sweetSpotBoxes: sweetSpot.boxes,
        sweetSpotProb: sweetSpot.probability,
        probabilities,
        advice: sweetSpot.probability >= 50 ?
            `${sweetSpot.boxes} boxes gives you a coin flip (${sweetSpot.probability}%) at ${targetCard.name}` :
            `Even ${sweetSpot.boxes} boxes only gives ${sweetSpot.probability}% chance - this is a long shot!`
    };
}

// Set Completion Estimate
export function estimateSetCompletion(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return null;

    const configInfo = getConfigInfo(productId, config);
    const checklist = CHECKLIST.filter(r => r.product_id === productId);
    const baseCards = checklist.filter(r => !r.set_type || r.set_type === 'Base' || r.set_name === 'Base');

    if (baseCards.length === 0) return null;

    const cardsPerBox = (configInfo.packs || 0) * (configInfo.cardsPerPack || 0);

    // Using coupon collector's problem approximation
    // E[boxes] ≈ n * ln(n) / cardsPerBox where n = number of unique cards needed
    const n = baseCards.length;
    const expectedCards = n * (Math.log(n) + 0.5772); // Euler-Mascheroni constant
    const boxesNeeded = Math.ceil(expectedCards / cardsPerBox);

    return {
        baseSetSize: n,
        cardsPerBox,
        estimatedBoxes: boxesNeeded,
        note: `~${boxesNeeded} boxes to complete base set (statistical average, assumes no trading)`
    };
}

// Rookie Focus
export function getRookieInsights(productId, config) {
    const checklist = CHECKLIST.filter(r => r.product_id === productId);
    const rookies = checklist.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));

    if (rookies.length === 0) return null;

    const teams = [...new Set(rookies.map(r => r.team).filter(Boolean))];
    const topTeams = teams.slice(0, 3);

    return {
        totalRookies: rookies.length,
        rookiePercentage: Math.round((rookies.length / checklist.length) * 100),
        topTeams,
        highlight: rookies.length > 20 ? 'Rookie-heavy product!' : rookies.length > 10 ? 'Solid rookie selection' : 'Limited rookie content'
    };
}

// Rarest Card Spotlight
export function getWhaleCard(productId, config) {
    const allOdds = ODDS_RAW.filter(r => r.product_id === productId && r.config === config && r.odds);
    if (allOdds.length === 0) return null;

    const sorted = allOdds
        .map(r => ({
            name: getCardDisplayName(r),
            category: r.category,
            odds: formatOddsValue(r.odds),
            oddsNum: parseOdds(r.odds)
        }))
        .sort((a, b) => b.oddsNum - a.oddsNum);

    const whale = sorted[0];
    if (!whale || whale.oddsNum < 100) return null;

    const configInfo = getConfigInfo(productId, config);
    const packsPerBox = configInfo.packs || 24;

    const boxesFor50 = Math.ceil((Math.log(0.5) / Math.log(1 - 1/whale.oddsNum)) / packsPerBox);
    const boxesFor10 = Math.ceil((Math.log(0.9) / Math.log(1 - 1/whale.oddsNum)) / packsPerBox);

    return {
        name: whale.name,
        category: whale.category,
        odds: whale.odds,
        oddsNum: whale.oddsNum,
        boxesFor50Percent: boxesFor50,
        boxesFor10Percent: boxesFor10,
        context: whale.oddsNum >= 1000 ? 'True grail - case hit or rarer' :
                 whale.oddsNum >= 500 ? 'Case hit territory' :
                 whale.oddsNum >= 200 ? 'Box hit - expect 1 per few boxes' :
                 'Attainable chase card'
    };
}

// Parallel Ranking by value
export function rankParallels(productId, config) {
    const allOdds = ODDS_RAW.filter(r =>
        r.product_id === productId &&
        r.config === config &&
        r.category === 'base' &&
        r.odds
    );

    return allOdds
        .map(r => ({
            name: getCardDisplayName(r),
            odds: formatOddsValue(r.odds),
            oddsNum: parseOdds(r.odds),
            tier: parseOdds(r.odds) >= 200 ? 'chase' :
                  parseOdds(r.odds) >= 50 ? 'rare' :
                  parseOdds(r.odds) >= 10 ? 'uncommon' : 'common'
        }))
        .sort((a, b) => b.oddsNum - a.oddsNum);
}

// Legacy exports (keep for backward compatibility)
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
        name: getCardDisplayName(row),
        category: row.category,
        odds: formatOddsValue(row.odds),
        oddsNum: parseOdds(row.odds)
    })).filter(c => c.oddsNum && c.oddsNum >= 200).sort((a, b) => b.oddsNum - a.oddsNum).slice(0, 5);
}

export function calculateExpectedHits(productId, config) {
    const product = PRODUCTS[productId];
    if (!product) return [];
    const configInfo = getConfigInfo(productId, config);
    const totalPacks = configInfo.packs || 0;
    const filtered = ODDS_RAW.filter(row => row.product_id === productId && row.config === config && row.category === 'base' && row.odds);
    return filtered.map(row => {
        const odds = parseOdds(row.odds);
        if (!odds) return null;
        const expected = totalPacks / odds;
        return {
            name: getCardDisplayName(row),
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
        const item = { name: getCardDisplayName(row), category: row.category, odds: formatOddsValue(row.odds) };
        if (odds <= 10) tiers.common.push(item);
        else if (odds <= 50) tiers.uncommon.push(item);
        else if (odds <= 200) tiers.rare.push(item);
        else tiers.chase.push(item);
    });
    return tiers;
}
