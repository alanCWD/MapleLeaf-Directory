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
import { createVideo, generateTusCredentials, getEmbedUrl } from './bunnyStream.ts';
import { createStoreMedia, updateMediaStatus } from './integrity/models.ts';
import path from 'path';
import fs from 'fs';

const clipUpload = multer({
  dest: '/tmp/video-stitch/uploads',
  limits: { fileSize: 200 * 1024 * 1024 },
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
      res.json({ stores: dbStores, source: 'database' });
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

    const combined = [...dbStores, ...newAiStores];
    console.log(`[API] Combined results: ${dbStores.length} from DB + ${newAiStores.length} new from AI = ${combined.length} total`);
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
    for (const storeData of validStores) {
      const store = await upsertStore(storeData);
      results.push(store);
    }
    res.status(201).json({ count: results.length, stores: results });
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
    const allowedFields = ['phone', 'website', 'hours', 'featuredOfferings', 'address'];
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
    const validTypes = ['verified_scout', 'legacy_archivist', 'integrity_anchor'];
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
    const validTypes = ['verified_scout', 'legacy_archivist', 'integrity_anchor'];
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
      if (!ALLOWED_VIDEO_MIMES.includes(file.mimetype)) {
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
    const isScout = userBadges.some(b => b.badgeType === 'verified_scout');

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
    const { pool } = await import('./db');

    const videoReviewResult = await pool.query(
      `SELECT COUNT(*) as cnt, COUNT(DISTINCT store_id) as store_cnt
       FROM integrity_reviews WHERE user_id = $1 AND has_verified_video = true`,
      [userId]
    );
    const videoReviewCount = parseInt(videoReviewResult.rows[0].cnt);
    const distinctVideoStores = parseInt(videoReviewResult.rows[0].store_cnt);

    const reviewResult = await pool.query(
      `SELECT COUNT(*) as cnt,
              AVG((trust_weight->>'final')::numeric) as avg_trust,
              SUM(CASE WHEN is_flagged THEN 1 ELSE 0 END) as flagged_cnt
       FROM integrity_reviews WHERE user_id = $1`,
      [userId]
    );
    const totalReviewCount = parseInt(reviewResult.rows[0].cnt);
    const avgTrustWeight = reviewResult.rows[0].avg_trust ? parseFloat(reviewResult.rows[0].avg_trust) : 0;
    const flaggedCount = parseInt(reviewResult.rows[0].flagged_cnt);

    const mediaResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM store_media WHERE user_id = $1`,
      [userId]
    );
    const mediaUploadCount = parseInt(mediaResult.rows[0].cnt);

    let communitySubmissionCount = 0;
    try {
      const subResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM store_claims WHERE user_id = $1 AND status = 'approved'`,
        [userId]
      );
      communitySubmissionCount = parseInt(subResult.rows[0].cnt);
    } catch {}

    const badges = await getUserBadges(userId);

    res.json({
      videoReviewCount,
      distinctVideoStores,
      totalReviewCount,
      avgTrustWeight: Math.round(avgTrustWeight * 1000) / 1000,
      flaggedCount,
      mediaUploadCount,
      communitySubmissionCount,
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

export default router;
