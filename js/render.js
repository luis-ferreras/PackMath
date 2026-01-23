import { state } from './state.js';
import { PRODUCTS, ODDS_RAW, CHECKLIST, getAvailableConfigs, getOddsForProduct, getAllParallelsForProduct, getAllInsertsForProduct, getAllAutographsForProduct, formatOddsValue } from './data.js';
import { parseOdds, formatOdds, getRarityColor, getRarityBg, getRarityTier, colors } from './utils.js';
import { findSleeperHit, findBestValueConfig, findChaseCards, calculateExpectedHits, groupByRarityTier } from './insights.js';

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
    return `
        <div class="product-banner" style="background: linear-gradient(135deg, ${styles.accentMuted} 0%, ${styles.bg.widget} 100%);
                    border: 1px solid ${styles.accent}40; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px;
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
                <h2 style="font-size: 18px; font-weight: 600; color: ${styles.text.primary}; margin: 0;">${product.name}</h2>
                <p style="color: ${styles.text.muted}; font-size: 12px; margin: 4px 0 0 0;">${product.sport} • ${product.brand} • ${product.year}</p>
            </div>
            <div style="display: flex; gap: 16px; font-size: 13px;">
                <span style="color: ${styles.text.muted};">Box Type: <strong style="color: ${styles.accent}; text-transform: capitalize;">${state.config}</strong></span>
            </div>
        </div>
    `;
}

