// Application state - shared across modules
export const state = {
    // View state: 'landing', 'search', 'product'
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
        params.set('product', state.product);
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
    } else if (state.view === 'landing') {
        // Include sport filter on landing page
        if (state.sportFilter) {
            params.set('sport', state.sportFilter);
        }
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

    const product = params.get('product');
    const config = params.get('config');
    const tab = params.get('tab');
    const query = params.get('q');
    const sport = params.get('sport');

    if (product) {
        state.view = 'product';
        state.product = product;
        if (config) state.config = config;
        if (tab) state.tab = tab;
        // Preserve sport filter for back navigation
        if (sport) state.sportFilter = sport;
    } else if (query) {
        state.view = 'search';
        state.searchQuery = query;
        if (sport) state.sportFilter = sport;
    } else {
        state.view = 'landing';
        // Sport filter on landing page
        if (sport) state.sportFilter = sport;
    }
}
