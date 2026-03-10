<script lang="ts">
	import ParseCSV from '$lib/components/ParseCSV.svelte';
	import TableInput from '$lib/components/TableInput.svelte';

	let csvData: object[] = $state([]);
	let headers: string[] = $state([]);

	function handleDataParsed(parsedHeaders: string[], parsedData: object[]): void {
		headers = parsedHeaders;
		csvData = parsedData;
	}

	function handleReset(): void {
		headers = [];
		csvData = [];
	}
</script>

<div class="w-full">
	<div class="hero bg-base-200 min-h-screen">
		<div class="hero-content text-center">
			<div class="max-w-lg">
				<h1 class="text-5xl font-bold">
					This is a simple app to add your input data and visualize
				</h1>
				<p class="py-6">
					Upload a CSV file to parse and display your data in a formatted table. You can then
					download the data or make modifications as needed.
				</p>
				<ParseCSV onDataParsed={handleDataParsed} />
			</div>
		</div>
	</div>

	<TableInput {headers} {csvData} />
</div>
