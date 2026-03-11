<script>
  // Props: result from validateCsv, header array, rows array, optional indicatorMap
  export let result = null;
  export let header = [];
  export let rows = [];
  export let indicatorMap = {};

  // Small helpers
  const previewRows = () => (rows && Array.isArray(rows) ? rows.slice(0, 10) : []);
  const numDataRows = () => (rows && Array.isArray(rows) ? rows.length : 0);
  const numCols = () => (header && Array.isArray(header) ? header.length : 0);

  function formatCell(v) {
    if (v === null || v === undefined) return '';
    return String(v);
  }
</script>

<style>
  .validation {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    color: #111827;
  }

  .summary {
    padding: 0.75rem;
    border-radius: 6px;
    background: #f8fafc;
    border: 1px solid #e6edf3;
    margin-bottom: 0.75rem;
  }

  .ok {
    color: #065f46;
    font-weight: 600;
  }
  .error {
    color: #b91c1c;
    font-weight: 600;
  }
  .warning {
    color: #92400e;
    font-weight: 600;
  }

  .section {
    margin-top: 0.75rem;
    padding: 0.5rem 0;
  }

  ul {
    margin: 0.25rem 0 0.5rem 1.25rem;
  }

  table.preview {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
    margin-top: 0.5rem;
  }

  table.preview th,
  table.preview td {
    border: 1px solid #e5e7eb;
    padding: 0.35rem 0.5rem;
    text-align: left;
  }

  table.preview th {
    background: #f3f4f6;
    font-weight: 600;
  }

  .small {
    font-size: 0.9rem;
    color: #374151;
  }

  .muted {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .errors-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.5rem;
  }
  .errors-table th, .errors-table td {
    border: 1px solid #e5e7eb;
    padding: 0.35rem 0.5rem;
    text-align: left;
  }
  .errors-table th { background: #fff1f2; }

  .empty {
    color: #6b7280;
    font-style: italic;
  }
</style>

<div class="validation">
  <div class="summary">
    {#if result}
      {#if result.ok}
        <div class="ok">Validation passed</div>
      {:else}
        <div class="error">Validation failed</div>
      {/if}
      <div class="small" style="margin-top:0.25rem">
        Checked {numDataRows()} row(s) × {numCols()} column(s).
        {#if result.headerErrors && result.headerErrors.length}
          <div class="muted">Header errors: {result.headerErrors.length}</div>
        {/if}
        {#if result.cellErrors && result.cellErrors.length}
          <div class="muted">Cell errors: {result.cellErrors.length}</div>
        {/if}
        {#if result.warnings && result.warnings.length}
          <div class="muted">Warnings: {result.warnings.length}</div>
        {/if}
      </div>
    {:else}
      <div class="muted">No validation run yet</div>
    {/if}
  </div>

  {#if result && result.headerErrors && result.headerErrors.length}
    <div class="section">
      <div class="error">Header errors</div>
      <ul>
        {#each result.headerErrors as he, i (i)}
          <li>{he}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if result && result.duplicateUoas && result.duplicateUoas.length}
    <div class="section">
      <div class="error">Duplicate UOA values</div>
      <ul>
        {#each result.duplicateUoas as d, i (i)}
          <li>
            <strong>{d.uoa}</strong> &mdash; rows: {Array.isArray(d.rows) ? d.rows.join(', ') : d.rows}
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if result && result.cellErrors && result.cellErrors.length}
    <div class="section">
      <div class="error">Cell errors ({result.cellErrors.length})</div>
      <table class="errors-table" aria-live="polite">
        <thead>
          <tr>
            <th>Row</th>
            <th>Col</th>
            <th>Column</th>
            <th>Value</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {#each result.cellErrors as e, i (i)}
            <tr>
              <td>{e.row}</td>
              <td>{(e.colIndex != null) ? (e.colIndex + 1) : (e.col || '')}</td>
              <td>{e.colName ?? ''}</td>
              <td><code>{formatCell(e.value)}</code></td>
              <td>{e.message}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if result && result.warnings && result.warnings.length}
    <div class="section">
      <div class="warning">Warnings ({result.warnings.length})</div>
      <ul>
        {#each result.warnings as w, i (i)}
          <li>{w}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div class="section">
    <div class="small"><strong>CSV preview</strong> (first {Math.min(10, numDataRows())} row(s))</div>
    {#if header && header.length}
      <table class="preview" role="table" aria-label="CSV preview">
        <thead>
          <tr>
            {#each header as h, hi (hi)}
              <th>{h}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each previewRows() as row, ri (ri)}
            <tr>
              {#each row as cell, ci (ci)}
                <td><code>{formatCell(cell)}</code></td>
              {/each}
              {#if row.length < header.length}
                {#each Array(header.length - row.length) as _, pad (pad)}
                  <td class="empty">&nbsp;</td>
                {/each}
              {/if}
            </tr>
          {/each}
          {#if previewRows().length === 0}
            <tr><td colspan={header.length} class="muted">No data rows</td></tr>
          {/if}
        </tbody>
      </table>
    {:else}
      <div class="muted">No header to preview</div>
    {/if}
  </div>
</div>
