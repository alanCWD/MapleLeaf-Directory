import crypto from 'crypto';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import type { StreamConfig, VideoProcessingStatus } from '../types.ts';

const BUNNY_BASE_URL = 'https://video.bunnycdn.com';

/**
 * Structured error thrown when a Bunny API call returns an HTTP error.
 * Check `statusCode` to distinguish 404 (not found) from other failures.
 */
export class BunnyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'BunnyApiError';
  }
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
    throw new BunnyApiError(`Bunny getVideo failed (${res.status}): ${text}`, res.status);
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

  interface StreamRequestInit extends RequestInit {
    duplex?: string;
  }
  const fetchInit: StreamRequestInit = {
    method: 'PUT',
    headers: {
      AccessKey: config.apiKey,
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(stats.size),
    },
    body: fileStream as unknown as BodyInit,
    duplex: 'half',
  };
  const res = await fetch(
    `${BUNNY_BASE_URL}/library/${config.libraryId}/videos/${videoId}`,
    fetchInit
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny upload failed (${res.status}): ${text}`);
  }
}

/**
 * Build a CDN download URL for a video MP4, optionally signing it with the
 * pull-zone token authentication key.
 *
 * Bunny CDN token auth algorithm (from Bunny docs):
 *   token = SHA256( cdnAuthToken + "/" + videoId + "/play_720p.mp4" + expiryTimestamp )
 *   URL   = https://{cdn}/{videoId}/play_720p.mp4?token={hexToken}&expires={expiryTimestamp}
 *
 * Set StreamConfig.cdnAuthToken (env var BUNNY_CDN_AUTH_TOKEN) to the pull-zone
 * "Authentication Key" found in Bunny Dashboard → Pull Zone → Security tab.
 */
function buildCdnDownloadUrl(videoId: string, config: StreamConfig): string {
  const cdn = config.cdnHostname || `vz-${config.libraryId}.b-cdn.net`;
  const filePath = `/${videoId}/play_720p.mp4`;

  if (!config.cdnAuthToken) {
    return `https://${cdn}${filePath}`;
  }

  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  // Bunny CDN Token Auth: SHA256( authKey + expiresTimestamp + filePath ) → base64url
  const token = crypto
    .createHash('sha256')
    .update(config.cdnAuthToken + expiry + filePath)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `https://${cdn}${filePath}?token=${token}&expires=${expiry}`;
}

/**
 * Download a processed video from the Bunny CDN to a local file.
 * Requires the library's "Direct Play / MP4 Fallback" option to be enabled
 * in Bunny Stream settings so the 720p MP4 is available at the CDN URL.
 *
 * If the pull zone has token authentication enabled, set StreamConfig.cdnAuthToken
 * (env var BUNNY_CDN_AUTH_TOKEN) to the pull-zone Authentication Key.
 */
export function downloadVideo(
  videoId: string,
  config: StreamConfig,
  destPath: string
): Promise<void> {
  const cdn = config.cdnHostname || `vz-${config.libraryId}.b-cdn.net`;
  const url = buildCdnDownloadUrl(videoId, config);

  // Use native https.get (not fetch/Readable.fromWeb) to avoid the silent
  // stall that occurs with Node's undici-backed fetch in production.
  // Bunny CDN pull zone has hotlink protection — Referer header required.
  const parsed = new URL(url);
  const client = parsed.protocol === 'https:' ? https : http;
  return new Promise<void>((resolve, reject) => {
    const req = client.get(
      url,
      {
        headers: {
          Referer: `https://${cdn}`,
          'User-Agent': 'LegacyLeaf-Branding/1.0',
        },
        timeout: 10 * 60 * 1000, // 10-minute socket idle timeout
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume(); // drain so socket can be reused
          reject(new Error(`Bunny CDN download failed (${res.statusCode}) for ${url}`));
          return;
        }
        const writeStream = fs.createWriteStream(destPath);
        pipeline(res, writeStream).then(resolve).catch(reject);
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error(`Download timed out for ${videoId}`));
    });
  });
}

export function getVideoStatusLabel(status: number): VideoProcessingStatus {
  switch (status) {
    case 0: return 'processing';
    case 1: return 'processing';
    case 2: return 'encoding';
    case 3: return 'ready';
    case 4: return 'ready';
    case 5: return 'failed';
    case 6: return 'uploading';
    case 7: return 'uploading';
    case 8: return 'failed';
    default: return 'processing';
  }
}
