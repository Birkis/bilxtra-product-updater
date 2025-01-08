import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	return {
		plugins: [sveltekit()],
		server: {
			fs: {
				allow: ['.']
			}
		},
		define: {
			'process.env.CRYSTALLIZE_ACCESS_TOKEN_ID': `'${env.CRYSTALLIZE_ACCESS_TOKEN_ID}'`,
			'process.env.CRYSTALLIZE_ACCESS_TOKEN_SECRET': `'${env.CRYSTALLIZE_ACCESS_TOKEN_SECRET}'`,
			'process.env.CRYSTALLIZE_TENANT_ID': `'${env.CRYSTALLIZE_TENANT_ID}'`,
			'process.env.CRYSTALLIZE_TENANT_IDENTIFIER': `'${env.CRYSTALLIZE_TENANT_IDENTIFIER}'`
		}
	};
});
