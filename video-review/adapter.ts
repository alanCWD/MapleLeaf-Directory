import type {
  StreamConfig,
  VideoMediaRecord,
  CreateMediaInput,
  ModerationInput,
  AdminVideoReview,
} from './types.ts';

/**
 * VideoReviewAdapter — the only interface a host app must implement
 * to wire its own entity type into the video review engine.
 *
 * Implement this and pass it to createVideoReviewRouter() to get a
 * fully-working video review system for your own domain entities.
 */
export interface VideoReviewAdapter {
  /**
   * Return Bunny Stream (or equivalent) credentials.
   * Called at request time so credentials can be rotated without restart.
   */
  getStreamConfig(): StreamConfig;

  /**
   * Resolve the display name of a subject (e.g. a store) by its ID.
   * Used to label title cards when stitching recorded clips.
   * Return null if the subject does not exist.
   */
  resolveSubjectName(subjectId: string): Promise<string | null>;

  /**
   * Persist a new media record tied to a subject.
   */
  createMedia(data: CreateMediaInput): Promise<VideoMediaRecord>;

  /**
   * Retrieve a single media record by numeric ID.
   */
  getMediaById(id: number): Promise<VideoMediaRecord | null>;

  /**
   * List all media records associated with a subject, excluding reviews.
   */
  getMediaBySubject(subjectId: string): Promise<VideoMediaRecord[]>;

  /**
   * Update the processing status of a video identified by its Bunny GUID.
   * Called when a webhook fires from the stream provider.
   */
  updateMediaProcessing(
    bunnyVideoId: string,
    status: string,
    extras?: { thumbnailUrl?: string; embedUrl?: string; durationSeconds?: number }
  ): Promise<VideoMediaRecord | null>;

  /**
   * Update moderation fields (status, rating, notes) for a media record.
   */
  updateMediaModeration(id: number, data: ModerationInput): Promise<VideoMediaRecord | null>;

  /**
   * Delete a media record from persistence.
   * The caller is responsible for removing the asset from the stream provider.
   */
  deleteMedia(id: number): Promise<boolean>;

  /**
   * Return all video reviews (media_type = 'review') enriched with
   * associated review metadata for the admin moderation queue.
   */
  listVideoReviews(): Promise<AdminVideoReview[]>;

  /**
   * Optional: write an audit log entry.
   * If not provided, moderation actions are not audited.
   */
  logAudit?(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    meta: Record<string, unknown>
  ): Promise<void>;
}
