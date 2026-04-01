import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { createMicrositeRouter } from '../microsite/server/routes.ts';
import {
  getAllStores,
  getStoreById,
  upsertStore,
  updateStore,
  addFlag,
  getFlags,
  getReviewQueue,
  adminReview,
  searchStoresInDb,
  createAuditLog,
  getAuditLogs,
  getAdminAllStores,
  adminUpdateStore,
  findStoreByNameOrAddress,
} from './db.ts';
import { verifyStore } from './verification.ts';
import { serverSearchStores } from './search.ts';
import { isAuthenticated } from './replit_integrations/auth/index.ts';
import { authStorage } from './replit_integrations/auth/index.ts';
import {
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  syncUserFavorites,
  createStoreClaim,
  getStoreClaimsByUser,
  getPendingClaims,
  reviewClaim,
  getClaimedStoresForOwner,
  getUserRole,
  setUserRole,
  getAllUsers,
  deleteUser,
  updateUserProfile,
  getUserByHandle,
  getUserPublicProfile,
  getUserSocialProfile,
} from './userDb.ts';
import {
  createReview,
  getReviewsByStore,
  calculateTrustWeight,
  calculateIntegrityScore,
  getMediaById,
  evaluateUserBadges,
  getUserBadges,
  getReviewsWithBadges,
  awardBadge,
  revokeBadge,
  getCurrentQRPayload,
  verifyPresence,
  getStoreCheckins,
  getUserCheckins,
  hasRecentCheckin,
  calculateDistance,
  deleteStoreMedia,
  getReviewById,
  deleteReview,
} from './integrity/index.ts';
import multer from 'multer';
import { createVideo, deleteVideo, generateTusCredentials, getEmbedUrl, isBunnyConfigured } from './bunnyStream.ts';
import { createVideoReviewRouter } from '../video-review/server/routes.ts';
import { legacyleafVideoAdapter } from '../video-review/legacyleaf-adapter.ts';
import { addWaitlistEmail, getWaitlistEmails, createDrop, getDropsByStore, cancelDrop, adminGetDrops, adminReviewDrop, updateDropCoverImage } from './db.ts';
import { sendWaitlistConfirmation } from './mailer.ts';
import {
  createPost,
  getPostById,
  listPublishedPosts,
  listUserPosts,
  listPendingPosts,
  listAllPosts,
  updatePostStatus,
  updatePostContentTier,
  updatePost,
  deletePost,
  adminDeletePost,
  addPostMedia,
  isUserCreator,
  setUserCreatorStatus,
  moderateCleanContent,
} from './posts.ts';
import type { PostStatus, ContentTier, CreatorPost } from '../types';
import { uploadImageToStorage, isBunnyStorageConfigured, uploadImageLocal } from './bunnyStorage.ts';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import heicConvert from 'heic-convert';
import { fileURLToPath } from 'url';

const HEIC_MIMETYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

function isHeicBuffer(buffer: Buffer, mimetype: string): boolean {
  if (HEIC_MIMETYPES.has(mimetype)) return true;
  if (buffer.length >= 12) {
    const ftyp = buffer.subarray(4, 8).toString('ascii');
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (ftyp === 'ftyp' && ['heic', 'heix', 'mif1', 'msf1', 'hevc', 'hevx', 'heim', 'heis'].includes(brand)) {
      return true;
    }
  }
  return false;
}

async function convertHeicToJpegBuffer(buffer: Buffer): Promise<Buffer> {
  const result = await (heicConvert as any)({ buffer, format: 'JPEG', quality: 0.92 });
  return Buffer.from(result);
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'));
    }
  },
});

const brandingImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and SVG images are allowed'));
    }
  },
});

const brandingVideoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, MOV, and WebM video files are allowed'));
    }
  },
});

const __dirnameRoutes = path.dirname(fileURLToPath(import.meta.url));
const BRANDING_DIR = path.resolve(__dirnameRoutes, '..', 'video-review', 'assets', 'branding');

const BRANDING_ASSET_MAP: Record<string, { filename: string; type: 'image' | 'video' }> = {
  'logo-light': { filename: 'logo-light.png', type: 'image' },
  'logo-dark':  { filename: 'logo-dark.png',  type: 'image' },
  'watermark':  { filename: 'watermark.png',  type: 'image' },
  'intro-video': { filename: 'intro.mp4',     type: 'video' },
  'outro-video': { filename: 'outro.mp4',     type: 'video' },
};

const router = Router();

function paramId(params: any): string {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

function getUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

const requireAdmin: RequestHandler = async (req: any, res, next) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const role = await getUserRole(userId);
  if (role !== 'admin') { res.status(403).json({ error: 'Admin access required' }); return; }
  next();
};

const requireOwnerOrAdmin: RequestHandler = async (req: any, res, next) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const role = await getUserRole(userId);
  if (role !== 'admin' && role !== 'owner') { res.status(403).json({ error: 'Owner or admin access required' }); return; }
  next();
};

router.use('/', createMicrositeRouter({
  isAuthenticated: isAuthenticated as RequestHandler,
  requireOwnerOrAdmin: requireOwnerOrAdmin as RequestHandler,
  requireAdmin: requireAdmin as RequestHandler,
  getUserId,
  getUserRole,
  getClaimedStoresForOwner,
  getStoreById,
  updateStore,
  adminUpdateStore,
  createAuditLog,
  authStorage,
  imageUpload,
  isBunnyStorageConfigured,
  uploadImageToStorage,
  uploadImageLocal,
  isHeicBuffer,
  convertHeicToJpegBuffer,
  paramId,
}));

router.use('/', createVideoReviewRouter(legacyleafVideoAdapter));

