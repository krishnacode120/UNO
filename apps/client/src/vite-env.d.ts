interface ImportMetaEnv {
  // Vite normalizes the origin at build time; null means static solo-only hosting.
  readonly VITE_SERVER_URL: string | null;
}
