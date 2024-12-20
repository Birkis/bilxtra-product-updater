/// <reference types="@sveltejs/kit" />

declare module '$env/static/private' {
    export const OPENAI_API_KEY: string;
    export const OPENAI_ASSISTANT_ID_GPT4: string;
    export const CRYSTALLIZE_TENANT_IDENTIFIER: string;
}

declare module '$app/stores' {
    import type { Readable } from 'svelte/store';
    export const page: Readable<any>; // You can define a more specific type if needed
}

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