// Compare View
export function renderCompareView() {
    const parallels = getAllParallelsForProduct(state.product);
    const inserts = getAllInsertsForProduct(state.product);
    const autographs = getAllAutographsForProduct(state.product);
    const configs = getAvailableConfigs(state.product);
    const subTab = state.compareTab || 'base';

    // Sub-tab buttons
    const tabButtons = `
        <div style="display: flex; gap: 4px; background: ${styles.bg.base}; padding: 4px; border-radius: 8px; margin-bottom: 12px;">
            ${[
                { id: 'base', label: 'Parallels', count: parallels.size },
                { id: 'inserts', label: 'Inserts', count: inserts.size },
                { id: 'autos', label: 'Autos', count: autographs.size }
            ].map(tab => `
                <button onclick="setCompareTab('${tab.id}')"
                    style="flex: 1; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
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
    if (subTab === 'base') {
        dataMap = parallels;
    } else if (subTab === 'inserts') {
        dataMap = inserts;
        showSSP = true;
    } else {
        dataMap = autographs;
    }

    // Build table (limit to 15 rows)
    const entries = Array.from(dataMap.entries());
    const limitedEntries = entries.slice(0, 15);
    const hasMore = entries.length > 15;

    let tableContent = '';
    if (dataMap.size > 0) {
        tableContent = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid ${styles.border};">
                            <th style="text-align: left; padding: 10px 8px; color: ${styles.text.muted}; font-weight: 500;">Name</th>
                            ${configs.map(c => `<th style="text-align: center; padding: 10px 6px; color: ${styles.text.muted}; font-weight: 500; text-transform: capitalize; font-size: 11px;">${c}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${limitedEntries.map(([name, configOdds]) => {
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
                                <tr style="border-bottom: 1px solid ${styles.border}30;">
                                    <td style="padding: 10px 8px; color: ${styles.text.primary}; font-size: 12px;">
                                        ${name.length > 25 ? name.slice(0, 22) + '...' : name}
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
            ${hasMore ? `<p style="text-align: center; color: ${styles.text.muted}; font-size: 11px; margin-top: 12px;">Showing 15 of ${entries.length} • Best odds highlighted in green</p>` :
                       `<p style="margin-top: 10px; font-size: 10px; color: ${styles.text.muted};">Green = best odds for that card</p>`}
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

// Calculator View - Simplified
export function renderCalculatorView() {
    const product = PRODUCTS[state.product];
    const configInfo = product.configs[state.config] || {};
    const packsPerBox = configInfo.packs || 0;
    const cardsPerPack = configInfo.cardsPerPack || 0;
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

    // Calculate expected hits using PACKS
    const expected = allCards.map(card => {
        const exp = totalPacks / card.odds;
        return { ...card, expected: exp, display: exp >= 1 ? exp.toFixed(1) : (exp * 100).toFixed(1) + '%' };
    });

    const tiers = { common: 0, uncommon: 0, rare: 0, chase: 0 };
    expected.forEach(e => {
        if (e.odds <= 10) tiers.common += e.expected;
        else if (e.odds <= 50) tiers.uncommon += e.expected;
        else if (e.odds <= 200) tiers.rare += e.expected;
        else tiers.chase += e.expected;
    });

    window.calculatorData = { tiers, totalPacks, totalCards, boxCount };
    setTimeout(() => renderDonutChart(), 0);

    const chaseCards = allCards.filter(c => c.odds >= 100).slice(0, 8);

    // Combined Box Stats + Donut Widget
    const mainWidget = widget('Box Calculator', `
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
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; padding: 12px; background: ${styles.bg.base}; border-radius: 8px;">
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
        </div>
    `, `${boxCount} box${boxCount > 1 ? 'es' : ''}`);

    // Donut Chart Widget
    const donutWidget = widget('Pull Distribution', `
        <div id="donutChart" style="width: 100%; height: 160px;"></div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px; text-align: center; font-size: 10px;">
            <div><div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.emerald}; margin: 0 auto 3px;"></div><div style="color: ${styles.text.muted};">Common</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.common.toFixed(1)}</div></div>
            <div><div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.blue}; margin: 0 auto 3px;"></div><div style="color: ${styles.text.muted};">Uncommon</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.uncommon.toFixed(1)}</div></div>
            <div><div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.violet}; margin: 0 auto 3px;"></div><div style="color: ${styles.text.muted};">Rare</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.rare.toFixed(1)}</div></div>
            <div><div style="width: 8px; height: 8px; border-radius: 50%; background: ${colors.orange}; margin: 0 auto 3px;"></div><div style="color: ${styles.text.muted};">Chase</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.chase.toFixed(2)}</div></div>
        </div>
    `);

    // Chase Odds Widget - Limited to 8
    const chaseOddsWidget = chaseCards.length > 0 ? widget('Chase Card Odds', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">Probability in ${totalPacks} packs</p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            ${chaseCards.map(card => {
                const prob = 1 - Math.pow(1 - (1 / card.odds), totalPacks);
                const probPercent = (prob * 100).toFixed(1);
                const barWidth = Math.min(100, prob * 100);
                const probColor = prob >= 0.5 ? colors.emerald : prob >= 0.1 ? colors.amber : colors.red;
                return `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                            <span style="color: ${styles.text.secondary}; font-size: 11px; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.name}</span>
                            <span style="font-family: monospace; font-size: 12px; color: ${probColor};">${probPercent}%</span>
                        </div>
                        <div style="height: 4px; background: ${styles.bg.input}; border-radius: 2px; overflow: hidden;">
                            <div style="height: 100%; width: ${barWidth}%; background: ${probColor}; border-radius: 2px;"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `, `Top ${chaseCards.length}`) : '';

    // Top Expected Hits - Limited to 10
    const topExpected = expected.filter(e => e.expected >= 0.01).slice(0, 10);
    const expectedWidget = widget('Expected Hits', `
        <div style="display: flex; flex-direction: column; gap: 6px;">
            ${topExpected.map(e => {
                const isGuaranteed = e.expected >= 1;
                const barWidth = Math.min(100, (e.expected / Math.max(...topExpected.map(x => x.expected))) * 100);
                return `
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${styles.text.secondary}; font-size: 11px;">${e.name}</div>
                        <div style="flex: 1; height: 4px; background: ${styles.bg.input}; border-radius: 2px; overflow: hidden;">
                            <div style="height: 100%; width: ${barWidth}%; background: ${getRarityBg(e.oddsDisplay)}; border-radius: 2px;"></div>
                        </div>
                        <div style="width: 45px; text-align: right; font-family: monospace; font-size: 11px; color: ${isGuaranteed ? colors.emerald : colors.amber};">${e.display}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <p style="margin-top: 10px; font-size: 9px; color: ${styles.text.muted}; text-align: center;">Statistical averages • Actual results vary</p>
    `, `Top ${topExpected.length}`);

    return mainWidget + donutWidget + chaseOddsWidget + expectedWidget;
}

function renderDonutChart() {
    const data = window.calculatorData;
    if (!data) return;

    const container = document.getElementById('donutChart');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const radius = Math.min(width, height) / 2 - 10;

    container.innerHTML = '';

    const svg = d3.select('#donutChart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${width/2},${height/2})`);

    const pieColors = { common: colors.emerald, uncommon: colors.blue, rare: colors.violet, chase: colors.orange };

    const pieData = [
        { name: 'Common', value: data.tiers.common, color: pieColors.common },
        { name: 'Uncommon', value: data.tiers.uncommon, color: pieColors.uncommon },
        { name: 'Rare', value: data.tiers.rare, color: pieColors.rare },
        { name: 'Chase', value: data.tiers.chase, color: pieColors.chase }
    ].filter(d => d.value > 0);

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);

    const arcs = svg.selectAll('arc').data(pie(pieData)).enter().append('g');

    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => d.data.color)
        .attr('stroke', styles.bg.panel)
        .attr('stroke-width', 2)
        .style('opacity', 0.85);

    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.1em').attr('fill', 'white').attr('font-size', '18px').attr('font-weight', 'bold').text(data.totalPacks);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '1.1em').attr('fill', styles.text.muted).attr('font-size', '9px').text('packs');
}

