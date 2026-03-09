import type { Store, StoreFlag, FlagReason, StoreMedia, UploadCredentials, MediaType } from '../types';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'API request failed');
  }
  return res.json();
}

export async function fetchStores(filters?: {
  province?: string;
  type?: string;
  verificationStatus?: string;
  hideUnverified?: boolean;
}): Promise<Store[]> {
  const params = new URLSearchParams();
  if (filters?.province) params.set('province', filters.province);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.verificationStatus) params.set('verificationStatus', filters.verificationStatus);
  if (filters?.hideUnverified) params.set('hideUnverified', 'true');
  const qs = params.toString();
  return apiFetch<Store[]>(`/stores${qs ? `?${qs}` : ''}`);
}

export async function fetchStore(id: string): Promise<Store> {
  return apiFetch<Store>(`/stores/${id}`);
}

export async function createStore(store: Partial<Store>): Promise<Store> {
  return apiFetch<Store>('/stores', {
    method: 'POST',
    body: JSON.stringify(store),
  });
}

export async function bulkUpsertStores(stores: Partial<Store>[]): Promise<{ count: number; stores: Store[] }> {
  return apiFetch<{ count: number; stores: Store[] }>('/stores/bulk', {
    method: 'POST',
    body: JSON.stringify({ stores }),
  });
}

export async function updateStore(id: string, updates: Partial<Store>): Promise<Store> {
  return apiFetch<Store>(`/stores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function saveStoreInsights(id: string, storeInsights: any, hours?: any[]): Promise<Store> {
  const body: any = { storeInsights };
  if (hours) body.hours = hours;
  return apiFetch<Store>(`/stores/${id}/insights`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function verifyStore(id: string): Promise<{ store: Store; verification: any }> {
  return apiFetch<{ store: Store; verification: any }>(`/stores/${id}/verify`, {
    method: 'POST',
  });
}

export async function bulkVerifyStores(storeIds: string[]): Promise<{ count: number; results: any[] }> {
  return apiFetch<{ count: number; results: any[] }>('/stores/bulk-verify', {
    method: 'POST',
    body: JSON.stringify({ storeIds }),
  });
}

export async function flagStore(id: string, reason: FlagReason, comment?: string): Promise<StoreFlag> {
  return apiFetch<StoreFlag>(`/stores/${id}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason, comment }),
  });
}

export async function fetchFlags(id: string): Promise<StoreFlag[]> {
  return apiFetch<StoreFlag[]>(`/stores/${id}/flags`);
}

export async function fetchReviewQueue(): Promise<Store[]> {
  return apiFetch<Store[]>('/admin/review-queue');
}

