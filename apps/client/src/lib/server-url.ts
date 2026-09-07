/** Socket.IO and the profile API must use the same origin, not an API path. */
export const resolveServerUrl = (value: string | undefined, staticHosting = false): string | null => {
  const raw = value?.trim();
  if (!raw) return staticHosting ? null : '';
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error('VITE_SERVER_URL must be an absolute HTTP(S) backend origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('VITE_SERVER_URL must be an HTTP(S) origin without credentials, paths, queries, or fragments.');
  }
  if (staticHosting && url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Vercel uses HTTPS. VITE_SERVER_URL must also use HTTPS to avoid blocked mixed-content requests.');
  }
  return url.origin;
};
