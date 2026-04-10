/** Shared reactive state for the explore-page scroll-spy section tracker.
 *  Written by /results/+page.svelte, read by +layout.svelte to drive ExploreNav. */
const exploreNav = $state({ activeSection: 'overview' });

export default exploreNav;
