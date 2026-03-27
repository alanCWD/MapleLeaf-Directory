import type { MicrositeConfig } from './types.ts';

/**
 * MicrositeAdapter — the only interface a host app must implement
 * to wire its own entity type into the microsite engine.
 *
 * Implement this and pass it to createTenantMiddleware() and
 * createMicrositeRouter() to get a fully-working Sovereign Site
 * for your own domain-aware entities.
 */
export interface MicrositeAdapter {
  resolveByDomain(domain: string): Promise<MicrositeConfig | null>;
  resolveById(id: string): Promise<MicrositeConfig | null>;
}
