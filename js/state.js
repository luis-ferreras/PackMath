// Application state - shared across modules
export const state = {
    sport: null,
    year: null,
    product: null,
    config: 'hobby',
    view: 'compare',
    compareTab: 'base',
    boxCount: 1,
    checklistSet: 'all',
    checklistTeam: 'all',
    checklistRookieOnly: false,
    checklistSearch: '',
    checklistSortBy: 'card_num',
    checklistSortDir: 'asc'
};

// URL Management
export function updateURL() {
    const params = new URLSearchParams();
    if (state.sport) params.set('sport', state.sport);
    if (state.year) params.set('year', state.year);
    if (state.product) params.set('product', state.product);
    if (state.config) params.set('config', state.config);
    if (state.view !== 'compare') params.set('view', state.view);
    const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newURL);
}
