const DEFAULT_STORE_IMAGES = [
  'https://images.unsplash.com/photo-1589998059171-988d887df646?w=800&q=80',
  'https://images.unsplash.com/photo-1603726843498-241d1549d8b0?w=800&q=80',
  'https://images.unsplash.com/photo-1585063560633-e6b1a58b43ae?w=800&q=80',
  'https://images.unsplash.com/photo-1616690002498-c1e43a0f0e48?w=800&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80',
  'https://images.unsplash.com/photo-1567449303078-57ad995bd329?w=800&q=80',
  'https://images.unsplash.com/photo-1536819114556-1e10f967fb61?w=800&q=80',
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
  'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=800&q=80',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',
  'https://images.unsplash.com/photo-1528698827591-e19cef3a72f7?w=800&q=80',
  'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=800&q=80',
  'https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800&q=80',
  'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?w=800&q=80',
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80',
  'https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=800&q=80',
  'https://images.unsplash.com/photo-1604328471151-b52226907017?w=800&q=80',
];

function getHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDefaultStoreImage(storeId: string): string {
  const seed = getHashCode(storeId);
  return DEFAULT_STORE_IMAGES[seed % DEFAULT_STORE_IMAGES.length];
}

export function getStoreHeaderImage(storeId: string, headerImageUrl?: string): string {
  return headerImageUrl || getDefaultStoreImage(storeId);
}

export { DEFAULT_STORE_IMAGES };
