/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_ENABLE_DIAGNOSTICS: string;
  readonly VITE_DEV_UNLOCK_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
