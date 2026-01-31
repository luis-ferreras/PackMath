import { getProductSlug, getProductBySlug, getProduct } from './data.js';

// Application state - shared across modules
export const state = {
    // View state: 'landing', 'sportFilter', 'search', 'product'
    view: 'landing',

    // Search
    searchQuery: '',
    sportFilter: null,

    // Product selection
    product: null,
    config: 'hobby',

    // Product page tab: 'compare', 'rarity', 'calculator', 'checklist'
    tab: 'compare',

    // Compare sub-tab
    compareTab: 'base',

    // Calculator state
    boxCount: 1,
    calcTargetCard: null,

    // Checklist filters
    checklistSet: 'all',
    checklistTeam: 'all',
    checklistRookieOnly: false,
    checklistSearch: '',
    checklistSortBy: 'card_num',
    checklistSortDir: 'asc'
};

// URL Management
export function updateURL(usePushState = false) {
    const params = new URLSearchParams();

    if (state.view === 'product' && state.product) {
        // Use slug for cleaner URLs
        const slug = getProductSlug(state.product);
        if (slug) {
            params.set('product', slug);
        }
        if (state.config && state.config !== 'hobby') {
            params.set('config', state.config);
        }
        if (state.tab && state.tab !== 'compare') {
            params.set('tab', state.tab);
        }
    } else if (state.view === 'search' && state.searchQuery) {
        params.set('q', state.searchQuery);
        if (state.sportFilter) {
            params.set('sport', state.sportFilter);
        }
    } else if (state.view === 'sportFilter' && state.sportFilter) {
        // Sport filter view
        params.set('sport', state.sportFilter);
    } else if (state.view === 'landing') {
        // Landing page (no sport filter)
    }

    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;

    // Use pushState for navigation, replaceState for minor updates (config changes, etc.)
    if (usePushState) {
        window.history.pushState({ ...state }, '', newURL);
    } else {
        window.history.replaceState({ ...state }, '', newURL);
    }
}

// Parse URL on load
export function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);

    const productSlug = params.get('product');
    const config = params.get('config');
    const tab = params.get('tab');
    const query = params.get('q');
    const sport = params.get('sport');

    if (productSlug) {
        // Look up product by slug
        const product = getProductBySlug(productSlug);
        if (product) {
            state.view = 'product';
            state.product = product.id; // Store internal ID, not slug
            if (config) state.config = config;
            if (tab) state.tab = tab;
            // Preserve sport filter for back navigation
            if (sport) state.sportFilter = sport;
        } else {
            // Invalid slug - fall back to landing
            state.view = 'landing';
            if (sport) state.sportFilter = sport;
        }
    } else if (query) {
        state.view = 'search';
        state.searchQuery = query;
        if (sport) state.sportFilter = sport;
    } else if (sport) {
        // Sport filter view
        state.view = 'sportFilter';
        state.sportFilter = sport;
    } else {
        // Landing page
        state.view = 'landing';
        state.sportFilter = null;
    }
}
