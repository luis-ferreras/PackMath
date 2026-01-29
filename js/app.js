import { loadData, getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs, PRODUCTS } from './data.js';
import { state, updateURL, loadStateFromURL } from './state.js';
import { renderLanding, renderSearchResults, renderProductPage, renderTabContent } from './render.js';

// ========================================
// View Management
// ========================================

function showView(viewName) {
    // Hide all views
    document.getElementById('landingView').classList.add('hidden');
    document.getElementById('searchView').classList.add('hidden');
    document.getElementById('productView').classList.add('hidden');

    // Show header search only when not on landing
    const headerSearch = document.getElementById('headerSearch');
    if (viewName === 'landing') {
        headerSearch.classList.add('hidden');
    } else {
        headerSearch.classList.remove('hidden');
    }

    // Show the requested view
    document.getElementById(`${viewName}View`).classList.remove('hidden');

    state.view = viewName;
}

// ========================================
// Navigation Actions
// ========================================

function navigateToLanding() {
    state.searchQuery = '';
    state.sportFilter = null;
    state.product = null;
    showView('landing');
    renderLanding();
    updateURL();

    // Clear search inputs
    document.getElementById('landingSearchInput').value = '';
    document.getElementById('headerSearchInput').value = '';
}

function navigateToSearch(query, sportFilter = null) {
    state.searchQuery = query;
    state.sportFilter = sportFilter;
    showView('search');
    renderSearchResults();
    updateURL();

    // Sync search inputs
    document.getElementById('headerSearchInput').value = query;
}

function navigateToProduct(productId) {
    const product = getProduct(productId);
    if (!product) {
        navigateToLanding();
        return;
    }

    state.product = productId;
    state.tab = 'compare';
    state.compareTab = 'base';

    // Set default config
    const availableConfigs = getAvailableConfigs(productId);
    if (availableConfigs.length > 0 && !availableConfigs.includes(state.config)) {
        state.config = availableConfigs[0];
    }

    showView('product');
    renderProductPage();
    updateURL();
}

// ========================================
// State Setters (for render.js to use)
// ========================================

function setConfig(config) {
    state.config = config;
    renderProductPage();
    updateURL();
}

function setTab(tab) {
    state.tab = tab;
    updateTabActiveState();
    renderTabContent();
    updateURL();
}

function setCompareTab(tab) {
    state.compareTab = tab;
    renderTabContent();
}

function setBoxCount(count) {
    state.boxCount = count;
    renderTabContent();
}

function setCalcTargetCard(cardName) {
    state.calcTargetCard = cardName || null;
    renderTabContent();
}

function setChecklistSet(set) {
    state.checklistSet = set;
    renderTabContent();
}

function setChecklistTeam(team) {
    state.checklistTeam = team;
    renderTabContent();
}

function setChecklistRookieOnly(checked) {
    state.checklistRookieOnly = checked;
    renderTabContent();
}

function setChecklistSort(column) {
    if (state.checklistSortBy === column) {
        state.checklistSortDir = state.checklistSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        state.checklistSortBy = column;
        state.checklistSortDir = 'asc';
    }
    renderTabContent();
}

let searchTimeout = null;
function setChecklistSearch(query) {
    state.checklistSearch = query;
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const activeEl = document.activeElement;
        const isSearchFocused = activeEl && activeEl.id === 'checklistSearchInput';
        const cursorPos = isSearchFocused ? activeEl.selectionStart : 0;

        renderTabContent();

        if (isSearchFocused) {
            const searchInput = document.getElementById('checklistSearchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.setSelectionRange(cursorPos, cursorPos);
            }
        }
    }, 150);
}

function setSportFilter(sport) {
    state.sportFilter = state.sportFilter === sport ? null : sport;
    renderLanding();
}

// Make handlers available globally
window.setConfig = setConfig;
window.setTab = setTab;
window.setCompareTab = setCompareTab;
window.setBoxCount = setBoxCount;
window.setCalcTargetCard = setCalcTargetCard;
window.setChecklistSet = setChecklistSet;
window.setChecklistTeam = setChecklistTeam;
window.setChecklistRookieOnly = setChecklistRookieOnly;
window.setChecklistSort = setChecklistSort;
window.setChecklistSearch = setChecklistSearch;
window.setSportFilter = setSportFilter;
window.navigateToProduct = navigateToProduct;
window.navigateToSearch = navigateToSearch;
window.navigateToLanding = navigateToLanding;

// ========================================
// Tab UI Updates
// ========================================

function updateTabActiveState() {
    document.querySelectorAll('.tab').forEach(tab => {
        const tabName = tab.getAttribute('data-tab');
        if (tabName === state.tab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Logo click - return to landing
    document.getElementById('logoLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToLanding();
    });

    // Landing search input
    const landingSearchInput = document.getElementById('landingSearchInput');
    landingSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && landingSearchInput.value.trim()) {
            navigateToSearch(landingSearchInput.value.trim(), state.sportFilter);
        }
    });

    // Header search input
    const headerSearchInput = document.getElementById('headerSearchInput');
    headerSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && headerSearchInput.value.trim()) {
            navigateToSearch(headerSearchInput.value.trim());
        }
    });

    // Back buttons
    document.getElementById('searchBackBtn').addEventListener('click', navigateToLanding);
    document.getElementById('productBackBtn').addEventListener('click', () => {
        if (state.searchQuery) {
            navigateToSearch(state.searchQuery, state.sportFilter);
        } else {
            navigateToLanding();
        }
    });

    // Tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            if (tabName) setTab(tabName);
        });
    });

    // Browser back/forward
    window.addEventListener('popstate', () => {
        loadStateFromURL();
        initFromState();
    });
}

// ========================================
// Initialization
// ========================================

function initFromState() {
    if (state.view === 'product' && state.product && PRODUCTS[state.product]) {
        showView('product');
        renderProductPage();
        updateTabActiveState();
    } else if (state.view === 'search' && state.searchQuery) {
        showView('search');
        renderSearchResults();
        document.getElementById('headerSearchInput').value = state.searchQuery;
    } else {
        showView('landing');
        renderLanding();
    }
}

async function init() {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');

    const success = await loadData();

    loadingState.classList.add('hidden');

    if (!success) {
        errorState.classList.remove('hidden');
        return;
    }

    // Parse URL state
    loadStateFromURL();

    // Initialize event listeners
    initEventListeners();

    // Render initial view based on state
    initFromState();
}

document.addEventListener('DOMContentLoaded', init);