// Insights View - Simplified
export function renderInsightsView() {
    const chaseCards = findChaseCards(state.product, state.config);
    const tiers = groupByRarityTier(state.product, state.config);
    const sleeperHit = findSleeperHit(state.product, state.config);
    const parallels = getAllParallelsForProduct(state.product);

    const bestValues = [];
    parallels.forEach((configOdds, name) => {
        const best = findBestValueConfig(state.product, name);
        if (best) bestValues.push({ name, ...best });
    });

    let widgets = '';

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

    // Rarity Breakdown Widget
    widgets += widget('Rarity Breakdown', `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
            <div style="text-align: center; padding: 10px; background: ${colors.emerald}15; border-radius: 6px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.emerald};">${tiers.common.length}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">Common</div>
            </div>
            <div style="text-align: center; padding: 10px; background: ${colors.blue}15; border-radius: 6px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.blue};">${tiers.uncommon.length}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">Uncommon</div>
            </div>
            <div style="text-align: center; padding: 10px; background: ${colors.violet}15; border-radius: 6px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.violet};">${tiers.rare.length}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">Rare</div>
            </div>
            <div style="text-align: center; padding: 10px; background: ${colors.orange}15; border-radius: 6px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.orange};">${tiers.chase.length}</div>
                <div style="font-size: 10px; color: ${styles.text.muted};">Chase</div>
            </div>
        </div>
    `);

    // Chase Cards Widget - Limited to 5
    if (chaseCards.length > 0) {
        widgets += widget('Chase Cards', `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${chaseCards.slice(0, 5).map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: ${styles.text.secondary}; font-size: 12px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c.name}</span>
                        <span style="font-family: monospace; font-size: 11px; color: ${getRarityColor(c.odds)};">${c.odds}</span>
                    </div>
                `).join('')}
            </div>
        `, '1:200+');
    }

    // Best Value Config Widget - Limited to 5
    if (bestValues.length > 0) {
        widgets += widget('Best Value', `
            <div style="display: flex; flex-direction: column; gap: 6px;">
                ${bestValues.slice(0, 5).map(v => `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: ${styles.text.secondary}; font-size: 12px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${v.name}</span>
                        <span style="font-size: 11px;">
                            <span style="color: ${colors.emerald}; font-weight: 500; text-transform: capitalize;">${v.config}</span>
                            <span style="color: ${styles.text.muted}; margin-left: 4px;">${v.odds}</span>
                        </span>
                    </div>
                `).join('')}
            </div>
        `, 'By config');
    }

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

    // Stats Widget - Compact
    const statsWidget = widget('Stats', `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
            <div style="background: ${styles.bg.base}; padding: 10px; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: 700; color: ${styles.text.primary};">${totalCards}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">TOTAL</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 10px; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: 700; color: ${colors.orange};">${rookies.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">ROOKIES</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 10px; border-radius: 6px;">
                <div style="font-size: 18px; font-weight: 700; color: ${colors.emerald};">${teams.length}</div>
                <div style="font-size: 9px; color: ${styles.text.muted};">TEAMS</div>
            </div>
        </div>
    `);

    // Filters Widget - Compact
    const filtersWidget = widget('Filters', `
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
                <input type="text" placeholder="Search player..." value="${searchQuery}" oninput="setChecklistSearch(this.value)"
                    class="filter-select" style="flex: 1; font-size: 12px; padding: 8px;">
                <label style="display: flex; align-items: center; gap: 5px; font-size: 11px; color: ${styles.text.secondary}; cursor: pointer; white-space: nowrap;">
                    <input type="checkbox" ${rookieFilter ? 'checked' : ''} onchange="setChecklistRookieOnly(this.checked)" style="accent-color: ${colors.emerald};">
                    RC only
                </label>
            </div>
        </div>
    `);

    // Cards List Widget - Limited to 25
    const limitedCards = filteredChecklist.slice(0, 25);
    const cardsWidget = widget('Browse', `
        <p style="color: ${styles.text.muted}; font-size: 10px; margin-bottom: 10px;">${filteredChecklist.length} of ${totalCards} cards</p>
        <div style="display: flex; flex-direction: column; gap: 2px;">
            ${limitedCards.length > 0 ? limitedCards.map(card => {
                const isRookie = ['TRUE', 'true', '1', 'Yes', 'yes'].includes(card.rookie);
                return `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 4px; font-size: 12px;"
                         onmouseover="this.style.background='${styles.bg.input}'" onmouseout="this.style.background='transparent'">
                        <span style="color: ${styles.text.muted}; font-size: 10px; width: 28px;">#${card.card_num || '-'}</span>
                        <span style="flex: 1; color: ${styles.text.primary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.player || 'Unknown'}</span>
                        <span style="color: ${styles.text.muted}; font-size: 11px; width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.team || '-'}</span>
                        ${isRookie ? `<span style="font-size: 9px; background: ${colors.orange}30; color: ${colors.orange}; padding: 2px 5px; border-radius: 3px;">RC</span>` : '<span style="width: 26px;"></span>'}
                    </div>
                `;
            }).join('') : `<p style="text-align: center; color: ${styles.text.muted}; padding: 20px; font-size: 12px;">No cards match filters</p>`}
        </div>
        ${filteredChecklist.length > 25 ? `<p style="text-align: center; color: ${styles.text.muted}; font-size: 10px; margin-top: 10px;">Showing 25 of ${filteredChecklist.length}</p>` : ''}
    `, `${filteredChecklist.length}`);

    return statsWidget + filtersWidget + cardsWidget;
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
        case 'checklist': viewContent = renderChecklistView(); break;
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
