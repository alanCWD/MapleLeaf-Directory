import crypto from 'crypto';

const BUNNY_API_KEY = () => process.env.BUNNY_STREAM_API_KEY || '';
const BUNNY_LIBRARY_ID = () => process.env.BUNNY_STREAM_LIBRARY_ID || '';
const BUNNY_CDN_HOSTNAME = () => process.env.BUNNY_CDN_HOSTNAME || '';
const BUNNY_BASE_URL = 'https://video.bunnycdn.com';

export function isBunnyConfigured(): boolean {
  return !!(BUNNY_API_KEY() && BUNNY_LIBRARY_ID());
}

export interface BunnyVideo {
  videoLibraryId: number;
  guid: string;
  title: string;
  dateUploaded: string;
  views: number;
  isPublic: boolean;
  length: number;
  status: number;
  framerate: number;
  rotation: number;
  width: number;
  height: number;
  availableResolutions: string;
  thumbnailCount: number;
  encodeProgress: number;
  storageSize: number;
  captions: any[];
  hasMP4Fallback: boolean;
  collectionId: string;
  thumbnailFileName: string;
  averageWatchTime: number;
  totalWatchTime: number;
  category: string;
  chapters: any[];
  moments: any[];
  metaTags: any[];
  transcodingMessages: any[];
}

export async function createVideo(title: string): Promise<BunnyVideo> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID()}/videos`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        AccessKey: BUNNY_API_KEY(),
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny createVideo failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function generateTusCredentials(videoId: string): {
  signature: string;
  expirationTime: number;
  libraryId: string;
} {
  const libraryId = BUNNY_LIBRARY_ID();
  const expirationTime = Math.floor(Date.now() / 1000) + 86400;

  const signatureString = `${libraryId}${BUNNY_API_KEY()}${expirationTime}${videoId}`;
  const signature = crypto
    .createHash('sha256')
    .update(signatureString)
    .digest('hex');

  return { signature, expirationTime, libraryId };
}

export async function getVideo(videoId: string): Promise<BunnyVideo> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID()}/videos/${videoId}`,
    {
      headers: {
        Accept: 'application/json',
        AccessKey: BUNNY_API_KEY(),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny getVideo failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${BUNNY_LIBRARY_ID()}/videos/${videoId}`,
    {
      method: 'DELETE',
      headers: {
        AccessKey: BUNNY_API_KEY(),
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny deleteVideo failed (${res.status}): ${text}`);
  }
}

export function getEmbedUrl(videoId: string): string {
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID()}/${videoId}`;
}

export function getThumbnailUrl(videoId: string): string {
  const cdnHostname = BUNNY_CDN_HOSTNAME() || `vz-${BUNNY_LIBRARY_ID()}.b-cdn.net`;
  return `https://${cdnHostname}/${videoId}/thumbnail.jpg`;
}

export function getVideoStatusLabel(status: number): string {
  switch (status) {
    case 0: return 'queued';
    case 1: return 'processing';
    case 2: return 'encoding';
    case 3: return 'ready';
    case 4: return 'ready';
    case 5: return 'failed';
    case 6: return 'uploading';
    case 7: return 'uploading';
    case 8: return 'failed';
    default: return 'unknown';
  }
}
