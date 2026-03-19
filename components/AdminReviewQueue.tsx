
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, CreatorPost } from '../types';
import { fetchReviewQueue, adminReviewStore, verifyStore as apiVerifyStore, getAdminClaimsAPI, reviewClaimAPI, fetchAllAdminPosts, moderatePost, fetchAdminVideoReviews, moderateVideoReview, AdminVideoReview } from '../services/api';
import { VerificationBadge } from './VerificationBadge';
import { useAuth } from '../hooks/useAuth';

export const AdminReviewQueue: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<CreatorPost[]>([]);
  const [videoReviews, setVideoReviews] = useState<AdminVideoReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [postNotes, setPostNotes] = useState<Record<number, string>>({});
  const [videoNotes, setVideoNotes] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<'stores' | 'claims' | 'posts' | 'videos'>('stores');
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const BADGE_LABELS: Record<string, string> = {
    explorer: 'Explorer',
    local_scout: 'Local Scout',
    regional_builder: 'Regional Builder',
    cross_region_contributor: 'Cross-Region',
    provincial_connector: 'Provincial Connector',
    bc_culture_guide: 'BC Culture Guide',
    founding_bc_architect: 'Founding Architect',
  };
  const BADGE_COLORS: Record<string, string> = {
    explorer: 'bg-stone-100 text-stone-600',
    local_scout: 'bg-blue-100 text-blue-700',
    regional_builder: 'bg-indigo-100 text-indigo-700',
    cross_region_contributor: 'bg-violet-100 text-violet-700',
    provincial_connector: 'bg-purple-100 text-purple-700',
    bc_culture_guide: 'bg-emerald-100 text-emerald-700',
    founding_bc_architect: 'bg-amber-100 text-amber-700',
  };

  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const [storeData, claimData, postsData, videoData] = await Promise.all([
        fetchReviewQueue(),
        getAdminClaimsAPI(),
        fetchAllAdminPosts(),
        fetchAdminVideoReviews(),
      ]);
      setStores(storeData);
      setClaims(claimData);
      setAllPosts(postsData);
      setVideoReviews(videoData);
      const preloadedNotes: Record<number, string> = {};
      for (const vr of videoData) {
        if (vr.moderationNotes) preloadedNotes[vr.id] = vr.moderationNotes;
      }
      setVideoNotes(preloadedNotes);
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
      const updated = await moderatePost(postId, action, postNotes[postId]);
      setAllPosts(prev => prev.map(p => p.id === postId ? { ...p, status: updated.status, contentTier: updated.contentTier } : p));
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
                {stores.length} stores | {claims.length} claims | {allPosts.length} posts | {videoReviews.length} reviews
              </span>
              <button
                onClick={loadQueue}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/10"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-6">
            <button
              onClick={() => setActiveTab('stores')}
              className={`px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition ${activeTab === 'stores' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Stores ({stores.length})
            </button>
            <button
              onClick={() => setActiveTab('claims')}
              className={`px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition ${activeTab === 'claims' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Claims ({claims.length})
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition ${activeTab === 'posts' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Posts ({allPosts.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-3 md:px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition ${activeTab === 'videos' ? 'bg-white text-stone-900' : 'bg-white/10 text-white hover:bg-white/20'}`}
            >
              Reviews ({videoReviews.length})
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
            allPosts.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-4xl mb-4">📝</div>
                <p className="text-stone-500 font-bold text-lg">No creator posts yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {allPosts.map((post) => {
                  const isPending = post.status === 'pending_moderation';
                  const isPublished = post.status === 'published';
                  const isRejected = post.status === 'rejected';
                  const videoMedia = post.media?.find(m => m.mediaType === 'video');
                  const imageMedia = post.media?.find(m => m.mediaType === 'image');
                  const thumbSrc = videoMedia?.thumbnailUrl || (imageMedia?.cdnUrl);
                  return (
                    <div key={post.id} className={`border rounded-2xl p-6 ${isPending ? 'border-amber-200 bg-amber-50/30' : isRejected ? 'border-red-200 bg-red-50/20' : 'border-stone-200 bg-stone-50/30'}`}>
                      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h4 className="font-black text-stone-900 text-lg">{post.title}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${post.contentTier === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {post.contentTier === 'raw' ? '🔥 Raw' : '✨ Clean'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isPending ? 'bg-amber-200 text-amber-800' : isPublished ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                              {isPending ? '⏳ Pending' : isPublished ? '✅ Published' : '❌ Rejected'}
                            </span>
                          </div>
                          {post.subtitle && (
                            <p className="text-sm text-stone-500 font-medium">{post.subtitle}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap mt-2 text-xs text-stone-400">
                            <span>By: <span className="text-stone-600 font-medium">{post.authorName || 'Unknown'}</span></span>
                            {post.authorBadge && (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${BADGE_COLORS[post.authorBadge] || 'bg-stone-100 text-stone-600'}`}>
                                {BADGE_LABELS[post.authorBadge] || post.authorBadge}
                              </span>
                            )}
                            {post.storeName && <span>| Store: {post.storeName}</span>}
                            <span>| {new Date(post.createdAt).toLocaleDateString()}</span>
                          </div>
                          {post.moderationNotes && (
                            <p className="text-xs text-stone-500 mt-1 italic">Notes: {post.moderationNotes}</p>
                          )}
                        </div>
                        {thumbSrc && (
                          <div className="flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 relative">
                            <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                            {videoMedia && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <span className="text-white text-lg">▶</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {post.bodyText && (
                        <div className="bg-white rounded-xl border border-stone-100 p-4 mb-4 max-h-40 overflow-y-auto">
                          <p className="text-sm text-stone-700 whitespace-pre-wrap">{post.bodyText}</p>
                        </div>
                      )}

                      <div className={`flex flex-col gap-3 pt-4 border-t ${isPending ? 'border-amber-200/50' : 'border-stone-200/50'}`}>
                        <textarea
                          rows={2}
                          placeholder="Admin notes (optional)"
                          value={postNotes[post.id] || ''}
                          onChange={(e) => setPostNotes(prev => ({ ...prev, [post.id]: e.target.value }))}
                          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:outline-none resize-none"
                        />
                        <div className="flex gap-2 flex-wrap">
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
                  );
                })}
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
                {videoReviews.map((vr) => {
                  const isDisapproved = vr.moderationStatus === 'disapproved';
                  const isPlaying = playingVideoId === vr.id;
                  const thumb = vr.thumbnailUrl;
                  return (
                    <div key={vr.id} className={`border rounded-2xl p-6 ${isDisapproved ? 'border-red-200 bg-red-50/20' : 'border-stone-200 bg-stone-50/30'}`}>
                      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <h4 className="font-black text-stone-900 text-lg">{vr.title || 'Video Review'}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${vr.contentRating === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {vr.contentRating === 'raw' ? '🔥 Raw' : '✨ Clean'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${isDisapproved ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}`}>
                              {isDisapproved ? '❌ Disapproved' : '✅ Approved'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400">
                            {vr.reviewerId && (
                              <span className="flex items-center gap-1.5">
                                <span>Reviewer: {vr.reviewerId.slice(0, 8)}…</span>
                                {vr.reviewerBadge && (
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${BADGE_COLORS[vr.reviewerBadge] || 'bg-stone-100 text-stone-600'}`}>
                                    {BADGE_LABELS[vr.reviewerBadge] || vr.reviewerBadge}
                                  </span>
                                )}
                              </span>
                            )}
                            {vr.storeName && (
                              <span>| Store: <Link to={`/store/${vr.storeId}`} className="text-emerald-600 hover:underline font-medium">{vr.storeName}</Link></span>
                            )}
                            {vr.reviewRating && (
                              <span className="flex gap-0.5 text-amber-500">
                                {[1,2,3,4,5].map(i => <span key={i}>{i <= Math.round(vr.reviewRating!) ? '★' : '☆'}</span>)}
                              </span>
                            )}
                            <span>| {new Date(vr.reviewCreatedAt || vr.createdAt).toLocaleDateString()}</span>
                          </div>
                          {vr.moderationNotes && (
                            <p className="text-xs text-stone-500 mt-1 italic">Notes: {vr.moderationNotes}</p>
                          )}
                        </div>
                        {(thumb || vr.embedUrl) && (
                          <div
                            className="flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden border border-stone-200 bg-stone-900 relative cursor-pointer"
                            onClick={() => setPlayingVideoId(isPlaying ? null : vr.id)}
                          >
                            {thumb && !isPlaying && (
                              <>
                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors">
                                  <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                                    <span className="text-stone-900 text-sm ml-0.5">▶</span>
                                  </div>
                                </div>
                              </>
                            )}
                            {(!thumb || isPlaying) && (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-white text-2xl">🎬</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isPlaying && vr.embedUrl && (
                        <div className="mb-4 -mx-6 md:mx-0 md:rounded-xl overflow-hidden bg-stone-900 relative" style={{ aspectRatio: '16/9' }}>
                          <iframe
                            src={vr.embedUrl}
                            className="absolute inset-0 w-full h-full"
                            allow="autoplay; fullscreen"
                            allowFullScreen
                          />
                        </div>
                      )}

                      {vr.reviewText && (
                        <div className="bg-white rounded-xl border border-stone-100 p-4 mb-4">
                          <p className="text-sm text-stone-700 italic">"{vr.reviewText}"</p>
                        </div>
                      )}

                      <div className="flex flex-col gap-3 pt-4 border-t border-stone-200/50">
                        <textarea
                          rows={2}
                          placeholder="Admin notes (optional)"
                          value={videoNotes[vr.id] || ''}
                          onChange={(e) => setVideoNotes(prev => ({ ...prev, [vr.id]: e.target.value }))}
                          className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-emerald-400 focus:outline-none resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          {isDisapproved ? (
                            <button
                              onClick={() => handleVideoModerate(vr.id, { moderationStatus: 'approved' })}
                              disabled={actionInProgress === `video-${vr.id}`}
                              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-500 transition disabled:opacity-50"
                            >
                              Re-approve
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVideoModerate(vr.id, { moderationStatus: 'disapproved' })}
                              disabled={actionInProgress === `video-${vr.id}`}
                              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                            >
                              Disapprove
                            </button>
                          )}
                          {vr.contentRating === 'raw' ? (
                            <button
                              onClick={() => handleVideoModerate(vr.id, { contentRating: 'clean' })}
                              disabled={actionInProgress === `video-${vr.id}`}
                              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-stone-200 text-stone-700 hover:bg-stone-300 transition disabled:opacity-50"
                            >
                              Mark Clean
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVideoModerate(vr.id, { contentRating: 'raw' })}
                              disabled={actionInProgress === `video-${vr.id}`}
                              className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-400 transition disabled:opacity-50"
                            >
                              Mark Raw
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};
