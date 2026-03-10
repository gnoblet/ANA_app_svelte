<script>
	import Papa from 'papaparse';

	// ============================================
	// TableInput Component
	// ============================================
	// Purpose: Display CSV data in a formatted table
	// This component manages:
	// - Rendering CSV data in a Daisy UI table
	// - Download functionality to export CSV
	// - Reset functionality to clear table
	// - Dynamic table generation from headers and data
	// ============================================

	// Array of column headers extracted from CSV file
	// Example: ['Name', 'Email', 'Phone']
	export let headers = [];

	// Array of row objects containing CSV data
	// Example: [{ Name: 'John', Email: 'john@example.com', Phone: '123-456-7890' }]
	export let csvData = [];

	/**
	 * Downloads the current CSV data as a file
	 * - Converts data back to CSV format using PapaParse
	 * - Creates a downloadable blob
	 * - Triggers browser download with timestamp filename
	 * - Cleans up object URL after download
	 */
	function downloadCSV() {
		// Exit early if no data to download
		if (csvData.length === 0) return;

		// ============ CSV CONVERSION ============
		// Convert array of objects back into CSV string format
		const csv = Papa.unparse(csvData);

		// Create a Blob object with the CSV data and MIME type
		const blob = new Blob([csv], { type: 'text/csv' });

		// ============ FILE DOWNLOAD ============
		// Create a temporary URL for the blob
		const url = URL.createObjectURL(blob);

		// Create an invisible anchor element for download triggering
		const link = document.createElement('a');
		link.href = url;

		// Generate filename with timestamp to avoid conflicts
		// Example: export-1704067200000.csv
		link.download = `export-${new Date().getTime()}.csv`;

		// Programmatically click the link to trigger download
		link.click();

		// Clean up the temporary URL to free memory
		URL.revokeObjectURL(url);
	}

	/**
	 * Clears all table data and resets component state
	 * - Empties headers array
	 * - Empties data array
	 * - Removes table from view (via conditional in template)
	 */
	function resetTable() {
		// Clear all column headers
		headers = [];

		// Clear all row data
		csvData = [];
	}
</script>

<!-- ============ TABLE SECTION ============ -->
<!-- Only display table if there is data to show -->
{#if csvData.length > 0}
	<div class="px-4 py-12">
		<!-- Container with max width for better layout on large screens -->
		<div class="mx-auto max-w-6xl">
			<!-- ============ ACTION BUTTONS ============ -->
			<!-- Download and Reset buttons -->
			<div class="mb-6 flex justify-center gap-4">
				<!-- Download CSV button - triggers downloadCSV function -->
				<button class="btn btn-primary" on:click={downloadCSV}> Download CSV </button>

				<!-- Reset button - clears all data and hides table -->
				<button class="btn btn-outline" on:click={resetTable}> Reset </button>
			</div>

			<!-- ============ TABLE CONTAINER ============ -->
			<!-- Styled wrapper with border, background, and horizontal scroll support -->
			<div class="rounded-box border-base-content/5 bg-base-100 overflow-x-auto border">
				<!-- Daisy UI table with zebra stripe styling -->
				<table class="table-zebra table">
					<!-- ============ TABLE HEADER ============ -->
					<!-- Column headers row -->
					<thead>
						<tr>
							<!-- Empty header for row number column -->
							<th></th>

							<!-- Dynamically render each column header from CSV -->
							{#each headers as header}
								<th>{header}</th>
							{/each}
						</tr>
					</thead>

					<!-- ============ TABLE BODY ============ -->
					<!-- Data rows rendered from csvData array -->
					<tbody>
						<!-- Loop through each row of data -->
						{#each csvData as row, index}
							<!-- Row with hover effect for better UX -->
							<tr class="hover:bg-base-300">
								<!-- Row number starting from 1 -->
								<th>{index + 1}</th>

								<!-- Render cell for each header/column -->
								{#each headers as header}
									<!-- Display cell value or dash if empty -->
									<td>{row[header] || '-'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- ============ SUMMARY SECTION ============ -->
			<!-- Display total row count -->
			<div class="mt-6 text-center">
				<p class="text-lg font-semibold">Total rows: {csvData.length}</p>
			</div>
		</div>
	</div>
{:else}
	<div class="px-4 py-12">
		<div class="mx-auto max-w-6xl">
			<p class="text-center">No data to display.</p>
		</div>
	</div>
{/if}
