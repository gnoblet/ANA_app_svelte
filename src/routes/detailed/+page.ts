// The detailed route reads from localStorage-backed stores (flagStore, indicatorsStore)
// which are browser-only. The page itself is a static shell that can be prerendered —
// stores hydrate in the browser after load, so direct reloads on GitHub Pages work.
