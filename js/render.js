import { state } from './state.js';
import {
    getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs,
    getConfigInfo, getChecklistForProduct
} from './data.js';

// ========================================
// Sports Sidebar Navigation
// ========================================

export function renderSportsSidebar() {
    const sports = getAvailableSports();
    const allProducts = getAllProducts();

    // Get product counts per sport
    const sportCounts = {};
    allProducts.forEach(p => {
        sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
    });

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
                <span class="nav-link-count">${allProducts.length}</span>
            </a>
        </li>
        ${sports.map(sport => {
            const icon = getSportIcon(sport);
            return `
                <li class="nav-item">
                    <a class="nav-link ${state.sportFilter === sport ? 'active' : ''}" onclick="setSportFilter('${sport}')">
                        <span class="nav-link-icon">${icon}</span>
                        ${sport}
                        <span class="nav-link-count">${sportCounts[sport] || 0}</span>
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

// ========================================
// Landing Page
// ========================================

export function renderLanding() {
    // Render sports in sidebar
    renderSportsSidebar();

    // Render sport cards
    renderSportCards();

    // Render new releases and popular products
    renderNewReleases();
    renderPopularProducts();
}

function renderSportCards() {
    const sports = getAvailableSports();
    const allProducts = getAllProducts();

    // Get product counts per sport
    const sportCounts = {};
    allProducts.forEach(p => {
        sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
    });

    const cardsHtml = sports.map(sport => {
        const icon = getSportIcon(sport);
        const count = sportCounts[sport] || 0;
        return `
            <div class="sport-card" onclick="setSportFilter('${sport}')">
                <div class="sport-card-icon">${icon}</div>
                <div class="sport-card-name">${sport}</div>
                <div class="sport-card-count">${count} product${count !== 1 ? 's' : ''}</div>
            </div>
        `;
    }).join('');

    document.getElementById('sportCards').innerHTML = cardsHtml;
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

    const newReleases = sorted.slice(0, 5);
    document.getElementById('newReleases').innerHTML = renderProductList(newReleases);
}

function renderPopularProducts() {
    const allProducts = getAllProducts();

    // For now, just show a mix of products (could be enhanced with actual popularity data)
    // Shuffle and pick 5
    const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
    const popular = shuffled.slice(0, 5);

    document.getElementById('popularProducts').innerHTML = renderProductList(popular);
}

function renderProductList(products) {
    if (products.length === 0) {
        return '<p class="text-muted text-sm">No products available</p>';
    }

    return products.map(product => {
        const icon = getSportIcon(product.sport);
        return `
            <div class="product-list-item" onclick="navigateToProduct('${product.id}')">
                <div class="product-list-icon">${icon}</div>
                <div class="product-list-info">
                    <div class="product-list-name">${product.name}</div>
                    <div class="product-list-meta">${product.brand} &bull; ${product.year}</div>
                </div>
                <div class="product-list-arrow">→</div>
            </div>
        `;
    }).join('');
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
                ${product.releaseDate ? `<p class="hero-release">Release: ${product.releaseDate}</p>` : ''}
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
    `;
}

// ========================================
// Checklist
// ========================================

export function renderTabContent() {
    const container = document.getElementById('tabContent');
    container.innerHTML = renderChecklistTab();
}

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
