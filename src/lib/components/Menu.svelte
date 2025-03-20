<script lang="ts">
  import { goto } from '$app/navigation';
  let showFeatures = false;

  function toggleFeatures() {
    showFeatures = !showFeatures;
  }

  function selectFeature(feature: string) {
    goto(`/${feature}`);
    showFeatures = false;
  }
</script>

<nav class="bg-gray-800 text-white p-4 flex justify-between">
  <div class="text-xl font-bold">My App</div>
  <ul class="flex space-x-4 items-center">
    <li><a href="/" class="hover:underline">Home</a></li>
    <li class="relative">
      <button on:click={toggleFeatures} class="hover:underline focus:outline-none">
        Features
      </button>
      {#if showFeatures}
      <ul class="absolute bg-white text-black mt-2 p-2 rounded shadow">
        <li><button on:click={() => selectFeature('feature1')} class="hover:bg-gray-200 p-1 w-full text-left">Feature 1</button></li>
        <li><button on:click={() => selectFeature('feature2')} class="hover:bg-gray-200 p-1 w-full text-left">Feature 2</button></li>
      </ul>
      {/if}
    </li>
  </ul>
</nav> 