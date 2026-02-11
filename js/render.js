import { state } from './state.js';
import {
    getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs,
    getConfigInfo, getChecklistForProduct, getOddsForProduct,
    getAllParallelsForProduct, getAllParallelsBySetForProduct, getAllInsertsForProduct, getAllAutographsForProduct,
    getAllRelicsForProduct, getAllAutoRelicsForProduct,
    loadChecklistForProduct, loadOddsForProduct, isChecklistLoaded, isOddsLoaded,
    loadConfigForProduct, isConfigLoaded,
    parseOddsToNumber
} from './data.js';
import {
    calculateProductScore, calculateVariance, calculateBreakeven,
    getRookieInsights, getWhaleCard, groupByRarityTier, estimateSetCompletion
} from './insights.js';

// ========================================
// Sports Sidebar Navigation
// ========================================

export function renderSportsSidebar() {
    const sports = getAvailableSports();

    // Check if we're on landing (home) page
    const isHome = state.view === 'landing';
    const isAllSports = state.sportFilter === 'all';

    // Desktop sidebar navigation
    const navHtml = `
        <li class="nav-item">
            <a class="nav-link ${isHome ? 'active' : ''}" onclick="navigateToLanding()">
                <span class="nav-link-icon">🏠</span>
                Home
            </a>
        </li>
        <li class="nav-item">
            <a class="nav-link ${isAllSports ? 'active' : ''}" onclick="setSportFilter('all')">
                <span class="nav-link-icon">🏆</span>
                All Sports
            </a>
        </li>
        ${sports.map(sport => {
            const icon = getSportIcon(sport);
            return `
                <li class="nav-item">
                    <a class="nav-link ${state.sportFilter === sport ? 'active' : ''}" onclick="setSportFilter('${sport}')">
                        <span class="nav-link-icon">${icon}</span>
                        ${sport}
                    </a>
                </li>
            `;
        }).join('')}
    `;
    document.getElementById('sportNavList').innerHTML = navHtml;

    // Mobile horizontal pills
    const pillsHtml = `
        <button class="mobile-pill ${isHome ? 'active' : ''}" onclick="navigateToLanding()">Home</button>
        <button class="mobile-pill ${isAllSports ? 'active' : ''}" onclick="setSportFilter('all')">All</button>
        ${sports.map(sport => `
            <button class="mobile-pill ${state.sportFilter === sport ? 'active' : ''}" onclick="setSportFilter('${sport}')">${sport}</button>
        `).join('')}
    `;
    document.getElementById('mobileSportPills').innerHTML = pillsHtml;
}

export function getSportIcon(sport) {
    const icons = {
        // Full names
        'Basketball': '🏀',
        'Football': '🏈',
        'Baseball': '⚾',
        'Hockey': '🏒',
        'Soccer': '⚽',
        'Golf': '⛳',
        'Tennis': '🎾',
        'Racing': '🏎️',
        'Wrestling': '🤼',
        // Abbreviations
        'NBA': '🏀',
        'NFL': '🏈',
        'MLB': '⚾',
        'NHL': '🏒',
        'MLS': '⚽',
        'PGA': '⛳',
        'ATP': '🎾',
        'WTA': '🎾',
        'F1': '🏎️',
        'UFC': '🥊',
        'WWE': '🤼',
        'NCAA': '🎓',
        // Special categories
        'Bowman U': '🎓',
        'College': '🎓',
        'Olympics': '🏅'
    };
    return icons[sport] || '⭐';
}

// Get brand logo path (returns null if no logo available)
export function getBrandLogo(brand) {
    const logos = {
        'Topps': 'img/topps-logo.svg'
        // Add more brands here: 'Panini': 'img/panini-logo.svg', etc.
    };
    return logos[brand] || null;
}

// Get sport logo path (returns null if no logo available)
export function getSportLogo(sport) {
    const logos = {
        'NBA': 'img/nba-logo.svg',
        'NFL': 'img/nfl-logo.svg',
        'MLB': 'img/mlb-logo.svg'
    };
    return logos[sport] || null;
}

// ========================================
// Landing Page
// ========================================

export function renderLanding() {
    // Render sports in sidebar
    renderSportsSidebar();

    // Render sport cards
    renderSportCards();

    // Render new releases and explore products
    renderNewReleases();
    renderExploreProducts();
}

function renderSportCards() {
    const sports = getAvailableSports();

    // Show first 3 sports + placeholder for ads
    const displaySports = sports.slice(0, 3);

    const cardsHtml = displaySports.map(sport => {
        const logo = getSportLogo(sport);
        const icon = getSportIcon(sport);
        const display = logo
            ? `<img src="${logo}" alt="${sport}" class="sport-card-logo">`
            : `<span class="sport-card-icon">${icon}</span><span class="sport-card-name">${sport}</span>`;
        return `
            <div class="sport-card" onclick="setSportFilter('${sport}')">
                ${display}
            </div>
        `;
    }).join('');

    // Add placeholder box for future ad space
    const placeholderHtml = `<div class="sport-card-placeholder"></div>`;

    document.getElementById('sportCards').innerHTML = cardsHtml + placeholderHtml;
}

function renderNewReleases() {
    const allProducts = getAllProducts();

    // Sort by release date (newest first), then by year
    const sorted = [...allProducts].sort((a, b) => {
        // Try release date first
        if (a.releaseDate && b.releaseDate) {
            return new Date(b.releaseDate) - new Date(a.releaseDate);
        }
        if (a.releaseDate) return -1;
        if (b.releaseDate) return 1;
        // Fall back to year
        return (b.year || '').localeCompare(a.year || '');
    });

    const newReleases = sorted.slice(0, 4);
    document.getElementById('newReleases').innerHTML = renderProductList(newReleases);
}

