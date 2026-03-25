import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Store, Province, VerificationStatus } from '../types';
import { fetchAdminStores, adminEditStore, fetchAuditLogs, adminUploadStoreHeaderImage, adminUploadStorePhoto, adminDeleteStorePhoto } from '../services/api';
import type { AuditLogEntry } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DEFAULT_STORE_IMAGES, getStoreHeaderImage } from '../utils/defaultStoreImages';

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-emerald-100 text-emerald-800',
  ai_suggested: 'bg-amber-100 text-amber-800',
  rejected: 'bg-rose-100 text-rose-800',
  historically_closed: 'bg-stone-200 text-stone-600',
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  ai_suggested: 'AI Suggested',
  rejected: 'Rejected',
  historically_closed: 'Closed',
};

const ACTION_LABELS: Record<string, string> = {
  store_approved: 'Approved Store',
  store_rejected: 'Rejected Store',
  store_closed: 'Marked Closed',
  store_edited: 'Edited Store',
  claim_approved: 'Approved Claim',
  claim_rejected: 'Rejected Claim',
};

const ACTION_COLORS: Record<string, string> = {
  store_approved: 'text-emerald-600',
  store_rejected: 'text-rose-600',
  store_closed: 'text-stone-500',
  store_edited: 'text-blue-600',
  claim_approved: 'text-emerald-600',
  claim_rejected: 'text-rose-600',
};

const PROVINCES = Object.values(Province);

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface EditFormData {
  name: string;
  address: string;
  province: string;
  type: string;
  phone: string;
  website: string;
  verificationStatus: string;
  adminNotes: string;
  featuredOfferings: string;
  headerImageUrl: string;
  hours: { day: string; time: string }[];
}

