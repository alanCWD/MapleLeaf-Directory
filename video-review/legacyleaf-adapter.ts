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
import { getUserRole } from '../server/userDb.ts';
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
};
