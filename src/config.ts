// centralized config for API URL
// In development, VITE_API_BASE_URL is usually http://localhost:3001
// In production (Netlify), it might be empty (to use relative paths /api/...) or set to a specific URL.

// If PROD (Netlify), default to empty string (relative path) to avoid localhost issues
// unless VITE_API_BASE_URL is explicitly set in Netlify env vars to something else
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
