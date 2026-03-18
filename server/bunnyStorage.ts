import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BUNNY_STORAGE_ZONE = () => process.env.BUNNY_STORAGE_ZONE || '';
const BUNNY_STORAGE_API_KEY = () => process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE_CDN_URL = () => process.env.BUNNY_STORAGE_CDN_URL || '';
const BUNNY_STORAGE_HOSTNAME = () => process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';

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
