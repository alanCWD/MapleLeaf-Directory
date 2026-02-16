import { Router } from 'express';
import type { Request, Response } from 'express';
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

const router = Router();

function paramId(params: any): string {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

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

router.post('/stores', async (req, res) => {
  try {
    const store = await upsertStore(req.body);
    res.status(201).json(store);
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

router.post('/stores/bulk', async (req: Request, res: Response) => {
  try {
    const stores = req.body.stores || req.body;
    if (!Array.isArray(stores)) {
      res.status(400).json({ error: 'Expected an array of stores' });
      return;
    }
    const results = [];
    for (const storeData of stores) {
      const store = await upsertStore(storeData);
      results.push(store);
    }
    res.status(201).json({ count: results.length, stores: results });
  } catch (error) {
    console.error('Error bulk upserting stores:', error);
    res.status(500).json({ error: 'Failed to bulk upsert stores' });
  }
});

router.patch('/stores/:id', async (req, res) => {
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

router.post('/stores/:id/verify', async (req, res) => {
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

router.post('/stores/bulk-verify', async (req: Request, res: Response) => {
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

router.post('/stores/:id/flag', async (req, res) => {
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

router.get('/admin/review-queue', async (_req, res) => {
  try {
    const stores = await getReviewQueue();
    res.json(stores);
  } catch (error) {
    console.error('Error fetching review queue:', error);
    res.status(500).json({ error: 'Failed to fetch review queue' });
  }
});

router.patch('/admin/stores/:id/review', async (req, res) => {
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

export default router;
