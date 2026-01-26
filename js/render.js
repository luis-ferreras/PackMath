import { state } from './state.js';
import { PRODUCTS, ODDS_RAW, CHECKLIST, getAvailableConfigs, getOddsForProduct, getAllParallelsForProduct, getAllInsertsForProduct, getAllAutographsForProduct, getAllRelicsForProduct, getAllAutoRelicsForProduct, formatOddsValue, getConfigInfo } from './data.js';
import { parseOdds, formatOdds, getRarityColor, getRarityBg, getRarityTier, colors } from './utils.js';
import {
    findSleeperHit, findBestValueConfig, findChaseCards, calculateExpectedHits, groupByRarityTier,
    calculateProductScore, calculateVariance, calculateBreakeven, compareConfigs,
    findSweetSpot, estimateSetCompletion, getRookieInsights, getWhaleCard, rankParallels
} from './insights.js';

// Styles object for inline styling
const styles = {
    text: {
        primary: '#fafafa',
        secondary: '#a1a1aa',
        muted: '#71717a'
    },
    bg: {
        base: '#09090b',
        panel: '#18181b',
        widget: '#1f1f23',
        input: '#27272a'
    },
    border: '#2e2e33',
    accent: 'hsl(250, 70%, 60%)',
    accentMuted: 'hsl(250, 40%, 20%)'
};

// Widget helper
function widget(title, content, badge = null) {
    return `
        <div class="widget">
            <div class="widget-header">
                <span class="widget-title">${title}</span>
                ${badge ? `<span class="widget-badge">${badge}</span>` : ''}
            </div>
            <div class="widget-content">
                ${content}
            </div>
        </div>
    `;
}

// Full-width widget helper (for tables, etc.)
function widgetFullWidth(title, content, badge = null) {
    return `
        <div class="widget" style="width: 100%; margin-bottom: 16px;">
            <div class="widget-header">
                <span class="widget-title">${title}</span>
                ${badge ? `<span class="widget-badge">${badge}</span>` : ''}
            </div>
            <div class="widget-content">
                ${content}
            </div>
        </div>
    `;
}

// Product banner - full width above grid
function renderProductBanner() {
    const product = PRODUCTS[state.product];
    if (!product) return '';
    const configInfo = getConfigInfo(state.product, state.config);
    const packs = configInfo?.packs || 0;
    const cards = configInfo?.cardsPerPack || 0;
    const boxesPerCase = configInfo?.boxesPerCase || 0;
    const totalCards = packs * cards;

    // Config details string
    const configDetails = packs && cards
        ? `${packs} packs × ${cards} cards = ${totalCards} cards/box${boxesPerCase ? ` • ${boxesPerCase} boxes/case` : ''}`
        : '';

    return `
        <div class="product-banner" style="background: linear-gradient(135deg, ${styles.accentMuted} 0%, ${styles.bg.widget} 100%);
                    border: 1px solid ${styles.accent}40; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <h2 style="font-size: 18px; font-weight: 600; color: ${styles.text.primary}; margin: 0;">${product.name}</h2>
                <p style="color: ${styles.text.muted}; font-size: 12px; margin: 4px 0 0 0;">${product.sport} • ${product.brand} • ${product.year}</p>
            </div>
            <div style="text-align: right;">
                <div style="font-size: 13px; color: ${styles.text.muted};">
                    Box Type: <strong style="color: ${styles.accent}; text-transform: capitalize;">${state.config}</strong>
                </div>
                ${configDetails ? `<div style="font-size: 11px; color: ${styles.text.muted}; margin-top: 4px;">${configDetails}</div>` : ''}
            </div>
        </div>
    `;
}

// Compare View
export function renderCompareView() {
    const parallels = getAllParallelsForProduct(state.product);
    const inserts = getAllInsertsForProduct(state.product);
    const autographs = getAllAutographsForProduct(state.product);
    const relics = getAllRelicsForProduct(state.product);
    const autoRelics = getAllAutoRelicsForProduct(state.product);
    const configs = getAvailableConfigs(state.product);
    const subTab = state.compareTab || 'base';

    // Build tabs array - only show tabs that have data
    const allTabs = [
        { id: 'base', label: 'Parallels', count: parallels.size },
        { id: 'inserts', label: 'Inserts', count: inserts.size },
        { id: 'autos', label: 'Autos', count: autographs.size },
        { id: 'relics', label: 'Relics', count: relics.size },
        { id: 'auto_relics', label: 'Auto Relics', count: autoRelics.size }
    ].filter(tab => tab.count > 0);

    // Sub-tab buttons
    const tabButtons = `
        <div style="display: flex; gap: 4px; background: ${styles.bg.base}; padding: 4px; border-radius: 8px; margin-bottom: 12px; flex-wrap: wrap;">
            ${allTabs.map(tab => `
                <button onclick="setCompareTab('${tab.id}')"
                    style="flex: 1; min-width: 80px; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
                           border: none; cursor: pointer; transition: all 150ms;
                           background: ${subTab === tab.id ? styles.bg.input : 'transparent'};
                           color: ${subTab === tab.id ? styles.text.primary : styles.text.muted};">
                    ${tab.label} <span style="opacity: 0.6;">${tab.count}</span>
                </button>
            `).join('')}
        </div>
    `;

    // Get table data based on selected tab
    let dataMap, showSSP = false;
    switch (subTab) {
        case 'base':
            dataMap = parallels;
            break;
        case 'inserts':
            dataMap = inserts;
            showSSP = true;
            break;
        case 'autos':
            dataMap = autographs;
            break;
        case 'relics':
            dataMap = relics;
            break;
        case 'auto_relics':
            dataMap = autoRelics;
            break;
        default:
            dataMap = parallels;
    }

    // Build table (all rows, scrollable)
    const entries = Array.from(dataMap.entries());

    let tableContent = '';
    if (dataMap.size > 0) {
        tableContent = `
            <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">Green = best odds for that card across configs</p>
            <div style="height: calc(100vh - 380px); min-height: 300px; overflow-y: auto; overflow-x: auto; border-radius: 6px;">
                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                    <thead style="position: sticky; top: 0; background: ${styles.bg.widget}; z-index: 1;">
                        <tr style="border-bottom: 1px solid ${styles.border};">
                            <th style="text-align: left; padding: 10px 8px; color: ${styles.text.muted}; font-weight: 500;">Name</th>
                            ${configs.map(c => `<th style="text-align: center; padding: 10px 6px; color: ${styles.text.muted}; font-weight: 500; text-transform: capitalize; font-size: 11px;">${c}</th>`).join('')}
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
                                <tr style="border-bottom: 1px solid ${styles.border}30;"
                                    onmouseover="this.style.background='${styles.bg.input}'" onmouseout="this.style.background='transparent'">
                                    <td style="padding: 10px 8px; color: ${styles.text.primary}; font-size: 12px;">
                                        ${name}
                                        ${isSSP ? `<span style="margin-left: 6px; font-size: 9px; background: ${colors.orange}30; color: ${colors.orange}; padding: 2px 5px; border-radius: 3px;">SSP</span>` : ''}
                                    </td>
                                    ${configs.map(c => {
                                        const odds = configOdds[c];
                                        const isBest = c === bestConfig && configs.length > 1;
                                        const color = isBest ? colors.emerald : getRarityColor(odds);
                                        return `<td style="text-align: center; padding: 10px 6px;">
                                            <span style="font-family: monospace; font-size: 11px; color: ${color}; ${isBest ? 'font-weight: 600;' : ''}">
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
    } else {
        tableContent = `<p style="color: ${styles.text.muted}; text-align: center; padding: 24px; font-size: 13px;">No data for this category</p>`;
    }

    return widgetFullWidth('Compare Odds', tabButtons + tableContent, `${entries.length} cards`);
}

