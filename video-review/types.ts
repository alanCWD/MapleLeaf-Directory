export type VideoProcessingStatus =
  | 'uploading'
  | 'processing'
  | 'encoding'
  | 'ready'
  | 'failed';

export type VideoMediaType = 'video' | 'walkthrough' | 'review';

export type VideoModerationStatus = 'approved' | 'disapproved';

export type VideoContentRating = 'clean' | 'raw';

export interface StreamConfig {
  apiKey: string;
  libraryId: string;
  cdnHostname: string;
}

export interface VideoMediaRecord {
  id: number;
  subjectId: string;
  userId: string | null;
  bunnyVideoId: string;
  bunnyLibraryId: string;
  title: string | null;
  description: string | null;
  status: VideoProcessingStatus;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  mediaType: VideoMediaType;
  durationSeconds: number | null;
  moderationStatus?: VideoModerationStatus;
  contentRating?: VideoContentRating;
  moderationNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaInput {
  subjectId: string;
  userId: string | null;
  bunnyVideoId: string;
  bunnyLibraryId: string;
  title: string;
  description?: string;
  status?: VideoProcessingStatus;
  thumbnailUrl?: string;
  embedUrl?: string;
  mediaType?: VideoMediaType;
}

export interface ModerationInput {
  moderationStatus?: VideoModerationStatus;
  contentRating?: VideoContentRating;
  moderationNotes?: string;
}

export interface UploadCredentials {
  videoId: string;
  libraryId: string;
  expirationTime: number;
  signature: string;
  mediaId: number;
  embedUrl: string;
}

export interface AdminVideoReview extends VideoMediaRecord {
  storeName: string | null;
  reviewText: string | null;
  reviewRating: number | null;
  reviewerId: string | null;
  reviewerBadge: string | null;
  reviewCreatedAt: string | null;
}

export interface RecorderQuestion {
  id: string;
  prompt: string;
  maxDurationSeconds: number;
  isRequired: boolean;
}

export interface SubmitReviewData {
  rating: number;
  contentText: string;
  videoAssetId?: number;
}

export interface VideoReviewSubmitResult {
  id: number;
  videoAssetId?: number | null;
  trustWeight?: { final: number } | null;
}

/**
 * BrandingConfig — supplied by the host adapter to control intro/outro clips
 * and the watermark applied to every processed video review.
 *
 * All fields are optional; omitting a field disables that feature cleanly.
 * Override any path to swap in niche-specific assets without code changes.
 */
export interface BrandingConfig {
  brandName: string;
  tagline?: string;
  introDurationSeconds?: number;
  outroDurationSeconds?: number;
  brandColor?: string;
  bgColor?: string;
  introVideoPath?: string;
  outroVideoPath?: string;
  watermarkImagePath?: string;
  watermarkText?: string;
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  watermarkOpacity?: number;
  assetsDir?: string;
}
