/**
 * URL Utilities
 */

/**
 * Given a relative path returned by the backend (e.g., 'uploads/qrcodes/AF-0001_abc.png'),
 * constructs the full URL to the static file.
 * 
 * Uses VITE_STATIC_URL from the environment so it can be pointed directly at
 * the backend in development (e.g., http://127.0.0.1:5000) and left relative
 * or pointed to a CDN in production.
 */
export function getBackendImageUrl(path: string | null | undefined): string {
  if (!path) return '';

  const baseUrl = import.meta.env.VITE_STATIC_URL ?? '';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const prefix = cleanPath.startsWith('/static/') ? '' : '/static';
  
  return `${cleanBase}${prefix}${cleanPath}`;
}
