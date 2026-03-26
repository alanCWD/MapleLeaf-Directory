
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createClaimAPI, getUserClaimsAPI, getOwnedStoresAPI, updateOwnedStoreAPI, fetchStoreMedia, deleteMedia, fetchStores, ownerUploadStoreHeaderImage, ownerUploadStorePhoto, ownerDeleteStorePhoto, ownerSaveStoreDomain, ownerVerifyStoreDomain, ownerUploadStoreLogo } from '../services/api';
import { VideoUploader } from './VideoUploader';
import { PresenceQR } from './PresenceQR';
import type { Store, StoreMedia } from '../types';
import { DEFAULT_STORE_IMAGES, getStoreHeaderImage } from '../utils/defaultStoreImages';

const SERVICES = [
  {
    title: "Sovereign Visibility",
    description: "Get discovered by conscious consumers looking for heritage harvests and sovereign stashes.",
    icon: "🌾",
    category: "Exposure"
  },
  {
    title: "Community Trust",
    description: "Showcase your traditional roots and local impact. We prioritize community storytelling over corporate metrics.",
    icon: "🤝",
    category: "Story"
  },
  {
    title: "Direct Connect",
    description: "Build direct relationships with your customers. Our platform facilitates independent shop growth without corporate gatekeeping.",
    icon: "🔗",
    category: "Growth"
  },
  {
    title: "Legacy Optimization",
    description: "Modern tools for traditional stashes. Digital presence that respects your independent operations.",
    icon: "✨",
    category: "Digital"
  }
];