export const AdminStores: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [claimedCount, setClaimedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [statusFilter, setStatusFilter] = useState('');
  const [claimedFilter, setClaimedFilter] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: '', address: '', province: '', type: '', phone: '', website: '',
    verificationStatus: '', adminNotes: '', featuredOfferings: '', headerImageUrl: '', hours: [],
  });
  const [newAdminHourDay, setNewAdminHourDay] = useState('Monday');
  const [newAdminHourTime, setNewAdminHourTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [editingStorePhotos, setEditingStorePhotos] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<'stores' | 'audit'>('stores');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditStoreFilter, setAuditStoreFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const loadStores = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchAdminStores({
        status: statusFilter || undefined,
        claimed: claimedFilter || undefined,
        search: searchQuery || undefined,
        province: provinceFilter || undefined,
        sortBy,
        sortOrder,
        page,
        limit,
      });
      setStores(result.stores);
      setTotal(result.total);
      setStatusCounts(result.statusCounts);
      setClaimedCount(result.claimedCount);
    } catch (err) {
      console.error('Failed to load stores:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, claimedFilter, searchQuery, provinceFilter, sortBy, sortOrder, page, limit]);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const result = await fetchAuditLogs({
        storeId: auditStoreFilter || undefined,
        action: auditActionFilter || undefined,
        page: auditPage,
        limit: 30,
      });
      setAuditLogs(result.logs);
      setAuditTotal(result.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  }, [auditStoreFilter, auditActionFilter, auditPage]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadStores();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isAdmin, loadStores]);

  useEffect(() => {
    if (activeTab === 'audit' && isAdmin) {
      loadAuditLogs();
    }
  }, [activeTab, isAdmin, loadAuditLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const openEdit = (store: Store) => {
    setEditingStore(store);
    setEditForm({
      name: store.name,
      address: store.address,
      province: store.province,
      type: store.type,
      phone: store.phone || '',
      website: store.website || '',
      verificationStatus: store.verificationStatus,
      adminNotes: store.adminNotes || '',
      featuredOfferings: (store.featuredOfferings || []).join(', '),
      headerImageUrl: store.headerImageUrl || '',
      hours: [...(store.hours || [])],
    });
    setNewAdminHourDay('Monday');
    setNewAdminHourTime('');
    setSaveMessage('');
    setEditingStorePhotos(store.storePhotos || []);
  };

  const handleSave = async () => {
    if (!editingStore) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      const updates: Partial<Store> = {
        name: editForm.name,
        address: editForm.address,
        province: editForm.province as Province,
        type: editForm.type as any,
        phone: editForm.phone || undefined,
        website: editForm.website || undefined,
        verificationStatus: editForm.verificationStatus as VerificationStatus,
        adminNotes: editForm.adminNotes || undefined,
        headerImageUrl: editForm.headerImageUrl || null,
        featuredOfferings: editForm.featuredOfferings
          ? editForm.featuredOfferings.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        hours: editForm.hours,
      };
      const updated = await adminEditStore(editingStore.id, updates);
      setStores(prev => prev.map(s => s.id === updated.id ? updated : s));
      setSaveMessage('Store updated successfully');
      setTimeout(() => {
        setEditingStore(null);
        setSaveMessage('');
      }, 1500);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleHeaderImageUpload = async (file: File) => {
    if (!editingStore) return;
    setIsUploadingHeader(true);
    setSaveMessage('');
    try {
      const result = await adminUploadStoreHeaderImage(editingStore.id, file);
      setEditForm(f => ({ ...f, headerImageUrl: result.url }));
      setStores(prev => prev.map(s => s.id === result.store.id ? result.store : s));
      setSaveMessage('Header image uploaded successfully');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setIsUploadingHeader(false);
    }
  };

  const handleAddStorePhoto = async (file: File) => {
    if (!editingStore) return;
    setIsUploadingPhoto(true);
    setSaveMessage('');
    try {
      const result = await adminUploadStorePhoto(editingStore.id, file);
      setEditingStorePhotos(result.storePhotos);
      setStores(prev => prev.map(s => s.id === result.store.id ? result.store : s));
      setSaveMessage('Interior photo added successfully');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeleteStorePhoto = async (index: number) => {
    if (!editingStore) return;
    try {
      const result = await adminDeleteStorePhoto(editingStore.id, index);
      setEditingStorePhotos(result.storePhotos);
      setStores(prev => prev.map(s => s.id === result.store.id ? result.store : s));
    } catch (err: any) {
      setSaveMessage(`Error: ${err.message}`);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const auditTotalPages = Math.ceil(auditTotal / 30);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Admin Access Required</h2>
        <p className="text-stone-500 font-medium mb-8">Please sign in with an admin account.</p>
        <a href="/api/login" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">Sign In</a>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">⛔</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Access Denied</h2>
        <p className="text-stone-500 font-medium mb-8">You need admin privileges to access this page.</p>
        <Link to="/" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">Back to Directory</Link>
      </div>
    );
  }

  const totalStores = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-gradient-to-r from-stone-900 to-amber-900 rounded-3xl p-8 mb-8 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Store Management</h1>
            <p className="text-stone-300 mt-1 text-sm font-medium">
              {totalStores} total stores | {claimedCount} claimed
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'stores' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              All Stores
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${
                activeTab === 'audit' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Audit Log
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          {['verified', 'ai_suggested', 'rejected', 'historically_closed'].map(status => (
            <button
              key={status}
              onClick={() => { setStatusFilter(prev => prev === status ? '' : status); setPage(1); setActiveTab('stores'); }}
              className={`rounded-xl px-4 py-3 text-left transition ${
                statusFilter === status ? 'bg-white text-stone-900 shadow-lg' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <div className="text-2xl font-black">{statusCounts[status] || 0}</div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-70">{STATUS_LABELS[status]}</div>
            </button>
          ))}
          <button
            onClick={() => { setClaimedFilter(prev => prev === 'true' ? '' : 'true'); setPage(1); setActiveTab('stores'); }}
            className={`rounded-xl px-4 py-3 text-left transition ${
              claimedFilter === 'true' ? 'bg-white text-stone-900 shadow-lg' : 'bg-white/10 hover:bg-white/20'
            }`}
          >
            <div className="text-2xl font-black">{claimedCount}</div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Claimed</div>
          </button>
        </div>
      </div>

      {activeTab === 'stores' && (
        <>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  type="text"
                  placeholder="Search by name or address..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
                <button type="submit" className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-400 transition">
                  Search
                </button>
                {searchQuery && (
                  <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }} className="px-3 py-2.5 text-stone-400 hover:text-stone-600 text-sm">
                    Clear
                  </button>
                )}
              </form>
              <select
                value={provinceFilter}
                onChange={e => { setProvinceFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">All Provinces</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="ai_suggested">AI Suggested</option>
                <option value="rejected">Rejected</option>
                <option value="historically_closed">Closed</option>
              </select>
              <select
                value={claimedFilter}
                onChange={e => { setClaimedFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">All</option>
                <option value="true">Claimed</option>
                <option value="false">Unclaimed</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4 animate-spin">⏳</div>
              <p className="text-stone-400 font-bold">Loading stores...</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50">
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider cursor-pointer hover:text-stone-700" onClick={() => handleSort('name')}>
                          Store {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider hidden lg:table-cell">Province</th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider cursor-pointer hover:text-stone-700 hidden md:table-cell" onClick={() => handleSort('confidence_score')}>
                          Score {sortBy === 'confidence_score' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider cursor-pointer hover:text-stone-700 hidden md:table-cell" onClick={() => handleSort('flag_count')}>
                          Flags {sortBy === 'flag_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider hidden lg:table-cell">Claimed</th>
                        <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider cursor-pointer hover:text-stone-700 hidden xl:table-cell" onClick={() => handleSort('updated_at')}>
                          Updated {sortBy === 'updated_at' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-right px-4 py-3 font-bold text-stone-500 uppercase text-xs tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map(store => (
                        <tr key={store.id} className="border-b border-stone-50 hover:bg-emerald-50/30 transition">
                          <td className="px-4 py-3">
                            <Link to={`/store/${store.id}`} className="font-bold text-stone-900 hover:text-emerald-600 transition">
                              {store.name}
                            </Link>
                            <div className="text-xs text-stone-400 mt-0.5 truncate max-w-[250px]">{store.address}</div>
                          </td>
                          <td className="px-4 py-3 text-stone-600 hidden lg:table-cell text-xs">{store.province}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[store.verificationStatus] || 'bg-stone-100 text-stone-600'}`}>
                              {STATUS_LABELS[store.verificationStatus] || store.verificationStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-stone-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(store.confidenceScore || 0) * 100}%` }} />
                              </div>
                              <span className="text-xs text-stone-500 font-medium">{Math.round((store.confidenceScore || 0) * 100)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {store.flagCount > 0 ? (
                              <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-700">{store.flagCount}</span>
                            ) : (
                              <span className="text-xs text-stone-300">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            {store.isClaimed ? (
                              <span className="inline-block px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">Claimed</span>
                            ) : (
                              <span className="text-xs text-stone-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-stone-400 hidden xl:table-cell">
                            {store.updatedAt ? new Date(store.updatedAt).toLocaleDateString() : (store.lastVerifiedAt ? new Date(store.lastVerifiedAt).toLocaleDateString() : '-')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(store)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-100 text-stone-700 hover:bg-emerald-100 hover:text-emerald-700 transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { setAuditStoreFilter(store.id); setAuditPage(1); setActiveTab('audit'); }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-100 text-stone-700 hover:bg-blue-100 hover:text-blue-700 transition"
                              >
                                Log
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {stores.length === 0 && (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-stone-400 font-bold">No stores found matching your filters.</p>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-stone-500">
                    Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg text-sm font-bold border border-stone-200 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
                            page === pageNum ? 'bg-emerald-500 text-white' : 'border border-stone-200 hover:bg-stone-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-lg text-sm font-bold border border-stone-200 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {activeTab === 'audit' && (
        <div>
          <div className="bg-white rounded-2xl border border-stone-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={auditActionFilter}
                onChange={e => { setAuditActionFilter(e.target.value); setAuditPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">All Actions</option>
                <option value="store_approved">Store Approved</option>
                <option value="store_rejected">Store Rejected</option>
                <option value="store_closed">Store Closed</option>
                <option value="store_edited">Store Edited</option>
                <option value="claim_approved">Claim Approved</option>
                <option value="claim_rejected">Claim Rejected</option>
              </select>
              {auditStoreFilter && (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 font-medium">
                  <span>Filtering by store</span>
                  <button onClick={() => { setAuditStoreFilter(''); setAuditPage(1); }} className="text-blue-400 hover:text-blue-600 font-bold">
                    ✕
                  </button>
                </div>
              )}
              <button
                onClick={loadAuditLogs}
                className="px-5 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-200 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {auditLoading ? (
            <div className="text-center py-24">
              <div className="text-5xl mb-4 animate-spin">⏳</div>
              <p className="text-stone-400 font-bold">Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-2xl border border-stone-200">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-stone-400 font-bold">No audit logs found.</p>
              <p className="text-stone-300 text-sm mt-2">Actions will appear here as admins review and edit stores.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-sm ${ACTION_COLORS[log.action] || 'text-stone-700'}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        {log.targetName && (
                          <>
                            <span className="text-stone-300">·</span>
                            <Link to={`/store/${log.targetId}`} className="text-sm font-medium text-stone-700 hover:text-emerald-600 truncate">
                              {log.targetName}
                            </Link>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                        <span>by {log.adminName || log.adminEmail || log.adminUserId}</span>
                        <span>·</span>
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2">
                          {log.details.notes && (
                            <p className="text-xs text-stone-500 italic">Notes: {log.details.notes}</p>
                          )}
                          {log.details.previousStatus && (
                            <p className="text-xs text-stone-500">
                              Status: <span className="font-medium">{STATUS_LABELS[log.details.previousStatus] || log.details.previousStatus}</span>
                              {' → '}
                              <span className="font-medium">{STATUS_LABELS[log.details.newStatus] || log.details.newStatus}</span>
                            </p>
                          )}
                          {log.details.changes && (
                            <div className="mt-1 space-y-1">
                              {Object.entries(log.details.changes).map(([field, change]: [string, any]) => (
                                <p key={field} className="text-xs text-stone-500">
                                  <span className="font-medium capitalize">{field}</span>: <span className="text-stone-400 line-through">{String(change.from || '-').substring(0, 60)}</span> → <span className="font-medium">{String(change.to || '-').substring(0, 60)}</span>
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {auditTotalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-stone-500">
                    Page {auditPage} of {auditTotalPages} ({auditTotal} entries)
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1} className="px-3 py-2 rounded-lg text-sm font-bold border border-stone-200 hover:bg-stone-50 disabled:opacity-30 transition">Prev</button>
                    <button onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} disabled={auditPage === auditTotalPages} className="px-3 py-2 rounded-lg text-sm font-bold border border-stone-200 hover:bg-stone-50 disabled:opacity-30 transition">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editingStore && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setEditingStore(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-stone-100 rounded-t-3xl px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-stone-900">Edit Store</h2>
              <button onClick={() => setEditingStore(null)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition text-stone-500 font-bold">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Type</label>
                  <select
                    value={editForm.type}
                    onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="Sovereign">Sovereign</option>
                    <option value="Local Gem">Local Gem</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Province</label>
                  <select
                    value={editForm.province}
                    onChange={e => setEditForm(f => ({ ...f, province: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Verification Status</label>
                  <select
                    value={editForm.verificationStatus}
                    onChange={e => setEditForm(f => ({ ...f, verificationStatus: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="verified">Verified</option>
                    <option value="ai_suggested">AI Suggested</option>
                    <option value="rejected">Rejected</option>
                    <option value="historically_closed">Historically Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Website</label>
                  <input
                    type="text"
                    value={editForm.website}
                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="https://"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Featured Offerings (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.featuredOfferings}
                  onChange={e => setEditForm(f => ({ ...f, featuredOfferings: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Edibles, Flower, Concentrates"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Store Hours</label>
                <div className="space-y-1.5 mb-3">
                  {(editForm.hours || []).map((h, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 border border-stone-200">
                      <span className="text-xs font-bold text-stone-600 w-24 shrink-0">{h.day}</span>
                      <span className="text-xs text-stone-700 flex-1">{h.time}</span>
                      <button
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, hours: f.hours.filter((_, i) => i !== idx) }))}
                        className="text-stone-400 hover:text-red-500 transition text-sm leading-none"
                        aria-label="Remove hour"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(editForm.hours || []).length === 0 && (
                    <p className="text-xs text-stone-400 italic">No hours set.</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={newAdminHourDay}
                    onChange={e => setNewAdminHourDay(e.target.value)}
                    className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <input
                    type="text"
                    value={newAdminHourTime}
                    onChange={e => setNewAdminHourTime(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const t = newAdminHourTime.trim();
                        if (t) { setEditForm(f => ({ ...f, hours: [...f.hours, { day: newAdminHourDay, time: t }] })); setNewAdminHourTime(''); }
                      }
                    }}
                    placeholder="e.g. 10:00 AM - 9:00 PM"
                    className="flex-1 min-w-0 px-4 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const t = newAdminHourTime.trim();
                      if (t) { setEditForm(f => ({ ...f, hours: [...f.hours, { day: newAdminHourDay, time: t }] })); setNewAdminHourTime(''); }
                    }}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-400 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Admin Notes</label>
                <textarea
                  value={editForm.adminNotes}
                  onChange={e => setEditForm(f => ({ ...f, adminNotes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                  placeholder="Internal admin notes..."
                />
              </div>

              <div className="bg-stone-50 rounded-xl border border-stone-200 p-4">
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Custom Domain</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-stone-800">{editingStore?.customDomain || '—'}</span>
                  {editingStore?.domainVerified ? (
                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Verified ✓</span>
                  ) : (
                    <span className="text-xs font-bold bg-stone-200 text-stone-500 px-2 py-0.5 rounded-full">
                      {editingStore?.customDomain ? 'Not Verified' : 'None'}
                    </span>
                  )}
                </div>
                {editingStore?.themeConfig?.brandColor && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-stone-500">Brand color:</span>
                    <span
                      className="inline-block w-4 h-4 rounded-full border border-stone-300"
                      style={{ backgroundColor: editingStore.themeConfig.brandColor }}
                    />
                    <span className="text-xs font-mono text-stone-600">{editingStore.themeConfig.brandColor}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Header Image</label>
                {editingStore && (
                  <div className="mb-2 relative group">
                    <img
                      src={editForm.headerImageUrl || getStoreHeaderImage(editingStore.id, editingStore.headerImageUrl)}
                      alt="Header preview"
                      className="w-full h-32 object-cover rounded-xl border border-stone-200"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/400x200/065f46/ffffff?text=Image+Error`; }}
                    />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all rounded-xl cursor-pointer">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold bg-black/60 px-3 py-1.5 rounded-lg">
                        {isUploadingHeader ? 'Uploading...' : 'Upload New Image'}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                        className="hidden"
                        disabled={isUploadingHeader}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleHeaderImageUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={editForm.headerImageUrl}
                    onChange={e => setEditForm(f => ({ ...f, headerImageUrl: e.target.value }))}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Or paste a custom image URL"
                  />
                  {editForm.headerImageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, headerImageUrl: '' }))}
                      className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-500 hover:bg-stone-100 transition whitespace-nowrap"
                    >
                      Use Default
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-2 max-h-36 overflow-y-auto">
                  {DEFAULT_STORE_IMAGES.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, headerImageUrl: url }))}
                      className={`rounded-lg overflow-hidden border-2 transition ${
                        editForm.headerImageUrl === url ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-stone-200 hover:border-emerald-300'
                      }`}
                    >
                      <img src={url} alt={`Default ${i + 1}`} className="w-full h-12 object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider">Interior Photos</label>
                  <span className="text-xs text-stone-400">{editingStorePhotos.length}/10</span>
                </div>
                {editingStorePhotos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {editingStorePhotos.map((url, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-200">
                        <img src={url} alt={`Interior ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeleteStorePhoto(i)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {editingStorePhotos.length < 10 ? (
                  <label className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-dashed border-stone-300 text-sm font-bold text-stone-500 hover:border-emerald-400 hover:text-emerald-600 transition cursor-pointer ${isUploadingPhoto ? 'opacity-50 cursor-wait' : ''}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    {isUploadingPhoto ? 'Uploading...' : `Add Interior Photo (${editingStorePhotos.length}/10)`}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      className="hidden"
                      disabled={isUploadingPhoto}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleAddStorePhoto(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                ) : (
                  <p className="text-xs text-stone-400 text-center py-2">Maximum of 10 interior photos reached.</p>
                )}
              </div>

              {saveMessage && (
                <div className={`px-4 py-3 rounded-xl text-sm font-bold ${
                  saveMessage.startsWith('Error') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {saveMessage}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-stone-100 rounded-b-3xl px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingStore(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-stone-600 hover:bg-stone-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-50 transition shadow-lg shadow-emerald-200"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
