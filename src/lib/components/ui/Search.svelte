<script lang="ts">
  export let value: string = '';
  export let placeholder: string = 'Search…';
  export let extraClass: string = '';
  export let required: boolean = false;
</script>

<label class={"input input-sm bg-white" + extraClass}>
<svg class="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
    <g stroke-linejoin="round" stroke-linecap="round" stroke-width="2.5" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.3-4.3"></path>
    </g>
  </svg>
  <input
    type="search"
    class="grow"
    placeholder={placeholder}
    bind:value={value}
    aria-label="Search"
    {required}
  />
</label>