function renderExploreProducts() {
    const allProducts = getAllProducts();

    // Shuffle and pick 4 random products for discovery
    const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
    const explore = shuffled.slice(0, 4);

    document.getElementById('exploreProducts').innerHTML = renderProductList(explore);
}

function renderProductList(products) {
    if (products.length === 0) {
        return '<p class="text-muted text-sm">No products available</p>';
    }

    const cards = products.map(product => {
        const sportLogo = getSportLogo(product.sport);
        const sportLogoHtml = sportLogo
            ? `<img src="${sportLogo}" alt="${product.sport}" class="product-list-watermark">`
            : '';

        // Clean up name: remove year (2025 or 2025-26 format) and brand
        let displayName = product.name
            .replace(/^\d{4}(-\d{2})?\s+/, '')  // Remove leading year
            .replace(new RegExp(`^${product.brand}\\s+`, 'i'), '');  // Remove brand

        return `
            <div class="product-list-card" onclick="navigateToProduct('${product.id}')">
                ${sportLogoHtml}
                <div class="product-list-card-content">
                    <div class="product-list-card-name">${displayName}</div>
                    <div class="product-list-card-meta">${product.year} &bull; ${product.brand} &bull; ${product.sport}</div>
                </div>
            </div>
        `;
    }).join('');

    return `<div class="product-list-grid">${cards}</div>`;
}

// ========================================
// Sport Filter View
// ========================================

export function renderSportFilterView() {
    // Render sports in sidebar
    renderSportsSidebar();

    // Update title - handle 'all' as special case
    const isAllSports = state.sportFilter === 'all';
    const title = isAllSports ? 'All Products' : `${state.sportFilter} Products`;
    document.getElementById('sportFilterTitle').textContent = title;

    // Render filtered products (null filter for 'all' to get all products)
    const filterSport = isAllSports ? null : state.sportFilter;
    const products = filterSport ? searchProducts('', filterSport) : getAllProducts();
    document.getElementById('sportFilterProducts').innerHTML = renderProductGrid(products);
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
        const sportLogo = getSportLogo(product.sport);
        const sportLogoHtml = sportLogo
            ? `<img src="${sportLogo}" alt="${product.sport}" class="product-card-watermark">`
            : '';

        // Clean up name: remove year (2025 or 2025-26 format) and brand
        let displayName = product.name
            .replace(/^\d{4}(-\d{2})?\s+/, '')  // Remove leading year
            .replace(new RegExp(`^${product.brand}\\s+`, 'i'), '');  // Remove brand

        return `
            <div class="product-card" onclick="navigateToProduct('${product.id}')">
                ${sportLogoHtml}
                <div class="product-card-content">
                    <div class="product-card-name">${displayName}</div>
                    <div class="product-card-meta">${product.year} &bull; ${product.brand} &bull; ${product.sport}</div>
                </div>
            </div>
        `;
    }).join('');
}

// ========================================
// Product Page
// ========================================

export async function renderProductPage() {
    const productSlug = state.product;

    // Load odds and config data (needed for configs in hero)
    const loadPromises = [];
    if (!isOddsLoaded(productSlug)) {
        loadPromises.push(loadOddsForProduct(productSlug));
    }
    if (!isConfigLoaded(productSlug)) {
        loadPromises.push(loadConfigForProduct(productSlug));
    }
    // Also load checklist for stats above tabs
    if (!isChecklistLoaded(productSlug)) {
        loadPromises.push(loadChecklistForProduct(productSlug));
    }
    if (loadPromises.length > 0) {
        await Promise.all(loadPromises);
    }

    renderProductHero();
    renderChecklistStats();
    renderProductTabs();
    renderTabContent();
}

// ========================================
// Checklist Stats (above tabs)
// ========================================

