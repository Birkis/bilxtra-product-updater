<script lang="ts">
    import type { PageData } from './$types';
    
    let { data }: PageData = $props();
</script>

<h1>Product {data.productId}</h1>