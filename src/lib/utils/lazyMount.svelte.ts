/**
 * Attachment factory: fires `onVisible` once when the element first enters
 * the viewport (+ rootMargin buffer), then disconnects. Used to defer
 * mounting heavy components until the user scrolls near them.
 *
 * Usage:
 *   <div {@attach lazyMount(() => (ready = true))}>…</div>
 */
export function lazyMount(onVisible: () => void, rootMargin = '600px 0px') {
	return (node: HTMLElement) => {
		const obs = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					onVisible();
					obs.disconnect();
				}
			},
			{ rootMargin }
		);
		obs.observe(node);
		return () => obs.disconnect();
	};
}
