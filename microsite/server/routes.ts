import { Router } from 'express';
import type { RequestHandler } from 'express';
import type multer from 'multer';
import dns from 'dns';
import sharp from 'sharp';
import crypto from 'crypto';

/**
 * Dependencies injected by the host application.
 * This keeps the microsite module decoupled from any specific
 * auth system, DB layer, or image pipeline.
 */
export interface MicrositeRouterDeps {
  isAuthenticated: RequestHandler;
  requireOwnerOrAdmin: RequestHandler;
  requireAdmin: RequestHandler;
  getUserId: (req: any) => string | null;
  getUserRole: (userId: string) => Promise<string>;
  getClaimedStoresForOwner: (userId: string) => Promise<string[]>;
  getStoreById: (id: string) => Promise<any | null>;
  updateStore: (id: string, updates: any) => Promise<any | null>;
  adminUpdateStore?: (id: string, updates: any, adminId: string) => Promise<any | null>;
  createAuditLog: (adminId: string, action: string, targetType: string, targetId: string, details: any) => Promise<any>;
  authStorage: { getUser: (id: string) => Promise<any> };
  imageUpload: ReturnType<typeof multer>;
  isBunnyStorageConfigured: () => boolean;
  uploadImageToStorage: (buffer: Buffer, filename: string, folder?: string) => Promise<string>;
  uploadImageLocal: (buffer: Buffer, filename: string, folder?: string) => Promise<string>;
  isHeicBuffer: (buffer: Buffer, mimetype: string) => boolean;
  convertHeicToJpegBuffer: (buffer: Buffer) => Promise<Buffer>;
  paramId: (params: any) => string;
}

/**
 * createMicrositeRouter — factory that returns a fully-wired Express Router
 * containing all Sovereign Site API routes.
 *
 * Mount this on your main router with:
 *   mainRouter.use('/', createMicrositeRouter(deps));
 */
