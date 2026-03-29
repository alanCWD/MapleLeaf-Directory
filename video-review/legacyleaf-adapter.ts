import path from 'path';
import type { RequestHandler } from 'express';
import {
  createStoreMedia,
  getStoreMedia,
  getMediaById,
  updateMediaStatus,
  deleteStoreMedia,
  updateMediaModeration as modelUpdateMediaModeration,
  getVideoReviews,
} from '../server/integrity/models.ts';
import { getStoreById } from '../server/db.ts';
import { createAuditLog } from '../server/db.ts';
import { isAuthenticated } from '../server/replit_integrations/auth/index.ts';
import { getUserRole, getClaimedStoresForOwner } from '../server/userDb.ts';
import {
  createReview,
  calculateTrustWeight,
  evaluateUserBadges,
  getUserBadges,
  hasRecentCheckin,
  calculateDistance,
  getMediaById as getMediaByIdForReview,
} from '../server/integrity/index.ts';
import type { VideoReviewAdapter } from './adapter.ts';
import type { StoreMedia } from '../types';
import type {
  StreamConfig,
  VideoMediaRecord,
  VideoProcessingStatus,
  VideoModerationStatus,
  VideoContentRating,
  CreateMediaInput,
  ModerationInput,
  AdminVideoReview,
  RecorderQuestion,
  SubmitReviewData,
  VideoReviewSubmitResult,
  BrandingConfig,
} from './types.ts';

interface StoreMediaRow extends StoreMedia {
  moderationStatus?: string;
  contentRating?: string;
  moderationNotes?: string | null;
}

interface VideoReviewRow extends StoreMediaRow {
  storeName?: string | null;
  reviewText?: string | null;
  reviewRating?: number | null;
  reviewerId?: string | null;
  reviewerBadge?: string | null;
  reviewCreatedAt?: string | null;
}

