/// <reference types="@sveltejs/kit" />
/// <reference types="svelte" />

declare namespace App {
    interface Locals {}
    interface PageData {}
    interface Error {}
    interface Platform {}
}

declare module '$app/stores' {
    import { type Readable } from 'svelte/store';
    import { type Navigation, type Page } from '@sveltejs/kit';
    
    export const page: Readable<Page>;
    export const navigating: Readable<Navigation | null>;
    export const updated: Readable<boolean>;
}

declare namespace svelteHTML {
    interface HTMLAttributes<T> {
        'on:click'?: (event: CustomEvent<any> & { target: EventTarget & T }) => void;
        'on:change'?: (event: CustomEvent<any> & { target: EventTarget & T }) => void;
        'on:submit'?: (event: CustomEvent<any> & { target: EventTarget & T }) => void;
        'class:text-blue-400'?: boolean;
        'class:text-blue-600'?: boolean;
    }
}

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface Platform {}
    }
}

declare module '$env/static/private' {
    export const TEC_DOC_API_KEY: string;
    export const PROVIDER_ID: string;
}

export {};
