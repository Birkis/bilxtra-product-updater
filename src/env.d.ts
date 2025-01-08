/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly CRYSTALLIZE_TENANT_IDENTIFIER: string;
    readonly CRYSTALLIZE_ACCESS_TOKEN_ID: string;
    readonly CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module '$env/static/private' {
    export const CRYSTALLIZE_TENANT_IDENTIFIER: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_ID: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
}

declare module '$env/dynamic/private' {
    export const env: {
        CRYSTALLIZE_TENANT_IDENTIFIER: string;
        CRYSTALLIZE_ACCESS_TOKEN_ID: string;
        CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
    }
} 