export async function adminReviewStore(
  id: string,
  action: 'approve' | 'reject' | 'mark_closed',
  notes?: string
): Promise<Store> {
  return apiFetch<Store>(`/admin/stores/${id}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ action, notes }),
  });
}

export async function searchStoresAPI(query: string, userLocation?: { lat: number; lng: number }): Promise<{ stores: Partial<Store>[] }> {
  return apiFetch<{ stores: Partial<Store>[] }>('/search', {
    method: 'POST',
    body: JSON.stringify({ query, userLocation }),
  });
}

export async function submitCommunityStore(data: {
  name: string;
  address: string;
  province: string;
  type: 'Sovereign' | 'Local Gem';
  website?: string;
  sourceUrl?: string;
  submitterNote?: string;
}): Promise<Store> {
  return apiFetch<Store>('/stores/community-submit', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getUserFavoritesAPI(): Promise<string[]> {
  return apiFetch<string[]>('/user/favorites');
}

export async function addFavoriteAPI(storeId: string): Promise<void> {
  await apiFetch(`/user/favorites/${storeId}`, { method: 'POST' });
}

export async function removeFavoriteAPI(storeId: string): Promise<void> {
  await apiFetch(`/user/favorites/${storeId}`, { method: 'DELETE' });
}

export async function syncFavoritesAPI(storeIds: string[]): Promise<string[]> {
  return apiFetch('/user/favorites/sync', {
    method: 'POST',
    body: JSON.stringify({ storeIds }),
  });
}

export async function createClaimAPI(storeId: string, message?: string): Promise<any> {
  return apiFetch('/user/claims', {
    method: 'POST',
    body: JSON.stringify({ storeId, message }),
  });
}

export async function getUserClaimsAPI(): Promise<any[]> {
  return apiFetch('/user/claims');
}

export async function getOwnedStoresAPI(): Promise<Store[]> {
  return apiFetch<Store[]>('/user/owned-stores');
}

export async function updateOwnedStoreAPI(id: string, updates: Partial<Store>): Promise<Store> {
  return apiFetch<Store>(`/owner/stores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getAdminClaimsAPI(): Promise<any[]> {
  return apiFetch('/admin/claims');
}

export async function reviewClaimAPI(claimId: number, action: 'approve' | 'reject', notes?: string): Promise<any> {
  return apiFetch(`/admin/claims/${claimId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ action, notes }),
  });
}

export interface AdminUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
  favoritesCount: number;
  claimsCount: number;
  badges: UserBadge[];
}

export async function getAdminUsersAPI(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>('/admin/users');
}

export async function updateUserRoleAPI(userId: string, role: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteUserAPI(userId: string): Promise<void> {
  await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
}

export interface IntegrityScoreCard {
  score: number;
  verifiedPresenceRatio: number;
  reviewStability: number;
  weightedAvgRating: number;
  contentRichness: number;
  lastAuditDate: string | null;
}

export interface RecorderQuestion {
  id: string;
  prompt: string;
  maxDurationSeconds: number;
  isRequired: boolean;
}

export interface UserBadge {
  id: number;
  userId: string;
  badgeType: string;
  awardedAt: string;
  metadata: Record<string, any> | null;
}

export interface WeightedReview {
  id: number;
  storeId: string;
  userId: string;
  rating: number;
  contentText: string;
  videoAssetId: number | null;
  trustWeight: { base: number; videoBonus: number; scoutBonus: number; geoDeviation: number; final: number };
  hasVerifiedVideo: boolean;
  isFlagged: boolean;
  disclosures: Record<string, unknown> | null;
  createdAt: string;
  reviewerBadges: UserBadge[];
}

export async function initMediaUpload(
  storeId: string,
  title: string,
  mediaType: MediaType
): Promise<UploadCredentials> {
  return apiFetch<UploadCredentials>(`/stores/${storeId}/media/init`, {
    method: 'POST',
    body: JSON.stringify({ title, mediaType }),
  });
}

export async function fetchStoreMedia(storeId: string): Promise<StoreMedia[]> {
  return apiFetch<StoreMedia[]>(`/stores/${storeId}/media`);
}

export async function deleteMedia(storeId: string, mediaId: number): Promise<void> {
  await apiFetch(`/stores/${storeId}/media/${mediaId}`, { method: 'DELETE' });
}

export async function submitReview(
  storeId: string,
  data: { rating: number; contentText: string; videoAssetId?: number }
): Promise<WeightedReview> {
  return apiFetch<WeightedReview>(`/stores/${storeId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchStoreReviews(storeId: string): Promise<WeightedReview[]> {
  return apiFetch<WeightedReview[]>(`/stores/${storeId}/reviews`);
}

export async function fetchIntegrityScore(storeId: string): Promise<IntegrityScoreCard> {
  return apiFetch<IntegrityScoreCard>(`/stores/${storeId}/integrity-score`);
}

export async function fetchRecorderQuestions(storeId: string): Promise<RecorderQuestion[]> {
  return apiFetch<RecorderQuestion[]>(`/stores/${storeId}/recorder-questions`);
}

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  return apiFetch<UserBadge[]>(`/users/${userId}/badges`);
}

export interface BadgeProgress {
  videoReviewCount: number;
  distinctVideoStores: number;
  totalReviewCount: number;
  avgTrustWeight: number;
  flaggedCount: number;
  mediaUploadCount: number;
  communitySubmissionCount: number;
  badges: UserBadge[];
}

export async function fetchBadgeProgress(): Promise<BadgeProgress> {
  return apiFetch<BadgeProgress>('/user/badge-progress');
}