function storeMediaToVideoRecord(m: StoreMediaRow): VideoMediaRecord {
  return {
    id: m.id,
    subjectId: m.storeId,
    userId: m.userId,
    bunnyVideoId: m.bunnyVideoId,
    bunnyLibraryId: m.bunnyLibraryId,
    title: m.title,
    description: m.description ?? null,
    status: m.status,
    thumbnailUrl: m.thumbnailUrl ?? null,
    embedUrl: m.embedUrl ?? null,
    mediaType: m.mediaType,
    durationSeconds: m.durationSeconds ?? null,
    moderationStatus: m.moderationStatus as VideoModerationStatus | undefined,
    contentRating: m.contentRating as VideoContentRating | undefined,
    moderationNotes: m.moderationNotes ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function videoReviewToAdminRecord(r: VideoReviewRow): AdminVideoReview {
  return {
    ...storeMediaToVideoRecord({
      id: r.id,
      storeId: r.storeId,
      userId: r.userId,
      bunnyVideoId: r.bunnyVideoId,
      bunnyLibraryId: r.bunnyLibraryId,
      title: r.title,
      description: r.description,
      status: r.status,
      thumbnailUrl: r.thumbnailUrl,
      embedUrl: r.embedUrl,
      mediaType: r.mediaType,
      durationSeconds: r.durationSeconds,
      moderationStatus: r.moderationStatus,
      contentRating: r.contentRating,
      moderationNotes: r.moderationNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }),
    storeName: r.storeName ?? null,
    reviewText: r.reviewText ?? null,
    reviewRating: r.reviewRating ?? null,
    reviewerId: r.reviewerId ?? null,
    reviewerBadge: r.reviewerBadge ?? null,
    reviewCreatedAt: r.reviewCreatedAt ?? null,
  };
}

/**
 * legacyleafVideoAdapter — concrete VideoReviewAdapter for the LegacyLeaf host app.
 *
 * Reads stream credentials from environment variables and delegates all
 * persistence operations to the existing server/integrity/models.ts layer.
 */
export const legacyleafVideoAdapter: VideoReviewAdapter = {
  getStreamConfig(): StreamConfig {
    return {
      apiKey: process.env.BUNNY_STREAM_API_KEY || '',
      libraryId: process.env.BUNNY_STREAM_LIBRARY_ID || '',
      cdnHostname: process.env.BUNNY_CDN_HOSTNAME || `vz-${process.env.BUNNY_STREAM_LIBRARY_ID || ''}.b-cdn.net`,
    };
  },

  async resolveSubjectName(subjectId: string): Promise<string | null> {
    try {
      const store = await getStoreById(subjectId);
      return store?.name ?? null;
    } catch {
      return null;
    }
  },

  async createMedia(data: CreateMediaInput): Promise<VideoMediaRecord> {
    const record = await createStoreMedia({
      storeId: data.subjectId,
      userId: data.userId,
      bunnyVideoId: data.bunnyVideoId,
      bunnyLibraryId: data.bunnyLibraryId,
      title: data.title,
      description: data.description,
      status: data.status ?? 'uploading',
      thumbnailUrl: data.thumbnailUrl,
      embedUrl: data.embedUrl,
      mediaType: data.mediaType || 'video',
    });
    return storeMediaToVideoRecord(record);
  },

  async getMediaById(id: number): Promise<VideoMediaRecord | null> {
    const record = await getMediaById(id);
    return record ? storeMediaToVideoRecord(record) : null;
  },

  async getMediaBySubject(subjectId: string): Promise<VideoMediaRecord[]> {
    const records = await getStoreMedia(subjectId);
    return records.map(storeMediaToVideoRecord);
  },

  async updateMediaProcessing(
    bunnyVideoId: string,
    status: VideoProcessingStatus,
    extras?: { thumbnailUrl?: string; embedUrl?: string; durationSeconds?: number }
  ): Promise<VideoMediaRecord | null> {
    const record = await updateMediaStatus(bunnyVideoId, status, extras);
    return record ? storeMediaToVideoRecord(record) : null;
  },

  async updateMediaModeration(id: number, data: ModerationInput): Promise<VideoMediaRecord | null> {
    const record = await modelUpdateMediaModeration(id, data);
    return record ? storeMediaToVideoRecord(record) : null;
  },

  async deleteMedia(id: number): Promise<boolean> {
    return deleteStoreMedia(id);
  },

  async listVideoReviews(): Promise<AdminVideoReview[]> {
    const records = await getVideoReviews();
    return records.map(videoReviewToAdminRecord);
  },

  extractUserId(req: any): string | null {
    return req.user?.id ?? req.user?.claims?.sub ?? null;
  },

  async isAdminUser(userId: string): Promise<boolean> {
    const role = await getUserRole(userId);
    return role === 'admin';
  },

  async getSubjectsOwnedBy(userId: string): Promise<string[]> {
    return getClaimedStoresForOwner(userId);
  },

  async submitVideoReview(
    subjectId: string,
    userId: string,
    data: SubmitReviewData,
    requestMeta?: { lat?: number; lng?: number }
  ): Promise<VideoReviewSubmitResult> {
    if (!data.rating || typeof data.rating !== 'number' || data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be a number between 1 and 5');
    }

    let hasVerifiedVideo = false;
    if (data.videoAssetId) {
      const videoMedia = await getMediaByIdForReview(data.videoAssetId);
      if (videoMedia && videoMedia.storeId !== subjectId) {
        throw new Error('Video does not belong to this store');
      }
      if (videoMedia && videoMedia.status === 'ready') {
        hasVerifiedVideo = true;
      }
    }

    const userBadges = await getUserBadges(userId);
    const scoutTiers = [
      'local_scout', 'regional_builder', 'cross_region_contributor',
      'provincial_connector', 'bc_culture_guide', 'founding_bc_architect',
    ];
    const isScout = userBadges.some((b: { badgeType: string }) => scoutTiers.includes(b.badgeType));

    const hasVerifiedPresenceCheckin = await hasRecentCheckin(userId, subjectId, 60);

    let geoDeviationDetected = false;
    if (!hasVerifiedPresenceCheckin && requestMeta?.lat != null && requestMeta?.lng != null) {
      const store = await getStoreById(subjectId);
      if (store && store.lat != null && store.lng != null) {
        const dist = calculateDistance(requestMeta.lat, requestMeta.lng, store.lat, store.lng);
        if (dist > 500) geoDeviationDetected = true;
      }
    }

    const trustWeight = calculateTrustWeight({
      hasVerifiedVideo,
      isScout,
      geoDeviationDetected,
      hasVerifiedPresence: hasVerifiedPresenceCheckin,
    });

    const review = await createReview({
      storeId: subjectId,
      userId,
      rating: data.rating,
      contentText: data.contentText || '',
      videoAssetId: data.videoAssetId,
      trustWeight,
      hasVerifiedVideo,
    });

    evaluateUserBadges(userId).catch((err: any) =>
      console.error('[VideoReview] Badge evaluation error:', err)
    );

    return {
      id: review.id,
      videoAssetId: review.videoAssetId ?? null,
      trustWeight: review.trustWeight ? { final: review.trustWeight.final } : null,
    };
  },

  requireAuth(): RequestHandler {
    return isAuthenticated as RequestHandler;
  },

  requireAdminAccess(): RequestHandler {
    const adminGuard: RequestHandler = async (req: any, res, next) => {
      try {
        const userId: string | undefined = req.user?.id ?? req.user?.claims?.sub;
        if (!userId) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        const role = await getUserRole(userId);
        if (role !== 'admin') {
          res.status(403).json({ error: 'Forbidden' });
          return;
        }
        next();
      } catch {
        res.status(500).json({ error: 'Internal server error' });
      }
    };
    return adminGuard;
  },

  async getExtraQuestions(subjectId: string): Promise<RecorderQuestion[]> {
    const store = await getStoreById(subjectId);
    if (!store || store.type !== 'Sovereign') return [];
    return [
      {
        id: 'q4',
        prompt: 'How does this business connect to its community or culture?',
        maxDurationSeconds: 45,
        isRequired: false,
      },
    ];
  },

  async logAudit(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    meta: Record<string, unknown>
  ): Promise<void> {
    await createAuditLog(adminId, action, targetType, targetId, meta);
  },

  getBrandingConfig(): BrandingConfig {
    const assetsDir = path.resolve(process.cwd(), 'video-review', 'assets', 'branding');
    return {
      brandName: 'LegacyLeaf',
      tagline: 'Authentic Cannabis Reviews',
      brandColor: 'c8a84b',
      bgColor: '1a2e1a',
      introVideoPath: path.join(assetsDir, 'intro.mp4'),
      outroVideoPath: path.join(assetsDir, 'outro.mp4'),
      watermarkImagePath: path.join(assetsDir, 'watermark.png'),
      watermarkText: 'LegacyLeaf',
      watermarkPosition: 'bottom-right',
      watermarkOpacity: 0.5,
      assetsDir,
      generatePlaceholders: true,
    };
  },
};
