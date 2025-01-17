<script lang="ts">
	const tools = [
		{
			title: 'Product Image Update',
			description: 'Update product images in bulk',
			href: '/product-image-update',
			icon: '🖼️'
		},
		{
			title: 'SKU Management',
			description: 'Manage and update SKUs',
			href: '/skus',
			icon: '🏷️'
		},
		{
			title: 'Orders',
			description: 'View and manage orders',
			href: '/orders_v3',
			icon: '📦'
		},
		{
			title: 'Products',
			description: 'Product management tools',
			href: '/products',
			icon: '🛍️'
		},
		{
			title: 'Search',
			description: 'Search functionality',
			href: '/search',
			icon: '🔍'
		},
		{
			title: 'Thule Data',
			description: 'Download latest Thule master data',
			href: '/thule-data',
			icon: '📥'
		}
	];
</script>

<div class="container">
	<h1>Webshop Utilities</h1>
	<div class="tools-grid">
		{#each tools as tool}
			<a href={tool.href} class="tool-card">
				<span class="icon">{tool.icon}</span>
				<h2>{tool.title}</h2>
				<p>{tool.description}</p>
			</a>
		{/each}
	</div>
</div>

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