router.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, userLocation } = req.body;
    if (!query || typeof query !== 'string' || query.trim() === '') {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }
    const trimmedQuery = query.trim();
    console.log(`[API] Search request: "${trimmedQuery}"`);

    const DB_RESULT_THRESHOLD = 3;

    const dbStores = await searchStoresInDb(trimmedQuery);
    console.log(`[API] Database search returned ${dbStores.length} stores`);

    if (dbStores.length >= DB_RESULT_THRESHOLD) {
      console.log(`[API] Sufficient results from database (${dbStores.length} >= ${DB_RESULT_THRESHOLD}), skipping AI search`);
      if (userLocation?.lat && userLocation?.lng) {
        const RADIUS_M = 100000;
        const sorted = dbStores
          .map(s => {
            if (s.lat && s.lng) {
              const distM = calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng);
              return { ...s, distanceKm: Math.round(distM / 100) / 10 };
            }
            return { ...s, distanceKm: null };
          })
          // Keep stores that are within 100km (if coordinates known) or that matched by city name (no coordinates)
          .filter(s => (s as any).distanceKm === null || (s as any).distanceKm * 1000 <= RADIUS_M)
          .sort((a: any, b: any) => {
            if (a.distanceKm === null && b.distanceKm === null) return 0;
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          });
        res.json({ stores: sorted, source: 'database' });
      } else {
        res.json({ stores: dbStores, source: 'database' });
      }
      return;
    }

    console.log(`[API] Only ${dbStores.length} database results, supplementing with AI search...`);
    const aiResult = await serverSearchStores(trimmedQuery, userLocation);
    console.log(`[API] AI search returned ${aiResult.stores.length} stores`);

    const dbIds = new Set(dbStores.map(s => s.id));
    const dbNames = new Set(dbStores.map(s => s.name.toLowerCase()));
    const newAiStores = aiResult.stores.filter((s: any) =>
      !dbIds.has(s.id) && !dbNames.has((s.name || '').toLowerCase())
    );

    let combined: any[] = [...dbStores, ...newAiStores];
    console.log(`[API] Combined results: ${dbStores.length} from DB + ${newAiStores.length} new from AI = ${combined.length} total`);

    if (userLocation?.lat && userLocation?.lng) {
      const RADIUS_M = 100000;
      combined = combined
        .map(s => {
          if (s.lat && s.lng) {
            const distM = calculateDistance(userLocation.lat, userLocation.lng, s.lat, s.lng);
            return { ...s, distanceKm: Math.round(distM / 100) / 10 };
          }
          return { ...s, distanceKm: null };
        })
        // Keep stores within 100km (if coordinates known) or matched by city text (no coordinates)
        .filter(s => s.distanceKm === null || s.distanceKm * 1000 <= RADIUS_M)
        .sort((a, b) => {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        });
      console.log(`[API] After 100km filter + distance sort: ${combined.length} stores`);
    }

    res.json({ stores: combined, source: 'combined' });
  } catch (error: any) {
    console.error('[API] Search error:', error?.message || error);
    res.status(500).json({ error: 'Search failed', details: error?.message });
  }
});

router.get('/stores', async (req: Request, res: Response) => {
  try {
    const { province, type, verificationStatus, hideUnverified, search, limit } = req.query;
    const stores = await getAllStores({
      province: province as string | undefined,
      type: type as string | undefined,
      verificationStatus: verificationStatus as string | undefined,
      hideUnverified: hideUnverified === 'true',
      search: search as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.get('/stores/:id', async (req: Request, res: Response) => {
  try {
    const store = await getStoreById(paramId(req.params));
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(store);
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({ error: 'Failed to fetch store' });
  }
});

router.patch('/stores/:id/insights', async (req: Request, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const { storeInsights, hours } = req.body;

    if (!storeInsights || typeof storeInsights !== 'object') {
      res.status(400).json({ error: 'Valid storeInsights object required' });
      return;
    }

    const allowedKeys = ['atmosphere', 'community', 'specialties', 'sovereignty', 'proTip'];
    const sanitized: Record<string, string> = {};
    for (const key of allowedKeys) {
      if (typeof storeInsights[key] === 'string' && storeInsights[key].length <= 2000) {
        sanitized[key] = storeInsights[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      res.status(400).json({ error: 'At least one valid insight field required' });
      return;
    }

    const existing = await getStoreById(storeId);
    if (!existing) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    if (existing.storeInsights && Object.values(existing.storeInsights).some(v => v != null && v !== '')) {
      console.log(`[API] Insights already cached for store: ${existing.name}, skipping overwrite`);
      res.json(existing);
      return;
    }

    const updates: any = { storeInsights: sanitized };
    if (Array.isArray(hours)) {
      updates.hours = hours;
    }

    const store = await updateStore(storeId, updates);
    console.log(`[API] Cached insights for store: ${store!.name}`);
    res.json(store);
  } catch (error) {
    console.error('Error saving store insights:', error);
    res.status(500).json({ error: 'Failed to save insights' });
  }
});

router.post('/stores', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const { name, address } = req.body;
    if (!name || name === 'Unknown' || !address || address.trim() === '') {
      res.status(400).json({ error: 'Valid name and address are required' });
      return;
    }
    const store = await upsertStore(req.body);
    res.status(201).json(store);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

router.post('/stores/bulk', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: Response) => {
  try {
    const stores = req.body.stores || req.body;
    if (!Array.isArray(stores)) {
      res.status(400).json({ error: 'Expected an array of stores' });
      return;
    }
    const validStores = stores.filter((s: any) => 
      s.name && s.name.trim() !== '' && s.name !== 'Unknown' &&
      s.address && s.address.trim() !== ''
    );
    const results = [];
    const skipped = [];
    for (const storeData of validStores) {
      const existing = await findStoreByNameOrAddress(storeData.name, storeData.address);
      if (existing && existing.verificationStatus !== 'rejected' && existing.id !== storeData.id) {
        skipped.push({ name: storeData.name, existingId: existing.id });
        continue;
      }
      const store = await upsertStore(storeData);
      results.push(store);
    }
    res.status(201).json({ count: results.length, stores: results, skipped });
  } catch (error) {
    console.error('Error bulk upserting stores:', error);
    res.status(500).json({ error: 'Failed to bulk upsert stores' });
  }
});

router.patch('/stores/:id', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const store = await updateStore(paramId(req.params), req.body);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

router.post('/stores/:id/verify', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const storeId = paramId(req.params);
    const store = await getStoreById(storeId);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    const verificationResult = await verifyStore(store);
    const updated = await updateStore(storeId, {
      verificationStatus: verificationResult.verificationStatus,
      confidenceScore: verificationResult.confidenceScore,
      evidenceSources: verificationResult.evidenceSources,
      evidenceCount: verificationResult.evidenceCount,
      placesApiMatch: verificationResult.placesApiMatch,
      googlePlaceId: verificationResult.googlePlaceId,
      lat: verificationResult.lat,
      lng: verificationResult.lng,
      placesCategory: verificationResult.placesCategory,
      lastVerifiedAt: verificationResult.lastVerifiedAt,
    });
    res.json({ store: updated, verification: verificationResult });
  } catch (error) {
    console.error('Error verifying store:', error);
    res.status(500).json({ error: 'Failed to verify store' });
  }
});

router.post('/stores/bulk-verify', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: Response) => {
  try {
    const storeIds: string[] = req.body.storeIds || [];
    if (!Array.isArray(storeIds) || storeIds.length === 0) {
      res.status(400).json({ error: 'Expected an array of store IDs' });
      return;
    }
    const results = [];
    for (const id of storeIds) {
      const store = await getStoreById(id);
      if (!store) continue;
      const verificationResult = await verifyStore(store);
      const updated = await updateStore(id, {
        verificationStatus: verificationResult.verificationStatus,
        confidenceScore: verificationResult.confidenceScore,
        evidenceSources: verificationResult.evidenceSources,
        evidenceCount: verificationResult.evidenceCount,
        placesApiMatch: verificationResult.placesApiMatch,
        googlePlaceId: verificationResult.googlePlaceId,
        lat: verificationResult.lat,
        lng: verificationResult.lng,
        placesCategory: verificationResult.placesCategory,
        lastVerifiedAt: verificationResult.lastVerifiedAt,
      });
      results.push({ store: updated, verification: verificationResult });
    }
    res.json({ count: results.length, results });
  } catch (error) {
    console.error('Error bulk verifying stores:', error);
    res.status(500).json({ error: 'Failed to bulk verify stores' });
  }
});

router.post('/stores/community-submit', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const { name, address, province, type, website, sourceUrl, submitterNote } = req.body;
    if (!name || !address || !province || !type) {
      res.status(400).json({ error: 'Name, address, province, and type are required' });
      return;
    }

    const existingStore = await findStoreByNameOrAddress(name, address);
    if (existingStore && existingStore.verificationStatus !== 'rejected') {
      res.status(409).json({ error: 'A store with this name or address already exists', existingId: existingStore.id });
      return;
    }

    const userId = getUserId(req);
    const evidenceSources = [];
    if (submitterNote) {
      evidenceSources.push({
        type: 'community_report',
        name: `Community submission: ${submitterNote.substring(0, 100)}`,
        date: new Date().toISOString().split('T')[0],
      });
    } else {
      evidenceSources.push({
        type: 'community_report',
        name: 'Community submission',
        date: new Date().toISOString().split('T')[0],
      });
    }
    const storeData: any = {
      name, address, province, type,
      website: website || '',
      sourceUrl: sourceUrl || '',
      verificationStatus: 'ai_suggested',
      confidenceScore: 0,
      evidenceSources: [],
      evidenceCount: 0,
      adminReviewed: false,
    };
    const store = await upsertStore(storeData);
    if (store) {
      const verificationResult = await verifyStore(store);
      const communityBoost = submitterNote ? 0.15 : 0.1;
      const combinedScore = Math.min(1, verificationResult.confidenceScore + communityBoost);
      const threshold = type === 'Sovereign' ? 0.3 : 0.6;
      const finalStatus = combinedScore >= threshold ? 'verified' : 'ai_suggested';
      const allEvidence = [...evidenceSources, ...verificationResult.evidenceSources];
      const updated = await updateStore(store.id, {
        verificationStatus: finalStatus,
        confidenceScore: Math.round(combinedScore * 100) / 100,
        evidenceSources: allEvidence,
        evidenceCount: allEvidence.length,
        placesApiMatch: verificationResult.placesApiMatch,
        googlePlaceId: verificationResult.googlePlaceId,
        lat: verificationResult.lat,
        lng: verificationResult.lng,
        placesCategory: verificationResult.placesCategory,
        lastVerifiedAt: verificationResult.lastVerifiedAt,
      });
      res.status(201).json(updated);
    } else {
      res.status(201).json(store);
    }
  } catch (error) {
    console.error('Error submitting community store:', error);
    res.status(500).json({ error: 'Failed to submit store' });
  }
});

router.post('/stores/:id/flag', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const { reason, comment } = req.body;
    if (!reason) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }
    const flag = await addFlag(paramId(req.params), reason, comment);
    res.status(201).json(flag);
  } catch (error) {
    console.error('Error flagging store:', error);
    res.status(500).json({ error: 'Failed to flag store' });
  }
});

