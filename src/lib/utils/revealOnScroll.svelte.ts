export interface RevealOptions {
	/** Translate Y offset to start from (px). Default: 24 */
	y?: number;
	/** Translate X offset to start from (px). Default: 0 */
	x?: number;
	/** Animation duration in ms. Default: 450 */
	duration?: number;
	/** Delay in ms before animation starts. Default: 0 */
	delay?: number;
	/** Easing CSS string. Default: cubic-bezier(0.16, 1, 0.3, 1) (expo out) */
	easing?: string;
	/** IntersectionObserver rootMargin. Default: '0px 0px -8% 0px' */
	rootMargin?: string;
}

/**
 * Attachment factory: reveals an element with a fly-in animation when it
 * enters the viewport. Respects `prefers-reduced-motion`.
 *
 * Usage:
 *   <div {@attach revealOnScroll()}>...</div>
 *   <div {@attach revealOnScroll({ y: 32, delay: 100 })}>...</div>
 */
export function revealOnScroll({
	y = 24,
	x = 0,
	duration = 450,
	delay = 0,
	easing = 'cubic-bezier(0.16, 1, 0.3, 1)',
	rootMargin = '0px 0px -8% 0px'
}: RevealOptions = {}) {
	return (node: HTMLElement) => {
		const prefersReduced =
			typeof window !== 'undefined' &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		if (prefersReduced) return;

		// Set initial hidden state via inline style
		node.style.opacity = '0';
		node.style.transform = `translate(${x}px, ${y}px)`;
		node.style.willChange = 'opacity, transform';

		const play = () => {
			node.style.transition = `opacity ${duration}ms ${easing} ${delay}ms, transform ${duration}ms ${easing} ${delay}ms`;
			node.style.opacity = '1';
			node.style.transform = 'translate(0, 0)';
			node.style.willChange = 'auto';
			obs.disconnect();
			// Clear transform after animation so it doesn't create a containing block
			// for position:fixed descendants (which would break tooltip positioning).
			const totalMs = duration + delay + 50;
			setTimeout(() => {
				node.style.transition = '';
				node.style.transform = '';
			}, totalMs);
		};

		const obs = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) play();
			},
			{ rootMargin }
		);

		obs.observe(node);

		return () => obs.disconnect();
	};
}
