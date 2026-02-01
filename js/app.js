import { loadData, getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs, PRODUCTS } from './data.js';
import { state, updateURL, loadStateFromURL } from './state.js';
import { renderLanding, renderSearchResults, renderProductPage, renderTabContent, renderProductTabs, renderSportsSidebar, renderSportFilterView } from './render.js';

// ========================================
// View Management
// ========================================

function showView(viewName) {
    // Hide all views
    document.getElementById('landingView').classList.add('hidden');
    document.getElementById('sportFilterView').classList.add('hidden');
    document.getElementById('searchView').classList.add('hidden');
    document.getElementById('productView').classList.add('hidden');

    // Show the requested view
    document.getElementById(`${viewName}View`).classList.remove('hidden');

    state.view = viewName;
}

// ========================================
// Navigation Actions
// ========================================

function navigateToLanding() {
    state.searchQuery = '';
    state.product = null;
    state.sportFilter = null;
    showView('landing');
    renderLanding();
    updateURL(true); // pushState for navigation

    // Clear search inputs
    document.getElementById('headerSearchInput').value = '';
    const landingSearch = document.getElementById('landingSearchInput');
    if (landingSearch) landingSearch.value = '';
}

function navigateToSearch(query, sportFilter = null) {
    state.searchQuery = query;
    state.sportFilter = sportFilter;
    showView('search');
    renderSearchResults();
    updateURL(true); // pushState for navigation

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
    state.tab = 'odds';

    // Validate and set config - use first available if current is invalid
    const availableConfigs = getAvailableConfigs(productId);
    if (availableConfigs.length > 0 && !availableConfigs.includes(state.config)) {
        state.config = availableConfigs[0];
    }

    showView('product');
    renderProductPage();
    updateURL(true); // pushState for navigation
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
    renderProductTabs();
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
    state.sportFilter = sport;
    state.searchQuery = '';
    state.product = null;

    // Always show sport filter view (including 'all' for all products)
    showView('sportFilter');
    renderSportFilterView();

    updateURL(true); // pushState for navigation
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
// Search Autocomplete
// ========================================

let autocompleteTimeout = null;
let selectedIndex = -1;
let currentSuggestions = [];

function initAutocomplete() {
    const input = document.getElementById('headerSearchInput');
    const dropdown = document.getElementById('searchDropdown');

    // Input event with debounce
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (autocompleteTimeout) clearTimeout(autocompleteTimeout);

        if (query.length < 2) {
            hideAutocomplete();
            return;
        }

        autocompleteTimeout = setTimeout(() => {
            const results = searchProducts(query, state.sportFilter).slice(0, 8);
            currentSuggestions = results;
            selectedIndex = -1;
            renderAutocomplete(results, query);
        }, 150);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('hidden')) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, currentSuggestions.length - 1);
                updateAutocompleteSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateAutocompleteSelection();
            } else if (e.key === 'Enter') {
                if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
                    e.preventDefault();
                    selectAutocompleteItem(currentSuggestions[selectedIndex]);
                } else if (input.value.trim()) {
                    hideAutocomplete();
                    navigateToSearch(input.value.trim(), state.sportFilter);
                }
            } else if (e.key === 'Escape') {
                hideAutocomplete();
            }
        } else if (e.key === 'Enter' && input.value.trim()) {
            navigateToSearch(input.value.trim(), state.sportFilter);
        }
    });

    // Close on blur (with delay for click handling)
    input.addEventListener('blur', () => {
        setTimeout(() => hideAutocomplete(), 200);
    });

    // Focus shows dropdown if there's a query
    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 2 && currentSuggestions.length > 0) {
            dropdown.classList.remove('hidden');
        }
    });
}

function renderAutocomplete(results, query) {
    const dropdown = document.getElementById('searchDropdown');

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div class="search-no-results">No products found for "${query}"</div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    const highlightMatch = (text, query) => {
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const html = results.map((product, index) => `
        <div class="search-dropdown-item ${index === selectedIndex ? 'selected' : ''}"
             data-product-id="${product.id}"
             onmouseenter="updateAutocompleteHover(${index})">
            <div class="search-item-name">${highlightMatch(product.name, query)}</div>
            <div class="search-item-meta">${product.sport} • ${product.year}</div>
        </div>
    `).join('');

    dropdown.innerHTML = html + `
        <div class="search-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
        </div>
    `;

    dropdown.classList.remove('hidden');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const productId = item.dataset.productId;
            const product = currentSuggestions.find(p => p.id === productId);
            if (product) selectAutocompleteItem(product);
        });
    });
}

