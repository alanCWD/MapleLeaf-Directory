import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const BUNNY_STORAGE_ZONE = () => process.env.BUNNY_STORAGE_ZONE || '';
const BUNNY_STORAGE_API_KEY = () => process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE_CDN_URL = () => process.env.BUNNY_STORAGE_CDN_URL || '';
const BUNNY_STORAGE_HOSTNAME = () => process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';
const BUNNY_CDN_AUTH_TOKEN = () => process.env.BUNNY_CDN_AUTH_TOKEN || '';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads');

export function isBunnyStorageConfigured(): boolean {
  return !!(BUNNY_STORAGE_ZONE() && BUNNY_STORAGE_API_KEY());
}

export async function uploadImageLocal(
  buffer: Buffer,
  filename: string,
  folder: string = 'posts'
): Promise<string> {
  const dir = path.join(LOCAL_UPLOADS_DIR, folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
}

export async function deleteImageLocal(
  filename: string,
  folder: string = 'posts'
): Promise<void> {
  const filepath = path.join(LOCAL_UPLOADS_DIR, folder, filename);
  try { fs.unlinkSync(filepath); } catch { }
}

export async function uploadImageToStorage(
  buffer: Buffer,
  filename: string,
  folder: string = 'posts'
): Promise<string> {
  const zone = BUNNY_STORAGE_ZONE();
  const hostname = BUNNY_STORAGE_HOSTNAME();
  const path = `/${zone}/${folder}/${filename}`;

  const res = await fetch(`https://${hostname}${path}`, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY(),
      'Content-Type': 'application/octet-stream',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny Storage upload failed (${res.status}): ${text}`);
  }

  const cdnBase = BUNNY_STORAGE_CDN_URL();
  if (cdnBase) {
    return `${cdnBase}/${folder}/${filename}`;
  }
  return `https://${zone}.b-cdn.net/${folder}/${filename}`;
}

export async function deleteImageFromStorage(
  filename: string,
  folder: string = 'posts'
): Promise<void> {
  const zone = BUNNY_STORAGE_ZONE();
  const hostname = BUNNY_STORAGE_HOSTNAME();
  const path = `/${zone}/${folder}/${filename}`;

  const res = await fetch(`https://${hostname}${path}`, {
    method: 'DELETE',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY(),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Bunny Storage delete failed (${res.status}): ${text}`);
  }
}

export function signBunnyCdnUrl(url: string, expiresInSeconds: number = 7200): string {
  const authToken = BUNNY_CDN_AUTH_TOKEN();
  if (!authToken) return url;
  try {
    const parsed = new URL(url);
    const urlPath = decodeURIComponent(parsed.pathname);
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const hashInput = authToken + urlPath + expires;
    const token = crypto.createHash('sha256')
      .update(hashInput)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    parsed.searchParams.set('token', token);
    parsed.searchParams.set('expires', String(expires));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function isBunnyCdnUrl(url: string): boolean {
  const cdnBase = BUNNY_STORAGE_CDN_URL();
  if (cdnBase && url.startsWith(cdnBase)) return true;
  const zone = BUNNY_STORAGE_ZONE();
  if (zone && url.includes(`${zone}.b-cdn.net`)) return true;
  return false;
}
