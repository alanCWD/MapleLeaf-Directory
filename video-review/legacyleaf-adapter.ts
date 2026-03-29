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
import type { VideoReviewAdapter } from './adapter.ts';
import type {
  StreamConfig,
  VideoMediaRecord,
  CreateMediaInput,
  ModerationInput,
  AdminVideoReview,
} from './types.ts';

function storeMediaToVideoRecord(m: any): VideoMediaRecord {
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
    moderationStatus: m.moderationStatus,
    contentRating: m.contentRating,
    moderationNotes: m.moderationNotes ?? null,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

function videoReviewToAdminRecord(r: any): AdminVideoReview {
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
      status: (data.status as any) || 'uploading',
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
    status: string,
    extras?: { thumbnailUrl?: string; embedUrl?: string; durationSeconds?: number }
  ): Promise<VideoMediaRecord | null> {
    const record = await updateMediaStatus(bunnyVideoId, status as any, extras);
    return record ? storeMediaToVideoRecord(record) : null;
  },

  async updateMediaModeration(id: number, data: ModerationInput): Promise<VideoMediaRecord | null> {
    const record = await modelUpdateMediaModeration(id, data as any);
    return record ? storeMediaToVideoRecord(record) : null;
  },

  async deleteMedia(id: number): Promise<boolean> {
    return deleteStoreMedia(id);
  },

  async listVideoReviews(): Promise<AdminVideoReview[]> {
    const records = await getVideoReviews();
    return records.map(videoReviewToAdminRecord);
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
