/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when the frontend is hosted elsewhere, for example https://api.example.com. Empty means same origin. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
