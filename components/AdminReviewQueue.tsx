
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, CreatorPost } from '../types';
import { fetchReviewQueue, adminReviewStore, verifyStore as apiVerifyStore, getAdminClaimsAPI, reviewClaimAPI, fetchPendingPosts, moderatePost, fetchAdminVideoReviews, moderateVideoReview, AdminVideoReview } from '../services/api';
import { VerificationBadge } from './VerificationBadge';
import { useAuth } from '../hooks/useAuth';

export const AdminReviewQueue: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [pendingPosts, setPendingPosts] = useState<CreatorPost[]>([]);
  const [videoReviews, setVideoReviews] = useState<AdminVideoReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [postNotes, setPostNotes] = useState<Record<number, string>>({});
  const [videoNotes, setVideoNotes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'stores' | 'claims' | 'posts' | 'videos'>('stores');
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const [storeData, claimData, postsData, videoData] = await Promise.all([
        fetchReviewQueue(),
        getAdminClaimsAPI(),
        fetchPendingPosts(),
        fetchAdminVideoReviews(),
      ]);
      setStores(storeData);
      setClaims(claimData);
      setPendingPosts(postsData);
      setVideoReviews(videoData);
    } catch (err: any) {
      console.error('Failed to load review queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadQueue();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isAdmin]);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Admin Access Required</h2>
        <p className="text-stone-500 font-medium mb-8">Please sign in with an admin account to access the review queue.</p>
        <a href="/api/login" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Sign In
        </a>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">⛔</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Access Denied</h2>
        <p className="text-stone-500 font-medium mb-8">You need admin privileges to access this page.</p>
        <Link to="/" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Back to Directory
        </Link>
      </div>
    );
  }

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

  const handleClaimReview = async (claimId: number, action: 'approve' | 'reject') => {
    setActionInProgress(`claim-${claimId}`);
    try {
      await reviewClaimAPI(claimId, action);
      setClaims(prev => prev.filter(c => c.id !== claimId));
    } catch (err) {
      console.error('Claim review failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePostModerate = async (postId: number, action: 'approve' | 'reject') => {
    setActionInProgress(`post-${postId}`);
    try {
      await moderatePost(postId, action, postNotes[postId]);
      setPendingPosts(prev => prev.filter(p => p.id !== postId));
    } catch (err) {
      console.error('Post moderation failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleVideoModerate = async (id: number, data: { moderationStatus?: string; contentRating?: string }) => {
    setActionInProgress(`video-${id}`);
    try {
      const updated = await moderateVideoReview(id, { ...data, moderationNotes: videoNotes[id] });
      setVideoReviews(prev => prev.map(v => v.id === id ? { ...v, ...updated } : v));
    } catch (err) {
      console.error('Video moderation failed:', err);
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
                Review low-confidence listings, flagged stores, and ownership claims.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-500/20 text-amber-300 px-4 py-2 rounded-xl text-sm font-bold border border-amber-500/30">
                {stores.length} stores | {claims.length} claims | {pendingPosts.length} posts | {videoReviews.length} videos
              </span>
              <button
                onClick={loadQueue}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/10"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'stores' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Store Reviews ({stores.length})
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'claims' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Ownership Claims ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'posts' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Creator Posts ({pendingPosts.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition ${activeTab === 'videos' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Video Reviews ({videoReviews.length})
            </button>
          </div>
        </div>

        <div className="p-6 md:p-10">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <p className="text-stone-400 font-bold">Loading review queue...</p>
            </div>
          ) : activeTab === 'stores' ? (
            stores.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-stone-500 font-bold text-lg">All clear! No stores pending review.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {stores.map((store) => (
                  <div
                    key={store.id}
                    className={`border rounded-2xl p-6 transition-all ${
                      store.flagCount > 0 ? 'border-red-200 bg-red-50/50' : 'border-stone-200 bg-stone-50/50'
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
                        <button onClick={() => handleVerify(store.id)} disabled={actionInProgress === store.id} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition disabled:opacity-50">
                          Re-verify
                        </button>
                        <button onClick={() => handleReview(store.id, 'approve')} disabled={actionInProgress === store.id} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50">
                          Approve
                        </button>
                        <button onClick={() => handleReview(store.id, 'mark_closed')} disabled={actionInProgress === store.id} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-400 transition disabled:opacity-50">
                          Closed
                        </button>
                        <button onClick={() => handleReview(store.id, 'reject')} disabled={actionInProgress === store.id} className="px-4 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'claims' ? (
            claims.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-stone-500 font-bold text-lg">No pending ownership claims.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {claims.map((claim: any) => (
                  <div key={claim.id} className="border border-stone-200 rounded-2xl p-6 bg-stone-50/50">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-stone-900">{claim.storeName || claim.storeId}</h4>
                        <p className="text-sm text-stone-500 mt-1">Claimed by: {claim.userName || 'Unknown'}</p>
                        {claim.message && (
                          <p className="text-sm text-stone-600 mt-2 bg-white p-3 rounded-xl border border-stone-100">"{claim.message}"</p>
                        )}
                        <p className="text-xs text-stone-400 mt-2">Submitted: {new Date(claim.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2 items-start">
                        <button
                          onClick={() => handleClaimReview(claim.id, 'approve')}
                          disabled={actionInProgress === `claim-${claim.id}`}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleClaimReview(claim.id, 'reject')}
                          disabled={actionInProgress === `claim-${claim.id}`}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'posts' ? (
            pendingPosts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">✅</div>
                <p className="text-stone-500 font-bold text-lg">No creator posts pending review.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {pendingPosts.map((post) => (
                  <div key={post.id} className="border border-amber-200 rounded-2xl p-6 bg-amber-50/30">
                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-black text-stone-900 text-lg">{post.title}</h4>
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase">
                            🔥 Raw
                          </span>
                        </div>
                        {post.subtitle && (
                          <p className="text-sm text-stone-500 font-medium">{post.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-stone-400">
                          <span>By: {post.authorName || 'Unknown'}</span>
                          {post.storeName && <span>| Store: {post.storeName}</span>}
                          <span>| {new Date(post.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {post.bodyText && (
                      <div className="bg-white rounded-xl border border-stone-100 p-4 mb-4 max-h-40 overflow-y-auto">
                        <p className="text-sm text-stone-700 whitespace-pre-wrap">{post.bodyText}</p>
                      </div>
                    )}

                    {post.media && post.media.length > 0 && (
                      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                        {post.media.map((m, i) => (
                          <div key={i} className="w-20 h-20 rounded-xl overflow-hidden border border-stone-200 flex-shrink-0 bg-stone-100">
                            {m.mediaType === 'image' ? (
                              <img src={m.cdnUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400 text-xl">🎬</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-3 pt-4 border-t border-amber-200/50">
                      <input
                        type="text"
                        placeholder="Moderation notes (optional)"
                        value={postNotes[post.id] || ''}
                        onChange={(e) => setPostNotes(prev => ({ ...prev, [post.id]: e.target.value }))}
                        className="flex-grow bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handlePostModerate(post.id, 'approve')}
                          disabled={actionInProgress === `post-${post.id}`}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handlePostModerate(post.id, 'reject')}
                          disabled={actionInProgress === `post-${post.id}`}
                          className="px-6 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'videos' ? (
            videoReviews.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">🎬</div>
                <p className="text-stone-500 font-bold text-lg">No video reviews yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {videoReviews.map((vr) => (
                  <div key={vr.id} className={`border rounded-2xl p-6 ${vr.moderationStatus === 'disapproved' ? 'border-red-200 bg-red-50/30' : 'border-stone-200 bg-stone-50/50'}`}>
                    <div className="flex flex-col md:flex-row gap-6">
                      {vr.embedUrl ? (
                        <div className="flex-shrink-0 w-full md:w-64 rounded-xl overflow-hidden bg-stone-900 relative" style={{ aspectRatio: '16/9' }}>
                          <iframe
                            src={vr.embedUrl}
                            className="absolute inset-0 w-full h-full"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      ) : vr.thumbnailUrl ? (
                        <div className="flex-shrink-0 w-full md:w-64 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                          <img src={vr.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-full md:w-64 rounded-xl bg-stone-200 flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
                          <span className="text-stone-400 text-3xl">🎬</span>
                        </div>
                      )}
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <h4 className="font-black text-stone-900">{vr.title || 'Video Review'}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${vr.moderationStatus === 'disapproved' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                            {vr.moderationStatus === 'disapproved' ? 'Disapproved' : 'Approved'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${vr.contentRating === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>
                            {vr.contentRating === 'raw' ? '🔥 Raw' : 'Clean'}
                          </span>
                        </div>
                        {vr.storeName && (
                          <p className="text-sm text-stone-500 mb-1">Store: <Link to={`/store/${vr.storeId}`} className="text-emerald-600 hover:underline">{vr.storeName}</Link></p>
                        )}
                        <p className="text-xs text-stone-400 mb-3">{new Date(vr.createdAt).toLocaleDateString()}</p>

                        <div className="flex flex-col gap-3">
                          <input
                            type="text"
                            placeholder="Moderation notes (optional)"
                            value={videoNotes[vr.id] || ''}
                            onChange={(e) => setVideoNotes(prev => ({ ...prev, [vr.id]: e.target.value }))}
                            className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:outline-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            {vr.moderationStatus === 'disapproved' ? (
                              <button
                                onClick={() => handleVideoModerate(vr.id, { moderationStatus: 'approved' })}
                                disabled={actionInProgress === `video-${vr.id}`}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                              >
                                Re-approve
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVideoModerate(vr.id, { moderationStatus: 'disapproved' })}
                                disabled={actionInProgress === `video-${vr.id}`}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                              >
                                Disapprove
                              </button>
                            )}
                            {vr.contentRating === 'raw' ? (
                              <button
                                onClick={() => handleVideoModerate(vr.id, { contentRating: 'clean' })}
                                disabled={actionInProgress === `video-${vr.id}`}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-200 text-stone-700 hover:bg-stone-300 transition disabled:opacity-50"
                              >
                                Mark Clean
                              </button>
                            ) : (
                              <button
                                onClick={() => handleVideoModerate(vr.id, { contentRating: 'raw' })}
                                disabled={actionInProgress === `video-${vr.id}`}
                                className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-400 transition disabled:opacity-50"
                              >
                                Mark Raw
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
