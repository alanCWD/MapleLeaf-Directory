const BUNNY_STORAGE_ZONE = () => process.env.BUNNY_STORAGE_ZONE || '';
const BUNNY_STORAGE_API_KEY = () => process.env.BUNNY_STORAGE_API_KEY || '';
const BUNNY_STORAGE_CDN_URL = () => process.env.BUNNY_STORAGE_CDN_URL || '';
const BUNNY_STORAGE_HOSTNAME = () => process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com';

export function isBunnyStorageConfigured(): boolean {
  return !!(BUNNY_STORAGE_ZONE() && BUNNY_STORAGE_API_KEY());
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