router.get('/stores/:id/flags', async (req, res) => {
  try {
    const flags = await getFlags(paramId(req.params));
    res.json(flags);
  } catch (error) {
    console.error('Error fetching flags:', error);
    res.status(500).json({ error: 'Failed to fetch flags' });
  }
});

router.get('/user/favorites', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const favorites = await getUserFavorites(userId);
    res.json(favorites);
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Failed to fetch favorites' });
  }
});

router.post('/user/favorites/:storeId', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    await addUserFavorite(userId, req.params.storeId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

router.delete('/user/favorites/:storeId', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    await removeUserFavorite(userId, req.params.storeId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

router.post('/user/favorites/sync', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const { storeIds } = req.body;
    if (!Array.isArray(storeIds)) {
      res.status(400).json({ error: 'storeIds array required' });
      return;
    }
    const result = await syncUserFavorites(userId, storeIds);
    res.json(result);
  } catch (error) {
    console.error('Error syncing favorites:', error);
    res.status(500).json({ error: 'Failed to sync favorites' });
  }
});

router.post('/user/claims', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const { storeId, message } = req.body;
    if (!storeId) {
      res.status(400).json({ error: 'storeId is required' });
      return;
    }
    const claim = await createStoreClaim(userId, storeId, message);
    res.status(201).json(claim);
  } catch (error) {
    console.error('Error creating claim:', error);
    res.status(500).json({ error: 'Failed to create claim' });
  }
});

router.get('/user/claims', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const claims = await getStoreClaimsByUser(userId);
    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

router.get('/user/profile/self', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const user = await authStorage.getUser(userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ handle: user.handle, avatarUrl: user.avatarUrl });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

const RESERVED_HANDLES = new Set(['me', 'self', 'admin', 'api', 'auth', 'profile', 'settings', 'store', 'posts', 'submit', 'owners', 'badges', 'anonymous']);

const SOCIAL_PLATFORMS: Record<string, { pattern: RegExp | null; isUrl: boolean }> = {
  instagram: { pattern: /^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,30}\/?$/, isUrl: true },
  facebook:  { pattern: /^https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]{1,100}\/?$/, isUrl: true },
  x:         { pattern: /^https?:\/\/(www\.)?(x|twitter)\.com\/[a-zA-Z0-9_]{1,15}\/?$/, isUrl: true },
  reddit:    { pattern: /^https?:\/\/(www\.)?reddit\.com\/(user|u)\/[a-zA-Z0-9_-]{3,20}\/?$/, isUrl: true },
  discord:   { pattern: /^[a-zA-Z0-9_.]{2,32}$/, isUrl: false },
};