export function createMicrositeRouter(deps: MicrositeRouterDeps): Router {
  const {
    isAuthenticated,
    requireOwnerOrAdmin,
    requireAdmin,
    getUserId,
    getUserRole,
    getClaimedStoresForOwner,
    getStoreById,
    updateStore,
    createAuditLog,
    authStorage,
    imageUpload,
    isBunnyStorageConfigured,
    uploadImageToStorage,
    uploadImageLocal,
    isHeicBuffer,
    convertHeicToJpegBuffer,
    paramId,
  } = deps;

  const adminUpdate = deps.adminUpdateStore ?? updateStore;

  const router = Router();

  async function checkSovereignPlanEntitlement(req: any, res: any, storeId: string): Promise<boolean> {
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return false; }
    const role = await getUserRole(userId);
    if (role === 'admin') return true;
    const store = await getStoreById(storeId);
    if (!store) { res.status(404).json({ error: 'Store not found' }); return false; }
    const status = store.sovereignPlanStatus || 'inactive';
    if (status !== 'active' && status !== 'trialing') {
      res.status(403).json({ error: 'Sovereign Site plan required to access this feature' });
      return false;
    }
    return true;
  }

  router.get('/tenant', async (req: any, res: any) => {
    if (!req.tenantStore) {
      res.json(null);
      return;
    }
    const firstDomain = (process.env.REPLIT_DOMAINS || '').split(',')[0]?.trim() || '';
    const directoryOrigin = firstDomain ? `https://${firstDomain}` : 'http://localhost:5000';
    res.json({ store: req.tenantStore, directoryOrigin });
  });

  router.get('/owner/stores/:id/preview', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      const store = await getStoreById(storeId);
      if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      res.json(store);
    } catch (error) {
      console.error('Error fetching store preview:', error);
      res.status(500).json({ error: 'Failed to fetch store preview' });
    }
  });

  router.post('/owner/stores/:id/header-image', isAuthenticated as RequestHandler, requireOwnerOrAdmin, imageUpload.single('image'), async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      let buffer: Buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer).resize(1600, 600, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
      const filename = `store-header-${storeId}-${Date.now()}.jpg`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'store-headers');
      } else {
        url = await uploadImageLocal(processed, filename, 'store-headers');
      }
      const store = await updateStore(storeId, { headerImageUrl: url });
      if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      res.json({ url, store });
    } catch (error: any) {
      console.error('[OwnerHeaderImage] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to upload header image' });
    }
  });

  router.post('/owner/stores/:id/logo', isAuthenticated as RequestHandler, requireOwnerOrAdmin, imageUpload.single('image'), async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!await checkSovereignPlanEntitlement(req, res, storeId)) return;
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      let buffer: Buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      const filename = `store-logo-${storeId}-${Date.now()}.png`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'store-logos');
      } else {
        url = await uploadImageLocal(processed, filename, 'store-logos');
      }
      const existing = await getStoreById(storeId);
      const mergedTheme = { ...(existing?.themeConfig || {}), logoUrl: url };
      const store = await updateStore(storeId, { themeConfig: mergedTheme });
      if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      res.json({ url, store });
    } catch (error: any) {
      console.error('[OwnerLogo] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to upload logo' });
    }
  });

  router.post('/owner/stores/:id/photos', isAuthenticated as RequestHandler, requireOwnerOrAdmin, imageUpload.single('image'), async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!await checkSovereignPlanEntitlement(req, res, storeId)) return;
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      const currentPhotos: string[] = existing.storePhotos || [];
      if (currentPhotos.length >= 10) {
        res.status(400).json({ error: 'Maximum of 10 interior photos allowed' });
        return;
      }
      let buffer: Buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer).resize(1200, 900, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      const filename = `store-photo-${storeId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'store-photos');
      } else {
        url = await uploadImageLocal(processed, filename, 'store-photos');
      }
      const newPhotos = [...currentPhotos, url];
      const store = await updateStore(storeId, { storePhotos: newPhotos });
      res.json({ url, storePhotos: newPhotos, store });
    } catch (error: any) {
      console.error('[OwnerStorePhotos] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to upload store photo' });
    }
  });

  router.delete('/owner/stores/:id/photos/:index', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const photoIndex = parseInt(req.params.index, 10);
      if (!Number.isInteger(photoIndex) || isNaN(photoIndex)) {
        res.status(400).json({ error: 'Invalid photo index' });
        return;
      }
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!await checkSovereignPlanEntitlement(req, res, storeId)) return;
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      const currentPhotos: string[] = existing.storePhotos || [];
      if (photoIndex < 0 || photoIndex >= currentPhotos.length) {
        res.status(400).json({ error: 'Invalid photo index' });
        return;
      }
      const newPhotos = currentPhotos.filter((_: string, i: number) => i !== photoIndex);
      const store = await updateStore(storeId, { storePhotos: newPhotos });
      res.json({ storePhotos: newPhotos, store });
    } catch (error: any) {
      console.error('[OwnerStorePhotos] Delete error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to delete store photo' });
    }
  });

  router.patch('/owner/stores/:id/domain', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!await checkSovereignPlanEntitlement(req, res, storeId)) return;
      const { customDomain, themeConfig } = req.body;
      const updates: any = {};
      if (customDomain !== undefined) {
        updates.customDomain = customDomain
          ? customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
          : null;
        updates.domainVerified = false;
      }
      if (themeConfig !== undefined) {
        const VALID_FONT_PAIRINGS = ['system', 'modern', 'classic', 'playful', 'elegant'];
        if (themeConfig.fontPairing !== undefined && !VALID_FONT_PAIRINGS.includes(themeConfig.fontPairing)) {
          res.status(400).json({ error: 'Invalid fontPairing value' });
          return;
        }
        const existing = await getStoreById(storeId);
        updates.themeConfig = { ...(existing?.themeConfig || {}), ...themeConfig };
      }
      const store = await updateStore(storeId, updates);
      if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      res.json(store);
    } catch (error: any) {
      console.error('[OwnerDomain] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to update domain settings' });
    }
  });

  router.post('/owner/stores/:id/domain/verify', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      if (!await checkSovereignPlanEntitlement(req, res, storeId)) return;
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      if (!existing.customDomain) {
        res.status(400).json({ error: 'No custom domain configured for this store' });
        return;
      }
      const replitDomains = (process.env.REPLIT_DOMAINS || '')
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .filter(Boolean);
      const normalizeHost = (h: string) => h.toLowerCase().replace(/\.$/, '').trim();
      let verified = false;
      let cnameTarget: string | null = null;
      let verificationReason: string = 'CNAME_NOT_FOUND';
      try {
        const addresses = await dns.promises.resolveCname(existing.customDomain);
        cnameTarget = addresses[0] || null;
        const normalizedAddresses = addresses.map(normalizeHost);
        if (replitDomains.length > 0) {
          verified = normalizedAddresses.some((addr: string) =>
            replitDomains.some((appDomain: string) => addr === appDomain)
          );
          verificationReason = verified
            ? 'CNAME_MATCHES_APP'
            : `CNAME_WRONG_TARGET: points to "${cnameTarget}", expected one of: ${replitDomains.join(', ')}`;
        } else {
          verificationReason = 'APP_DOMAIN_NOT_CONFIGURED';
        }
      } catch (dnsErr: any) {
        verificationReason = dnsErr.code === 'ENODATA' || dnsErr.code === 'ENOTFOUND'
          ? 'CNAME_NOT_FOUND'
          : `DNS_ERROR: ${dnsErr.code || dnsErr.message}`;
      }
      if (verified) {
        await updateStore(storeId, { domainVerified: true });
      }
      const expectedTarget = replitDomains[0] || null;
      res.json({ verified, cnameTarget, expectedTarget, domain: existing.customDomain, reason: verificationReason });
    } catch (error: any) {
      console.error('[OwnerDomain] Verify error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to verify domain' });
    }
  });

  router.post('/owner/stores/:id/billing/checkout', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      const store = await getStoreById(storeId);
      if (!store) { res.status(404).json({ error: 'Store not found' }); return; }

      const { getUncachableStripeClient } = await import('./billing.ts');
      const stripe = await getUncachableStripeClient();

      let customerId = store.stripeCustomerId || undefined;
      if (!customerId) {
        const user = await authStorage.getUser(userId);
        const customer = await stripe.customers.create({
          email: user?.email || undefined,
          name: store.name,
          metadata: { storeId, userId },
        });
        customerId = customer.id;
        await updateStore(storeId, { stripeCustomerId: customerId });
      }

      const products = await stripe.products.search({ query: "name:'Sovereign Site' AND active:'true'" });
      let priceId: string | undefined;
      if (products.data.length > 0) {
        const prices = await stripe.prices.list({ product: products.data[0].id, active: true, limit: 5 });
        const monthly = prices.data.find((p: any) => p.recurring?.interval === 'month');
        priceId = monthly?.id || prices.data[0]?.id;
      }
      if (!priceId) {
        res.status(400).json({ error: 'Sovereign Site plan not found. Run seed-sovereign-plan script first.' });
        return;
      }

      const baseUrl = `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: 'subscription',
        success_url: `${baseUrl}/#/owners?upgraded=1`,
        cancel_url: `${baseUrl}/#/owners`,
        metadata: { storeId },
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('[Billing] Checkout error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to create checkout session' });
    }
  });

  router.get('/owner/stores/:id/billing/portal', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const userId = getUserId(req)!;
      const role = await getUserRole(userId);
      if (role !== 'admin') {
        const ownedStores = await getClaimedStoresForOwner(userId);
        if (!ownedStores.includes(storeId)) {
          res.status(403).json({ error: 'You do not own this store' });
          return;
        }
      }
      const store = await getStoreById(storeId);
      if (!store) { res.status(404).json({ error: 'Store not found' }); return; }
      if (!store.stripeCustomerId) {
        res.status(400).json({ error: 'No billing account found for this store' });
        return;
      }
      const planStatus = store.sovereignPlanStatus || 'inactive';
      if (role !== 'admin' && planStatus !== 'active' && planStatus !== 'trialing') {
        res.status(403).json({ error: 'Active Sovereign Site plan required to access billing portal' });
        return;
      }

      const { getUncachableStripeClient } = await import('./billing.ts');
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${(process.env.REPLIT_DOMAINS || '').split(',')[0]}`;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: store.stripeCustomerId,
        return_url: `${baseUrl}/#/owners`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      console.error('[Billing] Portal error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to create billing portal session' });
    }
  });

  router.patch('/admin/stores/:id/theme', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const adminUserId = getUserId(req)!;
      const { themeConfig } = req.body;
      if (!themeConfig || typeof themeConfig !== 'object') {
        res.status(400).json({ error: 'themeConfig object required' });
        return;
      }
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      const VALID_FONT_PAIRINGS = ['system', 'modern', 'classic', 'playful', 'elegant'];
      if (themeConfig.fontPairing !== undefined && !VALID_FONT_PAIRINGS.includes(themeConfig.fontPairing)) {
        res.status(400).json({ error: 'Invalid fontPairing value' });
        return;
      }
      const merged = { ...(existing.themeConfig || {}), ...themeConfig };
      const store = await adminUpdate(storeId, { themeConfig: merged }, adminUserId);
      res.json(store);
    } catch (error) {
      console.error('Error updating store theme:', error);
      res.status(500).json({ error: 'Failed to update store theme' });
    }
  });

  router.post('/admin/stores/:id/header-image', isAuthenticated as RequestHandler, requireAdmin, imageUpload.single('image'), async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const adminUserId = getUserId(req)!;
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      let buffer: Buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer).resize(1600, 600, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
      const filename = `store-header-${storeId}-${Date.now()}.jpg`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'store-headers');
      } else {
        url = await uploadImageLocal(processed, filename, 'store-headers');
      }
      const store = await adminUpdate(storeId, { headerImageUrl: url }, adminUserId);
      if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      res.json({ url, store });
    } catch (error: any) {
      console.error('[AdminHeaderImage] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to upload header image' });
    }
  });

  router.post('/admin/stores/:id/photos', isAuthenticated as RequestHandler, requireAdmin, imageUpload.single('image'), async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const adminUserId = getUserId(req)!;
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      const currentPhotos: string[] = existing.storePhotos || [];
      if (currentPhotos.length >= 10) {
        res.status(400).json({ error: 'Maximum of 10 interior photos allowed' });
        return;
      }
      let buffer: Buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer).resize(1200, 900, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      const filename = `store-photo-${storeId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'store-photos');
      } else {
        url = await uploadImageLocal(processed, filename, 'store-photos');
      }
      const newPhotos = [...currentPhotos, url];
      const store = await adminUpdate(storeId, { storePhotos: newPhotos }, adminUserId);
      res.json({ url, storePhotos: newPhotos, store });
    } catch (error: any) {
      console.error('[AdminStorePhotos] Error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to upload store photo' });
    }
  });

  router.delete('/admin/stores/:id/photos/:index', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const photoIndex = parseInt(req.params.index, 10);
      if (!Number.isInteger(photoIndex) || isNaN(photoIndex)) {
        res.status(400).json({ error: 'Invalid photo index' });
        return;
      }
      const adminUserId = getUserId(req)!;
      const existing = await getStoreById(storeId);
      if (!existing) {
        res.status(404).json({ error: 'Store not found' });
        return;
      }
      const currentPhotos: string[] = existing.storePhotos || [];
      if (photoIndex < 0 || photoIndex >= currentPhotos.length) {
        res.status(400).json({ error: 'Invalid photo index' });
        return;
      }
      const newPhotos = currentPhotos.filter((_: string, i: number) => i !== photoIndex);
      const store = await adminUpdate(storeId, { storePhotos: newPhotos }, adminUserId);
      res.json({ storePhotos: newPhotos, store });
    } catch (error: any) {
      console.error('[AdminStorePhotos] Delete error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to delete store photo' });
    }
  });

  router.patch('/admin/stores/:id/sovereign-plan', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: any) => {
    try {
      const storeId = paramId(req.params);
      const { sovereignPlanStatus, sovereignPlanExpiresAt } = req.body;
      const validStatuses = ['active', 'trialing', 'inactive'];
      if (sovereignPlanStatus && !validStatuses.includes(sovereignPlanStatus)) {
        res.status(400).json({ error: 'Invalid sovereignPlanStatus' });
        return;
      }
      const updates: any = {};
      if (sovereignPlanStatus !== undefined) updates.sovereignPlanStatus = sovereignPlanStatus;
      if (sovereignPlanExpiresAt !== undefined) updates.sovereignPlanExpiresAt = sovereignPlanExpiresAt;
      const store = await updateStore(storeId, updates);
      if (!store) { res.status(404).json({ error: 'Store not found' }); return; }
      const adminId = getUserId(req)!;
      await createAuditLog(adminId, 'update_sovereign_plan', 'store', storeId, { sovereignPlanStatus, sovereignPlanExpiresAt });
      res.json(store);
    } catch (error: any) {
      console.error('[Admin] Sovereign plan update error:', error.message);
      res.status(500).json({ error: 'Failed to update sovereign plan' });
    }
  });

  return router;
}
