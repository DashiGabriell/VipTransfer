/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_DEFAULT_TENANT_SLUG?: string
  readonly VITE_N8N_WEBHOOK_URL?: string
  /** Public site origin for WhatsApp / share links (never localhost). */
  readonly VITE_PUBLIC_SITE_URL?: string
  /** Future Web Push VAPID public key */
  readonly VITE_VAPID_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
