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
  /** Resolve a tenant by its verified custom domain (e.g. "myshop.com"). */
  resolveByDomain(domain: string): Promise<MicrositeConfig | null>;

  /** Resolve a tenant by its internal entity ID. */
  resolveById(id: string): Promise<MicrositeConfig | null>;

  /**
   * Check whether a given user/tenant combination is entitled to
   * Sovereign Site plan features.
   *
   * Return true to allow, false to deny (caller handles the 403 response).
   * Admins are expected to always return true.
   */
  checkPlanEntitlement(userId: string, tenantId: string): Promise<boolean>;

  /**
   * Persist arbitrary config updates for a tenant.
   * Return the updated MicrositeConfig on success, null if not found.
   */
  updateConfig(tenantId: string, updates: Partial<Omit<MicrositeConfig, 'tenantId'>>): Promise<MicrositeConfig | null>;
}
