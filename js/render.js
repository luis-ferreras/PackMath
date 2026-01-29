import { state } from './state.js';
import {
    getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs,
    getConfigInfo, getProductStats, getChecklistForProduct,
    getAllParallelsForProduct, getAllInsertsForProduct, getAllAutographsForProduct,
    getAllRelicsForProduct, getAllAutoRelicsForProduct, formatOddsValue, ODDS_RAW
} from './data.js';
import { parseOdds, getRarityColor, colors } from './utils.js';

// ========================================
// Landing Page
// ========================================

export function renderLanding() {
    // Render sport pills
    const sports = getAvailableSports();
    const sportPillsHtml = sports.map(sport => `
        <button class="sport-pill ${state.sportFilter === sport ? 'active' : ''}" onclick="setSportFilter('${sport}')">
            ${sport}
        </button>
    `).join('');
    document.getElementById('sportPills').innerHTML = sportPillsHtml;

    // Render products
    const products = state.sportFilter ? searchProducts('', state.sportFilter) : getAllProducts();
    document.getElementById('landingProducts').innerHTML = renderProductGrid(products);
}

// ========================================
// Search Results
// ========================================

export function renderSearchResults() {
    const results = searchProducts(state.searchQuery, state.sportFilter);

    document.getElementById('searchQueryDisplay').textContent = `"${state.searchQuery}"`;
    document.getElementById('resultsCount').textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    document.getElementById('searchResults').innerHTML = renderProductGrid(results);
}

// ========================================
// Product Grid (shared)
// ========================================

