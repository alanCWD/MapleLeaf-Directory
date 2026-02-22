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
    console.log(`[API] Search request: "${query}"`);
    const result = await serverSearchStores(query.trim(), userLocation);
    console.log(`[API] Search returned ${result.stores.length} stores`);
    res.json(result);
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

router.patch('/admin/stores/:id/review', isAuthenticated as RequestHandler, requireAdmin, async (req, res) => {
  try {
    const { action, notes } = req.body;
    if (!action || !['approve', 'reject', 'mark_closed'].includes(action)) {
      res.status(400).json({ error: 'Valid action required: approve, reject, or mark_closed' });
      return;
    }
    const store = await adminReview(paramId(req.params), action, notes);
    if (!store) {
      res.status(404).json({ error: 'Store not found' });
      return;
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

router.patch('/admin/claims/:id/review', isAuthenticated as RequestHandler, requireAdmin, async (req, res) => {
  try {
    const { action, notes } = req.body;
    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({ error: 'Valid action required: approve or reject' });
      return;
    }
    const claim = await reviewClaim(parseInt(paramId(req.params)), action, notes);
    res.json(claim);
  } catch (error) {
    console.error('Error reviewing claim:', error);
    res.status(500).json({ error: 'Failed to review claim' });
  }
});

router.get('/admin/users', isAuthenticated as RequestHandler, requireAdmin, async (_req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
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

export default router;
