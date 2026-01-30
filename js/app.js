import { loadData, getAvailableSports, getAllProducts, searchProducts, getProduct, getAvailableConfigs, PRODUCTS } from './data.js';
import { state, updateURL, loadStateFromURL } from './state.js';
import { renderLanding, renderSearchResults, renderProductPage, renderTabContent, renderSportsSidebar } from './render.js';

// ========================================
// View Management
// ========================================

function showView(viewName) {
    // Hide all views
    document.getElementById('landingView').classList.add('hidden');
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
    showView('landing');
    renderLanding();
    updateURL(true); // pushState for navigation

    // Clear search input
    document.getElementById('headerSearchInput').value = '';
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
    state.tab = 'compare';
    state.compareTab = 'base';

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
    const wasOnDifferentView = state.view !== 'landing';
    state.sportFilter = sport;
    // If on search or product view, go back to landing
    if (wasOnDifferentView) {
        state.searchQuery = '';
        state.product = null;
        showView('landing');
    }
    renderLanding();
    updateURL(wasOnDifferentView); // pushState only if changing views
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
// Event Listeners
// ========================================

function initEventListeners() {
    // Logo click - return to landing
    document.getElementById('logoLink').addEventListener('click', (e) => {
        e.preventDefault();
        navigateToLanding();
    });

    // Initialize autocomplete
    initAutocomplete();

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
