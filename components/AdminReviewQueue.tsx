
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store } from '../types';
import { fetchReviewQueue, adminReviewStore, verifyStore as apiVerifyStore } from '../services/api';
import { VerificationBadge } from './VerificationBadge';

export const AdminReviewQueue: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const data = await fetchReviewQueue();
      setStores(data);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleReview = async (id: string, action: 'approve' | 'reject' | 'mark_closed') => {
    setActionInProgress(id);
    try {
      await adminReviewStore(id, action, notes[id]);
      setStores(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Review action failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleVerify = async (id: string) => {
    setActionInProgress(id);
    try {
      const result = await apiVerifyStore(id);
      setStores(prev => prev.map(s => s.id === id ? result.store : s));
    } catch (err) {
      console.error('Verification failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] border border-stone-200 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-900 p-10 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <h2 className="text-3xl font-black mb-2 tracking-tight">Admin Review Queue</h2>
              <p className="text-stone-300 font-medium">
                Review low-confidence and flagged listings before they appear as verified.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-500/20 text-amber-300 px-4 py-2 rounded-xl text-sm font-bold border border-amber-500/30">
                {stores.length} pending review
              </span>
              <button
                onClick={loadQueue}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/10"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <p className="text-stone-400 font-bold">Loading review queue...</p>
            </div>
          ) : stores.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-stone-500 font-bold text-lg">All clear! No stores pending review.</p>
              <p className="text-stone-400 text-sm mt-2">Check back after running the Discovery Engine.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className={`border rounded-2xl p-6 transition-all ${
                    store.flagCount > 0
                      ? 'border-red-200 bg-red-50/50'
                      : 'border-stone-200 bg-stone-50/50'
                  }`}
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Link to={`/store/${store.id}`} className="text-lg font-black text-stone-900 hover:text-emerald-600 transition">
                          {store.name}
                        </Link>
                        <VerificationBadge status={store.verificationStatus} confidenceScore={store.confidenceScore} compact />
                        {store.flagCount > 0 && (
                          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                            {store.flagCount} flag{store.flagCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500">{store.address}, {store.province}</p>
                      <p className="text-xs text-stone-400 mt-1">
                        Type: {store.type} | Confidence: {Math.round(store.confidenceScore * 100)}% | Evidence: {store.evidenceCount} source{store.evidenceCount !== 1 ? 's' : ''}
                      </p>
                      {store.evidenceSources && store.evidenceSources.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {store.evidenceSources.map((src, i) => (
                            <span key={i} className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">
                              {src.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-xs text-stone-400">
                        <span>Places Match:</span>
                        <span className={`font-bold ${store.placesApiMatch ? 'text-emerald-600' : 'text-red-500'}`}>
                          {store.placesApiMatch ? 'Yes' : 'No'}
                        </span>
                      </div>
                      {store.website && (
                        <a href={store.website.startsWith('http') ? store.website : `https://${store.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[200px]">
                          {store.website}
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3 mt-4 pt-4 border-t border-stone-200/50">
                    <input
                      type="text"
                      placeholder="Admin notes (optional)"
                      value={notes[store.id] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [store.id]: e.target.value }))}
                      className="flex-grow bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVerify(store.id)}
                        disabled={actionInProgress === store.id}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition disabled:opacity-50"
                      >
                        Re-verify
                      </button>
                      <button
                        onClick={() => handleReview(store.id, 'approve')}
                        disabled={actionInProgress === store.id}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(store.id, 'mark_closed')}
                        disabled={actionInProgress === store.id}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-400 transition disabled:opacity-50"
                      >
                        Closed
                      </button>
                      <button
                        onClick={() => handleReview(store.id, 'reject')}
                        disabled={actionInProgress === store.id}
                        className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
