import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import ViteYaml from 'vite-plugin-yaml';

export default defineConfig({
	plugins: [
		sveltekit(),
		ViteYaml()
	],
	assetsInclude: ['**/*.yaml']
});