// Bubbles View
export function renderBubblesView() {
    const currentOdds = getOddsForProduct(state.product, state.config);
    if (!currentOdds.base_parallels) {
        return widget('Rarity Bubbles', `<p style="color: ${styles.text.muted}; text-align: center; padding: 32px;">No parallel data available for this config</p>`);
    }

    const bubbleData = currentOdds.base_parallels
        .filter(p => p.odds)
        .map(p => {
            const odds = parseOdds(p.odds);
            const tier = getRarityTier(p.odds);
            return { name: p.name, odds: p.odds, oddsNum: odds, tier: tier.name, color: tier.color };
        });

    window.bubbleChartData = bubbleData;
    setTimeout(() => renderBubbleChart(), 0);

    const legendItems = [
        { label: 'Common (1:1-10)', color: colors.emerald },
        { label: 'Uncommon (1:11-50)', color: colors.blue },
        { label: 'Rare (1:51-200)', color: colors.violet },
        { label: 'Chase (1:200+)', color: colors.orange }
    ];

    return widget('Rarity Bubbles', `
        <p style="color: ${styles.text.muted}; font-size: 12px; margin-bottom: 12px;">Bigger bubble = easier to pull. Drag to rearrange.</p>
        <div id="bubbleChart" style="width: 100%; height: 350px; background: ${styles.bg.base}; border-radius: 8px; overflow: hidden;"></div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 12px; font-size: 10px; color: ${styles.text.muted};">
            ${legendItems.map(item => `
                <span style="display: flex; align-items: center; gap: 5px;">
                    <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color};"></span>
                    ${item.label}
                </span>
            `).join('')}
        </div>
    `, `${bubbleData.length} parallels`);
}

function renderBubbleChart() {
    const data = window.bubbleChartData;
    if (!data || data.length === 0) return;

    const container = document.getElementById('bubbleChart');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    container.innerHTML = '';

    const colorMap = { emerald: colors.emerald, blue: colors.blue, violet: colors.violet, orange: colors.orange };

    const maxOdds = Math.max(...data.map(d => d.oddsNum));
    const minRadius = 18;
    const maxRadius = 55;

    data.forEach(d => {
        const logMax = Math.log(maxOdds + 1);
        const logOdds = Math.log(d.oddsNum + 1);
        d.radius = maxRadius - ((logOdds / logMax) * (maxRadius - minRadius));
        d.x = width / 2 + (Math.random() - 0.5) * 100;
        d.y = height / 2 + (Math.random() - 0.5) * 100;
    });

    const svg = d3.select('#bubbleChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const simulation = d3.forceSimulation(data)
        .force('charge', d3.forceManyBody().strength(8))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.radius + 4))
        .force('x', d3.forceX(width / 2).strength(0.05))
        .force('y', d3.forceY(height / 2).strength(0.05));

    const bubbles = svg.selectAll('g')
        .data(data)
        .enter()
        .append('g')
        .style('cursor', 'grab')
        .call(d3.drag()
            .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
            .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

    bubbles.append('circle')
        .attr('r', d => d.radius)
        .attr('fill', d => colorMap[d.color])
        .attr('fill-opacity', 0.7)
        .attr('stroke', d => colorMap[d.color])
        .attr('stroke-width', 2)
        .style('filter', 'url(#glow)');

    bubbles.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .attr('fill', 'white')
        .attr('font-size', d => Math.max(9, d.radius / 4.5))
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text(d => d.name.length > 10 ? d.name.slice(0, 8) + '…' : d.name);

    bubbles.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1em')
        .attr('fill', 'rgba(255,255,255,0.75)')
        .attr('font-size', d => Math.max(8, d.radius / 5))
        .attr('font-weight', '500')
        .attr('pointer-events', 'none')
        .text(d => d.odds);

    bubbles
        .on('mouseover', function(event, d) {
            d3.select(this).select('circle').transition().duration(150).attr('fill-opacity', 1).attr('r', d.radius * 1.1);
        })
        .on('mouseout', function(event, d) {
            d3.select(this).select('circle').transition().duration(150).attr('fill-opacity', 0.7).attr('r', d.radius);
        });

    simulation.on('tick', () => {
        bubbles.attr('transform', d => {
            d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
            d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
            return `translate(${d.x},${d.y})`;
        });
    });
}

