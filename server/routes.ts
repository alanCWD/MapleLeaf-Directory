import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
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
} from './userDb.ts';
import {
  initUpload,
  getStoreMediaList,
  getSingleMedia,
  removeMedia,
  isBunnyConfigured,
  createReview,
  getReviewsByStore,
  calculateTrustWeight,
  calculateIntegrityScore,
  getMediaById,
  evaluateUserBadges,
  getUserBadges,
  getReviewsWithBadges,
  updateMediaModeration,
  getVideoReviews,
  awardBadge,
  revokeBadge,
  getCurrentQRPayload,
  verifyPresence,
  getStoreCheckins,
  getUserCheckins,
  hasRecentCheckin,
  calculateDistance,
} from './integrity/index.ts';
import type { RecorderQuestion } from './integrity/types.ts';
import multer from 'multer';
import { createJobDir, stitchClips, uploadStitchedToBunny, cleanupJobDir } from './videoStitcher.ts';
import { createVideo, generateTusCredentials, getEmbedUrl, getThumbnailUrl } from './bunnyStream.ts';
import { createStoreMedia, updateMediaStatus } from './integrity/models.ts';
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
import type { PostStatus, ContentTier } from '../types';
import { uploadImageToStorage, isBunnyStorageConfigured, uploadImageLocal } from './bunnyStorage.ts';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import heicConvert from 'heic-convert';

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

