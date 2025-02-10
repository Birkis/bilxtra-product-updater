<script lang="ts">
	export let data;
	import Menu from '$lib/components/Menu.svelte';
	import Dashboard from '$lib/components/Dashboard.svelte';
</script>

<main>
	<Menu />
	<Dashboard data={data} />
</main>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		text-align: center;
		color: #2d3748;
		margin-bottom: 2rem;
		font-size: 2.5rem;
	}

	.tools-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
		padding: 1rem;
	}

	.tool-card {
		background: white;
		border-radius: 12px;
		padding: 1.5rem;
		text-decoration: none;
		color: inherit;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		transition: transform 0.2s, box-shadow 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
	}

	.tool-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 8px rgba(0, 0, 0, 0.15);
	}

	.icon {
		font-size: 2.5rem;
		margin-bottom: 1rem;
	}

	h2 {
		margin: 0;
		margin-bottom: 0.5rem;
		color: #2d3748;
		font-size: 1.25rem;
	}

	p {
		margin: 0;
		color: #4a5568;
		font-size: 0.875rem;
	}

	:global(body) {
		background-color: #f7fafc;
		margin: 0;
		font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}
</style>
