import type { Store, StoreFlag, FlagReason } from '../types';

const API_BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'API request failed');
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
