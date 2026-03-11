const DEFAULT_STORE_IMAGES = [
  '/store-headers/header-1.png',
  '/store-headers/header-2.png',
  '/store-headers/header-3.png',
  '/store-headers/header-4.png',
  '/store-headers/header-5.png',
  '/store-headers/header-6.png',
  '/store-headers/header-7.png',
  '/store-headers/header-8.png',
  '/store-headers/header-9.png',
  '/store-headers/header-10.png',
  '/store-headers/header-11.png',
  '/store-headers/header-12.png',
  '/store-headers/header-13.png',
  '/store-headers/header-14.png',
  '/store-headers/header-15.png',
  '/store-headers/header-16.png',
  '/store-headers/header-17.png',
  '/store-headers/header-18.png',
  '/store-headers/header-19.png',
  '/store-headers/header-20.png',
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
