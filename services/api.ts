import type { Store, StoreFlag, FlagReason, StoreMedia, UploadCredentials, MediaType, CreatorPost } from '../types';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...(isFormData ? {} : { headers: { 'Content-Type': 'application/json' } }),
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
  avatarUrl: string | null;
  handle: string | null;
  role: string;
  isCreator: boolean;
  createdAt: string;
  updatedAt: string;
  favoritesCount: number;
  claimsCount: number;
  postsCount: number;
  reviewsCount: number;
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

export async function adminAwardBadge(userId: string, badgeType: string): Promise<UserBadge> {
  return apiFetch<UserBadge>(`/admin/users/${userId}/badges/${badgeType}`, { method: 'POST' });
}

export async function adminRevokeBadge(userId: string, badgeType: string): Promise<void> {
  await apiFetch(`/admin/users/${userId}/badges/${badgeType}`, { method: 'DELETE' });
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
  trustWeight: { base: number; videoBonus: number; scoutBonus: number; geoDeviation: number; presenceBonus: number; final: number };
  hasVerifiedVideo: boolean;
  isFlagged: boolean;
  disclosures: Record<string, unknown> | null;
  createdAt: string;
  reviewerBadges: UserBadge[];
  embedUrl?: string | null;
  thumbnailUrl?: string | null;
  contentRating?: string | null;
  moderationStatus?: string | null;
  reviewerHandle?: string | null;
  reviewerAvatarUrl?: string | null;
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

export interface StitchResult {
  mediaId: number;
  videoId: string;
  embedUrl: string;
  durationSeconds: number;
  fileSizeBytes: number;
}

export async function stitchVideoClips(
  storeId: string,
  clips: { blob: Blob; questionId: string }[],
  questions: { id: string; prompt: string }[],
  storeName: string,
  title?: string
): Promise<StitchResult> {
  const formData = new FormData();
  clips.forEach((clip, idx) => {
    formData.append('clips', clip.blob, `clip_${idx}.webm`);
  });

  const orderedQuestions = clips.map(clip => {
    const q = questions.find(q => q.id === clip.questionId);
    return { id: clip.questionId, prompt: q?.prompt || `Part ${clips.indexOf(clip) + 1}` };
  });

  formData.append('questions', JSON.stringify(orderedQuestions));
  formData.append('storeName', storeName);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/stores/${storeId}/media/stitch`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Video stitching failed');
  }

  return res.json();
}

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  return apiFetch<UserBadge[]>(`/users/${userId}/badges`);
}

export interface BadgeProgress {
  uniqueStoreReviews: number;
  distinctStores: number;
  culturePosts: number;
  regionsCount: number;
  repeatVisitCount: number;
  repeatVisitStores: number;
  qualityAverage: number;
  seasonalRevisits: number;
  timePeriodRevisits: number;
  singleStoreMaxPct: number;
  badges: UserBadge[];
}

export async function fetchBadgeProgress(): Promise<BadgeProgress> {
  return apiFetch<BadgeProgress>('/user/badge-progress');
}

export interface PresenceQRPayload {
  code: string;
  expiresAt: string;
  storeId: string;
}

export interface PresenceCheckinResult {
  verified: boolean;
  distance: number;
  geoVerified: boolean;
  qrValid: boolean;
  checkinId: number | null;
}

export interface PresenceCheckin {
  id: number;
  storeId: string;
  userId: string;
  qrCodeId: number;
  verifiedAt: string;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  geoVerified: boolean;
  method: string;
}

export interface StoreCheckinStats {
  total: number;
  verified: number;
}

export async function fetchPresenceQR(storeId: string): Promise<PresenceQRPayload> {
  return apiFetch<PresenceQRPayload>(`/stores/${storeId}/presence/qr`);
}

export async function submitPresenceCheckin(
  storeId: string,
  data: { qrCode: string; lat: number; lng: number }
): Promise<PresenceCheckinResult> {
  return apiFetch<PresenceCheckinResult>(`/stores/${storeId}/presence/checkin`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchStoreCheckins(storeId: string): Promise<StoreCheckinStats> {
  return apiFetch<StoreCheckinStats>(`/stores/${storeId}/presence/checkins`);
}

export async function fetchUserCheckins(): Promise<PresenceCheckin[]> {
  return apiFetch<PresenceCheckin[]>('/user/checkins');
}

export interface AdminStoresResponse {
  stores: Store[];
  total: number;
  statusCounts: Record<string, number>;
  claimedCount: number;
}

export interface AuditLogEntry {
  id: number;
  adminUserId: string;
  adminEmail?: string;
  adminName?: string;
  action: string;
  targetType: string;
  targetId: string;
  targetName?: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
}

export async function fetchAdminStores(filters: {
  status?: string;
  claimed?: string;
  search?: string;
  province?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AdminStoresResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.claimed) params.set('claimed', filters.claimed);
  if (filters.search) params.set('search', filters.search);
  if (filters.province) params.set('province', filters.province);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<AdminStoresResponse>(`/admin/stores${qs ? `?${qs}` : ''}`);
}

export async function adminEditStore(id: string, updates: Partial<Store>): Promise<Store> {
  return apiFetch<Store>(`/admin/stores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function createCreatorPost(data: {
  title: string;
  subtitle?: string;
  bodyText?: string;
  contentTier: 'clean' | 'raw';
  storeId?: string;
  media?: { mediaType: string; cdnUrl: string; bunnyId?: string; caption?: string }[];
}): Promise<CreatorPost> {
  return apiFetch<CreatorPost>('/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchPublishedPosts(options?: {
  storeId?: string;
  page?: number;
  limit?: number;
}): Promise<{ posts: CreatorPost[]; total: number }> {
  const params = new URLSearchParams();
  if (options?.storeId) params.set('storeId', options.storeId);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const qs = params.toString();
  return apiFetch<{ posts: CreatorPost[]; total: number }>(`/posts${qs ? `?${qs}` : ''}`);
}

export async function fetchMyPosts(): Promise<CreatorPost[]> {
  return apiFetch<CreatorPost[]>('/posts/mine');
}

export async function fetchPendingPosts(): Promise<CreatorPost[]> {
  return apiFetch<CreatorPost[]>('/posts/pending');
}

export async function fetchAllAdminPosts(): Promise<CreatorPost[]> {
  return apiFetch<CreatorPost[]>('/admin/posts');
}

export async function fetchPostById(id: number): Promise<CreatorPost> {
  return apiFetch<CreatorPost>(`/posts/${id}`);
}

export async function moderatePost(id: number, action: 'approve' | 'reject' | 'mark_raw' | 'mark_clean', notes?: string): Promise<CreatorPost> {
  return apiFetch<CreatorPost>(`/posts/${id}/moderate`, {
    method: 'POST',
    body: JSON.stringify({ action, notes }),
  });
}

export async function updateCreatorPost(id: number, data: {
  title?: string;
  subtitle?: string;
  bodyText?: string;
}): Promise<CreatorPost> {
  return apiFetch<CreatorPost>(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteCreatorPost(id: number): Promise<void> {
  await apiFetch<{ success: boolean }>(`/posts/${id}`, { method: 'DELETE' });
}

export async function initPostVideoUpload(title: string): Promise<{
  videoId: string;
  signature: string;
  expirationTime: number;
  libraryId: string;
  embedUrl: string;
}> {
  return apiFetch(`/posts/init-video`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function uploadPostImage(file: File): Promise<{ cdnUrl: string; filename: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_BASE}/posts/upload-image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Upload failed');
  }
  return res.json();
}

export async function setCreatorStatus(userId: string, isCreator: boolean): Promise<void> {
  await apiFetch<{ success: boolean }>(`/admin/users/${userId}/creator`, {
    method: 'PATCH',
    body: JSON.stringify({ isCreator }),
  });
}

export async function fetchAuditLogs(filters: {
  storeId?: string;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AuditLogsResponse> {
  const params = new URLSearchParams();
  if (filters.storeId) params.set('storeId', filters.storeId);
  if (filters.adminUserId) params.set('adminUserId', filters.adminUserId);
  if (filters.action) params.set('action', filters.action);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiFetch<AuditLogsResponse>(`/admin/audit-logs${qs ? `?${qs}` : ''}`);
}

export interface AdminVideoReview {
  id: number;
  storeId: string;
  storeName: string | null;
  userId: string | null;
  bunnyVideoId: string;
  title: string | null;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  moderationStatus: string;
  contentRating: string;
  moderationNotes: string | null;
  createdAt: string;
  reviewText: string | null;
  reviewRating: number | null;
  reviewerId: string | null;
  reviewerBadge: string | null;
  reviewCreatedAt: string | null;
}

export async function fetchAdminVideoReviews(): Promise<AdminVideoReview[]> {
  return apiFetch<AdminVideoReview[]>('/admin/media/video-reviews');
}

export async function moderateVideoReview(
  id: number,
  data: { moderationStatus?: string; contentRating?: string; moderationNotes?: string }
): Promise<AdminVideoReview> {
  return apiFetch<AdminVideoReview>(`/admin/media/${id}/moderate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export interface PublicUserProfile {
  handle: string | null;
  avatarUrl: string | null;
  posts: import('../types').CreatorPost[];
  reviews: Array<{
    id: number;
    storeId: string;
    storeName: string;
    rating: number;
    reviewText: string | null;
    createdAt: string;
  }>;
}

export async function fetchUserProfile(handle: string): Promise<PublicUserProfile> {
  return apiFetch<PublicUserProfile>(`/user/profile/${handle}`);
}

export async function updateUserProfile(data: { handle?: string; avatarFile?: File }): Promise<{ handle: string | null; avatarUrl: string | null }> {
  const form = new FormData();
  if (data.handle !== undefined) form.append('handle', data.handle);
  if (data.avatarFile) form.append('avatar', data.avatarFile);
  return apiFetch(`/user/profile`, { method: 'PATCH', body: form });
}
