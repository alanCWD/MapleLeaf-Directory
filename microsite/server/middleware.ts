import type { MicrositeAdapter } from '../adapter.ts';

const TENANT_CACHE_TTL_MS = 60_000;
const TENANT_CACHE_MAX_SIZE = 500;

/**
 * createTenantMiddleware — returns an Express middleware that resolves the
 * current request's tenant (by custom domain) and attaches it as
 * req.tenantStore for consumption by downstream route handlers.
 *
 * @param adapter - app-supplied MicrositeAdapter that resolves domains
 * @param mainDomain - the app's own primary domain (excluded from tenant resolution)
 */
export function createTenantMiddleware(adapter: MicrositeAdapter, mainDomain: string) {
  const tenantCache = new Map<string, { store: any; expiresAt: number }>();

  const pruneCache = () => {
    const now = Date.now();
    for (const [key, val] of tenantCache) {
      if (val.expiresAt <= now) tenantCache.delete(key);
    }
    if (tenantCache.size > TENANT_CACHE_MAX_SIZE) {
      const oldest = Array.from(tenantCache.entries())
        .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
        .slice(0, tenantCache.size - TENANT_CACHE_MAX_SIZE);
      for (const [key] of oldest) tenantCache.delete(key);
    }
  };

  setInterval(pruneCache, 5 * 60 * 1000).unref();

  return async (req: any, _res: any, next: any) => {
    try {
      const host = (req.headers.host || '').split(':')[0].toLowerCase().trim();
      if (
        !host ||
        host === 'localhost' ||
        host === mainDomain ||
        host.endsWith('.replit.app') ||
        host.endsWith('.replit.dev')
      ) {
        req.tenantStore = null;
        return next();
      }
      const cached = tenantCache.get(host);
      if (cached) {
        if (cached.expiresAt > Date.now()) {
          req.tenantStore = cached.store;
          return next();
        }
        tenantCache.delete(host);
      }
      if (tenantCache.size >= TENANT_CACHE_MAX_SIZE) pruneCache();
      const config = await adapter.resolveByDomain(host);
      tenantCache.set(host, { store: config, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
      req.tenantStore = config;
    } catch {
      req.tenantStore = null;
    }
    next();
  };
}