async function checkUrlHead(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    return response.ok || response.status === 405 || response.status === 403;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

router.patch('/user/profile', isAuthenticated as RequestHandler, imageUpload.single('avatar'), async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const { handle, socialLinks: socialLinksRaw } = req.body;

    const updateData: {
      handle?: string | null;
      customProfileImageUrl?: string | null;
      socialLinks?: Array<{ platform: string; url: string; public: boolean; verified: boolean }>;
    } = {};

    if (handle !== undefined) {
      const cleaned = (handle || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (handle.trim() && cleaned.length < 2) {
        res.status(400).json({ error: 'Handle must be at least 2 characters (letters, numbers, underscores only)' });
        return;
      }
      if (cleaned.length > 30) {
        res.status(400).json({ error: 'Handle must be 30 characters or fewer' });
        return;
      }
      if (RESERVED_HANDLES.has(cleaned)) {
        res.status(400).json({ error: 'That handle is reserved and cannot be used' });
        return;
      }
      if (cleaned) {
        const existing = await getUserByHandle(cleaned);
        if (existing && existing.id !== userId) {
          res.status(409).json({ error: 'That handle is already taken' });
          return;
        }
      }
      updateData.handle = cleaned || null;
    }

    if (req.file) {
      let buffer = req.file.buffer;
      if (isHeicBuffer(buffer, req.file.mimetype)) {
        buffer = await convertHeicToJpegBuffer(buffer);
      }
      const processed = await sharp(buffer).resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
      const filename = `avatar-${userId}-${Date.now()}.jpg`;
      let url: string;
      if (isBunnyStorageConfigured()) {
        url = await uploadImageToStorage(processed, filename, 'avatars');
      } else {
        url = await uploadImageLocal(processed, filename, 'avatars');
      }
      updateData.customProfileImageUrl = url;
    }

    if (socialLinksRaw !== undefined) {
      let parsed: any[];
      try {
        parsed = JSON.parse(socialLinksRaw);
        if (!Array.isArray(parsed)) throw new Error('not array');
      } catch {
        res.status(400).json({ error: 'Invalid socialLinks format' });
        return;
      }
      if (parsed.length === 0) {
        res.status(400).json({ error: 'At least one social media link is required to save your profile.' });
        return;
      }
      if (parsed.length > 5) {
        res.status(400).json({ error: 'Maximum 5 social links allowed.' });
        return;
      }
      const seenPlatforms = new Set<string>();
      const validatedLinks: Array<{ platform: string; url: string; public: boolean; verified: boolean }> = [];
      for (const link of parsed) {
        const platform = (typeof link.platform === 'string' ? link.platform : '').trim().toLowerCase();
        const linkUrl = (typeof link.url === 'string' ? link.url : '').trim();
        if (!SOCIAL_PLATFORMS[platform]) {
          res.status(400).json({ error: `Invalid platform: ${platform}` });
          return;
        }
        if (seenPlatforms.has(platform)) {
          res.status(400).json({ error: `Duplicate platform: ${platform}` });
          return;
        }
        seenPlatforms.add(platform);
        if (!linkUrl) {
          res.status(400).json({ error: `URL/username is required for ${platform}` });
          return;
        }
        const config = SOCIAL_PLATFORMS[platform];
        if (config.pattern && !config.pattern.test(linkUrl)) {
          res.status(400).json({ error: `Invalid ${platform} URL or username format` });
          return;
        }
        let verified = false;
        if (config.isUrl) {
          verified = await checkUrlHead(linkUrl);
        }
        validatedLinks.push({
          platform,
          url: linkUrl,
          public: link.public === true || link.public === 'true',
          verified,
        });
      }
      updateData.socialLinks = validatedLinks;
    }

    if (socialLinksRaw === undefined) {
      const existingProfile = await getUserSocialProfile(userId);
      if (existingProfile.socialLinks.length === 0) {
        res.status(400).json({ error: 'A social media link is required to save your profile.' });
        return;
      }
    }

    const result = await updateUserProfile(userId, updateData);
    res.json(result);
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    if (error?.code === '23505') {
      res.status(409).json({ error: 'That handle is already taken' });
      return;
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/user/profile/:handle', async (req: any, res) => {
  try {
    const { handle } = req.params;
    const userInfo = await getUserByHandle(handle);
    if (!userInfo) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    const content = await getUserPublicProfile(userInfo.id);
    const publicLinks = (userInfo.socialLinks || []).filter((l: any) => l.public);
    const payload: any = {
      handle: userInfo.handle,
      avatarUrl: userInfo.avatarUrl,
      posts: content.posts,
      reviews: content.reviews,
      socialLinks: publicLinks,
    };
    res.json(payload);
  } catch (error) {
    console.error('Error fetching public profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.get('/user/owned-stores', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const storeIds = await getClaimedStoresForOwner(userId);
    const stores = [];
    for (const id of storeIds) {
      const store = await getStoreById(id);
      if (store) stores.push(store);
    }
    res.json(stores);
  } catch (error) {
    console.error('Error fetching owned stores:', error);
    res.status(500).json({ error: 'Failed to fetch owned stores' });
  }
});

router.patch('/owner/stores/:id', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const storeId = paramId(req.params);
    const role = await getUserRole(userId);
    if (role !== 'admin') {
      const ownedStores = await getClaimedStoresForOwner(userId);
      if (!ownedStores.includes(storeId)) {
        res.status(403).json({ error: 'You do not own this store' });
        return;
      }
    }
    const allowedFields = ['phone', 'website', 'hours', 'featuredOfferings', 'address', 'headerImageUrl'];
    const updates: any = {};
    for (const field of allowedFields) {
      if (field in req.body) updates[field] = req.body[field];
    }
    const store = await updateStore(storeId, updates);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(store);
  } catch (error) {
    console.error('Error updating owned store:', error);
    res.status(500).json({ error: 'Failed to update store' });
  }
});


router.get('/admin/review-queue', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const stores = await getReviewQueue();
    res.json(stores);
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

router.delete('/admin/reviews/:id', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }
    // Fetch first so we know the video_asset_id before removing anything.
    const review = await getReviewById(id);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    // Cascade: clean up Bunny CDN video and store_media row (non-fatal).
    if (review.videoAssetId) {
      const media = await getMediaById(review.videoAssetId);
      if (media) {
        if (media.bunnyVideoId && isBunnyConfigured()) {
          try {
            await deleteVideo(media.bunnyVideoId);
          } catch (e: any) {
            console.warn(`[Admin] Could not delete Bunny video ${media.bunnyVideoId} (non-fatal): ${e.message}`);
          }
        }
        try {
          await deleteStoreMedia(review.videoAssetId);
        } catch (e: any) {
          console.warn(`[Admin] Could not delete store_media ${review.videoAssetId} (non-fatal): ${e.message}`);
        }
      }
    }
    // Delete the review after media cleanup so it only disappears once everything is gone.
    await deleteReview(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

router.patch('/admin/stores/:id/review', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const { action, notes } = req.body;
    if (!action || !['approve', 'reject', 'mark_closed'].includes(action)) {
      res.status(400).json({ error: 'Valid action required: approve, reject, or mark_closed' });
      return;
    }
    const storeId = paramId(req.params);
    const adminUserId = getUserId(req)!;
    const existing = await getStoreById(storeId);
    const store = await adminReview(storeId, action, notes);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    const actionMap: Record<string, string> = { approve: 'store_approved', reject: 'store_rejected', mark_closed: 'store_closed' };
    try {
      await createAuditLog(adminUserId, actionMap[action], 'store', storeId, {
        storeName: store.name,
        previousStatus: existing?.verificationStatus,
        newStatus: store.verificationStatus,
        notes: notes || null,
      });
    } catch (auditErr) {
      console.error('Failed to write audit log:', auditErr);
    }
    res.json(store);
  } catch (error) {
    console.error('Error reviewing store:', error);
    res.status(500).json({ error: 'Failed to review store' });
  }
});

router.get('/admin/claims', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const claims = await getPendingClaims();
    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

router.patch('/admin/claims/:id/review', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const { action, notes } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Valid action required: approve or reject' });
      return;
    }
    const adminUserId = getUserId(req)!;
    const claim = await reviewClaim(parseInt(paramId(req.params)), action, notes);
    try {
      await createAuditLog(adminUserId, action === 'approve' ? 'claim_approved' : 'claim_rejected', 'claim', String(claim.id), {
        storeId: claim.storeId,
        userId: claim.userId,
        notes: notes || null,
      });
    } catch (auditErr) {
      console.error('Failed to write audit log:', auditErr);
    }
    res.json(claim);
  } catch (error) {
    console.error('Error reviewing claim:', error);
    res.status(500).json({ error: 'Failed to review claim' });
  }
});