function renderChecklistStats() {
    const checklist = getChecklistForProduct(state.product);
    const container = document.getElementById('checklistStats');

    if (checklist.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Count card categories
    const baseSet = checklist.filter(c => {
        const setType = (c.set_type || c.set_name || '').toLowerCase();
        return setType === 'base' || setType === 'base set' || setType.includes('base');
    }).length;
    const inserts = checklist.filter(c => {
        const setType = (c.set_type || c.set_name || '').toLowerCase();
        return setType.includes('insert') || (!setType.includes('base') && !setType.includes('auto') && !setType.includes('relic') && setType !== '');
    }).length;
    const autographs = checklist.filter(c => {
        const setType = (c.set_type || c.set_name || '').toLowerCase();
        return setType.includes('auto') && !setType.includes('relic');
    }).length;
    const relics = checklist.filter(c => {
        const setType = (c.set_type || c.set_name || '').toLowerCase();
        return (setType === 'relic' || (setType.includes('relic') && !setType.includes('auto'))) && !setType.includes('redemption');
    }).length;
    const autoRelics = checklist.filter(c => {
        const setType = (c.set_type || c.set_name || '').toLowerCase();
        return (setType === 'autograph_relic' || (setType.includes('auto') && setType.includes('relic'))) && !setType.includes('redemption');
    }).length;

    container.innerHTML = `
        ${baseSet > 0 ? `
            <div class="checklist-stat">
                <span class="checklist-stat-value">${baseSet}</span>
                <span class="checklist-stat-label">Base Set</span>
            </div>
        ` : ''}
        ${inserts > 0 ? `
            <div class="checklist-stat">
                <span class="checklist-stat-value">${inserts}</span>
                <span class="checklist-stat-label">Inserts</span>
            </div>
        ` : ''}
        ${autographs > 0 ? `
            <div class="checklist-stat">
                <span class="checklist-stat-value">${autographs}</span>
                <span class="checklist-stat-label">Autographs</span>
            </div>
        ` : ''}
        ${relics > 0 ? `
            <div class="checklist-stat">
                <span class="checklist-stat-value">${relics}</span>
                <span class="checklist-stat-label">Relics</span>
            </div>
        ` : ''}
        ${autoRelics > 0 ? `
            <div class="checklist-stat">
                <span class="checklist-stat-value">${autoRelics}</span>
                <span class="checklist-stat-label">Auto Relics</span>
            </div>
        ` : ''}
    `;
}

function renderProductHero() {
    const product = getProduct(state.product);
    if (!product) return;

    const configs = getAvailableConfigs(state.product);
    const configInfo = getConfigInfo(state.product, state.config);

    const packs = configInfo?.packs || 0;
    const cardsPerPack = configInfo?.cardsPerPack || 0;
    const boxesPerCase = configInfo?.boxesPerCase || 0;
    const totalCards = packs * cardsPerPack;

    // Clean up name: remove leading year (2025 or 2025-26 format) and brand if duplicated
    let displayName = product.name
        .replace(/^\d{4}(-\d{2})?\s+/, '')  // Remove leading year
        .replace(new RegExp(`^${product.brand}\\s+`, 'i'), '');  // Remove brand

    // Brand: logo or text
    const brandLogo = getBrandLogo(product.brand);
    const brandDisplay = brandLogo
        ? `<img src="${brandLogo}" alt="${product.brand}" class="hero-brand-logo">`
        : product.brand;

    // Sport: logo or text
    const sportLogo = getSportLogo(product.sport);
    const sportDisplay = sportLogo
        ? `<img src="${sportLogo}" alt="${product.sport}" class="hero-sport-logo">`
        : product.sport;

    // Config selector
    const configOptions = configs.map(c =>
        `<option value="${c}" ${c === state.config ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
    ).join('');

    // Build meta line: Brand • Sport • Release Date
    const metaParts = [brandDisplay, sportDisplay];
    if (product.releaseDate) {
        metaParts.push(`<strong>Release Date:</strong> ${product.releaseDate}`);
    }

    // Build box info line: # Pack(s) • # Cards/Pack • # Boxes/Case
    const boxInfoParts = [];
    if (packs) boxInfoParts.push(`<strong>${packs}</strong> Pack${packs !== 1 ? 's' : ''}`);
    if (cardsPerPack) boxInfoParts.push(`<strong>${cardsPerPack}</strong> Cards/Pack`);
    if (boxesPerCase) boxInfoParts.push(`<strong>${boxesPerCase}</strong> Boxes/Case`);
    const boxInfoLine = boxInfoParts.length > 0 ? boxInfoParts.join(' &bull; ') : '';

    document.getElementById('productHero').innerHTML = `
        <div class="hero-toolbar">
            <button class="back-btn" id="productBackBtn" onclick="navigateBack()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m15 18-6-6 6-6"/>
                </svg>
                Back
            </button>
            ${configs.length > 0 ? `
                <div class="hero-config-select">
                    <span class="config-label">Box Type</span>
                    <select class="config-select" onchange="setConfig(this.value)">
                        ${configOptions}
                    </select>
                </div>
            ` : ''}
        </div>
        <div class="hero-info">
            <h1 class="hero-name">${displayName}</h1>
            <p class="hero-meta">${metaParts.join(' &bull; ')}</p>
            ${boxInfoLine ? `<p class="hero-meta hero-box-info">${boxInfoLine}</p>` : ''}
        </div>
    `;
}

// ========================================
// Product Tabs
// ========================================

export function renderProductTabs() {
    const tabs = [
        { id: 'odds', label: 'Odds' },
        { id: 'checklist', label: 'Checklist' },
        { id: 'insights', label: 'Insights' }
    ];

    const tabsHtml = tabs.map(tab => `
        <button class="tab ${state.tab === tab.id ? 'active' : ''}" onclick="setTab('${tab.id}')">
            ${tab.label}
        </button>
    `).join('');

    document.getElementById('productTabs').innerHTML = tabsHtml;
}

export async function renderTabContent() {
    const container = document.getElementById('tabContent');
    const productSlug = state.product;

    // Show loading state while fetching data
    const showLoading = () => {
        container.innerHTML = `<div class="empty-state"><p class="empty-state-text">Loading...</p></div>`;
    };

    switch (state.tab) {
        case 'odds':
            // Load odds data if not already cached
            if (!isOddsLoaded(productSlug)) {
                showLoading();
                await loadOddsForProduct(productSlug);
            }
            container.innerHTML = renderOddsTab();
            break;
        case 'checklist':
            // Load checklist data if not already cached
            if (!isChecklistLoaded(productSlug)) {
                showLoading();
                await loadChecklistForProduct(productSlug);
            }
            container.innerHTML = renderChecklistTab();
            break;
        case 'insights':
            // Load both odds and checklist data for insights
            const loadPromises = [];
            if (!isOddsLoaded(productSlug)) {
                loadPromises.push(loadOddsForProduct(productSlug));
            }
            if (!isChecklistLoaded(productSlug)) {
                loadPromises.push(loadChecklistForProduct(productSlug));
            }
            if (loadPromises.length > 0) {
                showLoading();
                await Promise.all(loadPromises);
            }
            container.innerHTML = renderInsightsTab();
            break;
        default:
            if (!isOddsLoaded(productSlug)) {
                showLoading();
                await loadOddsForProduct(productSlug);
            }
            container.innerHTML = renderOddsTab();
    }
}

// ========================================
// Odds Tab
// ========================================

// Counter for generating unique type group IDs
let oddsTypeGroupIdCounter = 0;

function renderOddsTab() {
    // Reset ID counters for fresh IDs
    oddsTypeGroupIdCounter = 0;
    oddsSectionIdCounter = 0;

    const product = getProduct(state.product);
    if (!product) {
        return `<div class="empty-state"><p class="empty-state-text">Product not found</p></div>`;
    }

    const parallelsBySet = getAllParallelsBySetForProduct(state.product);
    const inserts = getAllInsertsForProduct(state.product);
    const autographs = getAllAutographsForProduct(state.product);
    const relics = getAllRelicsForProduct(state.product);
    const autoRelics = getAllAutoRelicsForProduct(state.product);

    const hasData = parallelsBySet.size > 0 || inserts.size > 0 || autographs.size > 0 || relics.size > 0 || autoRelics.size > 0;

    if (!hasData) {
        return `<div class="empty-state"><p class="empty-state-text">No odds data available</p></div>`;
    }

    // Use the currently selected config from the Box Type dropdown
    const selectedConfig = state.config;

    let html = '';

    // Data source info banner
    html += `
        <div class="data-source-info">
            <svg class="data-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
            </svg>
            <span>View the official odds for each card type in this product. All data is sourced directly from the manufacturer's odds sheets included with the product. If you spot any errors, please let us know and we'll correct them as soon as possible.</span>
        </div>
    `;

    // Base Parallels - grouped by type, then by set
    html += renderTypeGroup('Base', parallelsBySet, selectedConfig);

    // Inserts Section - grouped by type, then by set
    html += renderTypeGroup('Inserts', inserts, selectedConfig);

    // Autographs Section - grouped by type, then by set
    html += renderTypeGroup('Autographs', autographs, selectedConfig);

    // Relics Section - grouped by type, then by set
    html += renderTypeGroup('Relics', relics, selectedConfig);

    // Auto Relics Section - grouped by type, then by set
    html += renderTypeGroup('Autograph Relics', autoRelics, selectedConfig);

    return html;
}

function renderTypeGroup(typeName, setMap, selectedConfig) {
    if (setMap.size === 0) {
        return '';
    }

    // Build sections HTML and count total items with odds for this config
    let sectionsHtml = '';
    let totalItems = 0;

    for (const [setName, parallels] of setMap) {
        // Count items with odds for this config
        const filteredEntries = [...parallels.entries()].filter(([name, configData]) => {
            return configData[selectedConfig] !== undefined && configData[selectedConfig] !== null;
        });

        if (filteredEntries.length > 0) {
            totalItems += filteredEntries.length;
            sectionsHtml += renderOddsSection(setName, parallels, selectedConfig, 'Parallel');
        }
    }

    // Don't show type group if no items have odds for this config
    if (totalItems === 0) {
        return '';
    }

    const groupId = `odds-type-group-${oddsTypeGroupIdCounter}`;
    const isFirstGroup = oddsTypeGroupIdCounter === 0;
    oddsTypeGroupIdCounter++;

    return `
        <div class="odds-type-group${isFirstGroup ? '' : ' collapsed'}" id="${groupId}">
            <button class="odds-type-header" onclick="toggleOddsTypeGroup('${groupId}')" aria-expanded="${isFirstGroup}">
                <h2 class="odds-type-title">${typeName}</h2>
                <span class="odds-type-count">${totalItems}</span>
                <svg class="odds-type-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </button>
            <div class="odds-type-content">
                ${sectionsHtml}
            </div>
        </div>
    `;
}

// Counter for generating unique section IDs
let oddsSectionIdCounter = 0;

function renderOddsSection(title, dataMap, selectedConfig, nameHeader = 'Card Type') {
    // Filter to only show items that have odds for the selected config
    const filteredEntries = [...dataMap.entries()].filter(([name, configData]) => {
        return configData[selectedConfig] !== undefined && configData[selectedConfig] !== null;
    });

    if (filteredEntries.length === 0) {
        return ''; // Don't show section if no odds for this config
    }

    // Sort by odds value (highest to lowest - rarest cards first)
    filteredEntries.sort((a, b) => {
        const oddsA = parseOddsToNumber(a[1][selectedConfig]);
        const oddsB = parseOddsToNumber(b[1][selectedConfig]);
        return oddsB - oddsA; // Descending order (highest odds first)
    });

    const rows = filteredEntries.map(([name, configData]) => {
        const odds = configData[selectedConfig];
        const isSSP = configData.isSSP;
        return `
            <tr>
                <td class="odds-name">${name}${isSSP ? '<span class="odds-ssp">SSP</span>' : ''}</td>
                <td class="odds-cell">${odds || '-'}</td>
            </tr>
        `;
    }).join('');

    const sectionId = `odds-section-${oddsSectionIdCounter}`;
    const isFirstSection = oddsSectionIdCounter === 0;
    oddsSectionIdCounter++;
    const itemCount = filteredEntries.length;

    return `
        <div class="odds-section${isFirstSection ? '' : ' collapsed'}" id="${sectionId}">
            <button class="odds-section-header" onclick="toggleOddsSection('${sectionId}')" aria-expanded="${isFirstSection}">
                <h3 class="odds-section-title">${title}</h3>
                <span class="odds-section-count">${itemCount}</span>
                <svg class="odds-section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </button>
            <div class="odds-section-content">
                <div class="odds-table-container">
                    <table class="odds-table">
                        <thead>
                            <tr>
                                <th class="odds-name-header">${nameHeader}</th>
                                <th class="odds-config-header">Odds</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Checklist Tab
// ========================================

function renderChecklistTab() {
    const checklist = getChecklistForProduct(state.product);

    if (checklist.length === 0) {
        return `<div class="empty-state"><p class="empty-state-text">No checklist data available</p></div>`;
    }

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

    // Compact filters bar
    const filtersHtml = `
        <div class="checklist-filters">
            <div class="checklist-search">
                <svg class="checklist-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="M21 21l-4.35-4.35"></path>
                </svg>
                <input type="text" id="checklistSearchInput" class="checklist-search-input" placeholder="Search players..." value="${searchQuery}" oninput="setChecklistSearch(this.value)">
            </div>
            <select class="checklist-select" onchange="setChecklistSet(this.value)">
                <option value="all" ${setFilter === 'all' ? 'selected' : ''}>All Sets</option>
                ${sets.map(s => `<option value="${s}" ${setFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <select class="checklist-select" onchange="setChecklistTeam(this.value)">
                <option value="all" ${teamFilter === 'all' ? 'selected' : ''}>All Teams</option>
                ${teams.map(t => `<option value="${t}" ${teamFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <button class="checklist-filter-btn ${rookieFilter ? 'active' : ''}" onclick="setChecklistRookieOnly(${!rookieFilter})">
                RC Only
            </button>
        </div>
    `;

    // Sort bar
    const sortOptions = [
        { value: 'card_num', label: '#' },
        { value: 'player', label: 'Player' },
        { value: 'team', label: 'Team' },
        { value: 'set', label: 'Set' }
    ];
    const sortHtml = `
        <div class="checklist-sort-bar">
            <span class="checklist-results-count">${filtered.length} cards</span>
            <div class="checklist-sort-options">
                <span class="checklist-sort-label">Sort:</span>
                ${sortOptions.map(opt => `
                    <button class="checklist-sort-btn ${sortBy === opt.value ? 'active' : ''}" onclick="setChecklistSort('${opt.value}')">
                        ${opt.label}${sortBy === opt.value ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                `).join('')}
            </div>
        </div>
    `;

    // Scrollable list
    const listHtml = filtered.length > 0 ? `
        <div class="checklist-list-container">
            <div class="checklist-list-header">
                <span class="checklist-col-num">#</span>
                <span class="checklist-col-set">Set</span>
                <span class="checklist-col-player">Player</span>
                <span class="checklist-col-team">Team</span>
            </div>
            <div class="checklist-list">
                ${filtered.map(card => {
                    const isRookie = ['TRUE', 'true', '1', 'Yes', 'yes'].includes(card.rookie);
                    const setName = card.set_name || card.set_type || 'Base';
                    return `
                        <div class="checklist-row${isRookie ? ' is-rookie' : ''}">
                            <span class="checklist-col-num">${card.card_num || '-'}</span>
                            <span class="checklist-col-set">${setName}</span>
                            <span class="checklist-col-player">${card.player || 'Unknown'}${isRookie ? '<span class="checklist-rc">RC</span>' : ''}</span>
                            <span class="checklist-col-team">${card.team || '-'}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    ` : '<div class="empty-state"><p class="empty-state-text">No cards match your filters</p></div>';

    // Data source info banner
    const dataSourceHtml = `
        <div class="data-source-info">
            <svg class="data-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
            </svg>
            <span>Browse all cards available in this product. Filter by set, team, or search for specific players. All data is sourced directly from the manufacturer's official checklists. If you spot any errors, please let us know and we'll correct them as soon as possible.</span>
        </div>
    `;

    return dataSourceHtml + filtersHtml + sortHtml + listHtml;
}

// ========================================
// Insights Tab
// ========================================

function renderInsightsTab() {
    const productSlug = state.product;
    const config = state.config;

    let html = '<div class="insights-container">';

    // Data source info banner
    html += `
        <div class="data-source-info">
            <svg class="data-source-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
            </svg>
            <span>Explore detailed analytics and statistics for this product. All calculations are based on official odds and checklist data from the manufacturer. If you spot any errors, please let us know and we'll correct them as soon as possible.</span>
        </div>
    `;

    // 1. Product Score Card (Violet theme)
    html += renderProductScoreCard(productSlug, config);

    // 2. Risk Meter (Red/Amber/Green gradient)
    html += renderRiskMeter(productSlug, config);

    // 3. Chase Card Break-Even Chart (Blue theme)
    html += renderBreakevenChart(productSlug, config);

    // 4. Rookie Report (Orange theme)
    html += renderRookieReport(productSlug, config);

    // 5. Whale Card Spotlight (Gold/Amber theme)
    html += renderWhaleCardSpotlight(productSlug, config);

    // 6. Odds Distribution (Multi-color)
    html += renderOddsDistribution(productSlug, config);

    // 7. Set Completion Estimate (Emerald theme)
    html += renderSetCompletionEstimate(productSlug, config);

    html += '</div>';
    return html;
}

// 1. Product Score Card - Violet theme
function renderProductScoreCard(productSlug, config) {
    const score = calculateProductScore(productSlug, config);
    if (!score) {
        return `
            <div class="insight-card insight-score">
                <div class="insight-header">
                    <span class="insight-icon">⭐</span>
                    <h3 class="insight-title">Product Score</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">Not enough data to calculate score</p>
                </div>
            </div>
        `;
    }

    const scorePercent = (score.score / score.maxScore) * 100;
    const verdictClass = score.verdict.toLowerCase().replace(' ', '-');

    return `
        <div class="insight-card insight-score">
            <div class="insight-header">
                <span class="insight-icon">⭐</span>
                <h3 class="insight-title">Product Score</h3>
                <span class="insight-badge insight-badge-${verdictClass}">${score.verdict}</span>
            </div>
            <div class="insight-body">
                <div class="score-display">
                    <div class="score-circle">
                        <svg viewBox="0 0 100 100" class="score-ring">
                            <circle cx="50" cy="50" r="45" class="score-ring-bg"/>
                            <circle cx="50" cy="50" r="45" class="score-ring-fill" style="stroke-dasharray: ${scorePercent * 2.83}, 283"/>
                        </svg>
                        <span class="score-value">${score.score}</span>
                        <span class="score-max">/ ${score.maxScore}</span>
                    </div>
                </div>
                <div class="score-breakdown">
                    <div class="score-metric">
                        <span class="metric-label">Variety</span>
                        <div class="metric-bar-container">
                            <div class="metric-bar metric-bar-variety" style="width: ${score.breakdown.variety * 10}%"></div>
                        </div>
                        <span class="metric-value">${score.breakdown.variety}</span>
                    </div>
                    <div class="score-metric">
                        <span class="metric-label">Chase Cards</span>
                        <div class="metric-bar-container">
                            <div class="metric-bar metric-bar-chase" style="width: ${score.breakdown.chase * 10}%"></div>
                        </div>
                        <span class="metric-value">${score.breakdown.chase}</span>
                    </div>
                    <div class="score-metric">
                        <span class="metric-label">Hit Rate</span>
                        <div class="metric-bar-container">
                            <div class="metric-bar metric-bar-hits" style="width: ${score.breakdown.hits * 10}%"></div>
                        </div>
                        <span class="metric-value">${score.breakdown.hits}</span>
                    </div>
                    <div class="score-metric">
                        <span class="metric-label">Value</span>
                        <div class="metric-bar-container">
                            <div class="metric-bar metric-bar-value" style="width: ${score.breakdown.value * 10}%"></div>
                        </div>
                        <span class="metric-value">${score.breakdown.value}</span>
                    </div>
                </div>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Score = (Variety × 0.2) + (Chase × 0.3) + (Hits × 0.3) + (Value × 0.2). Variety measures total card types, Chase counts cards with 1:200+ odds, Hits uses autograph frequency, and Value considers packs per box.
                </div>
            </div>
        </div>
    `;
}

// 2. Risk Meter - Red/Amber/Green gradient
function renderRiskMeter(productSlug, config) {
    const variance = calculateVariance(productSlug, config);
    if (!variance) {
        return `
            <div class="insight-card insight-risk">
                <div class="insight-header">
                    <span class="insight-icon">🎲</span>
                    <h3 class="insight-title">Risk Analysis</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">Not enough data for risk analysis</p>
                </div>
            </div>
        `;
    }

    const riskClass = variance.riskLevel.toLowerCase();
    const riskPosition = variance.riskLevel === 'High' ? 85 : variance.riskLevel === 'Medium' ? 50 : 15;

    return `
        <div class="insight-card insight-risk insight-risk-${riskClass}">
            <div class="insight-header">
                <span class="insight-icon">🎲</span>
                <h3 class="insight-title">Risk Analysis</h3>
                <span class="insight-badge insight-badge-risk-${riskClass}">${variance.riskLevel} Risk</span>
            </div>
            <div class="insight-body">
                <div class="risk-meter">
                    <div class="risk-gauge">
                        <div class="risk-gauge-fill"></div>
                        <div class="risk-needle" style="left: ${riskPosition}%"></div>
                    </div>
                    <div class="risk-labels">
                        <span>Safe</span>
                        <span>Moderate</span>
                        <span>Gamble</span>
                    </div>
                </div>
                <p class="risk-description">${variance.description}</p>
                <div class="risk-stats">
                    <div class="risk-stat">
                        <span class="risk-stat-value">${variance.chaseCards}</span>
                        <span class="risk-stat-label">Chase Cards</span>
                    </div>
                    <div class="risk-stat">
                        <span class="risk-stat-value">${variance.guaranteedHits}</span>
                        <span class="risk-stat-label">Easy Pulls</span>
                    </div>
                    <div class="risk-stat">
                        <span class="risk-stat-value">${variance.spread}x</span>
                        <span class="risk-stat-label">Odds Spread</span>
                    </div>
                </div>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Risk is based on odds spread (highest odds ÷ lowest odds). High Risk = spread > 500x with 3+ chase cards. Medium Risk = spread > 100x. Low Risk = spread ≤ 100x.
                </div>
            </div>
        </div>
    `;
}

// 3. Chase Card Break-Even Chart - Blue theme
function renderBreakevenChart(productSlug, config) {
    const breakeven = calculateBreakeven(productSlug, config);
    if (!breakeven || breakeven.length === 0) {
        return `
            <div class="insight-card insight-breakeven">
                <div class="insight-header">
                    <span class="insight-icon">📊</span>
                    <h3 class="insight-title">Break-Even Analysis</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No chase cards found for break-even analysis</p>
                </div>
            </div>
        `;
    }

    const maxBoxes = Math.max(...breakeven.map(b => b.boxesFor75));

    return `
        <div class="insight-card insight-breakeven">
            <div class="insight-header">
                <span class="insight-icon">📊</span>
                <h3 class="insight-title">Break-Even Analysis</h3>
                <span class="insight-subtitle">Boxes needed to hit chase cards</span>
            </div>
            <div class="insight-body">
                <div class="breakeven-chart">
                    ${breakeven.map(card => `
                        <div class="breakeven-row">
                            <div class="breakeven-label">
                                <span class="breakeven-name">${card.name}</span>
                                <span class="breakeven-odds">${card.odds}</span>
                            </div>
                            <div class="breakeven-bars">
                                <div class="breakeven-bar-container">
                                    <div class="breakeven-bar breakeven-bar-50" style="width: ${(card.boxesFor50 / maxBoxes) * 100}%">
                                        <span class="breakeven-bar-label">${card.boxesFor50}</span>
                                    </div>
                                </div>
                                <div class="breakeven-bar-container">
                                    <div class="breakeven-bar breakeven-bar-75" style="width: ${(card.boxesFor75 / maxBoxes) * 100}%">
                                        <span class="breakeven-bar-label">${card.boxesFor75}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="breakeven-legend">
                    <span class="legend-item legend-50"><span class="legend-dot"></span> 50% Chance</span>
                    <span class="legend-item legend-75"><span class="legend-dot"></span> 75% Chance</span>
                </div>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Uses probability formula P = 1 − (1 − 1/odds)^packs. Shows how many boxes you'd need to open to have a 50% or 75% chance of pulling each chase card (1:200+ odds).
                </div>
            </div>
        </div>
    `;
}

// 4. Rookie Report - Orange theme
function renderRookieReport(productSlug, config) {
    const rookies = getRookieInsights(productSlug, config);
    if (!rookies) {
        return `
            <div class="insight-card insight-rookies">
                <div class="insight-header">
                    <span class="insight-icon">🌟</span>
                    <h3 class="insight-title">Rookie Report</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No rookie data available</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="insight-card insight-rookies">
            <div class="insight-header">
                <span class="insight-icon">🌟</span>
                <h3 class="insight-title">Rookie Report</h3>
                <span class="insight-badge insight-badge-rookie">${rookies.highlight}</span>
            </div>
            <div class="insight-body">
                <div class="rookie-stats">
                    <div class="rookie-stat-main">
                        <span class="rookie-stat-value">${rookies.totalRookies}</span>
                        <span class="rookie-stat-label">Total Rookies</span>
                    </div>
                    <div class="rookie-stat-secondary">
                        <div class="rookie-percentage">
                            <div class="rookie-percentage-ring">
                                <svg viewBox="0 0 36 36" class="circular-chart">
                                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                    <path class="circle" stroke-dasharray="${rookies.rookiePercentage}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                                </svg>
                                <span class="percentage-value">${rookies.rookiePercentage}%</span>
                            </div>
                            <span class="rookie-stat-label">of Checklist</span>
                        </div>
                    </div>
                </div>
                ${rookies.topTeams.length > 0 ? `
                    <div class="rookie-teams">
                        <span class="rookie-teams-label">Top Teams:</span>
                        <div class="rookie-teams-list">
                            ${rookies.topTeams.map(team => `<span class="rookie-team-tag">${team}</span>`).join('')}
                        </div>
                    </div>
                ` : ''}
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Counts all cards marked as rookies in the official checklist. Percentage = (rookie cards ÷ total checklist cards) × 100.
                </div>
            </div>
        </div>
    `;
}

// 5. Whale Card Spotlight - Gold/Amber theme
function renderWhaleCardSpotlight(productSlug, config) {
    const whale = getWhaleCard(productSlug, config);
    if (!whale) {
        return `
            <div class="insight-card insight-whale">
                <div class="insight-header">
                    <span class="insight-icon">🐋</span>
                    <h3 class="insight-title">Whale Card Spotlight</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No ultra-rare cards found</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="insight-card insight-whale">
            <div class="insight-header">
                <span class="insight-icon">🐋</span>
                <h3 class="insight-title">Whale Card Spotlight</h3>
                <span class="insight-badge insight-badge-whale">${whale.context}</span>
            </div>
            <div class="insight-body">
                <div class="whale-card-display">
                    <div class="whale-card-name">${whale.name}</div>
                    <div class="whale-card-category">${whale.category}</div>
                    <div class="whale-card-odds">${whale.odds}</div>
                </div>
                <div class="whale-stats">
                    <div class="whale-stat">
                        <span class="whale-stat-icon">🎯</span>
                        <div class="whale-stat-info">
                            <span class="whale-stat-value">${whale.boxesFor50Percent} boxes</span>
                            <span class="whale-stat-label">for 50% chance</span>
                        </div>
                    </div>
                    <div class="whale-stat">
                        <span class="whale-stat-icon">🍀</span>
                        <div class="whale-stat-info">
                            <span class="whale-stat-value">${whale.boxesFor90Percent} boxes</span>
                            <span class="whale-stat-label">for 90% chance</span>
                        </div>
                    </div>
                </div>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Identifies the rarest card (highest odds, minimum 1:100). Box estimates use probability formula: boxes = ln(target) ÷ ln(1 − 1/odds) ÷ packs per box.
                </div>
            </div>
        </div>
    `;
}

// 6. Odds Distribution - Multi-color
function renderOddsDistribution(productSlug, config) {
    const tiers = groupByRarityTier(productSlug, config);
    if (!tiers) {
        return `
            <div class="insight-card insight-distribution">
                <div class="insight-header">
                    <span class="insight-icon">📈</span>
                    <h3 class="insight-title">Odds Distribution</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No odds data available</p>
                </div>
            </div>
        `;
    }

    const total = tiers.common.length + tiers.uncommon.length + tiers.rare.length + tiers.chase.length;
    if (total === 0) {
        return `
            <div class="insight-card insight-distribution">
                <div class="insight-header">
                    <span class="insight-icon">📈</span>
                    <h3 class="insight-title">Odds Distribution</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No odds data available</p>
                </div>
            </div>
        `;
    }

    const commonPct = Math.round((tiers.common.length / total) * 100);
    const uncommonPct = Math.round((tiers.uncommon.length / total) * 100);
    const rarePct = Math.round((tiers.rare.length / total) * 100);
    const chasePct = Math.round((tiers.chase.length / total) * 100);

    return `
        <div class="insight-card insight-distribution">
            <div class="insight-header">
                <span class="insight-icon">📈</span>
                <h3 class="insight-title">Odds Distribution</h3>
                <span class="insight-subtitle">${total} card types</span>
            </div>
            <div class="insight-body">
                <div class="distribution-donut">
                    <svg viewBox="0 0 100 100" class="donut-chart">
                        <circle cx="50" cy="50" r="40" class="donut-segment donut-common"
                            stroke-dasharray="${commonPct * 2.51} 251" stroke-dashoffset="0"/>
                        <circle cx="50" cy="50" r="40" class="donut-segment donut-uncommon"
                            stroke-dasharray="${uncommonPct * 2.51} 251" stroke-dashoffset="${-commonPct * 2.51}"/>
                        <circle cx="50" cy="50" r="40" class="donut-segment donut-rare"
                            stroke-dasharray="${rarePct * 2.51} 251" stroke-dashoffset="${-(commonPct + uncommonPct) * 2.51}"/>
                        <circle cx="50" cy="50" r="40" class="donut-segment donut-chase"
                            stroke-dasharray="${chasePct * 2.51} 251" stroke-dashoffset="${-(commonPct + uncommonPct + rarePct) * 2.51}"/>
                    </svg>
                    <div class="donut-center">
                        <span class="donut-total">${total}</span>
                        <span class="donut-label">Types</span>
                    </div>
                </div>
                <div class="distribution-legend">
                    <div class="distribution-tier tier-common">
                        <span class="tier-dot"></span>
                        <span class="tier-name">Common</span>
                        <span class="tier-count">${tiers.common.length}</span>
                        <span class="tier-odds">1:1 - 1:10</span>
                    </div>
                    <div class="distribution-tier tier-uncommon">
                        <span class="tier-dot"></span>
                        <span class="tier-name">Uncommon</span>
                        <span class="tier-count">${tiers.uncommon.length}</span>
                        <span class="tier-odds">1:11 - 1:50</span>
                    </div>
                    <div class="distribution-tier tier-rare">
                        <span class="tier-dot"></span>
                        <span class="tier-name">Rare</span>
                        <span class="tier-count">${tiers.rare.length}</span>
                        <span class="tier-odds">1:51 - 1:200</span>
                    </div>
                    <div class="distribution-tier tier-chase">
                        <span class="tier-dot"></span>
                        <span class="tier-name">Chase</span>
                        <span class="tier-count">${tiers.chase.length}</span>
                        <span class="tier-odds">1:200+</span>
                    </div>
                </div>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Groups all card types by their odds into four tiers: Common (1:1–1:10), Uncommon (1:11–1:50), Rare (1:51–1:200), and Chase (1:200+).
                </div>
            </div>
        </div>
    `;
}

// 7. Set Completion Estimate - Emerald theme
function renderSetCompletionEstimate(productSlug, config) {
    const estimate = estimateSetCompletion(productSlug, config);
    if (!estimate) {
        return `
            <div class="insight-card insight-completion">
                <div class="insight-header">
                    <span class="insight-icon">✅</span>
                    <h3 class="insight-title">Set Completion Estimate</h3>
                </div>
                <div class="insight-body">
                    <p class="insight-empty">No base set data available</p>
                </div>
            </div>
        `;
    }

    return `
        <div class="insight-card insight-completion">
            <div class="insight-header">
                <span class="insight-icon">✅</span>
                <h3 class="insight-title">Set Completion Estimate</h3>
            </div>
            <div class="insight-body">
                <div class="completion-display">
                    <div class="completion-boxes">
                        <span class="completion-boxes-value">${estimate.estimatedBoxes}</span>
                        <span class="completion-boxes-label">Boxes to Complete</span>
                    </div>
                    <div class="completion-visual">
                        <div class="completion-boxes-grid">
                            ${Array(Math.min(estimate.estimatedBoxes, 20)).fill('').map((_, i) =>
                                `<div class="completion-box-icon ${i < Math.min(5, estimate.estimatedBoxes) ? 'filled' : ''}"></div>`
                            ).join('')}
                            ${estimate.estimatedBoxes > 20 ? '<span class="completion-more">+' + (estimate.estimatedBoxes - 20) + '</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="completion-details">
                    <div class="completion-detail">
                        <span class="completion-detail-label">Base Set Size</span>
                        <span class="completion-detail-value">${estimate.baseSetSize} cards</span>
                    </div>
                    <div class="completion-detail">
                        <span class="completion-detail-label">Cards per Box</span>
                        <span class="completion-detail-value">${estimate.cardsPerBox}</span>
                    </div>
                </div>
                <p class="completion-note">${estimate.note}</p>
                <div class="insight-explanation">
                    <strong>How it's calculated:</strong> Uses the Coupon Collector's Problem formula: expected cards = n × (ln(n) + 0.5772), where n = base set size and 0.5772 is the Euler-Mascheroni constant. Assumes random distribution with no trading.
                </div>
            </div>
        </div>
    `;
}