const clipUpload = multer({
  dest: '/tmp/video-stitch/uploads',
  limits: { fileSize: 200 * 1024 * 1024 },
});

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
    const { province, type, verificationStatus, hideUnverified } = req.query;
    const stores = await getAllStores({
      province: province as string | undefined,
      type: type as string | undefined,
      verificationStatus: verificationStatus as string | undefined,
      hideUnverified: hideUnverified === 'true',
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
    const { handle, socialLinkPlatform, socialLinkUrl, socialLinkPublic } = req.body;

    const updateData: {
      handle?: string | null;
      customProfileImageUrl?: string | null;
      socialLinkPlatform?: string | null;
      socialLinkUrl?: string | null;
      socialLinkPublic?: boolean;
      socialLinkVerified?: boolean;
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

    if (socialLinkPlatform !== undefined || socialLinkUrl !== undefined) {
      const platform = (socialLinkPlatform || '').trim().toLowerCase();
      const linkUrl = (socialLinkUrl || '').trim();

      if (platform && !SOCIAL_PLATFORMS[platform]) {
        res.status(400).json({ error: 'Invalid social platform. Must be one of: instagram, facebook, x, reddit, discord' });
        return;
      }

      if (!platform && linkUrl) {
        res.status(400).json({ error: 'A platform must be selected when providing a social link URL' });
        return;
      } else if (platform && linkUrl) {
        const config = SOCIAL_PLATFORMS[platform];
        if (config.pattern && !config.pattern.test(linkUrl)) {
          res.status(400).json({ error: `Invalid ${platform} URL format` });
          return;
        }
        updateData.socialLinkPlatform = platform;
        updateData.socialLinkUrl = linkUrl;
        let verified = false;
        if (config.isUrl) {
          verified = await checkUrlHead(linkUrl);
        }
        updateData.socialLinkVerified = verified;
      } else if (!platform && !linkUrl) {
        updateData.socialLinkPlatform = null;
        updateData.socialLinkUrl = null;
        updateData.socialLinkVerified = false;
      } else if (platform && !linkUrl) {
        res.status(400).json({ error: 'Social link URL is required when a platform is selected' });
        return;
      }
    }

    if (socialLinkPublic !== undefined) {
      updateData.socialLinkPublic = socialLinkPublic === true || socialLinkPublic === 'true';
    }

    const existingProfile = await updateUserProfile(userId, {});
    const willHavePlatform = 'socialLinkPlatform' in updateData ? updateData.socialLinkPlatform : existingProfile.socialLinkPlatform;
    const willHaveUrl = 'socialLinkUrl' in updateData ? updateData.socialLinkUrl : existingProfile.socialLinkUrl;
    if (!willHavePlatform || !willHaveUrl) {
      res.status(400).json({ error: 'A social media link is required to save your profile. Please select a platform and enter your link.' });
      return;
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
    const payload: any = {
      handle: userInfo.handle,
      avatarUrl: userInfo.avatarUrl,
      posts: content.posts,
      reviews: content.reviews,
    };
    if (userInfo.socialLinkPublic && userInfo.socialLinkPlatform && userInfo.socialLinkUrl) {
      payload.socialLinkPlatform = userInfo.socialLinkPlatform;
      payload.socialLinkUrl = userInfo.socialLinkUrl;
      payload.socialLinkVerified = userInfo.socialLinkVerified;
    }
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

router.post('/stores/:id/media/init', isAuthenticated as RequestHandler, requireBunny, async (req: any, res) => {
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req)!;
    const { title, mediaType } = req.body;
    if (!title || typeof title !== 'string') {
      res.status(400).json({ error: 'Title is required' });
      return;
    }
    const credentials = await initUpload(storeId, userId, title, mediaType || 'video');
    res.json(credentials);
  } catch (error: any) {
    console.error('Error initializing media upload:', error);
    res.status(500).json({ error: 'Failed to initialize upload' });
  }
});

const ALLOWED_VIDEO_MIMES = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/ogg', 'application/octet-stream'];

router.post('/stores/:id/media/stitch', isAuthenticated as RequestHandler, requireBunny, (req: any, res: any, next: any) => {
  clipUpload.array('clips', 10)(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Maximum 200MB per clip.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many clips. Maximum 10 clips.' });
      }
      return res.status(400).json({ error: err.message || 'Upload error' });
    }
    next();
  });
}, async (req: any, res: any) => {
  let jobDir: string | null = null;
  try {
    const storeId = paramId(req.params);
    const userId = getUserId(req)!;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No clips provided' });
      return;
    }

    for (const file of files) {
      const baseMime = file.mimetype.split(';')[0].trim();
      if (!ALLOWED_VIDEO_MIMES.includes(baseMime) && !baseMime.startsWith('video/')) {
        res.status(400).json({ error: `Invalid file type: ${file.mimetype}. Only video files are accepted.` });
        return;
      }
    }

    let questions: { id: string; prompt: string }[] = [];
    try {
      questions = JSON.parse(req.body.questions || '[]');
    } catch {
      questions = [];
    }

    const storeName = req.body.storeName || 'Store Review';
    const title = req.body.title || `Video Review - ${storeName}`;

    jobDir = createJobDir();

    const clipInputs = files.map((file, idx) => {
      const destPath = path.join(jobDir!, `clip_${idx}${path.extname(file.originalname) || '.webm'}`);
      fs.renameSync(file.path, destPath);
      const q = questions[idx];
      return {
        filePath: destPath,
        questionPrompt: q?.prompt || `Part ${idx + 1}`,
        index: idx,
      };
    });

    console.log(`[Stitch] Starting stitch job for store ${storeId}: ${clipInputs.length} clips`);

    const stitchResult = await stitchClips({
      clips: clipInputs,
      storeName,
      transitionDuration: 0.5,
      titleCardDuration: 2.5,
    });

    const bunnyVideo = await createVideo(title);
    let media: any = null;
    try {
      media = await createStoreMedia({
        storeId,
        userId,
        bunnyVideoId: bunnyVideo.guid,
        bunnyLibraryId: String(bunnyVideo.videoLibraryId),
        title,
        embedUrl: getEmbedUrl(bunnyVideo.guid),
        thumbnailUrl: getThumbnailUrl(bunnyVideo.guid),
        mediaType: 'review',
        status: 'processing',
      });

      await uploadStitchedToBunny(stitchResult.outputPath, bunnyVideo.guid);
    } catch (uploadErr: any) {
      console.error('[Stitch] Upload/DB error, cleaning up Bunny asset:', uploadErr);
      if (media) {
        try { await updateMediaStatus(bunnyVideo.guid, 'failed', {}); } catch {}
      }
      try {
        const { deleteVideo } = await import('./bunnyStream.ts');
        await deleteVideo(bunnyVideo.guid);
      } catch {}
      throw uploadErr;
    }

    cleanupJobDir(jobDir);
    jobDir = null;

    console.log(`[Stitch] Complete: mediaId=${media.id}, bunnyVideoId=${bunnyVideo.guid}`);

    res.json({
      mediaId: media.id,
      videoId: bunnyVideo.guid,
      embedUrl: getEmbedUrl(bunnyVideo.guid),
      durationSeconds: stitchResult.durationSeconds,
      fileSizeBytes: stitchResult.fileSizeBytes,
    });
  } catch (error: any) {
    console.error('[Stitch] Error:', error);
    if (jobDir) cleanupJobDir(jobDir);
    res.status(500).json({ error: error.message || 'Video stitching failed' });
  }
});

