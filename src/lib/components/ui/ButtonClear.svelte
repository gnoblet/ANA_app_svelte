<script lang="ts">
	interface Props {
		label?: string;
		size?: 'xs' | 'sm' | 'md';
		onclick?: () => void;
	}

	let { label = 'Clear', size = 'sm', onclick }: Props = $props();
</script>

<button type="button" class="btn btn-ghost btn-outline border-base-content/30 btn-{size}" {onclick}
	>{label}</button
>
