
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createClaimAPI, getUserClaimsAPI, getOwnedStoresAPI, updateOwnedStoreAPI } from '../services/api';
import type { Store } from '../types';

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
  const [storeId, setStoreId] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [claims, setClaims] = useState<any[]>([]);

  useEffect(() => {
    getUserClaimsAPI().then(setClaims).catch(() => {});
  }, []);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId.trim()) { setError('Please enter a store ID'); return; }
    setIsSubmitting(true);
    setError('');
    try {
      await createClaimAPI(storeId.trim(), message.trim() || undefined);
      setSuccess(true);
      setStoreId('');
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
      <h3 className="text-xl font-black text-stone-900 mb-4">Claim Your Store</h3>
      <p className="text-stone-500 text-sm mb-6 font-medium">
        Find your store in our directory, copy its ID from the URL, and submit your claim. Our admin team will review and approve ownership.
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
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Store ID</label>
          <input
            type="text"
            value={storeId}
            onChange={e => setStoreId(e.target.value)}
            placeholder="Paste the store ID from the listing URL"
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
          />
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
          disabled={isSubmitting}
          className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Claim'}
        </button>
      </form>

      {claims.length > 0 && (
        <div className="mt-8">
          <h4 className="text-sm font-black uppercase tracking-widest text-stone-500 mb-3">Your Claims</h4>
          <div className="space-y-2">
            {claims.map((claim: any) => (
              <div key={claim.id} className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-3 border border-stone-100">
                <span className="text-sm font-medium text-stone-700 truncate">{claim.storeId}</span>
                <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
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

const OwnedStoresSection: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOwnedStoresAPI().then(setStores).catch(() => {});
  }, []);

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
              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editData.phone ?? store.phone ?? ''}
                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Website</label>
                  <input
                    type="text"
                    value={editData.website ?? store.website ?? ''}
                    onChange={e => setEditData({ ...editData, website: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">Address</label>
                  <input
                    type="text"
                    value={editData.address ?? store.address ?? ''}
                    onChange={e => setEditData({ ...editData, address: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm focus:border-emerald-400 outline-none"
                  />
                </div>
                <div className="flex gap-2">
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
                  {store.website && <a href={store.website} target="_blank" rel="noopener" className="text-emerald-600 hover:underline">{store.website}</a>}
                </div>
                <button
                  onClick={() => { setEditing(store.id); setEditData({}); }}
                  className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition"
                >
                  Edit Store Info
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export const OwnerPortal: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin';

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
              {!isLoading && !isAuthenticated ? (
                <a href="/api/login" className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/40 text-center">
                  Sign In to Claim Your Shop
                </a>
              ) : (
                <a href="#claim-section" className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/40 text-center">
                  Claim Your Shop
                </a>
              )}
              <Link to="/" className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold transition border border-white/20 backdrop-blur-md text-center">
                Browse Directory
              </Link>
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

      {isAuthenticated && (
        <section id="claim-section" className="py-16 max-w-4xl mx-auto px-4 space-y-8">
          {isOwnerOrAdmin && <OwnedStoresSection />}
          <ClaimStoreSection />
        </section>
      )}

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
          {!isAuthenticated ? (
            <a href="/api/login" className="inline-block bg-stone-900 text-white px-12 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-2xl shadow-stone-900/10">
              Sign In to Start Your Claim
            </a>
          ) : (
            <a href="#claim-section" className="inline-block bg-stone-900 text-white px-12 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-2xl shadow-stone-900/10">
              Start Your Claim
            </a>
          )}
        </div>
      </section>
    </div>
  );
};
