/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly CRYSTALLIZE_TENANT_ID: string;
    readonly CRYSTALLIZE_TENANT_IDENTIFIER: string;
    readonly CRYSTALLIZE_ACCESS_TOKEN_ID: string;
    readonly CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
    readonly THULE_API_KEY: string;
    readonly SUPABASE_URL: string;
    readonly SUPABASE_SERVICE_ROLE: string;
    readonly SUPABASE_JWT_SECRET: string;
    readonly OPENAI_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module '$env/dynamic/private' {
    export const CRYSTALLIZE_TENANT_ID: string;
    export const CRYSTALLIZE_TENANT_IDENTIFIER: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_ID: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
    export const THULE_API_KEY: string;
    export const SUPABASE_URL: string;
    export const SUPABASE_SERVICE_ROLE: string;
    export const SUPABASE_JWT_SECRET: string;
    export const OPENAI_API_KEY: string;
}

declare module '$env/dynamic/public' {
    export const CRYSTALLIZE_TENANT_ID: string;
    export const CRYSTALLIZE_TENANT_IDENTIFIER: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_ID: string;
    export const CRYSTALLIZE_ACCESS_TOKEN_SECRET: string;
    export const THULE_API_KEY: string;
    export const SUPABASE_URL: string;
    export const SUPABASE_SERVICE_ROLE: string;
    export const SUPABASE_JWT_SECRET: string;
    export const OPENAI_API_KEY: string;
} 