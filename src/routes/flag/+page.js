// This page can be pre-rendered with an empty/placeholder state
// When users navigate here with data in sessionStorage, the onMount hook loads and displays it
// This provides both SEO benefits (page exists) and dynamic updates (data loads on client)
export const prerender = true;
