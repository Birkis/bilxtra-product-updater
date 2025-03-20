<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
</script>

<div class="min-h-screen flex flex-col">
	<nav class="bg-gray-800 text-white p-4">
		<div class="container mx-auto flex items-center justify-between">
			<div class="text-xl font-bold">Crystallize Tools</div>
			<div class="flex gap-6">
				<a 
					href="/" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/'}
				>
					Dashboard
				</a>
				<a 
					href="/orders_v3" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/orders_v3'}
				>
					Orders
				</a>
				<a 
					href="/search" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/search'}
				>
					Search
				</a>
				<a 
					href="/product-image-update" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/product-image-update'}
				>
					Product Image Update
				</a>
				<a 
					href="/thule-data" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/thule-data'}
				>
					Thule Data
				</a>
				<a 
					href="/thule-db" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/thule-db'}
				>
					Thule DB
				</a>
				<a 
					href="/tecdoc-search" 
					class="hover:text-gray-300"
					class:text-blue-400={$page?.url?.pathname === '/tecdoc-search'}
				>
					TecDoc Search
				</a>
			</div>
		</div>
	</nav>

	<main class="flex-1">
		<slot />
	</main>

	<footer class="bg-gray-100 py-4 mt-8">
		<div class="container mx-auto px-4 text-center text-gray-600">
			<a 
				href="/privacy" 
				class="hover:text-gray-900"
				class:text-blue-600={$page?.url?.pathname === '/privacy'}
			>
				Privacy Policy
			</a>
		</div>
	</footer>
</div>
