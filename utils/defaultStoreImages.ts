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
  '/store-headers/header-21.png',
  '/store-headers/header-22.png',
  '/store-headers/header-23.png',
  '/store-headers/header-24.png',
  '/store-headers/header-25.png',
  '/store-headers/header-26.png',
  '/store-headers/header-27.png',
  '/store-headers/header-28.png',
  '/store-headers/header-29.png',
  '/store-headers/header-30.png',
  '/store-headers/header-31.png',
  '/store-headers/header-32.png',
  '/store-headers/header-33.png',
  '/store-headers/header-34.png',
  '/store-headers/header-35.png',
  '/store-headers/header-36.png',
  '/store-headers/header-37.png',
  '/store-headers/header-38.png',
  '/store-headers/header-39.png',
  '/store-headers/header-40.png',
  '/store-headers/header-41.png',
  '/store-headers/header-42.png',
  '/store-headers/header-43.png',
  '/store-headers/header-44.png',
  '/store-headers/header-45.png',
  '/store-headers/header-46.png',
  '/store-headers/header-47.png',
  '/store-headers/header-48.png',
  '/store-headers/header-49.png',
  '/store-headers/header-50.png',
  '/store-headers/header-51.png',
  '/store-headers/header-52.png',
  '/store-headers/header-53.png',
  '/store-headers/header-54.png',
  '/store-headers/header-55.png',
  '/store-headers/header-56.png',
  '/store-headers/header-57.png',
  '/store-headers/header-58.png',
  '/store-headers/header-59.png',
  '/store-headers/header-60.png',
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