function updateAutocompleteSelection() {
    const dropdown = document.getElementById('searchDropdown');
    const items = dropdown.querySelectorAll('.search-dropdown-item');

    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function updateAutocompleteHover(index) {
    selectedIndex = index;
    updateAutocompleteSelection();
}

function selectAutocompleteItem(product) {
    hideAutocomplete();
    document.getElementById('headerSearchInput').value = '';
    navigateToProduct(product.id);
}

function hideAutocomplete() {
    const dropdown = document.getElementById('searchDropdown');
    dropdown.classList.add('hidden');
    selectedIndex = -1;
}

// Make hover handler global
window.updateAutocompleteHover = updateAutocompleteHover;

// ========================================
// Landing Search Autocomplete
// ========================================

let landingAutocompleteTimeout = null;
let landingSelectedIndex = -1;
let landingCurrentSuggestions = [];

function initLandingAutocomplete() {
    const input = document.getElementById('landingSearchInput');
    const dropdown = document.getElementById('landingSearchDropdown');

    if (!input || !dropdown) return;

    // Input event with debounce
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        if (landingAutocompleteTimeout) clearTimeout(landingAutocompleteTimeout);

        if (query.length < 2) {
            hideLandingAutocomplete();
            return;
        }

        landingAutocompleteTimeout = setTimeout(() => {
            const results = searchProducts(query, null).slice(0, 8);
            landingCurrentSuggestions = results;
            landingSelectedIndex = -1;
            renderLandingAutocomplete(results, query);
        }, 150);
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('hidden')) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                landingSelectedIndex = Math.min(landingSelectedIndex + 1, landingCurrentSuggestions.length - 1);
                updateLandingAutocompleteSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                landingSelectedIndex = Math.max(landingSelectedIndex - 1, -1);
                updateLandingAutocompleteSelection();
            } else if (e.key === 'Enter') {
                if (landingSelectedIndex >= 0 && landingCurrentSuggestions[landingSelectedIndex]) {
                    e.preventDefault();
                    selectLandingAutocompleteItem(landingCurrentSuggestions[landingSelectedIndex]);
                } else if (input.value.trim()) {
                    hideLandingAutocomplete();
                    navigateToSearch(input.value.trim(), null);
                }
            } else if (e.key === 'Escape') {
                hideLandingAutocomplete();
            }
        } else if (e.key === 'Enter' && input.value.trim()) {
            navigateToSearch(input.value.trim(), null);
        }
    });

    // Close on blur (with delay for click handling)
    input.addEventListener('blur', () => {
        setTimeout(() => hideLandingAutocomplete(), 200);
    });

    // Focus shows dropdown if there's a query
    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length >= 2 && landingCurrentSuggestions.length > 0) {
            dropdown.classList.remove('hidden');
        }
    });
}

function renderLandingAutocomplete(results, query) {
    const dropdown = document.getElementById('landingSearchDropdown');

    if (results.length === 0) {
        dropdown.innerHTML = `
            <div class="search-no-results">No products found for "${query}"</div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }

    const highlightMatch = (text, query) => {
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    };

    const html = results.map((product, index) => `
        <div class="search-dropdown-item ${index === landingSelectedIndex ? 'selected' : ''}"
             data-product-id="${product.id}"
             onmouseenter="updateLandingAutocompleteHover(${index})">
            <div class="search-item-name">${highlightMatch(product.name, query)}</div>
            <div class="search-item-meta">${product.sport} • ${product.year}</div>
        </div>
    `).join('');

    dropdown.innerHTML = html + `
        <div class="search-hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span>
            <span><kbd>Enter</kbd> Select</span>
            <span><kbd>Esc</kbd> Close</span>
        </div>
    `;

    dropdown.classList.remove('hidden');

    // Add click handlers
    dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const productId = item.dataset.productId;
            const product = landingCurrentSuggestions.find(p => p.id === productId);
            if (product) selectLandingAutocompleteItem(product);
        });
    });
}

function updateLandingAutocompleteSelection() {
    const dropdown = document.getElementById('landingSearchDropdown');
    const items = dropdown.querySelectorAll('.search-dropdown-item');

    items.forEach((item, index) => {
        if (index === landingSelectedIndex) {
            item.classList.add('selected');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('selected');
        }
    });
}

function updateLandingAutocompleteHover(index) {
    landingSelectedIndex = index;
    updateLandingAutocompleteSelection();
}

function selectLandingAutocompleteItem(product) {
    hideLandingAutocomplete();
    document.getElementById('landingSearchInput').value = '';
    navigateToProduct(product.id);
}

function hideLandingAutocomplete() {
    const dropdown = document.getElementById('landingSearchDropdown');
    if (dropdown) {
        dropdown.classList.add('hidden');
        landingSelectedIndex = -1;
    }
}

// Quick search from landing page hints
function quickSearch(query) {
    navigateToSearch(query, null);
}

// Make handlers global
window.updateLandingAutocompleteHover = updateLandingAutocompleteHover;
window.quickSearch = quickSearch;

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // Logo click - return to landing
    document.getElementById('logoLink').addEventListener('click', (e) => {
        e.preventDefault();
        state.sportFilter = null;
        navigateToLanding();
    });

    // Initialize autocomplete
    initAutocomplete();
    initLandingAutocomplete();

    // Back buttons
    document.getElementById('searchBackBtn').addEventListener('click', navigateToLanding);
    document.getElementById('productBackBtn').addEventListener('click', () => {
        if (state.searchQuery) {
            navigateToSearch(state.searchQuery, state.sportFilter);
        } else if (state.sportFilter) {
            setSportFilter(state.sportFilter);
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
    // Always render the sidebar
    renderSportsSidebar();

    if (state.view === 'product' && state.product && PRODUCTS[state.product]) {
        showView('product');
        renderProductPage();
        updateTabActiveState();
    } else if (state.view === 'search' && state.searchQuery) {
        showView('search');
        renderSearchResults();
        document.getElementById('headerSearchInput').value = state.searchQuery;
    } else if (state.sportFilter) {
        // Sport is selected, show sport filter view
        showView('sportFilter');
        renderSportFilterView();
    } else {
        // No sport filter, show landing page
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