function renderProductGrid(products) {
    if (products.length === 0) {
        return `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">?</div>
                <p class="empty-state-text">No products found</p>
            </div>
        `;
    }

    return products.map(product => {
        const configs = getAvailableConfigs(product.id);
        const configTags = configs.slice(0, 4).map(c => `<span class="config-tag">${c}</span>`).join('');
        const moreConfigs = configs.length > 4 ? `<span class="config-tag">+${configs.length - 4}</span>` : '';

        return `
            <div class="product-card" onclick="navigateToProduct('${product.id}')">
                <div class="product-card-header">
                    <div class="product-card-name">${product.name}</div>
                    <div class="product-card-meta">${product.sport} &bull; ${product.brand} &bull; ${product.year}</div>
                </div>
                <div class="product-card-configs">
                    ${configTags}${moreConfigs}
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// Product Page
// ========================================

export function renderProductPage() {
    renderProductHero();
    renderTabContent();
}

function renderProductHero() {
    const product = getProduct(state.product);
    if (!product) return;

    const configs = getAvailableConfigs(state.product);
    const configInfo = getConfigInfo(state.product, state.config);
    const stats = getProductStats(state.product, state.config);

    const packs = configInfo?.packs || 0;
    const cardsPerPack = configInfo?.cardsPerPack || 0;
    const boxesPerCase = configInfo?.boxesPerCase || 0;
    const totalCards = packs * cardsPerPack;

    // Config selector
    const configOptions = configs.map(c =>
        `<option value="${c}" ${c === state.config ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
    ).join('');

    document.getElementById('productHero').innerHTML = `
        <div class="hero-top">
            <div class="hero-info">
                <h1 class="hero-name">${product.name}</h1>
                <p class="hero-meta">${product.sport} &bull; ${product.brand} &bull; ${product.year}</p>
            </div>
            ${configs.length > 0 ? `
                <div class="hero-config-select">
                    <span class="config-label">Box Type</span>
                    <select class="config-select" onchange="setConfig(this.value)">
                        ${configOptions}
                    </select>
                </div>
            ` : ''}
        </div>

        ${packs && cardsPerPack ? `
            <div class="hero-details">
                <div class="hero-detail">
                    <div class="hero-detail-value">${packs}</div>
                    <div class="hero-detail-label">Packs</div>
                </div>
                <div class="hero-detail">
                    <div class="hero-detail-value">${cardsPerPack}</div>
                    <div class="hero-detail-label">Cards/Pack</div>
                </div>
                <div class="hero-detail">
                    <div class="hero-detail-value">${totalCards}</div>
                    <div class="hero-detail-label">Total Cards</div>
                </div>
                ${boxesPerCase ? `
                    <div class="hero-detail">
                        <div class="hero-detail-value">${boxesPerCase}</div>
                        <div class="hero-detail-label">Boxes/Case</div>
                    </div>
                ` : ''}
            </div>
        ` : ''}

        <div class="hero-stats">
            <div class="hero-stat parallels">
                <div class="hero-stat-value">${stats.parallels}</div>
                <div class="hero-stat-label">Parallels</div>
            </div>
            <div class="hero-stat inserts">
                <div class="hero-stat-value">${stats.inserts}</div>
                <div class="hero-stat-label">Inserts</div>
            </div>
            <div class="hero-stat autos">
                <div class="hero-stat-value">${stats.autographs}</div>
                <div class="hero-stat-label">Autos</div>
            </div>
            <div class="hero-stat relics">
                <div class="hero-stat-value">${stats.relics}</div>
                <div class="hero-stat-label">Relics</div>
            </div>
        </div>
    `;
}

// ========================================
// Tab Content Router
// ========================================

export function renderTabContent() {
    const container = document.getElementById('tabContent');

    switch (state.tab) {
        case 'compare':
            container.innerHTML = renderCompareTab();
            break;
        case 'rarity':
            container.innerHTML = renderRarityTab();
            break;
        case 'calculator':
            container.innerHTML = renderCalculatorTab();
            break;
        case 'checklist':
            container.innerHTML = renderChecklistTab();
            break;
        default:
            container.innerHTML = renderCompareTab();
    }
}

// ========================================
// Compare Tab
// ========================================

function renderCompareTab() {
    const parallels = getAllParallelsForProduct(state.product);
    const inserts = getAllInsertsForProduct(state.product);
    const autographs = getAllAutographsForProduct(state.product);
    const relics = getAllRelicsForProduct(state.product);
    const autoRelics = getAllAutoRelicsForProduct(state.product);
    const configs = getAvailableConfigs(state.product);
    const subTab = state.compareTab || 'base';

    // Build tabs array
    const allTabs = [
        { id: 'base', label: 'Parallels', count: parallels.size },
        { id: 'inserts', label: 'Inserts', count: inserts.size },
        { id: 'autos', label: 'Autos', count: autographs.size },
        { id: 'relics', label: 'Relics', count: relics.size },
        { id: 'auto_relics', label: 'Auto Relics', count: autoRelics.size }
    ].filter(tab => tab.count > 0);

    // Sub-tabs
    const tabButtonsHtml = `
        <div class="sub-tabs">
            ${allTabs.map(tab => `
                <button class="sub-tab ${subTab === tab.id ? 'active' : ''}" onclick="setCompareTab('${tab.id}')">
                    ${tab.label} <span class="sub-tab-count">${tab.count}</span>
                </button>
            `).join('')}
        </div>
    `;

    // Get data based on selected tab
    let dataMap, showSSP = false;
    switch (subTab) {
        case 'base': dataMap = parallels; break;
        case 'inserts': dataMap = inserts; showSSP = true; break;
        case 'autos': dataMap = autographs; break;
        case 'relics': dataMap = relics; break;
        case 'auto_relics': dataMap = autoRelics; break;
        default: dataMap = parallels;
    }

    if (dataMap.size === 0) {
        return tabButtonsHtml + `<div class="empty-state"><p class="empty-state-text">No data for this category</p></div>`;
    }

    const entries = Array.from(dataMap.entries());

    const tableHtml = `
        <p class="text-muted text-xs mb-2">Green = best odds for that card across configs</p>
        <div class="table-scroll">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        ${configs.map(c => `<th style="text-align: center; text-transform: capitalize;">${c}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([name, configOdds]) => {
                        let bestConfig = null;
                        let bestOddsNum = Infinity;
                        configs.forEach(c => {
                            if (configOdds[c]) {
                                const num = parseOdds(configOdds[c]);
                                if (num < bestOddsNum) { bestOddsNum = num; bestConfig = c; }
                            }
                        });
                        const isSSP = showSSP && configOdds.isSSP;
                        return `
                            <tr>
                                <td>
                                    ${name}
                                    ${isSSP ? '<span class="tag tag-ssp" style="margin-left: 6px;">SSP</span>' : ''}
                                </td>
                                ${configs.map(c => {
                                    const odds = configOdds[c];
                                    const isBest = c === bestConfig && configs.length > 1;
                                    const color = isBest ? colors.emerald : getRarityColor(odds);
                                    return `<td style="text-align: center;">
                                        <span class="mono" style="color: ${color}; ${isBest ? 'font-weight: 600;' : ''}">
                                            ${odds || '—'}
                                        </span>
                                    </td>`;
                                }).join('')}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    return tabButtonsHtml + tableHtml;
}

// ========================================
// Rarity Map Tab
// ========================================

function renderRarityTab() {
    const allCards = ODDS_RAW.filter(row =>
        row.product_id === state.product && row.config === state.config && row.odds
    ).map(row => ({
        name: row.parallel || row.card_type,
        category: row.category || 'other',
        odds: parseOdds(row.odds),
        oddsDisplay: formatOddsValue(row.odds)
    })).filter(c => c.odds).sort((a, b) => a.odds - b.odds);

    if (allCards.length === 0) {
        return `<div class="empty-state"><p class="empty-state-text">No odds data for this config</p></div>`;
    }

    // Bucket into tiers
    const tiers = [
        { key: 'common', label: 'Common', range: '1:1 – 1:10', color: colors.emerald, cards: [] },
        { key: 'uncommon', label: 'Uncommon', range: '1:11 – 1:50', color: colors.blue, cards: [] },
        { key: 'rare', label: 'Rare', range: '1:51 – 1:200', color: colors.violet, cards: [] },
        { key: 'chase', label: 'Chase', range: '1:200+', color: colors.orange, cards: [] }
    ];

    allCards.forEach(c => {
        if (c.odds <= 10) tiers[0].cards.push(c);
        else if (c.odds <= 50) tiers[1].cards.push(c);
        else if (c.odds <= 200) tiers[2].cards.push(c);
        else tiers[3].cards.push(c);
    });

    const categoryLabels = { base: 'Base', insert: 'Insert', autograph: 'Auto', relic: 'Relic', other: 'Other' };

    // Overview
    const overviewHtml = `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Rarity Distribution</span>
                <span class="widget-badge">${allCards.length} card types</span>
            </div>
            <div class="widget-content">
                <div style="display: flex; gap: 4px; height: 32px; border-radius: 8px; overflow: hidden; margin-bottom: 16px;">
                    ${tiers.filter(t => t.cards.length > 0).map(t => {
                        const pct = (t.cards.length / allCards.length * 100);
                        return `<div style="flex: ${t.cards.length}; background: ${t.color}; display: flex; align-items: center; justify-content: center; min-width: 28px;" title="${t.label}: ${t.cards.length}">
                            <span style="font-size: 11px; font-weight: 700; color: white;">${t.cards.length}</span>
                        </div>`;
                    }).join('')}
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
                    ${tiers.map(t => `
                        <div>
                            <div style="font-size: 20px; font-weight: 700; color: ${t.color};">${t.cards.length}</div>
                            <div class="text-muted text-xs">${t.label}</div>
                            <div class="text-muted" style="font-size: 10px;">${t.range}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Tier sections
    const tierSectionsHtml = tiers.filter(t => t.cards.length > 0).map(tier => `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">${tier.label} Tier</span>
                <span class="widget-badge">${tier.cards.length} cards</span>
            </div>
            <div class="widget-content">
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                    ${tier.cards.map(card => `
                        <div style="display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; background: ${tier.color}10; border: 1px solid ${tier.color}30; border-radius: 8px;">
                            <span style="font-size: 12px; color: var(--text-primary);">${card.name}</span>
                            <span class="mono" style="font-size: 11px; color: ${tier.color}; font-weight: 600;">${card.oddsDisplay}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');

    return overviewHtml + tierSectionsHtml;
}

// ========================================
// Calculator Tab
// ========================================

function renderCalculatorTab() {
    const configInfo = getConfigInfo(state.product, state.config);
    const packsPerBox = configInfo?.packs || 0;
    const cardsPerPack = configInfo?.cardsPerPack || 0;
    const boxesPerCase = configInfo?.boxesPerCase || 0;
    const boxCount = state.boxCount || 1;
    const totalPacks = packsPerBox * boxCount;
    const totalCards = totalPacks * cardsPerPack;

    const allCards = ODDS_RAW.filter(row =>
        row.product_id === state.product && row.config === state.config && row.odds
    ).map(row => ({
        name: row.parallel || row.card_type,
        category: row.category,
        odds: parseOdds(row.odds),
        oddsDisplay: formatOddsValue(row.odds)
    })).filter(c => c.odds).sort((a, b) => a.odds - b.odds);

    // Box control widget
    const boxControlHtml = `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Box Calculator</span>
                <span class="widget-badge">${boxCount} box${boxCount > 1 ? 'es' : ''}</span>
            </div>
            <div class="widget-content">
                <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
                    <input type="range" min="1" max="20" value="${boxCount}" onchange="setBoxCount(parseInt(this.value))"
                        style="flex: 1; accent-color: ${colors.emerald};">
                    <span style="font-size: 24px; font-weight: 700; min-width: 40px;">${boxCount}</span>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
                    <div>
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.emerald};">${totalPacks}</div>
                        <div class="text-muted text-xs">PACKS</div>
                    </div>
                    <div>
                        <div style="font-size: 20px; font-weight: 700;">${cardsPerPack}</div>
                        <div class="text-muted text-xs">CARDS/PACK</div>
                    </div>
                    <div>
                        <div style="font-size: 20px; font-weight: 700;">${totalCards}</div>
                        <div class="text-muted text-xs">TOTAL CARDS</div>
                    </div>
                    <div>
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.blue};">${boxesPerCase || '—'}</div>
                        <div class="text-muted text-xs">BOXES/CASE</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Target card hunter
    const targetCard = state.calcTargetCard ? allCards.find(c => c.name === state.calcTargetCard) : null;

    function boxesForProb(odds, targetProb) {
        if (!odds || odds <= 0 || !packsPerBox) return '—';
        const packsNeeded = Math.log(1 - targetProb) / Math.log(1 - (1 / odds));
        return Math.ceil(packsNeeded / packsPerBox);
    }

    let targetContentHtml = '';
    if (targetCard) {
        const currentProb = 1 - Math.pow(1 - (1 / targetCard.odds), totalPacks);
        const currentProbPct = (currentProb * 100).toFixed(1);
        const currentColor = currentProb >= 0.5 ? colors.emerald : currentProb >= 0.1 ? colors.amber : colors.red;

        targetContentHtml = `
            <div style="margin-top: 16px; padding: 16px; background: var(--bg-base); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <div>
                        <div style="font-weight: 600;">${targetCard.name}</div>
                        <div class="text-muted text-xs">Odds: ${targetCard.oddsDisplay}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 28px; font-weight: 700; color: ${currentColor};">${currentProbPct}%</div>
                        <div class="text-muted text-xs">in ${boxCount} box${boxCount > 1 ? 'es' : ''}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
                    <div style="padding: 12px; background: ${colors.amber}15; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.amber};">${boxesForProb(targetCard.odds, 0.5)}</div>
                        <div class="text-muted text-xs">50% chance</div>
                    </div>
                    <div style="padding: 12px; background: ${colors.blue}15; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.blue};">${boxesForProb(targetCard.odds, 0.75)}</div>
                        <div class="text-muted text-xs">75% chance</div>
                    </div>
                    <div style="padding: 12px; background: ${colors.violet}15; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.violet};">${boxesForProb(targetCard.odds, 0.9)}</div>
                        <div class="text-muted text-xs">90% chance</div>
                    </div>
                    <div style="padding: 12px; background: ${colors.emerald}15; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 700; color: ${colors.emerald};">${boxesForProb(targetCard.odds, 0.99)}</div>
                        <div class="text-muted text-xs">99% chance</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        targetContentHtml = `<div class="text-muted text-center mt-4">Select a card above to see probability</div>`;
    }

    // Group cards by category for dropdown
    const cardsByCategory = {};
    allCards.forEach(c => {
        const cat = c.category || 'other';
        if (!cardsByCategory[cat]) cardsByCategory[cat] = [];
        cardsByCategory[cat].push(c);
    });
    const categoryOrder = ['base', 'insert', 'autograph', 'relic', 'other'];
    const categoryLabels = { base: 'Parallels', insert: 'Inserts', autograph: 'Autographs', relic: 'Relics', other: 'Other' };

    const targetHunterHtml = `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Target Card Hunter</span>
            </div>
            <div class="widget-content">
                <p class="text-muted text-xs mb-2">Pick a card to see how many boxes you need</p>
                <select class="form-select" onchange="setCalcTargetCard(this.value)">
                    <option value="" ${!state.calcTargetCard ? 'selected' : ''}>Choose a card...</option>
                    ${categoryOrder.filter(cat => cardsByCategory[cat]).map(cat => `
                        <optgroup label="${categoryLabels[cat] || cat}">
                            ${cardsByCategory[cat].map(c => `<option value="${c.name}" ${state.calcTargetCard === c.name ? 'selected' : ''}>${c.name} (${c.oddsDisplay})</option>`).join('')}
                        </optgroup>
                    `).join('')}
                </select>
                ${targetContentHtml}
            </div>
        </div>
    `;

    // Probability milestones
    const chaseCards = allCards.filter(c => c.odds >= 50).slice(0, 10);
    const milestoneBoxes = [1, 2, 3, 5, 10];

    const milestonesHtml = chaseCards.length > 0 ? `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Probability Milestones</span>
                <span class="widget-badge">${chaseCards.length} chase cards</span>
            </div>
            <div class="widget-content">
                <div class="table-scroll" style="max-height: 350px;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Card</th>
                                <th style="text-align: center;">Odds</th>
                                ${milestoneBoxes.map(b => `<th style="text-align: center;">${b}box</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${chaseCards.map(card => `
                                <tr>
                                    <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.name}</td>
                                    <td style="text-align: center;" class="mono text-muted">${card.oddsDisplay}</td>
                                    ${milestoneBoxes.map(b => {
                                        const packs = packsPerBox * b;
                                        const prob = 1 - Math.pow(1 - (1 / card.odds), packs);
                                        const pct = (prob * 100);
                                        const display = pct >= 99.5 ? '99%+' : pct >= 1 ? Math.round(pct) + '%' : '<1%';
                                        const cellColor = pct >= 75 ? colors.emerald : pct >= 50 ? colors.blue : pct >= 25 ? colors.amber : colors.red;
                                        return `<td style="text-align: center; color: ${cellColor}; font-weight: 500;" class="mono">${display}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    ` : '';

    return `<div class="widget-grid">${boxControlHtml}${targetHunterHtml}</div>${milestonesHtml}`;
}

// ========================================
// Checklist Tab
// ========================================

function renderChecklistTab() {
    const checklist = getChecklistForProduct(state.product);

    if (checklist.length === 0) {
        return `<div class="empty-state"><p class="empty-state-text">No checklist data available</p></div>`;
    }

    const totalCards = checklist.length;
    const rookies = checklist.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));
    const sets = [...new Set(checklist.map(c => c.set_name || c.set_type).filter(Boolean))];
    const teams = [...new Set(checklist.map(c => c.team).filter(Boolean))].sort();

    const setFilter = state.checklistSet || 'all';
    const teamFilter = state.checklistTeam || 'all';
    const rookieFilter = state.checklistRookieOnly || false;
    const searchQuery = state.checklistSearch || '';

    // Apply filters
    let filtered = [...checklist];
    if (setFilter !== 'all') filtered = filtered.filter(c => (c.set_name || c.set_type) === setFilter);
    if (teamFilter !== 'all') filtered = filtered.filter(c => c.team === teamFilter);
    if (rookieFilter) filtered = filtered.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(c => (c.player?.toLowerCase().includes(q)) || (c.team?.toLowerCase().includes(q)));
    }

    // Sort
    const sortBy = state.checklistSortBy || 'card_num';
    const sortDir = state.checklistSortDir || 'asc';
    filtered.sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
            case 'set': valA = (a.set_name || a.set_type || '').toLowerCase(); valB = (b.set_name || b.set_type || '').toLowerCase(); break;
            case 'card_num': valA = parseInt(a.card_num) || 9999; valB = parseInt(b.card_num) || 9999; break;
            case 'player': valA = (a.player || '').toLowerCase(); valB = (b.player || '').toLowerCase(); break;
            case 'team': valA = (a.team || '').toLowerCase(); valB = (b.team || '').toLowerCase(); break;
            default: valA = a.card_num; valB = b.card_num;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const sortArrow = (col) => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

    // Filters widget
    const filtersHtml = `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Filters</span>
                <span class="widget-badge">${filtered.length} of ${totalCards}</span>
            </div>
            <div class="widget-content">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                    <select class="form-select" onchange="setChecklistSet(this.value)">
                        <option value="all" ${setFilter === 'all' ? 'selected' : ''}>All Sets</option>
                        ${sets.map(s => `<option value="${s}" ${setFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <select class="form-select" onchange="setChecklistTeam(this.value)">
                        <option value="all" ${teamFilter === 'all' ? 'selected' : ''}>All Teams</option>
                        ${teams.map(t => `<option value="${t}" ${teamFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 12px; align-items: center;">
                    <input type="text" class="form-input" id="checklistSearchInput" placeholder="Search player..." value="${searchQuery}" oninput="setChecklistSearch(this.value)" style="flex: 1;">
                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; white-space: nowrap;">
                        <input type="checkbox" class="form-checkbox" ${rookieFilter ? 'checked' : ''} onchange="setChecklistRookieOnly(this.checked)">
                        RC only
                    </label>
                </div>
            </div>
        </div>
    `;

    // Table
    const tableHtml = `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">Checklist</span>
            </div>
            <div class="widget-content" style="padding: 0;">
                <div class="table-scroll" style="max-height: 500px;">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th style="cursor: pointer;" onclick="setChecklistSort('set')">Set${sortArrow('set')}</th>
                                <th style="cursor: pointer; text-align: center; width: 60px;" onclick="setChecklistSort('card_num')">#${sortArrow('card_num')}</th>
                                <th style="cursor: pointer;" onclick="setChecklistSort('player')">Player${sortArrow('player')}</th>
                                <th style="cursor: pointer;" onclick="setChecklistSort('team')">Team${sortArrow('team')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.length > 0 ? filtered.map(card => {
                                const isRookie = ['TRUE', 'true', '1', 'Yes', 'yes'].includes(card.rookie);
                                return `
                                    <tr>
                                        <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.set_name || card.set_type || 'Base'}</td>
                                        <td style="text-align: center;" class="mono text-muted">${card.card_num || '-'}</td>
                                        <td>
                                            ${card.player || 'Unknown'}
                                            ${isRookie ? '<span class="tag tag-rc" style="margin-left: 6px;">RC</span>' : ''}
                                        </td>
                                        <td class="text-muted">${card.team || '-'}</td>
                                    </tr>
                                `;
                            }).join('') : '<tr><td colspan="4" class="text-center text-muted" style="padding: 24px;">No cards match filters</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    return filtersHtml + tableHtml;
}
