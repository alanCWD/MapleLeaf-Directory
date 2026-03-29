import crypto from 'crypto';
import type { StreamConfig } from '../types.ts';

const BUNNY_BASE_URL = 'https://video.bunnycdn.com';

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

export function isStreamConfigured(config: StreamConfig): boolean {
  return !!(config.apiKey && config.libraryId);
}

export async function createVideo(title: string, config: StreamConfig): Promise<BunnyVideo> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${config.libraryId}/videos`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        AccessKey: config.apiKey,
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

export function generateTusCredentials(
  videoId: string,
  config: StreamConfig
): { signature: string; expirationTime: number; libraryId: string } {
  const expirationTime = Math.floor(Date.now() / 1000) + 86400;
  const signatureString = `${config.libraryId}${config.apiKey}${expirationTime}${videoId}`;
  const signature = crypto
    .createHash('sha256')
    .update(signatureString)
    .digest('hex');
  return { signature, expirationTime, libraryId: config.libraryId };
}

export async function getVideo(videoId: string, config: StreamConfig): Promise<BunnyVideo> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${config.libraryId}/videos/${videoId}`,
    {
      headers: {
        Accept: 'application/json',
        AccessKey: config.apiKey,
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny getVideo failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function deleteVideo(videoId: string, config: StreamConfig): Promise<void> {
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${config.libraryId}/videos/${videoId}`,
    {
      method: 'DELETE',
      headers: { AccessKey: config.apiKey },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny deleteVideo failed (${res.status}): ${text}`);
  }
}

export function getEmbedUrl(videoId: string, config: StreamConfig): string {
  return `https://iframe.mediadelivery.net/embed/${config.libraryId}/${videoId}`;
}

export function getThumbnailUrl(videoId: string, config: StreamConfig): string {
  const cdn = config.cdnHostname || `vz-${config.libraryId}.b-cdn.net`;
  return `https://${cdn}/${videoId}/thumbnail.jpg`;
}

export async function uploadVideoBuffer(
  filePath: string,
  videoId: string,
  config: StreamConfig
): Promise<void> {
  const { default: fs } = await import('fs');

  const stats = fs.statSync(filePath);
  const fileStream = fs.createReadStream(filePath);

  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${config.libraryId}/videos/${videoId}`,
    {
      method: 'PUT',
      headers: {
        AccessKey: config.apiKey,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stats.size),
      },
      body: fileStream as any,
      duplex: 'half' as any,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }
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