router.get('/stores/:id/media', async (req: Request, res: Response) => {
  try {
    const media = await getStoreMediaList(paramId(req.params));
    res.json(media);
  } catch (error) {
    console.error('Error fetching store media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.get('/stores/:id/media/:mediaId', async (req: any, res: Response) => {
  try {
    const mediaId = parseInt(req.params.mediaId);
    if (isNaN(mediaId)) {
      res.status(400).json({ error: 'Invalid media ID' });
      return;
    }
    const media = await getSingleMedia(mediaId);
    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }
    res.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

router.delete('/stores/:id/media/:mediaId', isAuthenticated as RequestHandler, async (req: any, res) => {
  try {
    const mediaId = parseInt(req.params.mediaId);
    if (isNaN(mediaId)) {
      res.status(400).json({ error: 'Invalid media ID' });
      return;
    }
    const userId = getUserId(req)!;
    const role = await getUserRole(userId);
    const media = await getSingleMedia(mediaId);
    if (!media) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }

    if (media.storeId !== paramId(req.params)) {
      res.status(404).json({ error: 'Media not found for this store' });
      return;
    }
    const isMediaOwner = media.userId === userId;
    const isAdmin = role === 'admin';
    let isStoreOwner = false;
    if (role === 'owner' || role === 'admin') {
      const ownedStores = await getClaimedStoresForOwner(userId);
      isStoreOwner = ownedStores.includes(paramId(req.params));
    }

    if (!isMediaOwner && !isStoreOwner && !isAdmin) {
      res.status(403).json({ error: 'Not authorized to delete this media' });
      return;
    }

    const deleted = await removeMedia(mediaId, userId);
    if (!deleted) {
      res.status(404).json({ error: 'Media not found' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

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

router.get('/stores/:id/recorder-questions', async (req: Request, res: Response) => {
  try {
    const store = await getStoreById(paramId(req.params));
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }

    const questions: RecorderQuestion[] = [
      {
        id: 'q1',
        prompt: `What brought you to ${store.name} today?`,
        maxDurationSeconds: 30,
        isRequired: true,
      },
      {
        id: 'q2',
        prompt: 'What makes this spot special or unique?',
        maxDurationSeconds: 45,
        isRequired: true,
      },
      {
        id: 'q3',
        prompt: 'Would you recommend this place to others? Why?',
        maxDurationSeconds: 30,
        isRequired: false,
      },
    ];

    if (store.type === 'Sovereign') {
      questions.push({
        id: 'q4',
        prompt: 'How does this business connect to its community or culture?',
        maxDurationSeconds: 45,
        isRequired: false,
      });
    }

    res.json(questions);
  } catch (error) {
    console.error('Error fetching recorder questions:', error);
    res.status(500).json({ error: 'Failed to fetch recorder questions' });
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


router.get('/admin/media/video-reviews', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const reviews = await getVideoReviews();
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching video reviews:', error);
    res.status(500).json({ error: 'Failed to fetch video reviews' });
  }
});

router.post('/admin/media/:id/moderate', isAuthenticated as RequestHandler, requireAdmin, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid media ID' }); return; }
    const { moderationStatus, contentRating, moderationNotes } = req.body;
    const validStatuses = ['approved', 'disapproved'];
    const validRatings = ['clean', 'raw'];
    if (moderationStatus && !validStatuses.includes(moderationStatus)) {
      res.status(400).json({ error: 'moderationStatus must be approved or disapproved' });
      return;
    }
    if (contentRating && !validRatings.includes(contentRating)) {
      res.status(400).json({ error: 'contentRating must be clean or raw' });
      return;
    }
    const existing = await getMediaById(id);
    if (!existing) { res.status(404).json({ error: 'Media not found' }); return; }
    if ((existing as any).mediaType !== 'review') {
      res.status(400).json({ error: 'Only video reviews can be moderated via this endpoint' });
      return;
    }
    const updated = await updateMediaModeration(id, { moderationStatus, contentRating, moderationNotes });
    if (!updated) { res.status(404).json({ error: 'Media not found' }); return; }
    const adminId = getUserId(req)!;
    await createAuditLog(adminId, 'media_moderate', 'store_media', String(id), {
      moderationStatus,
      contentRating,
      moderationNotes: moderationNotes || null,
    });
    res.json(updated);
  } catch (error) {
    console.error('Error moderating media:', error);
    res.status(500).json({ error: 'Failed to moderate media' });
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
    let deleted: boolean;
    if (role === 'admin') {
      deleted = await adminDeletePost(id);
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

export default router;
