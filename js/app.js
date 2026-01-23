import { loadData, getAvailableSports, getYearsBySport, getProducts, getAvailableConfigs, PRODUCTS } from './data.js';
import { state, updateURL } from './state.js';
import { renderProductContent } from './render.js';

// Event Handlers
function onSportChange(sport, doUpdateUrl = true) {
    state.sport = sport;
    state.year = null;
    state.product = null;

    const yearSelect = document.getElementById('yearSelect');
    const years = getYearsBySport(sport);
    yearSelect.innerHTML = '<option value="" disabled selected>Select year...</option>';
    years.forEach(y => yearSelect.innerHTML += `<option value="${y}">${y}</option>`);
    yearSelect.disabled = false;

    document.getElementById('productSelect').innerHTML = '<option value="" disabled selected>Select product...</option>';
    document.getElementById('productSelect').disabled = true;
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('productContent').classList.add('hidden');

    if (doUpdateUrl) updateURL();
}

function onYearChange(year, doUpdateUrl = true) {
    state.year = year;
    state.product = null;

    const productSelect = document.getElementById('productSelect');
    const products = getProducts(state.sport, year);
    productSelect.innerHTML = '<option value="" disabled selected>Select product...</option>';
    products.forEach(p => productSelect.innerHTML += `<option value="${p.id}">${p.brand}</option>`);
    productSelect.disabled = false;

    if (doUpdateUrl) updateURL();
}

function onProductChange(productId, doUpdateUrl = true) {
    state.product = productId;

    const availableConfigs = getAvailableConfigs(productId);
    if (availableConfigs.length > 0 && !availableConfigs.includes(state.config)) {
        state.config = availableConfigs[0];
    }

    // Populate and show config selector in sidebar
    const configGroup = document.getElementById('configGroup');
    const configSelect = document.getElementById('configSelect');
    if (availableConfigs.length > 0) {
        configSelect.innerHTML = availableConfigs.map(c =>
            `<option value="${c}" ${c === state.config ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
        ).join('');
        configGroup.style.display = 'block';
    } else {
        configGroup.style.display = 'none';
    }

    document.getElementById('emptyState').classList.add('hidden');
    document.getElementById('productContent').classList.remove('hidden');
    renderProductContent();

    if (doUpdateUrl) updateURL();
}

function setConfig(config) {
    state.config = config;
    // Update sidebar config select if it exists
    const configSelect = document.getElementById('configSelect');
    if (configSelect) configSelect.value = config;
    renderProductContent();
    updateURL();
}

function setView(view) {
    state.view = view;
    updateNavActiveState();
    renderProductContent();
    updateURL();
}

function setCompareTab(tab) {
    state.compareTab = tab;
    renderProductContent();
}

function setBoxCount(count) {
    state.boxCount = count;
    renderProductContent();
}

function setChecklistSet(set) {
    state.checklistSet = set;
    renderProductContent();
}

function setChecklistTeam(team) {
    state.checklistTeam = team;
    renderProductContent();
}

function setChecklistRookieOnly(checked) {
    state.checklistRookieOnly = checked;
    renderProductContent();
}

// Debounce helper
let searchTimeout = null;
function setChecklistSearch(query) {
    state.checklistSearch = query;

    // Debounce the re-render to avoid losing focus
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        const activeEl = document.activeElement;
        const isSearchFocused = activeEl && activeEl.id === 'checklistSearchInput';
        const cursorPos = isSearchFocused ? activeEl.selectionStart : 0;

        renderProductContent();

        // Restore focus and cursor position
        if (isSearchFocused) {
            const searchInput = document.getElementById('checklistSearchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.setSelectionRange(cursorPos, cursorPos);
            }
        }
    }, 150);
}

// Update active state on nav buttons
function updateNavActiveState() {
    document.querySelectorAll('.nav-link').forEach(link => {
        const view = link.getAttribute('data-view');
        if (view === state.view) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Make handlers available globally for onclick
window.setConfig = setConfig;
window.setView = setView;
window.setCompareTab = setCompareTab;
window.setBoxCount = setBoxCount;
window.setChecklistSet = setChecklistSet;
window.setChecklistTeam = setChecklistTeam;
window.setChecklistRookieOnly = setChecklistRookieOnly;
window.setChecklistSearch = setChecklistSearch;

// URL loading helper
function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    const sport = params.get('sport');
    const year = params.get('year');
    const product = params.get('product');
    const config = params.get('config');
    const view = params.get('view');

    if (config) {
        state.config = config;
        const configSelect = document.getElementById('configSelect');
        if (configSelect) configSelect.value = config;
    }
    if (view && ['compare', 'bubbles', 'calculator', 'checklist', 'insights'].includes(view)) {
        state.view = view;
        updateNavActiveState();
    }

    if (sport && getAvailableSports().includes(sport)) {
        document.getElementById('sportSelect').value = sport;
        onSportChange(sport, false);
        if (year && getYearsBySport(sport).includes(year)) {
            document.getElementById('yearSelect').value = year;
            onYearChange(year, false);
            if (product && PRODUCTS[product]) {
                document.getElementById('productSelect').value = product;
                onProductChange(product, false);
            }
        }
    }
}

// Initialize nav button listeners
function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            const view = link.getAttribute('data-view');
            if (view) {
                setView(view);
            }
        });
    });
}

// Initialize
async function init() {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const emptyState = document.getElementById('emptyState');

    const success = await loadData();

    loadingState.classList.add('hidden');

    if (!success) {
        errorState.classList.remove('hidden');
        return;
    }

    emptyState.classList.remove('hidden');

    const sportSelect = document.getElementById('sportSelect');
    getAvailableSports().forEach(sport => {
        sportSelect.innerHTML += `<option value="${sport}">${sport}</option>`;
    });

    sportSelect.addEventListener('change', e => onSportChange(e.target.value));
    document.getElementById('yearSelect').addEventListener('change', e => onYearChange(e.target.value));
    document.getElementById('productSelect').addEventListener('change', e => onProductChange(e.target.value));
    document.getElementById('configSelect').addEventListener('change', e => setConfig(e.target.value));

    // Initialize sidebar navigation
    initNavigation();

    loadStateFromURL();
}

document.addEventListener('DOMContentLoaded', init);
