import {
  createVideo,
  generateTusCredentials,
  deleteVideo,
  getEmbedUrl,
  getThumbnailUrl,
  getVideoStatusLabel,
  isBunnyConfigured,
} from '../bunnyStream';
import {
  createStoreMedia,
  getStoreMedia,
  getMediaById,
  updateMediaStatus,
  deleteStoreMedia,
} from './models';
import type { StoreMedia, UploadCredentials, MediaStatus } from '../../types';

export { isBunnyConfigured };

export async function initUpload(
  storeId: string,
  userId: string,
  title: string,
  mediaType: string = 'video'
): Promise<UploadCredentials> {
  if (!isBunnyConfigured()) {
    throw new Error('Bunny Stream is not configured');
  }

  const bunnyVideo = await createVideo(title);
  const tusCredentials = generateTusCredentials(bunnyVideo.guid);
  const embedUrl = getEmbedUrl(bunnyVideo.guid);

  const media = await createStoreMedia({
    storeId,
    userId,
    bunnyVideoId: bunnyVideo.guid,
    bunnyLibraryId: String(bunnyVideo.videoLibraryId),
    title,
    embedUrl,
    thumbnailUrl: getThumbnailUrl(bunnyVideo.guid),
    mediaType,
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

export async function handleWebhook(payload: {
  VideoGuid: string;
  Status: number;
  VideoLibraryId?: number;
}): Promise<StoreMedia | null> {
  const statusLabel = getVideoStatusLabel(payload.Status) as MediaStatus;
  const videoId = payload.VideoGuid;

  const extras: { thumbnailUrl?: string; embedUrl?: string } = {};

  if (statusLabel === 'ready') {
    extras.thumbnailUrl = getThumbnailUrl(videoId);
    extras.embedUrl = getEmbedUrl(videoId);
  }

  return updateMediaStatus(videoId, statusLabel, extras);
}

export async function removeMedia(mediaId: number, userId: string): Promise<boolean> {
  const media = await getMediaById(mediaId);
  if (!media) return false;

  try {
    await deleteVideo(media.bunnyVideoId);
  } catch (err) {
    console.error('[Integrity:media] Failed to delete from Bunny:', err);
  }

  return deleteStoreMedia(mediaId);
}

export async function getStoreMediaList(storeId: string): Promise<StoreMedia[]> {
  return getStoreMedia(storeId);
}

export async function getSingleMedia(mediaId: number): Promise<StoreMedia | null> {
  return getMediaById(mediaId);
}
