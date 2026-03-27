import { getStoreByCustomDomain, getStoreById } from '../server/db.ts';
import type { Store } from '../types.ts';
import type { MicrositeAdapter, MicrositeConfig } from './types.ts';

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
};
