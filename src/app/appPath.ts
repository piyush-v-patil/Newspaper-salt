/**
 * Where the app is served from: "/" normally, "/Newspaper-salt/" on GitHub
 * Pages. Set at build time through Vite's base option.
 */
export const BASE = import.meta.env.BASE_URL;

/** The router's base path, without a trailing slash ("/" stays "/"). */
export const ROUTER_BASE = BASE === '/' ? '/' : BASE.replace(/\/$/, '');

/** The current page within the app, e.g. "/today", whatever the base path. */
export function appPath(): string {
  const path = window.location.pathname;
  return ROUTER_BASE !== '/' && path.startsWith(ROUTER_BASE) ? path.slice(ROUTER_BASE.length) || '/' : path;
}
