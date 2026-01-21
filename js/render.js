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
function widget(title, content, badge = null, accent = false) {
    const accentStyle = accent ? `border-color: ${styles.accent}; box-shadow: 0 0 20px hsla(250, 70%, 60%, 0.3);` : '';
    return `
        <div class="widget" style="${accentStyle}">
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

// Config selector
export function renderConfigSelector(productId) {
    const configs = getAvailableConfigs(productId);
    return `
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px;">
            ${configs.map(key => `
                <button onclick="setConfig('${key}')"
                    style="padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;
                           text-transform: capitalize; cursor: pointer; transition: all 150ms;
                           border: 1px solid ${state.config === key ? styles.accent : styles.border};
                           background: ${state.config === key ? styles.accentMuted : 'transparent'};
                           color: ${state.config === key ? styles.accent : styles.text.secondary};">
                    ${key}
                </button>
            `).join('')}
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
        <div style="display: flex; gap: 4px; background: ${styles.bg.base}; padding: 4px; border-radius: 8px; margin-bottom: 16px;">
            ${[
                { id: 'base', label: 'Base Parallels', count: parallels.size },
                { id: 'inserts', label: 'Inserts', count: inserts.size },
                { id: 'autos', label: 'Autographs', count: autographs.size }
            ].map(tab => `
                <button onclick="setCompareTab('${tab.id}')"
                    style="padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;
                           border: none; cursor: pointer; transition: all 150ms;
                           background: ${subTab === tab.id ? styles.bg.input : 'transparent'};
                           color: ${subTab === tab.id ? styles.text.primary : styles.text.muted};">
                    ${tab.label} ${tab.count > 0 ? `<span style="opacity: 0.5; margin-left: 4px;">(${tab.count})</span>` : ''}
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

    // Build table
    let tableContent = '';
    if (dataMap.size > 0) {
        tableContent = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 1px solid ${styles.border};">
                            <th style="text-align: left; padding: 12px 8px; color: ${styles.text.muted}; font-weight: 500;">Name</th>
                            ${configs.map(c => `<th style="text-align: center; padding: 12px 8px; color: ${styles.text.muted}; font-weight: 500; text-transform: capitalize;">${c}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${Array.from(dataMap.entries()).map(([name, configOdds]) => {
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
                                <tr style="border-bottom: 1px solid ${styles.border}40;">
                                    <td style="padding: 12px 8px; color: ${styles.text.primary};">
                                        ${name}
                                        ${isSSP ? `<span style="margin-left: 8px; font-size: 10px; background: ${colors.orange}30; color: ${colors.orange}; padding: 2px 6px; border-radius: 4px;">SSP</span>` : ''}
                                    </td>
                                    ${configs.map(c => {
                                        const odds = configOdds[c];
                                        const isBest = c === bestConfig && configs.length > 1;
                                        const color = isBest ? colors.emerald : getRarityColor(odds);
                                        return `<td style="text-align: center; padding: 12px 8px;">
                                            <span style="font-family: monospace; color: ${color}; ${isBest ? 'font-weight: 700;' : ''}">
                                                ${odds || '—'}
                                            </span>
                                            ${isBest ? '<span style="margin-left: 4px; font-size: 10px;">✓</span>' : ''}
                                        </td>`;
                                    }).join('')}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <p style="margin-top: 12px; font-size: 11px; color: ${styles.text.muted};">✓ = Best odds for this card</p>
        `;
    } else {
        tableContent = `<p style="color: ${styles.text.muted}; text-align: center; padding: 32px;">No data available for this category</p>`;
    }

    return widget('Config Comparison', `
        <p style="color: ${styles.text.muted}; font-size: 13px; margin-bottom: 16px;">Compare odds across all box types</p>
        ${tabButtons}
        ${tableContent}
    `, 'Compare');
}

// Bubbles View
export function renderBubblesView() {
    const currentOdds = getOddsForProduct(state.product, state.config);
    if (!currentOdds.base_parallels) {
        return widget('Rarity Bubbles', `<p style="color: ${styles.text.muted};">No parallel data available</p>`);
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
        { label: 'Common (1:1-1:10)', color: colors.emerald },
        { label: 'Uncommon (1:11-1:50)', color: colors.blue },
        { label: 'Rare (1:51-1:200)', color: colors.violet },
        { label: 'Chase (1:200+)', color: colors.orange }
    ];

    return widget('Rarity Bubbles', `
        <p style="color: ${styles.text.muted}; font-size: 13px; margin-bottom: 12px;">Bubble size = pull rate. Bigger = easier to pull.</p>
        ${renderConfigSelector(state.product)}
        <div id="bubbleChart" style="width: 100%; height: 400px; background: ${styles.bg.base}; border-radius: 8px; margin-top: 16px; overflow: hidden;"></div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 16px; font-size: 11px; color: ${styles.text.muted};">
            ${legendItems.map(item => `
                <span style="display: flex; align-items: center; gap: 6px;">
                    <span style="width: 10px; height: 10px; border-radius: 50%; background: ${item.color};"></span>
                    ${item.label}
                </span>
            `).join('')}
        </div>
    `, 'Visual');
}

function renderBubbleChart() {
    const data = window.bubbleChartData;
    if (!data) return;

    const container = document.getElementById('bubbleChart');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    container.innerHTML = '';

    const colorMap = { emerald: colors.emerald, blue: colors.blue, violet: colors.violet, orange: colors.orange };

    const maxOdds = Math.max(...data.map(d => d.oddsNum));
    const minRadius = 20;
    const maxRadius = 60;

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
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const simulation = d3.forceSimulation(data)
        .force('charge', d3.forceManyBody().strength(10))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => d.radius + 5))
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
        .attr('fill-opacity', 0.75)
        .attr('stroke', d => colorMap[d.color])
        .attr('stroke-width', 2)
        .style('filter', 'url(#glow)');

    bubbles.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.3em')
        .attr('fill', 'white')
        .attr('font-size', d => Math.max(10, d.radius / 4))
        .attr('font-weight', '600')
        .attr('pointer-events', 'none')
        .text(d => d.name.length > 10 ? d.name.slice(0, 8) + '...' : d.name);

    bubbles.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.1em')
        .attr('fill', 'rgba(255,255,255,0.8)')
        .attr('font-size', d => Math.max(9, d.radius / 5))
        .attr('font-weight', '500')
        .attr('pointer-events', 'none')
        .text(d => d.odds);

    bubbles
        .on('mouseover', function(event, d) {
            d3.select(this).select('circle').transition().duration(150).attr('fill-opacity', 1).attr('r', d.radius * 1.15);
        })
        .on('mouseout', function(event, d) {
            d3.select(this).select('circle').transition().duration(150).attr('fill-opacity', 0.75).attr('r', d.radius);
        });

    simulation.on('tick', () => {
        bubbles.attr('transform', d => {
            d.x = Math.max(d.radius, Math.min(width - d.radius, d.x));
            d.y = Math.max(d.radius, Math.min(height - d.radius, d.y));
            return `translate(${d.x},${d.y})`;
        });
    });
}

// Calculator View
export function renderCalculatorView() {
    const product = PRODUCTS[state.product];
    const configInfo = product.configs[state.config] || {};
    const totalCards = (configInfo.packs || 0) * (configInfo.cardsPerPack || 0);
    const boxCount = state.boxCount || 1;
    const totalCardsMulti = totalCards * boxCount;

    const allCards = ODDS_RAW.filter(row =>
        row.product_id === state.product && row.config === state.config && row.odds
    ).map(row => ({
        name: row.parallel || row.card_type,
        category: row.category,
        odds: parseFloat(row.odds),
        oddsDisplay: formatOddsValue(row.odds)
    })).sort((a, b) => a.odds - b.odds);

    const expected = allCards.map(card => {
        const exp = totalCardsMulti / card.odds;
        return { ...card, expected: exp, display: exp >= 1 ? exp.toFixed(1) : (exp * 100).toFixed(1) + '%' };
    });

    const tiers = { common: 0, uncommon: 0, rare: 0, chase: 0 };
    expected.forEach(e => {
        if (e.odds <= 10) tiers.common += e.expected;
        else if (e.odds <= 50) tiers.uncommon += e.expected;
        else if (e.odds <= 200) tiers.rare += e.expected;
        else tiers.chase += e.expected;
    });

    window.calculatorData = { tiers, totalCards: totalCardsMulti, boxCount };
    setTimeout(() => renderDonutChart(), 0);

    const chaseCards = allCards.filter(c => c.odds >= 100).slice(-10).reverse();

    // Box Stats Widget
    const boxStatsWidget = widget('Box Configuration', `
        <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="color: ${styles.text.muted}; font-size: 13px;">Number of Boxes</span>
                <span style="font-size: 24px; font-weight: 700; color: ${styles.text.primary};">${boxCount}</span>
            </div>
            <input type="range" min="1" max="20" value="${boxCount}" onchange="setBoxCount(parseInt(this.value))"
                style="width: 100%; height: 6px; border-radius: 3px; background: ${styles.bg.input}; cursor: pointer; accent-color: ${colors.emerald};">
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: ${styles.text.muted}; margin-top: 4px;">
                <span>1 box</span><span>20 boxes</span>
            </div>
        </div>
        <div style="border-top: 1px solid ${styles.border}; padding-top: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center;">
            <div>
                <div style="font-size: 11px; color: ${styles.text.muted}; text-transform: uppercase;">Packs</div>
                <div style="font-size: 20px; font-weight: 700; color: ${styles.text.primary};">${(configInfo.packs || 0) * boxCount}</div>
            </div>
            <div>
                <div style="font-size: 11px; color: ${styles.text.muted}; text-transform: uppercase;">Cards/Pack</div>
                <div style="font-size: 20px; font-weight: 700; color: ${styles.text.primary};">${configInfo.cardsPerPack || 0}</div>
            </div>
            <div>
                <div style="font-size: 11px; color: ${styles.text.muted}; text-transform: uppercase;">Total Cards</div>
                <div style="font-size: 20px; font-weight: 700; color: ${colors.emerald};">${totalCardsMulti}</div>
            </div>
        </div>
        ${renderConfigSelector(state.product)}
    `, `${boxCount} Box${boxCount > 1 ? 'es' : ''}`);

    // Donut Chart Widget
    const donutWidget = widget('Pull Distribution', `
        <div id="donutChart" style="width: 100%; height: 200px;"></div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; text-align: center; font-size: 11px;">
            <div><div style="width: 10px; height: 10px; border-radius: 50%; background: ${colors.emerald}; margin: 0 auto 4px;"></div><div style="color: ${styles.text.muted};">Common</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.common.toFixed(1)}</div></div>
            <div><div style="width: 10px; height: 10px; border-radius: 50%; background: ${colors.blue}; margin: 0 auto 4px;"></div><div style="color: ${styles.text.muted};">Uncommon</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.uncommon.toFixed(1)}</div></div>
            <div><div style="width: 10px; height: 10px; border-radius: 50%; background: ${colors.violet}; margin: 0 auto 4px;"></div><div style="color: ${styles.text.muted};">Rare</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.rare.toFixed(1)}</div></div>
            <div><div style="width: 10px; height: 10px; border-radius: 50%; background: ${colors.orange}; margin: 0 auto 4px;"></div><div style="color: ${styles.text.muted};">Chase</div><div style="color: ${styles.text.primary}; font-weight: 600;">${tiers.chase.toFixed(2)}</div></div>
        </div>
    `);

    // Chase Odds Widget
    const chaseOddsWidget = widget('Chase Card Odds', `
        <p style="color: ${styles.text.muted}; font-size: 11px; margin-bottom: 12px;">Probability of pulling at least one in ${boxCount} box${boxCount > 1 ? 'es' : ''}</p>
        <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto;">
            ${chaseCards.map(card => {
                const prob = 1 - Math.pow(1 - (1 / card.odds), totalCardsMulti);
                const probPercent = (prob * 100).toFixed(1);
                const barWidth = Math.min(100, prob * 100);
                const probColor = prob >= 0.5 ? colors.emerald : prob >= 0.1 ? colors.amber : colors.red;
                return `
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="color: ${styles.text.secondary}; font-size: 13px;">${card.name}</span>
                            <span style="font-family: monospace; font-size: 13px; color: ${probColor};">${probPercent}%</span>
                        </div>
                        <div style="height: 6px; background: ${styles.bg.input}; border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${barWidth}%; background: ${probColor}; border-radius: 3px; transition: width 300ms;"></div>
                        </div>
                        <div style="color: ${styles.text.muted}; font-size: 10px; margin-top: 2px;">${card.oddsDisplay}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `, 'Probability');

    // Expected Hits Widget
    const expectedHitsWidget = widget(`Expected Hits`, `
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto;">
            ${expected.filter(e => e.expected >= 0.01).map(e => {
                const isGuaranteed = e.expected >= 1;
                const barWidth = Math.min(100, (e.expected / Math.max(...expected.map(x => x.expected))) * 100);
                return `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${styles.text.secondary}; font-size: 12px;">${e.name}</div>
                        <div style="flex: 1; height: 6px; background: ${styles.bg.input}; border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${barWidth}%; background: ${getRarityBg(e.oddsDisplay)}; border-radius: 3px;"></div>
                        </div>
                        <div style="width: 60px; text-align: right; font-family: monospace; font-size: 12px; color: ${isGuaranteed ? colors.emerald : colors.amber};">${e.display}</div>
                    </div>
                `;
            }).join('')}
        </div>
        <p style="margin-top: 12px; font-size: 10px; color: ${styles.text.muted}; text-align: center;">Note: These are statistical averages. Actual results will vary.</p>
    `, `${boxCount} Box${boxCount > 1 ? 'es' : ''}`);

    return boxStatsWidget + donutWidget + chaseOddsWidget + expectedHitsWidget;
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

    svg.append('text').attr('text-anchor', 'middle').attr('dy', '-0.2em').attr('fill', 'white').attr('font-size', '20px').attr('font-weight', 'bold').text(data.totalCards);
    svg.append('text').attr('text-anchor', 'middle').attr('dy', '1.2em').attr('fill', styles.text.muted).attr('font-size', '10px').text('total cards');
}

// Insights View
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
                <div class="widget-content">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="font-size: 28px;">💤</div>
                        <div>
                            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #78350f; font-weight: 600; margin-bottom: 4px;">Sleeper Hit</div>
                            <div style="font-size: 16px; font-weight: 700; color: #1c1917;">${sleeperHit.card}</div>
                            <div style="color: #78350f; font-weight: 600;">${sleeperHit.odds}</div>
                            <p style="color: #92400e; font-size: 12px; margin-top: 4px;">${sleeperHit.reason}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Chase Cards Widget
    widgets += widget('Chase Cards', `
        ${chaseCards.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${chaseCards.map(c => `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: ${styles.text.secondary}; font-size: 13px;">${c.name}</span>
                        <span style="font-family: monospace; font-size: 12px; color: ${getRarityColor(c.odds)};">${c.odds}</span>
                    </div>
                `).join('')}
            </div>
        ` : `<p style="color: ${styles.text.muted}; font-size: 13px;">No chase cards (1:200+) in this config</p>`}
    `, '1:200+');

    // Best Value Config Widget
    widgets += widget('Best Value Config', `
        <div style="display: flex; flex-direction: column; gap: 8px;">
            ${bestValues.slice(0, 5).map(v => `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: ${styles.text.secondary}; font-size: 13px;">${v.name}</span>
                    <span style="font-size: 12px;">
                        <span style="color: ${colors.emerald}; font-weight: 500; text-transform: capitalize;">${v.config}</span>
                        <span style="color: ${styles.text.muted}; margin-left: 4px;">${v.odds}</span>
                    </span>
                </div>
            `).join('')}
        </div>
    `, 'Value');

    // Rarity Breakdown Widget
    widgets += widget('Rarity Breakdown', `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div style="text-align: center; padding: 12px; background: ${colors.emerald}15; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: ${colors.emerald};">${tiers.common.length}</div>
                <div style="font-size: 11px; color: ${styles.text.muted};">Common</div>
            </div>
            <div style="text-align: center; padding: 12px; background: ${colors.blue}15; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: ${colors.blue};">${tiers.uncommon.length}</div>
                <div style="font-size: 11px; color: ${styles.text.muted};">Uncommon</div>
            </div>
            <div style="text-align: center; padding: 12px; background: ${colors.violet}15; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: ${colors.violet};">${tiers.rare.length}</div>
                <div style="font-size: 11px; color: ${styles.text.muted};">Rare</div>
            </div>
            <div style="text-align: center; padding: 12px; background: ${colors.orange}15; border-radius: 8px;">
                <div style="font-size: 24px; font-weight: 700; color: ${colors.orange};">${tiers.chase.length}</div>
                <div style="font-size: 11px; color: ${styles.text.muted};">Chase</div>
            </div>
        </div>
    `, 'Stats');

    // Config Selector Widget
    widgets += widget('Configuration', `
        <p style="color: ${styles.text.muted}; font-size: 13px; margin-bottom: 8px;">Select box type to view insights</p>
        ${renderConfigSelector(state.product)}
    `);

    return widgets;
}

// Checklist View
export function renderChecklistView() {
    const productChecklist = CHECKLIST.filter(row => row.product_id === state.product);

    if (productChecklist.length === 0) {
        return widget('Checklist', `
            <div style="text-align: center; padding: 32px;">
                <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
                <p style="color: ${styles.text.muted};">No checklist data available for this product.</p>
                <p style="color: ${styles.text.muted}; font-size: 12px; margin-top: 8px;">Add data to the checklist tab in Google Sheets.</p>
            </div>
        `);
    }

    const totalCards = productChecklist.length;
    const rookies = productChecklist.filter(c => ['TRUE', 'true', '1', 'Yes', 'yes'].includes(c.rookie));
    const rookieCount = rookies.length;
    const sets = [...new Set(productChecklist.map(c => c.set_name || c.set_type).filter(Boolean))];
    const setCount = sets.length;
    const autos = productChecklist.filter(c => (c.set_type?.toLowerCase().includes('auto')) || (c.set_name?.toLowerCase().includes('auto')));
    const autoCount = autos.length;
    const teams = [...new Set(productChecklist.map(c => c.team).filter(Boolean))].sort();
    const teamCount = teams.length;

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

    // Stats Widget
    const statsWidget = widget('Checklist Stats', `
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center;">
            <div style="background: ${styles.bg.base}; padding: 12px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: ${styles.text.primary};">${totalCards}</div>
                <div style="font-size: 10px; color: ${styles.text.muted}; text-transform: uppercase;">Total</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 12px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.orange};">${rookieCount}</div>
                <div style="font-size: 10px; color: ${styles.text.muted}; text-transform: uppercase;">Rookies</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 12px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.violet};">${setCount}</div>
                <div style="font-size: 10px; color: ${styles.text.muted}; text-transform: uppercase;">Sets</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 12px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.amber};">${autoCount}</div>
                <div style="font-size: 10px; color: ${styles.text.muted}; text-transform: uppercase;">Autos</div>
            </div>
            <div style="background: ${styles.bg.base}; padding: 12px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: ${colors.emerald};">${teamCount}</div>
                <div style="font-size: 10px; color: ${styles.text.muted}; text-transform: uppercase;">Teams</div>
            </div>
        </div>
    `, 'Overview');

    // Filters Widget
    const filtersWidget = widget('Filters', `
        <div style="display: flex; flex-direction: column; gap: 12px;">
            <div>
                <label style="display: block; font-size: 11px; color: ${styles.text.muted}; margin-bottom: 4px;">Set</label>
                <select onchange="setChecklistSet(this.value)" class="filter-select" style="width: 100%;">
                    <option value="all" ${setFilter === 'all' ? 'selected' : ''}>All Sets</option>
                    ${sets.map(s => `<option value="${s}" ${setFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div>
                <label style="display: block; font-size: 11px; color: ${styles.text.muted}; margin-bottom: 4px;">Team</label>
                <select onchange="setChecklistTeam(this.value)" class="filter-select" style="width: 100%;">
                    <option value="all" ${teamFilter === 'all' ? 'selected' : ''}>All Teams</option>
                    ${teams.map(t => `<option value="${t}" ${teamFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${styles.text.secondary}; cursor: pointer;">
                <input type="checkbox" ${rookieFilter ? 'checked' : ''} onchange="setChecklistRookieOnly(this.checked)" style="accent-color: ${colors.emerald};">
                Rookies Only
            </label>
            <div>
                <input type="text" placeholder="Search player..." value="${searchQuery}" oninput="setChecklistSearch(this.value)" class="filter-select" style="width: 100%;">
            </div>
        </div>
    `);

    // Cards List Widget
    const cardsWidget = widget('Browse Cards', `
        <p style="color: ${styles.text.muted}; font-size: 11px; margin-bottom: 12px;">Showing ${filteredChecklist.length} of ${totalCards} cards</p>
        <div style="max-height: 400px; overflow-y: auto;">
            ${filteredChecklist.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${filteredChecklist.slice(0, 100).map(card => {
                        const isRookie = ['TRUE', 'true', '1', 'Yes', 'yes'].includes(card.rookie);
                        const isAuto = (card.set_type?.toLowerCase().includes('auto')) || (card.set_name?.toLowerCase().includes('auto'));
                        return `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 6px; transition: background 150ms;"
                                 onmouseover="this.style.background='${styles.bg.input}'" onmouseout="this.style.background='transparent'">
                                <span style="color: ${styles.text.muted}; font-size: 11px; width: 32px;">#${card.card_num || '-'}</span>
                                <span style="flex: 1; color: ${styles.text.primary}; font-size: 13px;">${card.player || 'Unknown'}</span>
                                <span style="color: ${styles.text.muted}; font-size: 12px; width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${card.team || '-'}</span>
                                <div style="display: flex; gap: 4px; width: 60px;">
                                    ${isRookie ? `<span style="font-size: 10px; background: ${colors.orange}30; color: ${colors.orange}; padding: 2px 6px; border-radius: 4px;">RC</span>` : ''}
                                    ${isAuto ? `<span style="font-size: 10px; background: ${colors.amber}30; color: ${colors.amber}; padding: 2px 6px; border-radius: 4px;">Auto</span>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                    ${filteredChecklist.length > 100 ? `<p style="text-align: center; color: ${styles.text.muted}; font-size: 12px; padding: 16px;">Showing first 100 results. Use filters to narrow down.</p>` : ''}
                </div>
            ` : `<p style="text-align: center; color: ${styles.text.muted}; padding: 32px;">No cards match your filters</p>`}
        </div>
    `, `${filteredChecklist.length} Cards`);

    return statsWidget + filtersWidget + cardsWidget;
}

// Main render function
export function renderProductContent() {
    const product = PRODUCTS[state.product];
    if (!product) {
        document.getElementById('productContent').innerHTML = widget('Error', `<p style="color: ${styles.text.muted};">No data available</p>`);
        return;
    }

    // Product header widget
    const headerWidget = `
        <div class="widget widget--accent">
            <div class="widget-content">
                <h2 style="font-size: 18px; font-weight: 600; color: ${styles.text.primary}; margin-bottom: 4px;">${product.name}</h2>
                <p style="color: ${styles.text.muted}; font-size: 13px;">${product.sport} • ${product.brand} • ${product.year}</p>
            </div>
        </div>
    `;

    let viewContent = '';
    switch (state.view) {
        case 'bubbles': viewContent = renderBubblesView(); break;
        case 'calculator': viewContent = renderCalculatorView(); break;
        case 'checklist': viewContent = renderChecklistView(); break;
        case 'insights': viewContent = renderInsightsView(); break;
        default: viewContent = renderCompareView();
    }

    document.getElementById('productContent').innerHTML = headerWidget + viewContent;
}
