import {
  createVideo,
  generateTusCredentials,
  deleteVideo,
  getEmbedUrl,
  getThumbnailUrl,
  getVideoStatusLabel,
  isStreamConfigured,
} from './bunnyStream.ts';
import type { VideoReviewAdapter } from '../adapter.ts';
import type {
  VideoMediaRecord,
  UploadCredentials,
  AdminVideoReview,
} from '../types.ts';

/**
 * createVideoReviewMediaService — returns the core media lifecycle functions
 * bound to a concrete VideoReviewAdapter.
 *
 * All stream credentials and persistence operations are delegated through
 * the adapter so this module has no direct dependency on any specific
 * stream provider, database, or ORM.
 */
export function createVideoReviewMediaService(adapter: VideoReviewAdapter) {
  function streamConfig() {
    return adapter.getStreamConfig();
  }

  function isBunnyConfigured(): boolean {
    return isStreamConfigured(streamConfig());
  }

  async function initUpload(
    subjectId: string,
    userId: string,
    title: string,
    mediaType: string = 'video'
  ): Promise<UploadCredentials> {
    const config = streamConfig();

    if (!isBunnyConfigured()) {
      throw new Error('Stream provider is not configured');
    }

    const bunnyVideo = await createVideo(title, config);
    const tusCredentials = generateTusCredentials(bunnyVideo.guid, config);
    const embedUrl = getEmbedUrl(bunnyVideo.guid, config);

    const media = await adapter.createMedia({
      subjectId,
      userId,
      bunnyVideoId: bunnyVideo.guid,
      bunnyLibraryId: String(bunnyVideo.videoLibraryId),
      title,
      embedUrl,
      thumbnailUrl: getThumbnailUrl(bunnyVideo.guid, config),
      mediaType: mediaType as any,
      status: 'uploading',
    });

    return {
      videoId: bunnyVideo.guid,
      libraryId: tusCredentials.libraryId,
      expirationTime: tusCredentials.expirationTime,
      signature: tusCredentials.signature,
      mediaId: media.id,
      embedUrl,
    };
  }

  async function handleWebhook(payload: {
    VideoGuid: string;
    Status: number;
    VideoLibraryId?: number;
  }): Promise<VideoMediaRecord | null> {
    const config = streamConfig();
    const statusLabel = getVideoStatusLabel(payload.Status);
    const videoId = payload.VideoGuid;

    const extras: { thumbnailUrl?: string; embedUrl?: string } = {};

    if (statusLabel === 'ready') {
      extras.thumbnailUrl = getThumbnailUrl(videoId, config);
      extras.embedUrl = getEmbedUrl(videoId, config);
    }

    return adapter.updateMediaProcessing(videoId, statusLabel, extras);
  }

  async function removeMedia(mediaId: number, _userId: string): Promise<boolean> {
    const config = streamConfig();
    const media = await adapter.getMediaById(mediaId);
    if (!media) return false;

    try {
      await deleteVideo(media.bunnyVideoId, config);
    } catch (err) {
      console.error('[VideoReview:media] Failed to delete from stream provider:', err);
    }

    return adapter.deleteMedia(mediaId);
  }

  async function getSubjectMedia(subjectId: string): Promise<VideoMediaRecord[]> {
    return adapter.getMediaBySubject(subjectId);
  }

  async function getSingleMedia(mediaId: number): Promise<VideoMediaRecord | null> {
    return adapter.getMediaById(mediaId);
  }

  async function listVideoReviews(): Promise<AdminVideoReview[]> {
    return adapter.listVideoReviews();
  }

  return {
    isBunnyConfigured,
    initUpload,
    handleWebhook,
    removeMedia,
    getSubjectMedia,
    getSingleMedia,
    listVideoReviews,
  };
}
