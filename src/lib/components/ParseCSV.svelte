<script lang="ts">
	import Papa from 'papaparse';
	import type { ParseResult } from 'papaparse';

	// ============================================
	// ParseCSV Component
	// ============================================
	// Purpose: Handle CSV file upload and parsing
	// This component manages:
	// - File input and validation
	// - CSV parsing using PapaParse library
	// - Emitting parsed data to parent component
	// ============================================

	// Reference to the file input element for manipulation
	let fileInput;

	// Stores the name of the currently loaded file
	let fileName = '';

	// Callback function exported to parent component
	// Called when CSV data is successfully parsed
	// Parameters: (headers: string[], data: object[])
	export let onDataParsed = () => {};

	/**
	 * Handles file selection and CSV parsing
	 * - Validates file exists
	 * - Checks file size (max 2MB)
	 * - Parses CSV with PapaParse
	 * - Extracts headers and data
	 * - Calls parent callback with results
	 */
	/**
	 * TypeScript Type Annotation Explanation:
	 * - Event: Base event type from the DOM
	 * - & (intersection operator): Combines two types together
	 * - { target: HTMLInputElement }: Specifies that event.target is specifically an HTMLInputElement
	 *
	 * This tells TypeScript that:
	 * 1. The parameter is a standard DOM Event
	 * 2. The target property is an HTMLInputElement (file input)
	 * 3. We can safely access .files property without type casting
	 *
	 * Without this type, TypeScript wouldn't know that event.target has a 'files' property
	 */
	function handleFileSelect(event: Event & { target: HTMLInputElement }) {
		// Get the selected file from the input element
		const file = event.target.files?.[0];

		// Exit early if no file selected
		if (!file) return;

		// ============ FILE VALIDATION ============
		// Check file size - must be under 2MB (2,097,152 bytes)
		if (file.size > 2 * 1024 * 1024) {
			alert('File size exceeds 2MB limit');
			return;
		}

		// Store the filename for display to user
		fileName = file.name;

		// ============ CSV PARSING ============
		// Use PapaParse to parse the CSV file
		Papa.parse(file, {
			// Treat first row as column headers
			header: true,
			// Keep all values as strings (don't auto-convert numbers)
			dynamicTyping: false,
			// Skip any completely empty rows
			skipEmptyLines: true,
			// Callback when parsing completes successfully
			/**
			 * Results Parameter Type Explanation:
			 * ParseResult is a TypeScript type from PapaParse that includes:
			 * - data: The parsed CSV data as an array of objects
			 * - errors: Array of parsing errors (if any)
			 * - meta: Metadata about the parsing process
			 *
			 * By typing the results parameter, TypeScript knows:
			 * 1. results.data exists and is an array
			 * 2. results.data[0] is an object with column values
			 * 3. We can safely access these properties without type errors
			 *
			 * Without this type, TypeScript would not know what properties are available
			 */
			complete: (results: ParseResult<object>) => {
				// Check if we have valid data
				if (results.data && results.data.length > 0) {
					// Extract column headers from the first row's keys
					const headers = Object.keys(results.data[0]);
					// Send headers and parsed data to parent component
					onDataParsed(headers, results.data);
				}
			},
			// Callback if parsing encounters an error
			error: (error) => {
				alert(`Error parsing CSV: ${error.message}`);
			}
		});
	}

	/**
	 * Clears the loaded file and resets component state
	 * - Clears filename display
	 * - Resets file input element
	 * - Notifies parent that data is cleared
	 */
	function resetFile() {
		// Clear the displayed filename
		fileName = '';

		// Reset the file input element to allow selecting the same file again
		if (fileInput) {
			fileInput.value = '';
		}

		// Notify parent component that data has been cleared
		onDataParsed([], []);
	}
</script>

<!-- ============ TEMPLATE ============ -->
<!-- File upload form with Daisy UI styling -->
<div class="flex items-center justify-center">
	<fieldset class="fieldset">
		<!-- Form legend/title -->
		<legend class="fieldset-legend">Pick a CSV file</legend>

		<!-- File input element -->
		<!-- Accepts only .csv files -->
		<!-- Triggers handleFileSelect when file is chosen -->
		<input
			type="file"
			accept=".csv"
			class="file-input file-input-primary"
			on:change={handleFileSelect}
			bind:this={fileInput}
		/>

		<!-- Helper text with file size limit -->
		<label class="label">Max size 2MB</label>

		<!-- Display loaded filename if a file was selected -->
		{#if fileName}
			<label class="label">
				<span class="label-text">Loaded: {fileName}</span>
			</label>
		{/if}

		<!-- Show clear button only if a file is loaded -->
		{#if fileName}
			<button class="btn btn-sm btn-outline mt-2" on:click={resetFile}> Clear File </button>
		{/if}
	</fieldset>
</div>
