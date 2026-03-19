<script lang="ts">
	import * as d3 from 'd3';
	import {
		systemBaseColor,
		factorColor,
		subfactorColor,
		formatIndicatorTooltip
	} from '$lib/components/viz/colors';

	// Typing for the hierarchical pack datum produced by the generator.
	type PackDatum = {
		name: string;
		children?: PackDatum[];
		value?: number;
		id?: string;
		indicator?: Record<string, unknown>;
		// other fields are allowed but not required here
	};

	// Receive plot data as prop. Expect the hierarchical structure (root node).
	export let data: PackDatum;

	// Specify the dimensions of the chart.
	const width = 928;
	const height = width;
	const margin = 10; // to avoid clipping the root circle stroke

	// Specify the number format for values.
	const format = d3.format(',d');

	// Create the pack layout with typed API.
	const pack = d3
		.pack<PackDatum>()
		.size([width - margin * 2, height - margin * 2])
		.padding(3);

	// Compute the hierarchy from the JSON data; recursively sum the
	// values for each node; sort the tree by descending value; lastly
	// apply the pack layout. Types are explicit so no casts are required.
	const root = (() => {
		const hierarchy = d3
			.hierarchy<PackDatum>(data)
			.sum((d) => d.value ?? 0)
			.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

		// pack returns a HierarchyCircularNode<PackDatum>
		return pack(hierarchy);
	})();
</script>

<svg
	{width}
	{height}
	viewBox="{-margin} {-margin} {width} {height}"
	style:max-width="100%"
	style:height="auto"
	style:font="10px sans-serif"
>
	<g class="data">
		<!-- Loop through each of the descendants. -->
		{#each root.descendants() as d (d.data.id)}
			<!-- Define some useful variables to display and position data. -->
			{@const path = `${d
				.ancestors()
				.map((a) => a.data.name)
				.reverse()
				.join('/')}`}
			{@const value = `${format(d.value ?? 0)}`}
			{@const title = `${path}\n${value}`}

			{@const words = d.data.name.split(/(?=[A-Z][a-z])|\s+/g)}
			{@const offsetValues = `${words.length / 2 + 0.35}em`}

			<!-- Place each node according to the layout’s x and y values. -->
			<g transform="translate({d.x}, {d.y})">
				<!-- Add a title. Use indicator tooltip when available. -->
				<title>{d.data.indicator ? formatIndicatorTooltip(d.data.indicator) : title}</title>

				<!-- Add a filled or stroked circle. Colour chosen from system/factor/subfactor palettes. -->
				<circle
					fill={(() => {
						// derive an ancestors array of ids from root -> ... -> node (root at index 0)
						// prefer node `id` when available; fall back to `name` for compatibility
						const ancestors = d
							.ancestors()
							.map((a) => a.data.id ?? a.data.name)
							.reverse();
						const systemId = ancestors[1]; // root is at 0 ('root'), system at 1

						// depth: 1=system, 2=factor, 3=subfactor, 4=indicator (leaf)
						if (d.depth === 1) return systemBaseColor(systemId);
						if (d.depth === 2)
							return factorColor(
								systemId,
								d.parent ? d.parent.children.indexOf(d) : 0,
								d.parent ? d.parent.children.length : undefined
							);
						if (d.depth === 3)
							return subfactorColor(
								systemId,
								d.parent ? d.parent.children.indexOf(d) : 0,
								d.parent ? d.parent.children.indexOf(d) : 0,
								d.parent ? d.parent.children.length : undefined
							);
						// indicator leaf: map to subfactor/factor colouring (dimmed)
						const subIdx = d.parent ? d.parent.children.indexOf(d) : 0;
						const facIdx =
							d.parent && d.parent.parent ? d.parent.parent.children.indexOf(d.parent) : 0;
						return subfactorColor(
							systemId,
							facIdx,
							subIdx,
							d.parent ? d.parent.children.length : undefined
						);
					})()}
					stroke={d.children ? '#bbb' : '#666'}
					r={d.r}
				/>

				<!-- Add a label to leaf nodes. -->
				{#if !d.children && d.r > 10}
					<text clip-path={`circle(${d.r})`}>
						<!-- Loop through the words to be displayed. -->
						{#each words as word, i (i)}
							{@const offsetWords = `${i - words.length / 2 + 0.35}em`}

							<!-- Add a tspan for each CamelCase-separated word. -->
							<tspan x={0} y={offsetWords} text-anchor="middle" dominant-baseline="middle">
								{word}
							</tspan>
						{/each}

						<!-- Add a tspan for the node’s value. -->
						<tspan
							x={0}
							y={offsetValues}
							text-anchor="middle"
							dominant-baseline="middle"
							fill-opacity="0.7"
						>
							{value}
						</tspan>
					</text>
				{/if}
			</g>
		{/each}
	</g>
</svg>
