import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminVideoReviews, moderateVideoReview } from '../client/api.ts';
import type { AdminVideoReview } from '../types.ts';

export type { AdminVideoReview };

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

interface AdminVideoPanelProps {
  reviews?: AdminVideoReview[];
  onReviewsChange?: (reviews: AdminVideoReview[]) => void;
}

/**
 * AdminVideoPanel — self-contained video review moderation panel.
 *
 * When `reviews` and `onReviewsChange` are not provided the component manages
 * its own state and fetches directly from the API. Pass them in when you need
 * to share review state with a parent (e.g. for tab counts).
 */
export const AdminVideoPanel: React.FC<AdminVideoPanelProps> = ({
  reviews: externalReviews,
  onReviewsChange,
}) => {
  const [internalReviews, setInternalReviews] = useState<AdminVideoReview[]>([]);
  const [isLoading, setIsLoading] = useState(!externalReviews);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [videoNotes, setVideoNotes] = useState<Record<number, string>>({});
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);

  const videoReviews = externalReviews ?? internalReviews;

  const setVideoReviews = (updater: (prev: AdminVideoReview[]) => AdminVideoReview[]) => {
    const next = updater(videoReviews);
    setInternalReviews(next);
    if (onReviewsChange) {
      onReviewsChange(next);
    }
  };

  const loadReviews = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAdminVideoReviews();
      setInternalReviews(data);
      if (onReviewsChange) {
        onReviewsChange(data);
      }
      const preloaded: Record<number, string> = {};
      for (const vr of data) {
        if (vr.moderationNotes) preloaded[vr.id] = vr.moderationNotes;
      }
      setVideoNotes(preloaded);
    } catch (err) {
      console.error('[AdminVideoPanel] Failed to load video reviews:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!externalReviews) {
      loadReviews();
    } else {
      const preloaded: Record<number, string> = {};
      for (const vr of externalReviews) {
        if (vr.moderationNotes) preloaded[vr.id] = vr.moderationNotes;
      }
      setVideoNotes(preloaded);
    }
  }, []);

  const handleVideoModerate = async (
    id: number,
    data: { moderationStatus?: string; contentRating?: string }
  ) => {
    setActionInProgress(`video-${id}`);
    try {
      const updated = await moderateVideoReview(id, { ...data, moderationNotes: videoNotes[id] });
      setVideoReviews(prev => prev.map(v => (v.id === id ? { ...v, ...updated } : v)));
    } catch (err) {
      console.error('[AdminVideoPanel] Video moderation failed:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="w-8 h-8 animate-spin text-stone-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (videoReviews.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">🎬</div>
        <p className="text-stone-500 font-bold text-lg">No video reviews yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {videoReviews.map((vr) => {
        const isDisapproved = vr.moderationStatus === 'disapproved';
        const isPlaying = playingVideoId === vr.id;
        const thumb = vr.thumbnailUrl;

        return (
          <div
            key={vr.id}
            className={`border rounded-2xl p-6 ${
              isDisapproved
                ? 'border-red-200 bg-red-50/20'
                : 'border-stone-200 bg-stone-50/30'
            }`}
          >
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h4 className="font-black text-stone-900 text-lg">
                    {vr.title || 'Video Review'}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      vr.contentRating === 'raw'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {vr.contentRating === 'raw' ? '🔥 Raw' : '✨ Clean'}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      isDisapproved
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isDisapproved ? '❌ Disapproved' : '✅ Approved'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-stone-400">
                  {vr.reviewerId && (
                    <span className="flex items-center gap-1.5">
                      <span>Reviewer: {vr.reviewerId.slice(0, 8)}…</span>
                      {vr.reviewerBadge && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            BADGE_COLORS[vr.reviewerBadge] || 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {BADGE_LABELS[vr.reviewerBadge] || vr.reviewerBadge}
                        </span>
                      )}
                    </span>
                  )}
                  {vr.storeName && (
                    <span>
                      | Store:{' '}
                      <Link
                        to={`/store/${vr.storeId}`}
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        {vr.storeName}
                      </Link>
                    </span>
                  )}
                  {vr.reviewRating && (
                    <span className="flex gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map(i => (
                        <span key={i}>{i <= Math.round(vr.reviewRating!) ? '★' : '☆'}</span>
                      ))}
                    </span>
                  )}
                  <span>
                    | {new Date(vr.reviewCreatedAt || vr.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {vr.moderationNotes && (
                  <p className="text-xs text-stone-500 mt-1 italic">
                    Notes: {vr.moderationNotes}
                  </p>
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
              <div
                className="mb-4 -mx-6 md:mx-0 md:rounded-xl overflow-hidden bg-stone-900 relative"
                style={{ aspectRatio: '16/9' }}
              >
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
                onChange={e =>
                  setVideoNotes(prev => ({ ...prev, [vr.id]: e.target.value }))
                }
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
  );
};