router.get('/admin/stores', isAuthenticated as RequestHandler, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, claimed, search, province, sortBy, sortOrder, page, limit } = req.query;
    const result = await getAdminAllStores({
      status: status as string | undefined,
      claimed: claimed as string | undefined,
      search: search as string | undefined,
      province: province as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching admin stores:', error);
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.patch('/admin/stores/:id', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const storeId = paramId(req.params);
    const adminUserId = getUserId(req)!;
    const store = await adminUpdateStore(storeId, req.body, adminUserId);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

router.get('/admin/audit-logs', isAuthenticated as RequestHandler, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { storeId, adminUserId, action, targetType, startDate, endDate, page, limit } = req.query;
    const result = await getAuditLogs({
      storeId: storeId as string | undefined,
      adminUserId: adminUserId as string | undefined,
      action: action as string | undefined,
      targetType: targetType as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.get('/admin/branding', isAuthenticated as RequestHandler, requireAdmin, (_req, res) => {
  try {
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
    const assets: Record<string, { exists: boolean; url: string | null; filename: string }> = {};
    for (const [key, { filename }] of Object.entries(BRANDING_ASSET_MAP)) {
      const filepath = path.join(BRANDING_DIR, filename);
      const exists = fs.existsSync(filepath);
      assets[key] = { exists, url: exists ? `/branding-assets/${filename}` : null, filename };
    }
    res.json({ assets });
  } catch (error) {
    console.error('[AdminBranding] GET error:', error);
    res.status(500).json({ error: 'Failed to retrieve branding status' });
  }
});

router.post('/admin/branding/:asset', isAuthenticated as RequestHandler, requireAdmin, (req, res, next) => {
  const assetKey = req.params.asset as string;
  const assetDef = BRANDING_ASSET_MAP[assetKey];
  if (!assetDef) {
    res.status(400).json({ error: `Unknown branding asset: ${assetKey}` });
    return;
  }
  const upload = assetDef.type === 'video' ? brandingVideoUpload : brandingImageUpload;
  upload.single('file')(req, res, next);
}, async (req: any, res) => {
  try {
    const assetKey = req.params.asset;
    const assetDef = BRANDING_ASSET_MAP[assetKey];
    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }
    fs.mkdirSync(BRANDING_DIR, { recursive: true });
    const destPath = path.join(BRANDING_DIR, assetDef.filename);
    fs.writeFileSync(destPath, req.file.buffer);
    const url = `/branding-assets/${assetDef.filename}`;
    console.log(`[AdminBranding] Uploaded ${assetKey} → ${destPath}`);
    res.json({ success: true, asset: assetKey, url, filename: assetDef.filename });
  } catch (error: any) {
    console.error('[AdminBranding] Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

router.delete('/admin/branding/:asset', isAuthenticated as RequestHandler, requireAdmin, (req, res) => {
  try {
    const assetKey = req.params.asset as string;
    const assetDef = BRANDING_ASSET_MAP[assetKey];
    if (!assetDef) {
      res.status(400).json({ error: `Unknown branding asset: ${assetKey}` });
      return;
    }
    const destPath = path.join(BRANDING_DIR, assetDef.filename);
    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
      console.log(`[AdminBranding] Deleted ${assetKey} from ${destPath}`);
    }
    res.json({ success: true, asset: assetKey });
  } catch (error: any) {
    console.error('[AdminBranding] Delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

router.get('/admin/users', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const users = await getAllUsers();
    const usersWithBadges = await Promise.all(
      users.map(async (u: any) => {
        const badges = await getUserBadges(u.id);
        return { ...u, badges };
      })
    );
    res.json(usersWithBadges);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/admin/users/:id/role', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const targetId = paramId(req.params);
    const currentUserId = getUserId(req);
    if (targetId === currentUserId) {
      res.status(400).json({ error: 'You cannot change your own role' });
      return;
    }
    const { role } = req.body;
    if (!role || !['user', 'owner', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Valid role required: user, owner, or admin' });
      return;
    }
    await setUserRole(targetId, role);
    const users = await getAllUsers();
    const updatedUser = users.find(u => u.id === targetId);
    res.json(updatedUser || { id: targetId, role });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

router.delete('/admin/users/:id', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const targetId = paramId(req.params);
    const currentUserId = getUserId(req);
    if (targetId === currentUserId) {
      res.status(400).json({ error: 'You cannot delete your own account' });
      return;
    }
    await deleteUser(targetId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/admin/users/:id/badges/:badgeType', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const targetId = paramId(req.params);
    const badgeType = req.params.badgeType;
    const validTypes = [
      'explorer', 'local_scout', 'regional_builder', 'cross_region_contributor',
      'provincial_connector', 'bc_culture_guide', 'founding_bc_architect',
    ];
    if (!validTypes.includes(badgeType)) {
      res.status(400).json({ error: 'Invalid badge type' });
      return;
    }
    const badge = await awardBadge(targetId, badgeType, { awardedBy: 'admin', adminUserId: getUserId(req) });
    res.json(badge);
  } catch (error) {
    console.error('Error awarding badge:', error);
    res.status(500).json({ error: 'Failed to award badge' });
  }
});

router.delete('/admin/users/:id/badges/:badgeType', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const targetId = paramId(req.params);
    const badgeType = req.params.badgeType;
    const validTypes = [
      'explorer', 'local_scout', 'regional_builder', 'cross_region_contributor',
      'provincial_connector', 'bc_culture_guide', 'founding_bc_architect',
    ];
    if (!validTypes.includes(badgeType)) {
      res.status(400).json({ error: 'Invalid badge type' });
      return;
    }
    const revoked = await revokeBadge(targetId, badgeType);
    if (!revoked) {
      res.status(404).json({ error: 'Badge not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking badge:', error);
    res.status(500).json({ error: 'Failed to revoke badge' });
  }
});

const requireBunny: RequestHandler = (_req, res, next) => {
  if (!isBunnyConfigured()) {
    res.status(503).json({ error: 'Video service not configured' });
    return;
  }
  next();
};

router.post('/stores/:id/reviews', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req)!;
    const { rating, contentText, videoAssetId, disclosures } = req.body;

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
      return;
    }

    let hasVerifiedVideo = false;
    if (videoAssetId) {
      const videoMedia = await getMediaById(videoAssetId);
      if (videoMedia && videoMedia.storeId !== storeId) {
        res.status(400).json({ error: 'Video does not belong to this store' });
        return;
      }
      if (videoMedia && videoMedia.status === 'ready') {
        hasVerifiedVideo = true;
      }
    }

    const userBadges = await getUserBadges(userId);
    const scoutTiers = ['local_scout', 'regional_builder', 'cross_region_contributor', 'provincial_connector', 'bc_culture_guide', 'founding_bc_architect'];
    const isScout = userBadges.some(b => scoutTiers.includes(b.badgeType));

    const hasVerifiedPresenceCheckin = await hasRecentCheckin(userId, storeId, 60);

    let geoDeviationDetected = false;
    if (!hasVerifiedPresenceCheckin && req.body.lat != null && req.body.lng != null) {
      const store = await getStoreById(storeId);
      if (store && store.lat != null && store.lng != null) {
        const dist = calculateDistance(req.body.lat, req.body.lng, store.lat, store.lng);
        if (dist > 500) {
          geoDeviationDetected = true;
        }
      }
    }

    const trustWeight = calculateTrustWeight({
      hasVerifiedVideo,
      isScout,
      geoDeviationDetected,
      hasVerifiedPresence: hasVerifiedPresenceCheckin,
    });

    const review = await createReview({
      storeId,
      userId,
      rating,
      contentText: contentText || '',
      videoAssetId: videoAssetId || undefined,
      trustWeight,
      hasVerifiedVideo,
      disclosures: disclosures || undefined,
    });

    evaluateUserBadges(userId).catch((err: any) =>
      console.error('[Badges] Error evaluating badges after review:', err)
    );

    res.status(201).json(review);
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.get('/stores/:id/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = await getReviewsWithBadges(paramId(req.params));
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/users/:userId/badges', async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const badges = await getUserBadges(userId as string);
    res.json(badges);
  } catch (error) {
    console.error('Error fetching user badges:', error);
    res.status(500).json({ error: 'Failed to fetch user badges' });
  }
});

router.get('/user/badge-progress', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const { getUserStats } = await import('./integrity/badges');

    const stats = await getUserStats(userId);
    const badges = await getUserBadges(userId);

    res.json({
      uniqueStoreReviews: stats.uniqueStoreReviews,
      distinctStores: stats.distinctStores,
      culturePosts: stats.culturePosts,
      regionsCount: stats.regionsCount,
      repeatVisitCount: stats.repeatVisitCount,
      repeatVisitStores: stats.repeatVisitStores,
      qualityAverage: Math.round(stats.qualityAverage * 1000) / 1000,
      seasonalRevisits: stats.seasonalRevisits,
      timePeriodRevisits: stats.timePeriodRevisits,
      singleStoreMaxPct: Math.round(stats.singleStoreMaxPct * 100),
      badges,
    });
  } catch (error) {
    console.error('Error fetching badge progress:', error);
    res.status(500).json({ error: 'Failed to fetch badge progress' });
  }
});

router.get('/stores/:id/integrity-score', async (req: Request, res: Response) => {
  try {
    const reviews = await getReviewsByStore(paramId(req.params));
    const scoreCard = calculateIntegrityScore(reviews);
    res.json(scoreCard);
  } catch (error) {
    console.error('Error calculating integrity score:', error);
    res.status(500).json({ error: 'Failed to calculate integrity score' });
  }
});


router.get('/stores/:id/presence/qr', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res) => {
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

    const payload = getCurrentQRPayload(storeId);
    res.json(payload);
  } catch (error) {
    console.error('Error fetching presence QR:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
});

router.post('/stores/:id/presence/checkin', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req)!;
    const { qrCode, lat, lng } = req.body;

    if (!qrCode || typeof qrCode !== 'string') {
      res.status(400).json({ error: 'QR code is required' });
      return;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'Valid lat and lng are required' });
      return;
    }

    const result = await verifyPresence(storeId, userId, qrCode, lat, lng);
    res.json(result);
  } catch (error) {
    console.error('Error processing checkin:', error);
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

router.get('/stores/:id/presence/checkins', async (req: Request, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const checkins = await getStoreCheckins(storeId);
    const verifiedCount = checkins.filter((c: any) => c.verified).length;
    res.json({
      total: checkins.length,
      verified: verifiedCount,
    });
  } catch (error) {
    console.error('Error fetching store checkins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

router.get('/user/checkins', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const checkins = await getUserCheckins(userId);
    res.json(checkins);
  } catch (error) {
    console.error('Error fetching user checkins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

const requireCreator: RequestHandler = async (req: any, res, next) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const role = await getUserRole(userId);
  if (role === 'admin') { next(); return; }
  const creator = await isUserCreator(userId);
  if (!creator) { res.status(403).json({ error: 'Creator access required' }); return; }
  next();
};

router.post('/posts/upload-image', isAuthenticated as RequestHandler, requireCreator, imageUpload.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    let sourceBuffer = req.file.buffer;
    if (isHeicBuffer(sourceBuffer, req.file.mimetype)) {
      sourceBuffer = await convertHeicToJpegBuffer(sourceBuffer);
    }
    const meta = await sharp(sourceBuffer).metadata();
    const validFormats = new Set(['jpeg', 'png', 'webp', 'heif']);
    if (!meta.format || !validFormats.has(meta.format)) {
      res.status(400).json({ error: 'Uploaded file is not a supported image format' });
      return;
    }
    const convertedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    const filename = `${crypto.randomUUID()}.jpg`;
    let cdnUrl: string;
    if (isBunnyStorageConfigured()) {
      cdnUrl = await uploadImageToStorage(convertedBuffer, filename);
    } else {
      cdnUrl = await uploadImageLocal(convertedBuffer, filename);
    }
    res.json({ cdnUrl, filename });
  } catch (error: any) {
    console.error('[ImageUpload] Error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to upload image' });
  }
});

router.post('/posts/init-video', isAuthenticated as RequestHandler, requireCreator, requireBunny, async (req: any, res) => {
  try {
    const { title } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const video = await createVideo(title.trim());
    const creds = generateTusCredentials(video.guid);
    const embedUrl = getEmbedUrl(video.guid);
    res.json({
      videoId: video.guid,
      signature: creds.signature,
      expirationTime: creds.expirationTime,
      libraryId: creds.libraryId,
      embedUrl,
    });
  } catch (error: any) {
    console.error('Error initializing post video upload:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize video upload' });
  }
});

router.post('/posts', isAuthenticated as RequestHandler, requireCreator, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const { title, subtitle, bodyText, contentTier, storeId, media } = req.body;
    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const SCOUT_PLUS_BADGES = ['local_scout', 'regional_builder', 'cross_region_contributor', 'provincial_connector', 'bc_culture_guide', 'founding_bc_architect'];
    const userBadgesForPost = await getUserBadges(userId);
    const hasScoutPlus = userBadgesForPost.some(b => SCOUT_PLUS_BADGES.includes(b.badgeType));

    const requestedClean = contentTier === 'clean';
    const tier: ContentTier = (requestedClean && hasScoutPlus) ? 'clean' : 'raw';
    let status: PostStatus = 'pending_moderation';
    let moderationNotes: string | null = null;

    if (tier === 'clean') {
      const check = await moderateCleanContent(title, subtitle, bodyText);
      if (check.passed) {
        status = 'published';
      } else {
        status = 'rejected';
        moderationNotes = check.reason || 'Failed auto-moderation';
      }
    }

    const post = await createPost({
      userId,
      storeId: storeId || null,
      title: title.trim(),
      subtitle: subtitle?.trim() || null,
      bodyText: bodyText?.trim() || null,
      contentTier: tier,
      status,
      moderationNotes,
    });

    if (Array.isArray(media) && media.length > 0) {
      const allowedDomains = ['.b-cdn.net', '.bunnycdn.com', '.bunny.net', '.mediadelivery.net'];
      const hasVideo = media.some((m: any) => m.mediaType === 'video');
      const validMedia = hasVideo ? media.filter((m: any) => m.mediaType === 'video').slice(0, 1) : media.slice(0, 10);
      for (let i = 0; i < validMedia.length; i++) {
        const m = validMedia[i];
        if (m.cdnUrl && typeof m.cdnUrl === 'string') {
          try {
            const url = new URL(m.cdnUrl);
            const domainAllowed = url.protocol === 'https:' && allowedDomains.some(d => url.hostname.endsWith(d));
            if (!domainAllowed) {
              console.warn(`Rejected media URL from non-allowed domain: ${url.hostname}`);
              continue;
            }
          } catch {
            continue;
          }
          await addPostMedia({
            postId: post.id,
            mediaType: m.mediaType === 'video' ? 'video' : 'image',
            bunnyId: m.bunnyId || null,
            cdnUrl: m.cdnUrl,
            caption: m.caption || null,
            displayOrder: i,
          });
        }
      }
    }

    const fullPost = await getPostById(post.id);
    res.status(201).json(fullPost);
  } catch (error: any) {
    console.error('Error creating post:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

router.get('/posts', async (req: any, res: Response) => {
  try {
    const { storeId, page, limit } = req.query;
    const result = await listPublishedPosts({
      storeId: storeId as string | undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });
    const authenticated = req.isAuthenticated && req.isAuthenticated();
    if (!authenticated) {
      result.posts = result.posts.map(post => {
        if (post.contentTier === 'raw') {
          return {
            ...post,
            title: 'Raw Content',
            subtitle: null,
            bodyText: null,
            media: [],
          };
        }
        return post;
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error listing posts:', error);
    res.status(500).json({ error: 'Failed to list posts' });
  }
});

router.get('/posts/mine', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const userId = getUserId(req)!;
    const posts = await listUserPosts(userId);
    res.json(posts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ error: 'Failed to fetch your posts' });
  }
});

router.get('/posts/pending', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const posts = await listPendingPosts();
    res.json(posts);
  } catch (error) {
    console.error('Error fetching pending posts:', error);
    res.status(500).json({ error: 'Failed to fetch pending posts' });
  }
});

router.get('/admin/posts', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const posts = await listAllPosts();
    res.json(posts);
  } catch (error) {
    console.error('Error fetching all posts for admin:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});



router.get('/posts/:id', async (req: any, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid post ID' }); return; }
    const post = await getPostById(id);
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }
    if (post.status !== 'published') {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const authenticated = req.isAuthenticated && req.isAuthenticated();
    if (post.contentTier === 'raw' && !authenticated) {
      res.status(403).json({ error: 'Sign in to view raw content' });
      return;
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

router.post('/posts/:id/moderate', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid post ID' }); return; }
    const { action, notes } = req.body;
    const validActions = ['approve', 'reject', 'mark_raw', 'mark_clean'];
    if (!validActions.includes(action)) {
      res.status(400).json({ error: `Action must be one of: ${validActions.join(', ')}` });
      return;
    }
    const existing = await getPostById(id);
    if (!existing) { res.status(404).json({ error: 'Post not found' }); return; }

    let post: CreatorPost | null;
    if (action === 'mark_raw' || action === 'mark_clean') {
      const tier: ContentTier = action === 'mark_raw' ? 'raw' : 'clean';
      post = await updatePostContentTier(id, tier);
    } else {
      const newStatus: PostStatus = action === 'approve' ? 'published' : 'rejected';
      post = await updatePostStatus(id, newStatus, notes);
    }
    if (!post) { res.status(404).json({ error: 'Post not found' }); return; }

    const adminId = getUserId(req)!;
    await createAuditLog(adminId, `post_${action}`, 'post', String(id), {
      postTitle: post.title,
      contentTier: post.contentTier,
      notes: notes || null,
    });

    res.json(post);
  } catch (error) {
    console.error('Error moderating post:', error);
    res.status(500).json({ error: 'Failed to moderate post' });
  }
});

router.patch('/posts/:id', isAuthenticated as RequestHandler, requireCreator, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid post ID' }); return; }
    const userId = getUserId(req)!;
    const { title, subtitle, bodyText } = req.body;
    const updated = await updatePost(id, userId, { title, subtitle, bodyText });
    if (!updated) {
      res.status(404).json({ error: 'Post not found or cannot be edited (only draft/rejected posts can be updated)' });
      return;
    }
    const fullPost = await getPostById(updated.id);
    res.json(fullPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

router.delete('/posts/:id', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid post ID' }); return; }
    const userId = getUserId(req)!;
    const role = await getUserRole(userId);
    const existing = await getPostById(id);
    let deleted: boolean;
    if (role === 'admin') {
      deleted = await adminDeletePost(id);
      if (deleted) {
        try {
          await createAuditLog(userId, 'post_delete', 'post', String(id), {
            postTitle: existing?.title ?? null,
            storeId: existing?.storeId ?? null,
          });
        } catch (auditErr) {
          console.error('Failed to write audit log:', auditErr);
        }
      }
    } else {
      deleted = await deletePost(id, userId);
    }
    if (!deleted) { res.status(404).json({ error: 'Post not found or not yours' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

router.patch('/admin/users/:id/creator', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const userId = req.params.id;
    const { isCreator } = req.body;
    await setUserCreatorStatus(userId, !!isCreator);
    const adminId = getUserId(req)!;
    await createAuditLog(adminId, isCreator ? 'grant_creator' : 'revoke_creator', 'user', userId, {});
    res.json({ success: true, isCreator: !!isCreator });
  } catch (error) {
    console.error('Error updating creator status:', error);
    res.status(500).json({ error: 'Failed to update creator status' });
  }
});

router.post('/waitlist', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      res.status(400).json({ error: 'A valid email address is required' });
      return;
    }
    const record = await addWaitlistEmail(email);
    if (record.isNew) {
      sendWaitlistConfirmation(record.email).catch((err: any) => {
        console.error('[Mailer] Failed to send waitlist confirmation:', err?.message || err);
      });
    }
    res.json({ success: true, alreadySubscribed: !record.isNew });
  } catch (error: any) {
    console.error('[Waitlist] Error adding email:', error?.message || error);
    res.status(500).json({ error: 'Failed to join waitlist' });
  }
});

router.get('/admin/waitlist', isAuthenticated as RequestHandler, requireAdmin, async (_req: any, res: Response) => {
  try {
    const emails = await getWaitlistEmails();
    res.json({ emails, total: emails.length });
  } catch (error: any) {
    console.error('[Waitlist] Error fetching emails:', error?.message || error);
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
});

const MAIN_DOMAIN_FOR_DROPS = 'legacyleafdirectory.ca';

function buildAutoLink(store: { id: string; customDomain?: string; domainVerified?: boolean; sovereignPlanStatus?: string }): string {
  if (store.customDomain && store.domainVerified && store.sovereignPlanStatus === 'active') {
    return `https://${store.customDomain}`;
  }
  return `https://${MAIN_DOMAIN_FOR_DROPS}/#/store/${store.id}`;
}

router.post('/owner/stores/:id/drops', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const role = await getUserRole(userId);
    if (role !== 'admin') {
      const claimed = await getClaimedStoresForOwner(userId);
      const owns = claimed.some((s: any) => s.id === storeId);
      if (!owns) { res.status(403).json({ error: 'You do not own this store' }); return; }
    }

    const store = await getStoreById(storeId);
    if (!store) { res.status(404).json({ error: 'Store not found' }); return; }

    const { type, title, body, customLink } = req.body;
    if (!type || !['product', 'event', 'announcement'].includes(type)) {
      res.status(400).json({ error: 'type must be product, event, or announcement' }); return;
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'title is required' }); return;
    }
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      res.status(400).json({ error: 'body is required' }); return;
    }
    if (title.trim().length > 200) {
      res.status(400).json({ error: 'title must be 200 characters or fewer' }); return;
    }
    if (body.trim().length > 2000) {
      res.status(400).json({ error: 'body must be 2000 characters or fewer' }); return;
    }
    if (customLink && typeof customLink === 'string' && customLink.trim().length > 0) {
      try {
        const parsed = new URL(customLink.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          res.status(400).json({ error: 'customLink must be a valid http or https URL' }); return;
        }
      } catch {
        res.status(400).json({ error: 'customLink must be a valid http or https URL' }); return;
      }
    }

    const autoLink = buildAutoLink(store);
    const drop = await createDrop({
      storeId,
      userId,
      type: type.trim(),
      title: title.trim(),
      body: body.trim(),
      autoLink,
      customLink: customLink?.trim() || undefined,
    });

    res.status(201).json(drop);
  } catch (err: any) {
    console.error('[Drops] Error creating drop:', err?.message || err);
    res.status(500).json({ error: 'Failed to create drop' });
  }
});

router.get('/owner/stores/:id/drops', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const role = await getUserRole(userId);
    if (role !== 'admin') {
      const claimed = await getClaimedStoresForOwner(userId);
      const owns = claimed.some((s: any) => s.id === storeId);
      if (!owns) { res.status(403).json({ error: 'You do not own this store' }); return; }
    }

    const drops = await getDropsByStore(storeId);
    res.json(drops);
  } catch (err: any) {
    console.error('[Drops] Error fetching drops:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch drops' });
  }
});

router.delete('/owner/stores/:id/drops/:dropId', isAuthenticated as RequestHandler, requireOwnerOrAdmin, async (req: any, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const dropId = parseInt(req.params.dropId);
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (isNaN(dropId)) { res.status(400).json({ error: 'Invalid drop ID' }); return; }

    const role = await getUserRole(userId);
    if (role !== 'admin') {
      const claimed = await getClaimedStoresForOwner(userId);
      const owns = claimed.some((s: any) => s.id === storeId);
      if (!owns) { res.status(403).json({ error: 'You do not own this store' }); return; }
    }

    const cancelled = await cancelDrop(dropId, storeId);
    if (!cancelled) { res.status(404).json({ error: 'Drop not found or cannot be cancelled (only pending drops can be cancelled)' }); return; }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Drops] Error cancelling drop:', err?.message || err);
    res.status(500).json({ error: 'Failed to cancel drop' });
  }
});

router.post('/owner/stores/:id/drops/:dropId/cover-image', isAuthenticated as RequestHandler, requireOwnerOrAdmin, imageUpload.single('image'), async (req: any, res: Response) => {
  try {
    const storeId = paramId(req.params);
    const dropId = parseInt(req.params.dropId);
    const userId = getUserId(req);
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    if (isNaN(dropId)) { res.status(400).json({ error: 'Invalid drop ID' }); return; }
    if (!req.file) { res.status(400).json({ error: 'No image file provided' }); return; }

    const role = await getUserRole(userId);
    if (role !== 'admin') {
      const claimed = await getClaimedStoresForOwner(userId);
      const owns = claimed.some((s: any) => s.id === storeId);
      if (!owns) { res.status(403).json({ error: 'You do not own this store' }); return; }
    }

    let buffer: Buffer = req.file.buffer;
    if (isHeicBuffer(buffer, req.file.mimetype)) {
      buffer = await convertHeicToJpegBuffer(buffer);
    }
    const processed = await sharp(buffer).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer();
    const filename = `drop-cover-${dropId}-${Date.now()}.jpg`;
    let url: string;
    if (isBunnyStorageConfigured()) {
      url = await uploadImageToStorage(processed, filename, 'drop-covers');
    } else {
      url = await uploadImageLocal(processed, filename, 'drop-covers');
    }

    const drop = await updateDropCoverImage(dropId, storeId, url);
    if (!drop) { res.status(404).json({ error: 'Drop not found or cannot be updated' }); return; }
    res.json({ url, drop });
  } catch (err: any) {
    console.error('[Drops] Error uploading cover image:', err?.message || err);
    res.status(500).json({ error: 'Failed to upload cover image' });
  }
});

router.get('/admin/drops', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: Response) => {
  try {
    const { status, page, limit } = req.query;
    const result = await adminGetDrops({
      status: status as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json(result);
  } catch (err: any) {
    console.error('[Drops] Error fetching admin drops:', err?.message || err);
    res.status(500).json({ error: 'Failed to fetch drops' });
  }
});

router.patch('/admin/drops/:id/review', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res: Response) => {
  try {
    const dropId = parseInt(req.params.id);
    if (isNaN(dropId)) { res.status(400).json({ error: 'Invalid drop ID' }); return; }

    const { action, scheduledAt, adminNotes } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'action must be approve or reject' }); return;
    }
    if (action === 'approve' && !scheduledAt) {
      res.status(400).json({ error: 'scheduledAt is required when approving' }); return;
    }

    const drop = await adminReviewDrop(dropId, action, { scheduledAt, adminNotes });
    if (!drop) { res.status(404).json({ error: 'Drop not found or already reviewed' }); return; }

    const adminId = getUserId(req)!;
    await createAuditLog(adminId, `drop_${action}d`, 'drop', String(dropId), {
      dropTitle: drop.title,
      storeId: drop.storeId,
      scheduledAt: drop.scheduledAt,
      adminNotes: drop.adminNotes,
    }).catch((e: any) => console.error('[Drops] Audit log error:', e?.message));

    res.json(drop);
  } catch (err: any) {
    console.error('[Drops] Error reviewing drop:', err?.message || err);
    res.status(500).json({ error: 'Failed to review drop' });
  }
});

export default router;
