import { getStoreByCustomDomain, getStoreById, updateStore } from '../server/db.ts';
import { getUserRole } from '../server/userDb.ts';
import type { Store } from '../types.ts';
import type { MicrositeAdapter } from './adapter.ts';
import type { MicrositeConfig } from './types.ts';

function storeToConfig(store: Store): MicrositeConfig {
  return {
    tenantId: store.id,
    name: store.name,
    type: store.type,
    address: store.address,
    province: store.province,
    phone: store.phone,
    website: store.website,
    rating: store.rating,
    hours: store.hours,
    featuredOfferings: store.featuredOfferings,
    headerImageUrl: store.headerImageUrl,
    storePhotos: store.storePhotos,
    themeConfig: store.themeConfig,
    customDomain: store.customDomain,
    domainVerified: store.domainVerified,
    planStatus: store.sovereignPlanStatus || 'inactive',
    planExpiresAt: store.sovereignPlanExpiresAt,
    stripeCustomerId: store.stripeCustomerId,
    isClaimed: store.isClaimed,
    verificationStatus: store.verificationStatus,
    storeInsights: store.storeInsights,
  };
}

export const legacyleafAdapter: MicrositeAdapter = {
  async resolveByDomain(domain: string) {
    const store = await getStoreByCustomDomain(domain);
    return store ? storeToConfig(store) : null;
  },

  async resolveById(id: string) {
    const store = await getStoreById(id);
    return store ? storeToConfig(store) : null;
  },

  async checkPlanEntitlement(userId: string, tenantId: string) {
    const role = await getUserRole(userId);
    if (role === 'admin') return true;
    const store = await getStoreById(tenantId);
    if (!store) return false;
    const status = store.sovereignPlanStatus || 'inactive';
    return status === 'active' || status === 'trialing';
  },

  async updateConfig(tenantId: string, updates: Partial<Omit<MicrositeConfig, 'tenantId'>>) {
    const storeUpdates: Partial<Store> = {};
    if (updates.headerImageUrl !== undefined) storeUpdates.headerImageUrl = updates.headerImageUrl;
    if (updates.storePhotos !== undefined) storeUpdates.storePhotos = updates.storePhotos;
    if (updates.themeConfig !== undefined) storeUpdates.themeConfig = updates.themeConfig;
    if (updates.customDomain !== undefined) storeUpdates.customDomain = updates.customDomain;
    if (updates.domainVerified !== undefined) storeUpdates.domainVerified = updates.domainVerified;
    if (updates.planStatus !== undefined) storeUpdates.sovereignPlanStatus = updates.planStatus;
    if (updates.planExpiresAt !== undefined) storeUpdates.sovereignPlanExpiresAt = updates.planExpiresAt;
    if (updates.stripeCustomerId !== undefined) storeUpdates.stripeCustomerId = updates.stripeCustomerId;
    const store = await updateStore(tenantId, storeUpdates);
    return store ? storeToConfig(store) : null;
  },
};