// Calculator View - Target Card Hunter, Probability Milestones, Scenario Analysis
export function renderCalculatorView() {
    const product = PRODUCTS[state.product];
    const configInfo = getConfigInfo(state.product, state.config);
    const packsPerBox = configInfo.packs || 0;
    const cardsPerPack = configInfo.cardsPerPack || 0;
    const boxesPerCase = configInfo.boxesPerCase || 0;
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

    // --- Box Control Widget ---
    const boxControlWidget = widget('Box Calculator', `
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
            <div style="flex: 1;">
                <label style="font-size: 11px; color: ${styles.text.muted};">Boxes</label>
                <div style="display: flex; align-items: center; gap: 12px; margin-top: 4px;">
                    <input type="range" min="1" max="20" value="${boxCount}" onchange="setBoxCount(parseInt(this.value))"
                        style="flex: 1; height: 4px; border-radius: 2px; background: ${styles.bg.input}; cursor: pointer; accent-color: ${colors.emerald};">
                    <span style="font-size: 20px; font-weight: 700; color: ${styles.text.primary}; min-width: 30px;">${boxCount}</span>
                </div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center; padding: 12px; background: ${styles.bg.base}; border-radius: 8px;">
            <div>
                <div style="font-size: 18px; font-weight: 700; color: ${colors.emerald};">${totalPacks}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">PACKS</div>
            </div>
            <div>
                <div style="font-size: 18px; font-weight: 700; color: ${styles.text.primary};">${cardsPerPack}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">CARDS/PACK</div>
            </div>
            <div>
                <div style="font-size: 18px; font-weight: 700; color: ${styles.text.primary};">${totalCards}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">TOTAL CARDS</div>
            </div>
            <div>
                <div style="font-size: 18px; font-weight: 700; color: ${colors.blue};">${boxesPerCase || '—'}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">BOXES/CASE</div>
            </div>
        </div>
    `, `${boxCount} box${boxCount > 1 ? 'es' : ''}`);

    // --- TARGET CARD HUNTER ---
    const targetCard = state.calcTargetCard ? allCards.find(c => c.name === state.calcTargetCard) : null;

    // Calculate boxes needed for probability thresholds
    function boxesForProb(odds, targetProb) {
        if (!odds || odds <= 0 || !packsPerBox) return '—';
        const packsNeeded = Math.log(1 - targetProb) / Math.log(1 - (1 / odds));
        return Math.ceil(packsNeeded / packsPerBox);
    }

    let targetContent = '';
    if (targetCard) {
        const prob50 = boxesForProb(targetCard.odds, 0.5);
        const prob75 = boxesForProb(targetCard.odds, 0.75);
        const prob90 = boxesForProb(targetCard.odds, 0.9);
        const prob99 = boxesForProb(targetCard.odds, 0.99);
        const currentProb = 1 - Math.pow(1 - (1 / targetCard.odds), totalPacks);
        const currentProbPct = (currentProb * 100).toFixed(1);
        const currentColor = currentProb >= 0.5 ? colors.emerald : currentProb >= 0.1 ? colors.amber : colors.red;
        const catLabel = targetCard.category ? targetCard.category.charAt(0).toUpperCase() + targetCard.category.slice(1) : '';

        targetContent = `
            <div style="margin-top: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 10px; background: ${styles.bg.base}; border-radius: 8px;">
                    <div>
                        <div style="font-size: 14px; font-weight: 700; color: ${styles.text.primary};">${targetCard.name}</div>
                        <div style="font-size: 10px; color: ${styles.text.muted};">${catLabel} • Odds: ${targetCard.oddsDisplay}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 22px; font-weight: 800; color: ${currentColor};">${currentProbPct}%</div>
                        <div style="font-size: 9px; color: ${styles.text.muted};">in ${boxCount} box${boxCount > 1 ? 'es' : ''}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
                    <div style="padding: 10px 4px; background: ${colors.amber}15; border: 1px solid ${colors.amber}30; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 800; color: ${colors.amber};">${prob50}</div>
                        <div style="font-size: 9px; color: ${styles.text.muted}; margin-top: 2px;">boxes for</div>
                        <div style="font-size: 11px; font-weight: 600; color: ${colors.amber};">50%</div>
                    </div>
                    <div style="padding: 10px 4px; background: ${colors.blue}15; border: 1px solid ${colors.blue}30; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 800; color: ${colors.blue};">${prob75}</div>
                        <div style="font-size: 9px; color: ${styles.text.muted}; margin-top: 2px;">boxes for</div>
                        <div style="font-size: 11px; font-weight: 600; color: ${colors.blue};">75%</div>
                    </div>
                    <div style="padding: 10px 4px; background: ${colors.violet}15; border: 1px solid ${colors.violet}30; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 800; color: ${colors.violet};">${prob90}</div>
                        <div style="font-size: 9px; color: ${styles.text.muted}; margin-top: 2px;">boxes for</div>
                        <div style="font-size: 11px; font-weight: 600; color: ${colors.violet};">90%</div>
                    </div>
                    <div style="padding: 10px 4px; background: ${colors.emerald}15; border: 1px solid ${colors.emerald}30; border-radius: 8px;">
                        <div style="font-size: 20px; font-weight: 800; color: ${colors.emerald};">${prob99}</div>
                        <div style="font-size: 9px; color: ${styles.text.muted}; margin-top: 2px;">boxes for</div>
                        <div style="font-size: 11px; font-weight: 600; color: ${colors.emerald};">99%</div>
                    </div>
                </div>
            </div>`;
    } else {
        targetContent = `
            <div style="text-align: center; padding: 24px 12px; color: ${styles.text.muted}; font-size: 12px;">
                Select a card above to see how many boxes you need
            </div>`;
    }

    // Group cards by category for the dropdown
    const cardsByCategory = {};
    allCards.forEach(c => {
        const cat = c.category || 'other';
        if (!cardsByCategory[cat]) cardsByCategory[cat] = [];
        cardsByCategory[cat].push(c);
    });
    const categoryOrder = ['base', 'insert', 'autograph', 'relic', 'autograph_relic', 'other'];
    const categoryLabels = { base: 'Base / Parallels', insert: 'Inserts', autograph: 'Autographs', relic: 'Relics', autograph_relic: 'Auto Relics', other: 'Other' };

    const targetWidget = widget('Target Card Hunter', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">Pick a card you're chasing — see exactly how many boxes to find it</p>
        <select onchange="setCalcTargetCard(this.value)" class="filter-select" style="width: 100%; font-size: 12px; padding: 8px;">
            <option value="" ${!state.calcTargetCard ? 'selected' : ''}>Choose a card...</option>
            ${categoryOrder.filter(cat => cardsByCategory[cat]).map(cat => `
                <optgroup label="${categoryLabels[cat] || cat}">
                    ${cardsByCategory[cat].map(c => `<option value="${c.name}" ${state.calcTargetCard === c.name ? 'selected' : ''}>${c.name} (${c.oddsDisplay})</option>`).join('')}
                </optgroup>
            `).join('')}
        </select>
        ${targetContent}
    `, targetCard ? targetCard.oddsDisplay : 'Pick a card');

    // --- PROBABILITY MILESTONES ---
    const chaseCards = allCards.filter(c => c.odds >= 50).slice(0, 12);
    const milestoneBoxes = [1, 2, 3, 5, 10, 15, 20];

    const milestonesWidget = chaseCards.length > 0 ? widgetFullWidth('Probability Milestones', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">Chance of pulling at least one — by box count</p>
        <div style="overflow-x: auto;">
            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid ${styles.border};">
                        <th style="text-align: left; padding: 8px 6px; color: ${styles.text.muted}; font-weight: 600; font-size: 10px; position: sticky; left: 0; background: ${styles.bg.widget}; z-index: 1;">Card</th>
                        <th style="text-align: center; padding: 8px 4px; color: ${styles.text.muted}; font-weight: 600; font-size: 10px;">Odds</th>
                        ${milestoneBoxes.map(b => `<th style="text-align: center; padding: 8px 4px; color: ${b === boxCount ? colors.emerald : styles.text.muted}; font-weight: 600; font-size: 10px; ${b === boxCount ? `background: ${colors.emerald}10;` : ''}">${b} box${b > 1 ? 'es' : ''}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${chaseCards.map(card => {
                        return `
                        <tr style="border-bottom: 1px solid ${styles.border}20;" onmouseover="this.style.background='${styles.bg.input}'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 8px 6px; color: ${styles.text.secondary}; font-size: 11px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; position: sticky; left: 0; background: inherit;">${card.name}</td>
                            <td style="text-align: center; padding: 8px 4px; font-family: monospace; color: ${styles.text.muted}; font-size: 10px;">${card.oddsDisplay}</td>
                            ${milestoneBoxes.map(b => {
                                const packs = packsPerBox * b;
                                const prob = 1 - Math.pow(1 - (1 / card.odds), packs);
                                const pct = (prob * 100);
                                const display = pct >= 99.5 ? '99%+' : pct >= 1 ? Math.round(pct) + '%' : pct >= 0.1 ? pct.toFixed(1) + '%' : '<0.1%';
                                const cellColor = pct >= 75 ? colors.emerald : pct >= 50 ? colors.blue : pct >= 25 ? colors.amber : pct >= 5 ? colors.orange : colors.red;
                                const opacity = Math.max(0.15, Math.min(0.5, pct / 100));
                                const isCurrentBox = b === boxCount;
                                return `<td style="text-align: center; padding: 8px 4px; font-family: monospace; font-size: 11px; font-weight: ${isCurrentBox ? '700' : '500'}; color: ${cellColor}; background: ${cellColor}${Math.round(opacity * 255).toString(16).padStart(2, '0')}; ${isCurrentBox ? `box-shadow: inset 0 0 0 1px ${colors.emerald}60;` : ''}">${display}</td>`;
                            }).join('')}
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <p style="margin-top: 8px; font-size: 9px; color: ${styles.text.muted}; text-align: center;">Highlighted column matches your box count • Cards with odds 1:50+</p>
    `, `${chaseCards.length} cards`) : '';

    // --- SCENARIO ANALYSIS ---
    // Categorize expected hits for the current box count
    const expected = allCards.map(card => {
        const exp = totalPacks / card.odds;
        const prob = 1 - Math.pow(1 - (1 / card.odds), totalPacks);
        return { ...card, expected: exp, prob };
    });

    // Guaranteed = expected >= 1, Likely = prob >= 50%, Possible = prob >= 10%, Longshot = rest
    const guaranteed = expected.filter(e => e.expected >= 1);
    const likely = expected.filter(e => e.expected < 1 && e.prob >= 0.5);
    const possible = expected.filter(e => e.prob < 0.5 && e.prob >= 0.1);
    const longshot = expected.filter(e => e.prob < 0.1 && e.prob >= 0.01);

    // Count by category
    function countByCategory(cards) {
        const cats = { base: 0, insert: 0, autograph: 0, relic: 0, other: 0 };
        cards.forEach(c => {
            const cat = (c.category || 'other').toLowerCase();
            if (cat === 'base') cats.base++;
            else if (cat === 'insert') cats.insert++;
            else if (cat === 'autograph' || cat === 'auto') cats.autograph++;
            else if (cat === 'relic') cats.relic++;
            else cats.other++;
        });
        return cats;
    }

    // Total expected hits by category
    function expectedByCategory(cards) {
        const cats = { base: 0, insert: 0, autograph: 0, relic: 0, other: 0 };
        cards.forEach(c => {
            const cat = (c.category || 'other').toLowerCase();
            if (cat === 'base') cats.base += c.expected;
            else if (cat === 'insert') cats.insert += c.expected;
            else if (cat === 'autograph' || cat === 'auto') cats.autograph += c.expected;
            else if (cat === 'relic') cats.relic += c.expected;
            else cats.other += c.expected;
        });
        return cats;
    }

    const guaranteedCats = expectedByCategory(guaranteed);
    const likelyCats = countByCategory(likely);
    const possibleCats = countByCategory(possible);
    const longshotCats = countByCategory(longshot);

    // Total expected hits
    const totalExpected = expected.reduce((sum, e) => sum + e.expected, 0);
    const totalExpInserts = expected.filter(e => (e.category || '').toLowerCase() === 'insert').reduce((sum, e) => sum + e.expected, 0);
    const totalExpAutos = expected.filter(e => (e.category || '').toLowerCase() === 'autograph' || (e.category || '').toLowerCase() === 'auto').reduce((sum, e) => sum + e.expected, 0);
    const totalExpRelics = expected.filter(e => (e.category || '').toLowerCase() === 'relic').reduce((sum, e) => sum + e.expected, 0);

    function scenarioSection(label, emoji, color, count, cats, description) {
        if (count === 0) return '';
        const catTags = [];
        if (cats.base) catTags.push(`<span style="font-size: 9px; padding: 2px 6px; background: ${styles.text.primary}20; color: ${styles.text.secondary}; border-radius: 3px;">Base: ${typeof cats.base === 'number' && cats.base % 1 !== 0 ? cats.base.toFixed(1) : cats.base}</span>`);
        if (cats.insert) catTags.push(`<span style="font-size: 9px; padding: 2px 6px; background: ${colors.blue}20; color: ${colors.blue}; border-radius: 3px;">Inserts: ${typeof cats.insert === 'number' && cats.insert % 1 !== 0 ? cats.insert.toFixed(1) : cats.insert}</span>`);
        if (cats.autograph) catTags.push(`<span style="font-size: 9px; padding: 2px 6px; background: ${colors.amber}20; color: ${colors.amber}; border-radius: 3px;">Autos: ${typeof cats.autograph === 'number' && cats.autograph % 1 !== 0 ? cats.autograph.toFixed(1) : cats.autograph}</span>`);
        if (cats.relic) catTags.push(`<span style="font-size: 9px; padding: 2px 6px; background: ${colors.emerald}20; color: ${colors.emerald}; border-radius: 3px;">Relics: ${typeof cats.relic === 'number' && cats.relic % 1 !== 0 ? cats.relic.toFixed(1) : cats.relic}</span>`);
        if (cats.other) catTags.push(`<span style="font-size: 9px; padding: 2px 6px; background: ${colors.violet}20; color: ${colors.violet}; border-radius: 3px;">Other: ${typeof cats.other === 'number' && cats.other % 1 !== 0 ? cats.other.toFixed(1) : cats.other}</span>`);

        return `
            <div style="padding: 12px; background: ${color}08; border: 1px solid ${color}25; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 16px;">${emoji}</span>
                        <div>
                            <div style="font-size: 12px; font-weight: 700; color: ${color};">${label}</div>
                            <div style="font-size: 9px; color: ${styles.text.muted};">${description}</div>
                        </div>
                    </div>
                    <div style="font-size: 18px; font-weight: 800; color: ${color};">${typeof count === 'number' && count % 1 !== 0 ? count.toFixed(1) : count}</div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">${catTags.join('')}</div>
            </div>`;
    }

    const scenarioWidget = widget('Scenario Analysis', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 12px;">What to expect from ${boxCount} box${boxCount > 1 ? 'es' : ''} (${totalPacks} packs)</p>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${scenarioSection('Guaranteed Hits', '🎯', colors.emerald, guaranteed.length > 0 ? totalExpected.toFixed(1) + ' total' : 0, guaranteedCats, 'Expected at least 1 of each')}
            ${scenarioSection('Likely Pulls', '🔥', colors.blue, likely.length, likelyCats, '50%+ chance per card')}
            ${scenarioSection('Possible Pulls', '🎲', colors.amber, possible.length, possibleCats, '10-50% chance per card')}
            ${scenarioSection('Longshots', '⭐', colors.orange, longshot.length, longshotCats, '1-10% chance per card')}
        </div>
        <div style="margin-top: 14px; padding: 10px; background: ${styles.bg.base}; border-radius: 8px;">
            <div style="font-size: 10px; font-weight: 600; color: ${styles.text.muted}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Expected Hits Summary</div>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; text-align: center;">
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: ${styles.text.primary};">${totalExpected.toFixed(1)}</div>
                    <div style="font-size: 9px; color: ${styles.text.muted};">TOTAL</div>
                </div>
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: ${colors.blue};">${totalExpInserts.toFixed(1)}</div>
                    <div style="font-size: 9px; color: ${styles.text.muted};">INSERTS</div>
                </div>
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: ${colors.amber};">${totalExpAutos.toFixed(1)}</div>
                    <div style="font-size: 9px; color: ${styles.text.muted};">AUTOS</div>
                </div>
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: ${colors.emerald};">${totalExpRelics.toFixed(1)}</div>
                    <div style="font-size: 9px; color: ${styles.text.muted};">RELICS</div>
                </div>
            </div>
        </div>
        <p style="margin-top: 10px; font-size: 9px; color: ${styles.text.muted}; text-align: center;">Statistical averages • Actual results vary</p>
    `, `${boxCount} box${boxCount > 1 ? 'es' : ''}`);

    return boxControlWidget + targetWidget + milestonesWidget + scenarioWidget;
}


// Insights View - Comprehensive
export function renderInsightsView() {
    const productScore = calculateProductScore(state.product, state.config);
    const variance = calculateVariance(state.product, state.config);
    const breakeven = calculateBreakeven(state.product, state.config);
    const configComparison = compareConfigs(state.product);
    const sweetSpot = findSweetSpot(state.product, state.config);
    const setCompletion = estimateSetCompletion(state.product, state.config);
    const rookieInsights = getRookieInsights(state.product, state.config);
    const whaleCard = getWhaleCard(state.product, state.config);
    const sleeperHit = findSleeperHit(state.product, state.config);
    const parallelRanking = rankParallels(state.product, state.config);
    const tiers = groupByRarityTier(state.product, state.config);

    let widgets = '';

    // Product Score Widget - Featured
    if (productScore) {
        const scoreColor = productScore.score >= 7 ? colors.emerald : productScore.score >= 5 ? colors.amber : colors.red;
        widgets += `
            <div class="widget" style="background: linear-gradient(135deg, ${styles.bg.widget} 0%, ${scoreColor}15 100%); border: 1px solid ${scoreColor}40;">
                <div class="widget-header">
                    <span class="widget-title">Product Rating</span>
                    <span class="widget-badge">${productScore.verdict}</span>
                </div>
                <div class="widget-content">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="position: relative; width: 70px; height: 70px;">
                            <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none" stroke="${styles.bg.input}" stroke-width="3"/>
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                      fill="none" stroke="${scoreColor}" stroke-width="3"
                                      stroke-dasharray="${productScore.score * 10}, 100"/>
                            </svg>
                            <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 18px; font-weight: 700; color: ${scoreColor};">${productScore.score}</span>
                            </div>
                        </div>
                        <div style="flex: 1; display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; font-size: 10px;">
                            <div style="display: flex; justify-content: space-between;"><span style="color: ${styles.text.muted};">Variety</span><span style="color: ${styles.text.primary};">${productScore.breakdown.variety}/10</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: ${styles.text.muted};">Chase</span><span style="color: ${styles.text.primary};">${productScore.breakdown.chase}/10</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: ${styles.text.muted};">Hits</span><span style="color: ${styles.text.primary};">${productScore.breakdown.hits}/10</span></div>
                            <div style="display: flex; justify-content: space-between;"><span style="color: ${styles.text.muted};">Value</span><span style="color: ${styles.text.primary};">${productScore.breakdown.value}/10</span></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Variance/Risk Widget
    if (variance) {
        const riskColor = variance.riskLevel === 'High' ? colors.red : variance.riskLevel === 'Medium' ? colors.amber : colors.emerald;
        const riskIcon = variance.riskLevel === 'High' ? '🎰' : variance.riskLevel === 'Medium' ? '⚖️' : '📊';
        widgets += widget('Risk Profile', `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <span style="font-size: 24px;">${riskIcon}</span>
                <div>
                    <div style="font-size: 16px; font-weight: 700; color: ${riskColor};">${variance.riskLevel} Variance</div>
                    <div style="font-size: 11px; color: ${styles.text.muted};">${variance.description}</div>
                </div>
            </div>
            <div style="display: flex; gap: 12px; font-size: 10px; color: ${styles.text.muted};">
                <span>Chase cards: <strong style="color: ${styles.text.primary};">${variance.chaseCards}</strong></span>
                <span>Guaranteed: <strong style="color: ${styles.text.primary};">${variance.guaranteedHits}</strong></span>
            </div>
        `, variance.riskLevel);
    }

    // Whale Card Spotlight
    if (whaleCard) {
        widgets += `
            <div class="widget" style="background: linear-gradient(135deg, ${colors.violet}20 0%, ${styles.bg.widget} 100%); border: 1px solid ${colors.violet}40;">
                <div class="widget-header">
                    <span class="widget-title">🐋 The Whale</span>
                    <span class="widget-badge">${whaleCard.context}</span>
                </div>
                <div class="widget-content">
                    <div style="font-size: 15px; font-weight: 700; color: ${styles.text.primary}; margin-bottom: 4px;">${whaleCard.name}</div>
                    <div style="font-size: 20px; font-weight: 700; color: ${colors.violet}; margin-bottom: 8px;">${whaleCard.odds}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                        <div style="background: ${styles.bg.base}; padding: 8px; border-radius: 6px; text-align: center;">
                            <div style="color: ${styles.text.muted};">50% chance</div>
                            <div style="font-weight: 600; color: ${colors.amber};">${whaleCard.boxesFor50Percent} boxes</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px; border-radius: 6px; text-align: center;">
                            <div style="color: ${styles.text.muted};">10% chance</div>
                            <div style="font-weight: 600; color: ${colors.emerald};">${whaleCard.boxesFor10Percent} boxes</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Sleeper Hit Widget
    if (sleeperHit) {
        widgets += `
            <div class="widget" style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%); border: none;">
                <div class="widget-content" style="padding: 14px;">
                    <div style="display: flex; align-items: flex-start; gap: 10px;">
                        <div style="font-size: 24px;">💤</div>
                        <div>
                            <div style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #78350f; font-weight: 600;">Sleeper Hit</div>
                            <div style="font-size: 14px; font-weight: 700; color: #1c1917; margin-top: 2px;">${sleeperHit.card}</div>
                            <div style="color: #78350f; font-weight: 600; font-size: 12px;">${sleeperHit.odds}</div>
                            <p style="color: #92400e; font-size: 11px; margin-top: 4px;">${sleeperHit.reason}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Sweet Spot Analysis
    if (sweetSpot) {
        widgets += widget('Sweet Spot', `
            <div style="margin-bottom: 10px;">
                <div style="font-size: 11px; color: ${styles.text.muted}; margin-bottom: 4px;">Target: ${sweetSpot.targetCard}</div>
                <div style="font-size: 13px; color: ${styles.text.secondary};">${sweetSpot.advice}</div>
            </div>
            <div style="display: flex; gap: 4px; align-items: end;">
                ${sweetSpot.probabilities.slice(0, 5).map(p => `
                    <div style="flex: 1; text-align: center;">
                        <div style="height: ${Math.max(8, p.probability * 0.6)}px; background: ${p.probability >= 50 ? colors.emerald : colors.blue}; border-radius: 3px 3px 0 0; margin-bottom: 4px;"></div>
                        <div style="font-size: 9px; color: ${styles.text.muted};">${p.boxes}box</div>
                        <div style="font-size: 10px; font-weight: 600; color: ${p.probability >= 50 ? colors.emerald : styles.text.secondary};">${p.probability}%</div>
                    </div>
                `).join('')}
            </div>
        `, `${sweetSpot.sweetSpotBoxes} boxes`);
    }

    // Break-even Calculator
    if (breakeven && breakeven.length > 0) {
        widgets += widget('Break-even Analysis', `
            <p style="font-size: 10px; color: ${styles.text.muted}; margin-bottom: 10px;">Boxes needed for 50% chance at chase cards</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${breakeven.map(b => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: ${styles.bg.base}; border-radius: 6px;">
                        <span style="color: ${styles.text.secondary}; font-size: 12px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.name}</span>
                        <div style="text-align: right;">
                            <span style="font-weight: 600; color: ${colors.amber};">${b.boxesFor50} boxes</span>
                            <span style="font-size: 10px; color: ${styles.text.muted}; margin-left: 4px;">(${b.odds})</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `, 'Chase odds');
    }

    // Config Comparison
    if (configComparison && configComparison.configs.length >= 2) {
        widgets += widget('Config Showdown', `
            <div style="display: grid; grid-template-columns: repeat(${configComparison.configs.length}, 1fr); gap: 8px; margin-bottom: 10px;">
                ${configComparison.configs.map(c => {
                    const info = getConfigInfo(state.product, c.config);
                    const cardsPerPack = info?.cardsPerPack || 0;
                    const boxesPerCase = info?.boxesPerCase || 0;
                    const totalCards = c.packs * cardsPerPack;
                    const isBest = c.config === configComparison.bestForAutos;
                    return `
                    <div style="text-align: center; padding: 12px 8px; background: ${isBest ? colors.emerald + '15' : styles.bg.base}; border-radius: 6px; border: 1px solid ${isBest ? colors.emerald + '40' : 'transparent'};">
                        <div style="font-size: 12px; font-weight: 600; color: ${styles.text.primary}; text-transform: capitalize; margin-bottom: 8px;">${c.config}</div>
                        <div style="font-size: 10px; color: ${styles.text.muted}; line-height: 1.6;">
                            <div>${c.packs} packs × ${cardsPerPack} cards</div>
                            <div style="font-weight: 600; color: ${styles.text.secondary};">${totalCards} cards/box</div>
                            ${boxesPerCase ? `<div>${boxesPerCase} boxes/case</div>` : ''}
                        </div>
                        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${styles.border};">
                            <div style="font-size: 10px; color: ${styles.text.muted};">Auto Odds</div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isBest ? colors.emerald : styles.text.primary};">${c.autoOdds}</div>
                        </div>
                    </div>
                `}).join('')}
            </div>
            <p style="font-size: 11px; color: ${styles.text.secondary}; text-align: center;">💡 ${configComparison.insight}</p>
        `, 'vs');
    }

    // Rookie Insights
    if (rookieInsights) {
        widgets += widget('Rookie Report', `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                <div style="font-size: 28px; font-weight: 700; color: ${colors.orange};">${rookieInsights.totalRookies}</div>
                <div>
                    <div style="font-size: 12px; color: ${styles.text.primary};">Rookies in set</div>
                    <div style="font-size: 11px; color: ${styles.text.muted};">${rookieInsights.rookiePercentage}% of checklist</div>
                </div>
            </div>
            <div style="padding: 8px; background: ${colors.orange}15; border-radius: 6px; font-size: 11px; color: ${colors.orange};">
                ${rookieInsights.highlight}
            </div>
        `, `${rookieInsights.rookiePercentage}%`);
    }

    // Set Completion Estimate
    if (setCompletion) {
        widgets += widget('Set Builder', `
            <div style="text-align: center; margin-bottom: 10px;">
                <div style="font-size: 11px; color: ${styles.text.muted};">Base set size</div>
                <div style="font-size: 24px; font-weight: 700; color: ${styles.text.primary};">${setCompletion.baseSetSize} cards</div>
            </div>
            <div style="padding: 10px; background: ${styles.bg.base}; border-radius: 6px; text-align: center;">
                <div style="font-size: 10px; color: ${styles.text.muted};">Estimated to complete</div>
                <div style="font-size: 16px; font-weight: 600; color: ${colors.blue};">~${setCompletion.estimatedBoxes} boxes</div>
                <div style="font-size: 9px; color: ${styles.text.muted}; margin-top: 4px;">(${setCompletion.cardsPerBox} cards/box avg)</div>
            </div>
        `, 'Collector');
    }

    // Parallel Ranking
    if (parallelRanking && parallelRanking.length > 0) {
        const topParallels = parallelRanking.slice(0, 8);
        widgets += widget('Parallel Hierarchy', `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                ${topParallels.map((p, i) => {
                    const tierColor = p.tier === 'chase' ? colors.orange : p.tier === 'rare' ? colors.violet : p.tier === 'uncommon' ? colors.blue : colors.emerald;
                    return `
                        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: ${i === 0 ? tierColor + '15' : 'transparent'}; border-radius: 4px;">
                            <span style="width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; background: ${tierColor}30; color: ${tierColor}; font-size: 10px; font-weight: 600; border-radius: 50%;">${i + 1}</span>
                            <span style="flex: 1; color: ${styles.text.secondary}; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
                            <span style="font-family: monospace; font-size: 10px; color: ${tierColor};">${p.odds}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `, `Top ${topParallels.length}`);
    }

    // Rarity Breakdown
    widgets += widget('Rarity Breakdown', `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
            <div style="text-align: center; padding: 8px; background: ${colors.emerald}15; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: 700; color: ${colors.emerald};">${tiers.common.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">Common</div>
            </div>
            <div style="text-align: center; padding: 8px; background: ${colors.blue}15; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: 700; color: ${colors.blue};">${tiers.uncommon.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">Uncommon</div>
            </div>
            <div style="text-align: center; padding: 8px; background: ${colors.violet}15; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: 700; color: ${colors.violet};">${tiers.rare.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">Rare</div>
            </div>
            <div style="text-align: center; padding: 8px; background: ${colors.orange}15; border-radius: 6px;">
                <div style="font-size: 16px; font-weight: 700; color: ${colors.orange};">${tiers.chase.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">Chase</div>
            </div>
        </div>
    `);

    return widgets;
}

// Checklist View - Simplified
export function renderChecklistView() {
    const productChecklist = CHECKLIST.filter(row => row.product_id === state.product);

    if (productChecklist.length === 0) {
        return widget('Checklist', `
            <div style="text-align: center; padding: 24px;">
                <div style="font-size: 36px; margin-bottom: 8px;">📋</div>
                <p style="color: ${styles.text.muted}; font-size: 13px;">No checklist data available</p>
            </div>
        `);
    }

    const totalCards = productChecklist.length;
    const baseSetCards = productChecklist.filter(c => {
        const setName = (c.set_name || '').trim();
        return setName === 'Base Set';
    });
    const insertCards = productChecklist.filter(c => {
        const setType = (c.set_type || '').toLowerCase().trim();
        return setType === 'insert';
    });
    const autoCards = productChecklist.filter(c => {
        const setType = (c.set_type || '').toLowerCase().trim();
        return setType === 'autograph' || setType === 'auto';
    });
    const relicCards = productChecklist.filter(c => {
        const setType = (c.set_type || '').toLowerCase().trim();
        return setType === 'relic';
    });
    const rookies = productChecklist.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));
    const sets = [...new Set(productChecklist.map(c => c.set_name || c.set_type).filter(Boolean))];
    const teams = [...new Set(productChecklist.map(c => c.team).filter(Boolean))].sort();

    const setFilter = state.checklistSet || 'all';
    const teamFilter = state.checklistTeam || 'all';
    const rookieFilter = state.checklistRookieOnly || false;
    const searchQuery = state.checklistSearch || '';

    let filteredChecklist = [...productChecklist];
    if (setFilter !== 'all') filteredChecklist = filteredChecklist.filter(c => (c.set_name || c.set_type) === setFilter);
    if (teamFilter !== 'all') filteredChecklist = filteredChecklist.filter(c => c.team === teamFilter);
    if (rookieFilter) filteredChecklist = filteredChecklist.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredChecklist = filteredChecklist.filter(c => (c.player?.toLowerCase().includes(query)) || (c.team?.toLowerCase().includes(query)));
    }

    // Stats & Filters Row - Side by side (50/50)
    const statsFiltersRow = `
        <div style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
            <div class="widget" style="flex: 1; min-width: 280px;">
                <div class="widget-header">
                    <span class="widget-title">Stats</span>
                </div>
                <div class="widget-content">
                    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; text-align: center;">
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${styles.text.primary};">${totalCards}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">CARDS</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${colors.violet};">${baseSetCards.length}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">SET SIZE</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${colors.blue};">${insertCards.length}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">INSERTS</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${colors.amber};">${autoCards.length}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">AUTOS</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${colors.emerald};">${relicCards.length}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">RELICS</div>
                        </div>
                        <div style="background: ${styles.bg.base}; padding: 8px 4px; border-radius: 6px;">
                            <div style="font-size: 16px; font-weight: 700; color: ${colors.orange};">${rookies.length}</div>
                            <div style="font-size: 8px; color: ${styles.text.muted};">ROOKIES</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="widget" style="flex: 1; min-width: 280px;">
                <div class="widget-header">
                    <span class="widget-title">Filters</span>
                </div>
                <div class="widget-content">
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <select onchange="setChecklistSet(this.value)" class="filter-select" style="width: 100%; font-size: 12px; padding: 8px;">
                                <option value="all" ${setFilter === 'all' ? 'selected' : ''}>All Sets</option>
                                ${sets.map(s => `<option value="${s}" ${setFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
                            </select>
                            <select onchange="setChecklistTeam(this.value)" class="filter-select" style="width: 100%; font-size: 12px; padding: 8px;">
                                <option value="all" ${teamFilter === 'all' ? 'selected' : ''}>All Teams</option>
                                ${teams.map(t => `<option value="${t}" ${teamFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                            </select>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="checklistSearchInput" placeholder="Search player..." value="${searchQuery}" oninput="setChecklistSearch(this.value)"
                                class="filter-select" style="flex: 1; font-size: 12px; padding: 8px;">
                            <label style="display: flex; align-items: center; gap: 5px; font-size: 11px; color: ${styles.text.secondary}; cursor: pointer; white-space: nowrap;">
                                <input type="checkbox" ${rookieFilter ? 'checked' : ''} onchange="setChecklistRookieOnly(this.checked)" style="accent-color: ${colors.emerald};">
                                RC only
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Sort the filtered checklist
    const sortBy = state.checklistSortBy || 'card_num';
    const sortDir = state.checklistSortDir || 'asc';
    const sortedChecklist = [...filteredChecklist].sort((a, b) => {
        let valA, valB;
        switch (sortBy) {
            case 'set':
                valA = (a.set_name || a.set_type || 'Base').toLowerCase();
                valB = (b.set_name || b.set_type || 'Base').toLowerCase();
                break;
            case 'card_num':
                valA = parseInt(a.card_num) || 9999;
                valB = parseInt(b.card_num) || 9999;
                break;
            case 'player':
                valA = (a.player || '').toLowerCase();
                valB = (b.player || '').toLowerCase();
                break;
            case 'team':
                valA = (a.team || '').toLowerCase();
                valB = (b.team || '').toLowerCase();
                break;
            default:
                valA = a.card_num;
                valB = b.card_num;
        }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // Sort indicator helper
    const sortArrow = (col) => {
        if (sortBy !== col) return '';
        return sortDir === 'asc' ? ' ▲' : ' ▼';
    };
    const headerStyle = (col) => `
        text-align: ${col === 'card_num' ? 'center' : 'left'};
        padding: 10px 8px;
        color: ${sortBy === col ? styles.accent : styles.text.muted};
        font-weight: 500;
        cursor: pointer;
        user-select: none;
        ${col === 'card_num' ? 'width: 60px;' : ''}
    `;

    // Cards List Widget - Full width with scrollable table (dynamic height)
    const cardsWidget = widgetFullWidth('Browse', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">${filteredChecklist.length} of ${totalCards} cards</p>
        <div style="height: calc(100vh - 380px); min-height: 300px; overflow-y: auto; overflow-x: auto; border-radius: 6px;">
            <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead style="position: sticky; top: 0; background: ${styles.bg.widget}; z-index: 1;">
                    <tr style="border-bottom: 1px solid ${styles.border};">
                        <th style="${headerStyle('set')}" onclick="setChecklistSort('set')">Set${sortArrow('set')}</th>
                        <th style="${headerStyle('card_num')}" onclick="setChecklistSort('card_num')">#${sortArrow('card_num')}</th>
                        <th style="${headerStyle('player')}" onclick="setChecklistSort('player')">Player${sortArrow('player')}</th>
                        <th style="${headerStyle('team')}" onclick="setChecklistSort('team')">Team${sortArrow('team')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedChecklist.length > 0 ? sortedChecklist.map(card => {
                        const isRookie = ['TRUE', 'true', '1', 'Yes', 'yes'].includes(card.rookie);
                        const setName = card.set_name || card.set_type || 'Base';
                        return `
                            <tr style="border-bottom: 1px solid ${styles.border}30;"
                                onmouseover="this.style.background='${styles.bg.input}'" onmouseout="this.style.background='transparent'">
                                <td style="padding: 10px 8px; color: ${styles.text.secondary}; font-size: 11px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${setName}
                                </td>
                                <td style="text-align: center; padding: 10px 8px; color: ${styles.text.muted}; font-family: monospace; font-size: 11px;">
                                    ${card.card_num || '-'}
                                </td>
                                <td style="padding: 10px 8px; color: ${styles.text.primary};">
                                    ${card.player || 'Unknown'}
                                    ${isRookie ? `<span style="margin-left: 6px; font-size: 9px; background: ${colors.orange}30; color: ${colors.orange}; padding: 2px 5px; border-radius: 3px;">RC</span>` : ''}
                                </td>
                                <td style="padding: 10px 8px; color: ${styles.text.muted}; font-size: 11px;">
                                    ${card.team || '-'}
                                </td>
                            </tr>
                        `;
                    }).join('') : `<tr><td colspan="4" style="text-align: center; color: ${styles.text.muted}; padding: 20px; font-size: 12px;">No cards match filters</td></tr>`}
                </tbody>
            </table>
        </div>
    `, `${filteredChecklist.length}`);

    return statsFiltersRow + cardsWidget;
}

// Main render function
export function renderProductContent() {
    const product = PRODUCTS[state.product];
    if (!product) {
        document.getElementById('productContent').innerHTML = widget('Error', `<p style="color: ${styles.text.muted};">No data available</p>`);
        return;
    }

    // Full-width product banner
    const banner = renderProductBanner();

    let viewContent = '';
    let isFullWidth = false;
    switch (state.view) {
        case 'bubbles': viewContent = renderBubblesView(); break;
        case 'calculator': viewContent = renderCalculatorView(); break;
        case 'checklist':
            viewContent = renderChecklistView();
            isFullWidth = true;
            break;
        case 'insights': viewContent = renderInsightsView(); break;
        default:
            viewContent = renderCompareView();
            isFullWidth = true;
            break;
    }

    // Banner always outside grid; Compare view also outside grid (full-width)
    if (isFullWidth) {
        document.getElementById('productContent').innerHTML = `
            ${banner}
            ${viewContent}
        `;
    } else {
        document.getElementById('productContent').innerHTML = `
            ${banner}
            <div class="widget-grid">
                ${viewContent}
            </div>
        `;
    }
}