const ClaimStoreSection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Store[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [claims, setClaims] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getUserClaimsAPI().then(setClaims).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSelectedStore(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await fetchStores({ search: q, limit: 20 });
        setSearchResults(results.slice(0, 8));
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
    setSearchQuery(store.name);
    setShowDropdown(false);
    setSearchResults([]);
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) { setError('Please search for and select your store'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await createClaimAPI(selectedStore.id, message.trim() || undefined);
      setSuccess(true);
      setSelectedStore(null);
      setSearchQuery('');
      setMessage('');
      const updated = await getUserClaimsAPI();
      setClaims(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to submit claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-stone-200 p-8 shadow-sm">
      <h3 className="text-xl font-black text-stone-900 mb-2">Claim Your Store</h3>
      <p className="text-stone-500 text-sm mb-6 font-medium">
        Search for your store below and submit a claim. Our admin team will verify and approve ownership.
      </p>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-medium mb-4">
          Claim submitted! Our team will review it shortly.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleClaim} className="space-y-4">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Search for Your Store</label>
          <div ref={searchRef} className="relative">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Type your store name…"
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl pl-11 pr-4 py-4 focus:border-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
                autoComplete="off"
              />
              {isSearching && (
                <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
                {searchResults.map(store => (
                  <button
                    key={store.id}
                    type="button"
                    onClick={() => handleSelectStore(store)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition text-left border-b border-stone-100 last:border-b-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-900 text-sm truncate">{store.name}</p>
                      <p className="text-xs text-stone-400 truncate">{store.address}, {store.province}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${store.isClaimed ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-500'}`}>
                      {store.isClaimed ? 'Claimed' : store.type}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchResults.length === 0 && !isSearching && searchQuery.trim() && (
              <div className="absolute z-50 left-0 right-0 mt-2 bg-white border border-stone-200 rounded-2xl shadow-xl px-4 py-4 text-sm text-stone-500 text-center">
                No stores found for "{searchQuery}". <Link to="/community-submit" className="text-emerald-600 font-bold hover:underline">Submit a new listing?</Link>
              </div>
            )}
          </div>

          {selectedStore && (
            <div className="mt-3 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
              <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-emerald-900 text-sm truncate">{selectedStore.name}</p>
                <p className="text-xs text-emerald-700 truncate">{selectedStore.address}, {selectedStore.province}</p>
              </div>
              <button type="button" onClick={() => { setSelectedStore(null); setSearchQuery(''); }} className="text-emerald-500 hover:text-emerald-700 text-lg leading-none flex-shrink-0">×</button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Why should we approve your claim?</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tell us how you're connected to this store (e.g. I'm the owner, manager, etc.)"
            rows={3}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !selectedStore}
          className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Ownership Claim'}
        </button>
      </form>

      {claims.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-black uppercase tracking-widest text-stone-500 mb-3">Your Claims</h4>
          <div className="space-y-2">
            {claims.map((claim: any) => (
              <div key={claim.id} className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-3 border border-stone-100 gap-3">
                <span className="text-sm font-bold text-stone-700 truncate">{claim.storeName || claim.storeId}</span>
                <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg flex-shrink-0 ${
                  claim.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                  claim.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const OwnedStoresSection: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [newOffering, setNewOffering] = useState('');
  const [newHourDay, setNewHourDay] = useState('Monday');
  const [newHourTime, setNewHourTime] = useState('');
  const [headerUploading, setHeaderUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState<string[]>([]);
  const headerFileRef = useRef<HTMLInputElement>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getOwnedStoresAPI().then(setStores).catch(() => {});
  }, []);

  const startEditing = (store: Store) => {
    setEditing(store.id);
    setEditData({
      phone: store.phone ?? '',
      website: store.website ?? '',
      address: store.address ?? '',
      headerImageUrl: store.headerImageUrl ?? '',
      featuredOfferings: [...(store.featuredOfferings || [])],
      hours: [...(store.hours || [])],
    });
    setEditingPhotos(store.storePhotos || []);
    setNewOffering('');
    setNewHourDay('Monday');
    setNewHourTime('');
  };

  const handleHeaderImageUpload = async (storeId: string, file: File) => {
    setHeaderUploading(true);
    try {
      const { url, store } = await ownerUploadStoreHeaderImage(storeId, file);
      setEditData((prev: any) => ({ ...prev, headerImageUrl: url }));
      setStores(prev => prev.map(s => s.id === storeId ? store : s));
    } catch (err: any) {
      alert(err.message || 'Failed to upload header image');
    } finally {
      setHeaderUploading(false);
    }
  };

  const handleAddPhoto = async (storeId: string, file: File) => {
    if (editingPhotos.length >= 10) {
      alert('Maximum of 10 interior photos allowed');
      return;
    }
    setPhotoUploading(true);
    try {
      const { storePhotos, store } = await ownerUploadStorePhoto(storeId, file);
      setEditingPhotos(storePhotos);
      setStores(prev => prev.map(s => s.id === storeId ? store : s));
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeletePhoto = async (storeId: string, index: number) => {
    try {
      const { storePhotos, store } = await ownerDeleteStorePhoto(storeId, index);
      setEditingPhotos(storePhotos);
      setStores(prev => prev.map(s => s.id === storeId ? store : s));
    } catch (err: any) {
      alert(err.message || 'Failed to delete photo');
    }
  };

  const addOffering = () => {
    const trimmed = newOffering.trim();
    if (!trimmed) return;
    setEditData((prev: any) => ({ ...prev, featuredOfferings: [...(prev.featuredOfferings || []), trimmed] }));
    setNewOffering('');
  };

  const removeOffering = (idx: number) => {
    setEditData((prev: any) => ({ ...prev, featuredOfferings: prev.featuredOfferings.filter((_: any, i: number) => i !== idx) }));
  };

  const addHour = () => {
    const trimmed = newHourTime.trim();
    if (!trimmed) return;
    setEditData((prev: any) => ({ ...prev, hours: [...(prev.hours || []), { day: newHourDay, time: trimmed }] }));
    setNewHourTime('');
  };

  const removeHour = (idx: number) => {
    setEditData((prev: any) => ({ ...prev, hours: prev.hours.filter((_: any, i: number) => i !== idx) }));
  };

  const handleSave = async (storeId: string) => {
    setSaving(true);
    try {
      const updated = await updateOwnedStoreAPI(storeId, editData);
      setStores(prev => prev.map(s => s.id === storeId ? updated : s));
      setEditing(null);
      setEditData({});
    } catch (err) {
      console.error('Failed to update store:', err);
    } finally {
      setSaving(false);
    }
  };

  if (stores.length === 0) return null;

  return (
    <div className="bg-white rounded-[32px] border border-stone-200 p-8 shadow-sm">
      <h3 className="text-xl font-black text-stone-900 mb-4">Your Stores</h3>
      <div className="space-y-4">
        {stores.map(store => (
          <div key={store.id} className="border border-stone-200 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="font-bold text-stone-900">{store.name}</h4>
                <p className="text-sm text-stone-500">{store.address}</p>
              </div>
              <span className="text-xs font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg">Owner</span>
            </div>
            
            {editing === store.id ? (
              <div className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editData.phone ?? ''}
                    onChange={e => setEditData((prev: any) => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Visit Official Site (Website URL)</label>
                  <input
                    type="text"
                    value={editData.website ?? ''}
                    onChange={e => setEditData((prev: any) => ({ ...prev, website: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                    placeholder="https://yourstore.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={editData.address ?? ''}
                    onChange={e => setEditData((prev: any) => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-2">Main Header Image</label>
                  <input
                    ref={headerFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleHeaderImageUpload(store.id, file);
                      e.target.value = '';
                    }}
                  />
                  <div
                    className="relative mb-2 group cursor-pointer rounded-xl overflow-hidden"
                    onClick={() => !headerUploading && headerFileRef.current?.click()}
                  >
                    <img
                      src={editData.headerImageUrl ? editData.headerImageUrl : getStoreHeaderImage(store.id, store.headerImageUrl)}
                      alt="Header preview"
                      className="w-full h-32 object-cover border border-stone-200"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://placehold.co/400x200/065f46/ffffff?text=Image+Error`; }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-1">
                      {headerUploading ? (
                        <span className="text-white text-xs font-bold">Uploading…</span>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                          <span className="text-white text-xs font-bold">Upload from computer</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={editData.headerImageUrl ?? ''}
                      onChange={e => setEditData((prev: any) => ({ ...prev, headerImageUrl: e.target.value }))}
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                      placeholder="Or paste an image URL"
                    />
                    {editData.headerImageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditData((prev: any) => ({ ...prev, headerImageUrl: '' }))}
                        className="px-3 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-500 hover:bg-stone-100 transition whitespace-nowrap"
                      >
                        Use Default
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                    {DEFAULT_STORE_IMAGES.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setEditData((prev: any) => ({ ...prev, headerImageUrl: url }))}
                        className={`rounded-lg overflow-hidden border-2 transition ${
                          editData.headerImageUrl === url ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-stone-200 hover:border-emerald-300'
                        }`}
                      >
                        <img src={url} alt={`Default ${i + 1}`} className="w-full h-16 object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-stone-500">Interior Photos ({editingPhotos.length}/10)</label>
                  </div>
                  <input
                    ref={photoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleAddPhoto(store.id, file);
                      e.target.value = '';
                    }}
                  />
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {editingPhotos.map((photoUrl, idx) => (
                      <div key={idx} className="relative group rounded-lg overflow-hidden border border-stone-200">
                        <img src={photoUrl} alt={`Interior ${idx + 1}`} className="w-full h-20 object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(store.id, idx)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full w-5 h-5 text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition leading-none"
                          aria-label="Delete photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {editingPhotos.length < 10 && (
                      <button
                        type="button"
                        onClick={() => !photoUploading && photoFileRef.current?.click()}
                        disabled={photoUploading}
                        className="h-20 rounded-lg border-2 border-dashed border-stone-300 hover:border-emerald-400 flex flex-col items-center justify-center gap-1 text-stone-400 hover:text-emerald-600 transition disabled:opacity-50"
                      >
                        {photoUploading ? (
                          <span className="text-xs font-bold">Uploading…</span>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            <span className="text-xs font-bold">Add Photo</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {editingPhotos.length === 0 && (
                    <p className="text-xs text-stone-400 italic">No interior photos yet. Show customers what your store looks like inside.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-2">Featured Selection</label>
                  <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
                    {(editData.featuredOfferings || []).map((item: string, idx: number) => (
                      <span key={idx} className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-full">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeOffering(idx)}
                          className="ml-1 text-emerald-500 hover:text-red-500 transition leading-none"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {(editData.featuredOfferings || []).length === 0 && (
                      <span className="text-xs text-stone-400 italic">No items yet. Add some below.</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOffering}
                      onChange={e => setNewOffering(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOffering(); } }}
                      placeholder="e.g. Flower, Edibles, Concentrates…"
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addOffering}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-400 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-2">Store Hours</label>
                  <div className="space-y-2 mb-3">
                    {(editData.hours || []).map((h: { day: string; time: string }, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2 border border-stone-200">
                        <span className="text-xs font-bold text-stone-600 w-24 shrink-0">{h.day}</span>
                        <span className="text-xs text-stone-700 flex-1">{h.time}</span>
                        <button
                          type="button"
                          onClick={() => removeHour(idx)}
                          className="text-stone-400 hover:text-red-500 transition text-sm leading-none"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(editData.hours || []).length === 0 && (
                      <p className="text-xs text-stone-400 italic">No hours set. Add below.</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={newHourDay}
                      onChange={e => setNewHourDay(e.target.value)}
                      className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:border-emerald-400 outline-none"
                    >
                      {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <input
                      type="text"
                      value={newHourTime}
                      onChange={e => setNewHourTime(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHour(); } }}
                      placeholder="e.g. 10:00 AM - 9:00 PM"
                      className="flex-1 min-w-0 bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-sm focus:border-emerald-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={addHour}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-400 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleSave(store.id)}
                    disabled={saving}
                    className="bg-emerald-500 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setEditData({}); }}
                    className="bg-stone-100 text-stone-600 px-6 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex gap-4 text-sm text-stone-500 mb-3">
                  {store.phone && <span>{store.phone}</span>}
                  {store.website && <a href={store.website} target="_blank" rel="noopener" className="text-emerald-600 hover:underline truncate max-w-xs">{store.website}</a>}
                </div>
                <button
                  onClick={() => startEditing(store)}
                  className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition"
                >
                  Edit Store Info
                </button>
              </div>
            )}

            <StoreMediaSection store={store} />
            <PresenceQR storeId={store.id} storeName={store.name} />
            <OwnedSiteSection
              store={store}
              onUpdate={updated => setStores(prev => prev.map(s => s.id === updated.id ? updated : s))}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

type DnsResult = {
  verified: boolean;
  cnameTarget: string | null;
  expectedTarget: string | null;
  domain: string;
  reason: string;
};

const DEFAULT_BRAND = '#065f46';
const FALLBACK_CNAME_TARGET = 'legacyleaf-directory.replit.app';

const DnsInstructions: React.FC<{ target: string; header: string; subtext: string; color: 'amber' | 'red' }> = ({ target, header, subtext, color }) => {
  const colorMap = {
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', head: 'text-amber-800', sub: 'text-amber-700', inner: 'border-amber-200' },
    red: { bg: 'bg-red-50', border: 'border-red-200', head: 'text-red-800', sub: 'text-red-700', inner: 'border-red-200' },
  }[color];
  return (
    <div className={`${colorMap.bg} ${colorMap.border} border rounded-2xl p-4`}>
      <p className={`${colorMap.head} font-bold text-sm mb-1`}>{header}</p>
      <p className={`${colorMap.sub} text-xs mb-3`}>{subtext}</p>
      <div className={`bg-white ${colorMap.inner} border rounded-xl p-3`}>
        <p className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">DNS Setup Instructions</p>
        <p className="text-xs text-stone-600 mb-2">Go to your domain registrar → DNS settings → add this CNAME record:</p>
        <div className="overflow-x-auto">
          <table className="text-xs font-mono w-full min-w-[220px]">
            <thead>
              <tr className="text-stone-400">
                <th className="text-left pr-4 font-bold">Type</th>
                <th className="text-left pr-4 font-bold">Name</th>
                <th className="text-left font-bold">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-stone-800">
                <td className="pr-4">CNAME</td>
                <td className="pr-4">@</td>
                <td className="break-all">{target}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function extractDominantColors(img: HTMLImageElement, count = 2): string[] {
  const canvas = document.createElement('canvas');
  const size = 60;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const colorMap: Record<string, number> = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const avg = (r + g + b) / 3;
    if (avg < 15 || avg > 240) continue;
    const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
    if (maxC - minC < 30) continue;
    const rq = Math.round(r / 32) * 32;
    const gq = Math.round(g / 32) * 32;
    const bq = Math.round(b / 32) * 32;
    const key = `${rq},${gq},${bq}`;
    colorMap[key] = (colorMap[key] || 0) + 1;
  }
  const sorted = Object.entries(colorMap).sort(([, a], [, b]) => b - a);
  const picked: string[] = [];
  for (const [key] of sorted) {
    if (picked.length >= count) break;
    const [r, g, b] = key.split(',').map(Number);
    const hex = '#' + [r, g, b].map(x => Math.min(255, x).toString(16).padStart(2, '0')).join('');
    const tooClose = picked.some(prev => {
      const pr = parseInt(prev.slice(1, 3), 16);
      const pg = parseInt(prev.slice(3, 5), 16);
      const pb = parseInt(prev.slice(5, 7), 16);
      return Math.abs(r - pr) + Math.abs(g - pg) + Math.abs(b - pb) < 80;
    });
    if (!tooClose) picked.push(hex);
  }
  return picked;
}

const OwnedSiteSection: React.FC<{ store: Store; onUpdate: (updated: Store) => void }> = ({ store, onUpdate }) => {
  const [domain, setDomain] = useState(store.customDomain ?? '');
  const [brandColor, setBrandColor] = useState(store.themeConfig?.brandColor ?? DEFAULT_BRAND);
  const [accentColor, setAccentColor] = useState(store.themeConfig?.accentColor ?? '');
  const [currentLogoUrl, setCurrentLogoUrl] = useState(store.themeConfig?.logoUrl ?? '');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [dnsResult, setDnsResult] = useState<DnsResult | null>(null);
  const [dnsError, setDnsError] = useState('');
  const autoCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (autoCheckRef.current) clearTimeout(autoCheckRef.current); }, []);

  useEffect(() => {
    const propLogo = store.themeConfig?.logoUrl ?? '';
    if (propLogo !== currentLogoUrl) setCurrentLogoUrl(propLogo);
  }, [store.themeConfig?.logoUrl]);

  const savedDomain = store.customDomain ?? '';
  const savedBrand = store.themeConfig?.brandColor ?? DEFAULT_BRAND;
  const savedAccent = store.themeConfig?.accentColor ?? '';
  const isDirty = domain !== savedDomain || brandColor !== savedBrand || accentColor !== savedAccent;

  const hasDomain = !!savedDomain;
  const isVerified = dnsResult ? dnsResult.verified : store.domainVerified;
  const displayExpected = dnsResult?.expectedTarget || FALLBACK_CNAME_TARGET;

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    setLogoError('');
    setExtractedColors([]);
    try {
      const { url, store: updated } = await ownerUploadStoreLogo(store.id, file);
      setCurrentLogoUrl(url);
      onUpdate(updated);
      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';
      tempImg.onload = () => {
        const colors = extractDominantColors(tempImg, 2);
        setExtractedColors(colors);
        if (colors[0]) setBrandColor(colors[0]);
        if (colors[1]) setAccentColor(colors[1]);
      };
      tempImg.src = url;
    } catch (err: any) {
      setLogoError(err.message || 'Failed to upload logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setDnsResult(null);
    try {
      const themeConfig: { brandColor?: string; accentColor?: string; logoUrl?: string } = { brandColor };
      if (accentColor) themeConfig.accentColor = accentColor;
      if (currentLogoUrl) themeConfig.logoUrl = currentLogoUrl;
      const updated = await ownerSaveStoreDomain(store.id, domain.trim(), themeConfig);
      onUpdate(updated);
      if (domain.trim()) {
        if (autoCheckRef.current) clearTimeout(autoCheckRef.current);
        autoCheckRef.current = setTimeout(async () => {
          try {
            const result = await ownerVerifyStoreDomain(store.id);
            setDnsResult(result);
          } catch { }
        }, 5000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save domain settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckDns = async () => {
    setChecking(true);
    setDnsError('');
    try {
      const result = await ownerVerifyStoreDomain(store.id);
      setDnsResult(result);
    } catch (err: any) {
      setDnsError(err.message || 'DNS check failed');
    } finally {
      setChecking(false);
    }
  };

  const isFormBusy = saving || checking;

  return (
    <div className="border border-stone-200 rounded-2xl p-6 mt-4">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        <h4 className="font-bold text-stone-900">Your Website</h4>
        {hasDomain && !isDirty && (
          isVerified ? (
            <span className="ml-auto text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
              Live
            </span>
          ) : (
            <span className="ml-auto text-xs font-black uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              DNS Pending
            </span>
          )
        )}
      </div>
      <p className="text-xs text-stone-400 mb-4 ml-7">Connect your own domain and customize your store's branded website.</p>

      <input
        ref={logoFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleLogoUpload(file);
          e.target.value = '';
        }}
      />

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1">Store Logo</label>
          <div
            className={`relative flex items-center gap-4 bg-stone-50 border border-stone-200 rounded-xl p-3 cursor-pointer hover:border-emerald-400 transition ${isFormBusy || logoUploading ? 'opacity-60 pointer-events-none' : ''}`}
            onClick={() => !isFormBusy && !logoUploading && logoFileRef.current?.click()}
          >
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt="Store logo"
                className="w-16 h-16 object-contain rounded-lg border border-stone-200 bg-white flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-stone-300 flex items-center justify-center flex-shrink-0 bg-white">
                <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              {logoUploading ? (
                <div className="flex items-center gap-2 text-sm text-stone-500">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Uploading & extracting colours…
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-stone-700">{currentLogoUrl ? 'Change Logo' : 'Upload Logo'}</p>
                  <p className="text-xs text-stone-400 mt-0.5">PNG, JPG or WebP · max 20 MB</p>
                  {extractedColors.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-stone-400">Colours picked:</span>
                      {extractedColors.map((c, i) => (
                        <div key={i} className="w-4 h-4 rounded-full border border-stone-200 flex-shrink-0" style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {!logoUploading && (
              <svg className="w-4 h-4 text-stone-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
          </div>
          {logoError && <p className="text-xs text-red-600 mt-1 font-medium">{logoError}</p>}
          {extractedColors.length > 0 && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">Brand and accent colours auto-filled from your logo. Adjust below if needed.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1">Custom Domain</label>
          <input
            type="text"
            value={domain}
            onChange={e => { setDomain(e.target.value); setDnsResult(null); }}
            placeholder="e.g. thegreentree.ca"
            disabled={isFormBusy}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none disabled:opacity-60"
          />
          <p className="text-xs text-stone-400 mt-1">Enter without https:// — e.g. shop.example.ca</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1">Primary Colour</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={brandColor}
              onChange={e => setBrandColor(e.target.value)}
              disabled={isFormBusy}
              className="w-10 h-10 rounded-xl border border-stone-200 cursor-pointer bg-stone-50 p-0.5 disabled:opacity-60"
              title="Pick primary colour"
            />
            <input
              type="text"
              value={brandColor}
              onChange={e => {
                const v = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandColor(v);
              }}
              maxLength={7}
              disabled={isFormBusy}
              className="w-28 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-mono focus:border-emerald-400 outline-none disabled:opacity-60"
              placeholder="#065f46"
            />
            <div className="w-8 h-8 rounded-full border border-stone-200 flex-shrink-0" style={{ backgroundColor: brandColor }} title="Primary colour preview" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-500 mb-1">Accent Colour <span className="font-normal text-stone-400">(optional)</span></label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor || '#000000'}
              onChange={e => setAccentColor(e.target.value)}
              disabled={isFormBusy}
              className="w-10 h-10 rounded-xl border border-stone-200 cursor-pointer bg-stone-50 p-0.5 disabled:opacity-60"
              title="Pick accent colour"
            />
            <input
              type="text"
              value={accentColor}
              onChange={e => {
                const v = e.target.value;
                if (/^#?[0-9a-fA-F]{0,6}$/.test(v)) setAccentColor(v.startsWith('#') || v === '' ? v : `#${v}`);
              }}
              maxLength={7}
              disabled={isFormBusy}
              className="w-28 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-mono focus:border-emerald-400 outline-none disabled:opacity-60"
              placeholder="auto from logo"
            />
            {accentColor && (
              <>
                <div className="w-8 h-8 rounded-full border border-stone-200 flex-shrink-0" style={{ backgroundColor: accentColor }} title="Accent colour preview" />
                <button type="button" onClick={() => setAccentColor('')} className="text-xs text-stone-400 hover:text-red-500 transition">Clear</button>
              </>
            )}
          </div>
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-medium">
            {saveError}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            disabled={isFormBusy || !isDirty}
            className="bg-emerald-500 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-emerald-400 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleCheckDns}
            disabled={isFormBusy || !hasDomain}
            title={!hasDomain ? 'Save a domain first' : undefined}
            className="bg-stone-100 text-stone-700 px-5 py-2 rounded-xl text-sm font-bold hover:bg-stone-200 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {checking && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {checking ? 'Checking…' : 'Check DNS'}
          </button>
          <a
            href={`#/preview/store/${store.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-purple-100 text-purple-800 px-5 py-2 rounded-xl text-sm font-bold hover:bg-purple-200 transition flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Preview Site
          </a>
        </div>

        {saving && domain.trim() && (
          <p className="text-xs text-stone-400 italic">Saving — will auto-check DNS in 5 seconds after save…</p>
        )}
        {checking && (
          <p className="text-xs text-stone-400 italic">Checking DNS…</p>
        )}

        {dnsError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm font-medium">
            {dnsError}
          </div>
        )}

        {/* --- DNS status area: exactly one of three states --- */}
        {dnsResult ? (
          dnsResult.verified ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-emerald-700 font-bold text-sm mb-1">✅ Verified & Live</p>
              <p className="text-emerald-600 text-xs mb-3">Your custom domain is pointing here correctly.</p>
              <a
                href={`https://${dnsResult.domain || savedDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-500 transition"
              >
                Preview Your Site →
              </a>
            </div>
          ) : (
            <DnsInstructions
              target={displayExpected}
              header="⚠ DNS Not Yet Resolving"
              subtext={`Your domain is not yet pointing here. ${dnsResult.cnameTarget ? `Currently resolves to: ${dnsResult.cnameTarget}.` : 'No CNAME record found.'}`}
              color="amber"
            />
          )
        ) : hasDomain && isVerified ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-emerald-700 font-bold text-sm mb-1">✅ Verified & Live</p>
            <a
              href={`https://${savedDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700 hover:text-emerald-500 transition"
            >
              Preview Your Site →
            </a>
          </div>
        ) : hasDomain && !isVerified ? (
          <DnsInstructions
            target={FALLBACK_CNAME_TARGET}
            header="⚠ DNS Setup Pending"
            subtext="Add a CNAME record at your domain registrar to activate your branded website:"
            color="amber"
          />
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
            <p className="text-stone-500 font-bold text-sm mb-1">❌ No domain entered</p>
            <p className="text-stone-400 text-xs">Enter a custom domain above and save to get started. DNS instructions will appear once a domain is saved.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: StoreMedia['status'] }> = ({ status }) => {
  const config = {
    uploading: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Uploading' },
    processing: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Processing' },
    encoding: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Encoding' },
    ready: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Ready' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  }[status] || { bg: 'bg-stone-100', text: 'text-stone-700', label: status };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg ${config.bg} ${config.text}`}>
      {(status === 'processing' || status === 'encoding' || status === 'uploading') && (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {status === 'ready' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {status === 'failed' && (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {config.label}
    </span>
  );
};

const StoreMediaSection: React.FC<{ store: Store }> = ({ store }) => {
  const [media, setMedia] = useState<StoreMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const loadMedia = async () => {
    try {
      const items = await fetchStoreMedia(store.id);
      setMedia(items);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [store.id]);

  useEffect(() => {
    const hasProcessing = media.some(m => m.status === 'processing' || m.status === 'encoding' || m.status === 'uploading');
    if (!hasProcessing) return;
    const interval = setInterval(loadMedia, 10000);
    return () => clearInterval(interval);
  }, [media]);

  const handleDelete = async (mediaId: number) => {
    setDeletingId(mediaId);
    try {
      await deleteMedia(store.id, mediaId);
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      setConfirmDeleteId(null);
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploadComplete = () => {
    setShowUploader(false);
    loadMedia();
  };

  return (
    <div className="border border-stone-200 rounded-2xl p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-bold text-stone-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Media
          {media.length > 0 && (
            <span className="text-xs font-bold text-stone-400">({media.length})</span>
          )}
        </h4>
        {!showUploader && (
          <button
            onClick={() => setShowUploader(true)}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Upload Video
          </button>
        )}
      </div>

      {showUploader && (
        <div className="mb-6">
          <VideoUploader
            storeId={store.id}
            onComplete={handleUploadComplete}
            onCancel={() => setShowUploader(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : media.length === 0 && !showUploader ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-stone-500 font-medium mb-3">No media uploaded yet</p>
          <button
            onClick={() => setShowUploader(true)}
            className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition"
          >
            Upload your first video
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {media.map(item => (
            <div key={item.id} className="flex items-center gap-4 bg-stone-50 rounded-xl p-3 border border-stone-100">
              <div className="w-20 h-14 bg-stone-200 rounded-lg overflow-hidden flex-shrink-0">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-900 truncate">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={item.status} />
                  <span className="text-xs text-stone-400 capitalize">{item.mediaType}</span>
                  {item.durationSeconds && (
                    <span className="text-xs text-stone-400">
                      {Math.floor(item.durationSeconds / 60)}:{String(item.durationSeconds % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {confirmDeleteId === item.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="text-xs font-bold text-red-600 hover:text-red-500 disabled:opacity-50"
                    >
                      {deletingId === item.id ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-xs font-bold text-stone-500 hover:text-stone-400"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(item.id)}
                    className="text-stone-400 hover:text-red-500 transition p-1"
                    title="Delete media"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const OwnerPortal: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

  const scrollToClaim = () => {
    document.getElementById('claim-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <section className="bg-gradient-to-br from-emerald-900 via-[#0a2e1f] to-purple-900 text-white py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
              Empower Your <span className="text-emerald-400 underline decoration-purple-500/40 decoration-wavy">Sovereignty</span>
            </h1>
            <p className="text-xl text-stone-300 mb-10 leading-relaxed font-medium">
              Exclusively for Sovereign Indigenous shops and local gems. We are the anti-corporate directory, connecting connoisseurs with the real roots of Canadian cannabis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={scrollToClaim}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/40 text-center"
              >
                Claim Your Store
              </button>
              <button
                onClick={scrollToClaim}
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold transition border border-white/20 backdrop-blur-md text-center"
              >
                Browse Directory
              </button>
            </div>
          </div>
          <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-2xl font-black mb-4 text-white">How It Works</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black flex-shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-white">Find Your Store</h4>
                  <p className="text-stone-400 text-sm">Search the directory for your shop listing</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black flex-shrink-0">2</div>
                <div>
                  <h4 className="font-bold text-white">Submit a Claim</h4>
                  <p className="text-stone-400 text-sm">Tell us who you are and how you're connected to the store</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black flex-shrink-0">3</div>
                <div>
                  <h4 className="font-bold text-white">Get Approved</h4>
                  <p className="text-stone-400 text-sm">Our team reviews and approves your ownership claim</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400 font-black flex-shrink-0">4</div>
                <div>
                  <h4 className="font-bold text-white">Manage Your Listing</h4>
                  <p className="text-stone-400 text-sm">Update hours, contact info, and offerings directly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="claim-section" className="py-16 max-w-4xl mx-auto px-4 space-y-8">
        {isAuthenticated ? (
          <>
            {isOwnerOrAdmin && <OwnedStoresSection />}
            <ClaimStoreSection />
          </>
        ) : (
          !isLoading && (
            <div className="bg-white rounded-[32px] border border-stone-200 p-10 shadow-sm text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-stone-900 mb-2">Sign in to Claim Your Store</h3>
              <p className="text-stone-500 font-medium mb-8 max-w-sm mx-auto">
                Create a free account to search for your store, submit an ownership claim, and manage your listing.
              </p>
              <a
                href="/api/login"
                className="inline-block bg-emerald-500 hover:bg-emerald-400 text-white px-10 py-4 rounded-2xl font-black transition shadow-lg shadow-emerald-200"
              >
                Sign In / Register
              </a>
            </div>
          )
        )}
      </section>

      <section className="py-24 max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-stone-900 mb-4 tracking-tight">Elevating the Independent Spirit</h2>
          <p className="text-stone-500 max-w-2xl mx-auto font-medium">We focus exclusively on the shops that keep the culture alive, prioritizing heritage over corporate scaling.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {SERVICES.map((service, idx) => (
            <div key={idx} className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm hover:border-emerald-500 hover:shadow-2xl transition-all duration-500 group">
              <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition duration-300 shadow-inner">{service.icon}</div>
              <h4 className="text-xl font-black text-stone-900 mb-3">{service.title}</h4>
              <p className="text-stone-500 text-sm leading-relaxed font-medium">{service.description}</p>
              <div className="mt-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                  {service.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-emerald-50 py-24 mb-24 rounded-[64px] mx-4 border border-emerald-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -ml-32 -mt-32"></div>
        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6 tracking-tight">Own a Sovereign Shop?</h2>
          <p className="text-lg text-stone-600 mb-8 font-medium">
            Highlight your traditional roots and community impact today. Our platform is designed to respect and elevate sovereign commerce without the interference of corporate standardizing.
          </p>
          <button
            onClick={scrollToClaim}
            className="inline-block bg-stone-900 text-white px-12 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-2xl shadow-stone-900/10"
          >
            Claim Your Store
          </button>
        </div>
      </section>
    </div>
  );
};
