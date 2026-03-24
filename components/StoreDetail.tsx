
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, Review, StoreMedia, CreatorPost } from '../types';
import { getStoreInsights } from '../services/geminiService';
import { saveStoreInsights, fetchStoreMedia, fetchStoreReviews, fetchIntegrityScore, submitReview, fetchPublishedPosts, fetchStore } from '../services/api';
import type { WeightedReview, IntegrityScoreCard } from '../services/api';
import { VerificationBadge } from './VerificationBadge';
import { EvidencePanel } from './EvidencePanel';
import { FlagButton } from './FlagButton';
import { MediaGallery } from './MediaGallery';
import { VideoRecorder } from './VideoRecorder';
import { VideoUploader } from './VideoUploader';
import { IntegrityCard } from './IntegrityCard';
import { BadgeIcon } from './BadgeIcon';
import { PresenceCheckin } from './PresenceCheckin';
import { useAuth } from '../hooks/useAuth';
import { getStoreHeaderImage } from '../utils/defaultStoreImages';

interface StoreDetailProps {
  stores: Store[];
  onUpdateStore: (store: Store) => void;
}

interface RawContentThumbnailProps {
  embedUrl: string;
  thumbnailUrl: string | null;
  contentRating: string;
  onPlay: (url: string) => void;
}

const RawContentThumbnail: React.FC<RawContentThumbnailProps> = ({ embedUrl, thumbnailUrl, contentRating, onPlay }) => {
  const [revealed, setRevealed] = useState(false);
  const isRaw = contentRating === 'raw';

  if (isRaw && !revealed) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden cursor-pointer"
        style={{ aspectRatio: '9/16' }}
        onClick={() => setRevealed(true)}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Video review thumbnail"
            className="w-full h-full object-cover blur-xl scale-110"
          />
        ) : (
          <div className="w-full h-full bg-stone-800" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-2">
          <span className="text-2xl">🔞</span>
          <span className="text-white font-black text-sm">Sensitive Content</span>
          <span className="text-white/70 text-xs">Tap to view</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onPlay(embedUrl)}
      className="relative w-full rounded-2xl overflow-hidden group block"
      style={{ aspectRatio: '9/16' }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Video review thumbnail"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-stone-900 flex items-center justify-center">
          <svg className="w-10 h-10 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35 transition">
        <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <svg className="w-5 h-5 text-stone-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </button>
  );
};

interface InsightsData {
  atmosphere?: string;
  community?: string;
  specialties?: string;
  sovereignty?: string;
  proTip?: string;
  hours?: { day: string; time: string }[];
}

export const StoreDetail: React.FC<StoreDetailProps> = ({ stores, onUpdateStore }) => {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isOwner: isOwnerOrAdmin, isAdmin, isCreator } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  
  const [newReview, setNewReview] = useState({ userName: '', rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const [storeMedia, setStoreMedia] = useState<StoreMedia[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [showVideoUploader, setShowVideoUploader] = useState(false);
  const [weightedReviews, setWeightedReviews] = useState<WeightedReview[]>([]);
  const [integrityScore, setIntegrityScore] = useState<IntegrityScoreCard | null>(null);
  const [isLoadingIntegrity, setIsLoadingIntegrity] = useState(false);
  const [reviewVideoMode, setReviewVideoMode] = useState<'none' | 'recorder' | 'uploader'>('none');
  const [reviewVideoAssetId, setReviewVideoAssetId] = useState<number | undefined>(undefined);
  const [storePosts, setStorePosts] = useState<CreatorPost[]>([]);
  const [activeTab, setActiveTab] = useState<'reviews' | 'posts'>('reviews');
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; index: number } | null>(null);

  const hasCachedInsights = (s: Store | null): boolean => {
    if (!s?.storeInsights) return false;
    return Object.values(s.storeInsights).some(v => v != null && v !== '');
  };

  useEffect(() => {
    const found = stores.find(s => s.id === id);
    if (found) {
      setStore(found);
      if (hasCachedInsights(found)) {
        setInsights({ ...found.storeInsights!, hours: found.hours });
      } else if (found.hours && !insights) {
        setInsights(prev => prev ? prev : { hours: found.hours });
      }
    }
  }, [id, stores]);

  useEffect(() => {
    if (!id) return;
    fetchStore(id)
      .then(fresh => {
        setStore(fresh);
        if (onUpdateStore) onUpdateStore(fresh);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (store && !hasCachedInsights(store) && !insights?.atmosphere) {
      fetchInsights();
    }
  }, [store]);

  useEffect(() => {
    if (!id) return;
    setIsLoadingMedia(true);
    fetchStoreMedia(id)
      .then(setStoreMedia)
      .catch(() => setStoreMedia([]))
      .finally(() => setIsLoadingMedia(false));

    fetchStoreReviews(id)
      .then(setWeightedReviews)
      .catch(() => setWeightedReviews([]));

    fetchPublishedPosts({ storeId: id, limit: 5 })
      .then(result => setStorePosts(result.posts))
      .catch(() => setStorePosts([]));

    setIsLoadingIntegrity(true);
    fetchIntegrityScore(id)
      .then(setIntegrityScore)
      .catch(() => setIntegrityScore(null))
      .finally(() => setIsLoadingIntegrity(false));
  }, [id]);

  const loadMedia = () => {
    if (!id) return;
    fetchStoreMedia(id).then(setStoreMedia).catch(() => {});
  };

  const detailHeaderUrl = store ? getStoreHeaderImage(store.id, store.headerImageUrl) : '';

  useEffect(() => {
    if (!store) return;

    const scriptId = `schema-ld-${store.id}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const hoursToUse = Array.isArray(insights?.hours) ? insights?.hours : (Array.isArray(store.hours) ? store.hours : []);

    const readyVideos = storeMedia.filter(m => m.status === 'ready' && m.embedUrl);

    const videoObjects = readyVideos.map(media => ({
      "@type": "VideoObject" as const,
      "name": media.title,
      "thumbnailUrl": media.thumbnailUrl || undefined,
      "embedUrl": media.embedUrl || undefined,
      "uploadDate": media.createdAt,
      "duration": media.durationSeconds ? `PT${media.durationSeconds}S` : undefined
    }));

    const schemaData: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "Store",
      "name": store.name,
      "description": `${store.type} cannabis store in ${store.province}, Canada.`,
      "image": detailHeaderUrl,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": store.address,
        "addressRegion": store.province,
        "addressCountry": "CA"
      },
      "url": store.website || window.location.href,
      "telephone": store.phone,
      "aggregateRating": store.rating ? {
        "@type": "AggregateRating",
        "ratingValue": store.rating,
        "reviewCount": store.reviews?.length || 1
      } : undefined,
      "openingHoursSpecification": hoursToUse.map(h => {
        const parts = h.time.split(' - ');
        const opens = parts[0] || "09:00";
        const closes = parts[1] || "21:00";
        return {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": h.day,
          "opens": opens,
          "closes": closes
        };
      })
    };

    if (videoObjects.length > 0) {
      schemaData["video"] = videoObjects;
    }

    script.text = JSON.stringify(schemaData);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [store, insights, detailHeaderUrl, storeMedia]);

  const fetchInsights = async () => {
    if (!store) return;
    setIsLoadingInsights(true);
    try {
      const data = await getStoreInsights(store.name);
      setInsights(data);
      
      const insightsToSave: Record<string, any> = {};
      if (data.atmosphere) insightsToSave.atmosphere = data.atmosphere;
      if (data.community) insightsToSave.community = data.community;
      if (data.specialties) insightsToSave.specialties = data.specialties;
      if (data.sovereignty) insightsToSave.sovereignty = data.sovereignty;
      if (data.proTip) insightsToSave.proTip = data.proTip;

      const newHours = Array.isArray(data.hours) && JSON.stringify(data.hours) !== JSON.stringify(store.hours)
        ? data.hours : undefined;

      try {
        const saved = await saveStoreInsights(store.id, insightsToSave, newHours);
        onUpdateStore(saved);
      } catch (saveErr) {
        console.error("Failed to cache insights", saveErr);
      }
    } catch (err) {
      console.error("Failed to load insights", err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !newReview.comment) return;

    setIsSubmittingReview(true);
    try {
      const weightedReview = await submitReview(store.id, {
        rating: newReview.rating,
        contentText: newReview.comment,
        videoAssetId: reviewVideoAssetId,
      });
      setWeightedReviews(prev => [weightedReview, ...prev]);

      if (id) {
        fetchIntegrityScore(id)
          .then(setIntegrityScore)
          .catch(() => {});
      }

      setNewReview({ userName: '', rating: 5, comment: '' });
      setReviewVideoAssetId(undefined);
      setReviewVideoMode('none');
      setShowReviewForm(false);
    } catch (err) {
      const review: Review = {
        id: Math.random().toString(36).substr(2, 9),
        ...newReview,
        date: new Date().toISOString().split('T')[0]
      };

      const updatedReviews = [review, ...(store.reviews || [])];
      const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = parseFloat((totalRating / updatedReviews.length).toFixed(1));

      const updatedStore = {
        ...store,
        reviews: updatedReviews,
        rating: avgRating
      };

      onUpdateStore(updatedStore);
      setNewReview({ userName: '', rating: 5, comment: '' });
      setReviewVideoAssetId(undefined);
      setReviewVideoMode('none');
      setShowReviewForm(false);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (!store) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-stone-800">Store Not Found</h2>
        <p className="text-stone-500 mb-8">We couldn't find the dispensary you were looking for.</p>
        <Link to="/" className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-500 transition">
          Back to Directory
        </Link>
      </div>
    );
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store.name}, ${store.address}, ${store.province}, Canada`)}`;
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const hoursList = Array.isArray(insights?.hours) ? insights?.hours : (Array.isArray(store.hours) ? store.hours : null);

  return (
    <div className="bg-stone-50 min-h-screen pb-24 overflow-x-hidden">
      <div className="relative overflow-hidden">
        <img 
          src={detailHeaderUrl} 
          alt={store.name} 
          className={`absolute inset-0 w-full h-full object-cover ${store.verificationStatus === 'historically_closed' ? 'grayscale' : ''}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/1600x600/065f46/ffffff?text=${encodeURIComponent(store.name)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent"></div>
        <div className="relative pt-32 md:pt-48 pb-8 md:pb-12 px-4 md:px-12">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="text-white">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest shadow-lg ${store.type === 'Sovereign' ? 'bg-purple-600' : 'bg-emerald-600'}`}>
                  {store.type}
                </span>
                <VerificationBadge 
                  status={store.verificationStatus} 
                  confidenceScore={store.confidenceScore}
                />
                {store.isClaimed && (
                  <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 01-2.812 2.812c.051.64.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"></path></svg>
                    Claimed
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-6xl font-black mb-2 tracking-tight leading-tight">{store.name}</h1>
              <p className="text-base md:text-xl text-stone-300 flex items-start gap-2">
                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {store.address}, {store.province}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {store.website && (
                <a 
                  href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold hover:bg-emerald-500 transition shadow-xl flex items-center justify-center gap-2 text-sm md:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                  Visit Website
                </a>
              )}
              <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-stone-900 px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold hover:bg-stone-100 transition shadow-xl flex items-center justify-center gap-2 text-sm md:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 10V7"></path></svg>
                Get Directions
              </a>
              {!store.isClaimed && (
                <Link to="/owners" className="bg-emerald-600 text-white px-6 py-3 md:px-8 md:py-4 rounded-2xl font-bold hover:bg-emerald-500 transition shadow-xl shadow-emerald-900/40 text-sm md:text-base">
                  Claim Listing
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 grid lg:grid-cols-3 gap-8 lg:gap-12 overflow-x-hidden">
        <div className="lg:col-span-2 space-y-12 min-w-0">
          {store.verificationStatus === 'ai_suggested' && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-amber-800 mb-1">Unverified Listing</h3>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    This listing was AI-suggested and has not been independently verified. It may not exist in the real world. 
                    Information shown may be inaccurate. If you have knowledge about this location, please help us verify it using the report button below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {store.verificationStatus === 'historically_closed' && (
            <div className="bg-stone-100 border-2 border-stone-300 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🕐</span>
                <div>
                  <h3 className="font-bold text-stone-800 mb-1">Historically Closed</h3>
                  <p className="text-stone-600 text-sm leading-relaxed">
                    This location has been marked as historically closed. It may have been operational in the past but is no longer active.
                  </p>
                </div>
              </div>
            </div>
          )}

          <EvidencePanel
            sources={store.evidenceSources || []}
            confidenceScore={store.confidenceScore || 0}
            placesApiMatch={store.placesApiMatch || false}
          />

          <section>
            <h2 className="text-2xl font-extrabold text-stone-900 mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-emerald-600 rounded-full"></span>
              Featured Selection
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {store.featuredOfferings?.map((item, idx) => (
                <div key={idx} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex items-center justify-between">
                  <span className="font-bold text-stone-800">{item}</span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">In Stock</span>
                </div>
              ))}
              {(!store.featuredOfferings || store.featuredOfferings.length === 0) && (
                <p className="text-stone-400 italic">No specific offerings highlighted yet.</p>
              )}
            </div>
          </section>

          {insights && (
            <section className="bg-white rounded-[40px] p-8 md:p-12 border border-stone-200 shadow-sm">
              <h2 className="text-2xl font-black text-stone-900 mb-8 tracking-tight">Store Attributes</h2>
              <div className="grid md:grid-cols-2 gap-8">
                {insights.atmosphere && (
                  <div>
                    <h4 className="font-bold text-stone-400 uppercase text-xs tracking-widest mb-2">Vibe</h4>
                    <p className="text-stone-700 leading-relaxed">{insights.atmosphere}</p>
                  </div>
                )}
                {insights.specialties && (
                  <div>
                    <h4 className="font-bold text-stone-400 uppercase text-xs tracking-widest mb-2">Specialties</h4>
                    <p className="text-stone-700 leading-relaxed">{insights.specialties}</p>
                  </div>
                )}
                {insights.community && (
                  <div className="md:col-span-2">
                    <h4 className="font-bold text-stone-400 uppercase text-xs tracking-widest mb-2">Community Impact</h4>
                    <p className="text-stone-700 leading-relaxed">{insights.community}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {store.storePhotos && store.storePhotos.length > 0 && (
            <section>
              <h2 className="text-2xl font-extrabold text-stone-900 mb-6 flex items-center gap-2">
                <span className="w-2 h-8 bg-emerald-600 rounded-full"></span>
                Inside the Store
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {store.storePhotos.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxPhoto({ url, index: i })}
                    className="group aspect-square rounded-2xl overflow-hidden border border-stone-200 hover:shadow-lg transition-shadow"
                  >
                    <img
                      src={url}
                      alt={`${store.name} interior photo ${i + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-1 border-b border-stone-200 mb-8">
            {[
              { key: 'reviews' as const, label: 'Reviews', count: weightedReviews.length },
              { key: 'posts' as const, label: 'Community Posts', count: storeMedia.length + storePosts.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 font-bold text-sm border-b-2 transition-all ${
                  activeTab === tab.key
                    ? 'border-emerald-500 text-emerald-700'
                    : 'border-transparent text-stone-400 hover:text-stone-600'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'posts' && (
            <section className="space-y-12">
              <div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                  <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
                    <span className="w-2 h-8 bg-emerald-600 rounded-full"></span>
                    Community Posts
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {isAuthenticated && (
                      <button
                        onClick={() => setShowVideoRecorder(true)}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10 flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Share Your Experience
                      </button>
                    )}
                    {isOwnerOrAdmin && (
                      <button
                        onClick={() => setShowVideoUploader(true)}
                        className="bg-stone-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-700 transition shadow-lg flex items-center gap-2 text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload Video
                      </button>
                    )}
                  </div>
                </div>
                {storePosts.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    {storePosts.map(post => {
                      const heroImage = post.media?.find(m => m.mediaType === 'image');
                      const heroVideo = post.media?.find(m => m.mediaType === 'video');
                      const videoThumb = heroVideo?.thumbnailUrl;
                      return (
                        <Link
                          key={post.id}
                          to={`/posts/${post.id}`}
                          className="group bg-white rounded-2xl border border-stone-200 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col"
                        >
                          {heroImage ? (
                            <div className="aspect-[16/10] overflow-hidden bg-stone-100">
                              <img src={heroImage.cdnUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            </div>
                          ) : videoThumb ? (
                            <div className="aspect-[16/10] overflow-hidden bg-stone-900 relative">
                              <img src={videoThumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                  <span className="text-stone-900 text-lg ml-1">▶</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-stone-50 flex items-center justify-center">
                              <span className="text-5xl opacity-30">📝</span>
                            </div>
                          )}
                          <div className="p-4 flex-grow flex flex-col">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                post.contentTier === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {post.contentTier === 'raw' ? '🔥 Raw' : '✨ Clean'}
                              </span>
                            </div>
                            <h4 className="font-black text-stone-900 text-base leading-tight mb-1 group-hover:text-emerald-600 transition-colors">{post.title}</h4>
                            {post.subtitle && <p className="text-stone-500 text-sm font-medium mb-1">{post.subtitle}</p>}
                            {post.bodyText && <p className="text-stone-400 text-sm line-clamp-2 mb-2">{post.bodyText}</p>}
                            <div className="flex items-center gap-2 mt-auto pt-3 border-t border-stone-100">
                              {post.authorImageUrl ? (
                                <img src={post.authorImageUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">
                                  {(post.authorHandle?.[0] || post.authorName?.[0] || 'A').toUpperCase()}
                                </div>
                              )}
                              {post.authorHandle ? (
                                <Link
                                  to={`/profile/${post.authorHandle}`}
                                  className="text-xs font-bold text-emerald-600 hover:text-emerald-500 truncate transition-colors"
                                  onClick={e => e.stopPropagation()}
                                >
                                  @{post.authorHandle}
                                </Link>
                              ) : (
                                <span className="text-xs text-stone-400 truncate">{post.authorName || 'Anonymous'}</span>
                              )}
                              <span className="text-[10px] text-stone-400 ml-auto flex-shrink-0">{new Date(post.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                <MediaGallery media={storeMedia} isLoading={isLoadingMedia} isAuthenticated={isAuthenticated} hideEmptyState={storePosts.length > 0} />
              </div>
            </section>
          )}

          {activeTab === 'reviews' && (
          <section id="reviews">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                Community Reviews
              </h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => { setShowReviewForm(true); setReviewVideoMode('recorder'); }}
                  className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10 flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Share Your Experience
                </button>
                <button
                  onClick={() => { setShowReviewForm(true); setReviewVideoMode('uploader'); }}
                  className="bg-stone-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-stone-700 transition shadow-lg flex items-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Video
                </button>
                {showReviewForm && (
                  <button
                    onClick={() => { setShowReviewForm(false); setReviewVideoMode('none'); }}
                    className="text-stone-500 px-5 py-2.5 rounded-xl font-bold hover:text-stone-700 border border-stone-200 hover:bg-stone-50 transition text-sm"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {showReviewForm && (
              <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm mb-12 animate-fade-in">
                {!isAuthenticated ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-stone-900 mb-2">Sign In to Submit a Review</h3>
                    <p className="text-stone-500 text-sm mb-6 max-w-xs mx-auto">Create an account or sign in to share your experience and help the community.</p>
                    <a
                      href="#/auth"
                      className="inline-block bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20"
                    >
                      Sign In to Submit Review
                    </a>
                  </div>
                ) : (
                <form onSubmit={handleAddReview} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Your Name</label>
                      <input 
                        type="text" 
                        required
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                        placeholder="John Doe"
                        value={newReview.userName}
                        onChange={e => setNewReview({...newReview, userName: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewReview({...newReview, rating: star})}
                            className={`text-2xl transition-transform hover:scale-125 ${star <= newReview.rating ? 'text-amber-400' : 'text-stone-200'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Your Experience</label>
                    <textarea 
                      required
                      rows={4}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
                      placeholder="Share your thoughts on products, service, or atmosphere..."
                      value={newReview.comment}
                      onChange={e => setNewReview({...newReview, comment: e.target.value})}
                    />
                  </div>
                  {isAuthenticated && (
                    <div>
                      <label className="block text-sm font-bold text-stone-700 mb-2 uppercase tracking-wider">Attach Video (Optional)</label>
                      {reviewVideoAssetId ? (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                          <svg className="w-5 h-5 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-emerald-700 font-medium">Video attached — earns +0.2 trust weight</span>
                          <button
                            type="button"
                            onClick={() => setReviewVideoAssetId(undefined)}
                            className="ml-auto text-stone-400 hover:text-red-500 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setReviewVideoMode('recorder')}
                            className="flex items-center gap-2 bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-purple-100 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Record Video
                          </button>
                          <button
                            type="button"
                            onClick={() => setReviewVideoMode('uploader')}
                            className="flex items-center gap-2 bg-stone-50 text-stone-700 border border-stone-200 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-100 transition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Upload File
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button 
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isSubmittingReview ? 'Posting...' : reviewVideoAssetId ? 'Post Video Review' : 'Post Review'}
                  </button>
                </form>
                )}
              </div>
            )}

            <div className="space-y-6">
              {weightedReviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {weightedReviews.map(wr => (
                    <div key={`wr-${wr.id}`} className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden flex flex-col">
                      {wr.embedUrl ? (
                        <RawContentThumbnail
                          embedUrl={wr.embedUrl}
                          thumbnailUrl={wr.thumbnailUrl ?? null}
                          contentRating={wr.contentRating ?? 'clean'}
                          onPlay={setVideoModalUrl}
                        />
                      ) : (
                        <div className="relative w-full bg-gradient-to-br from-stone-800 to-stone-900 flex flex-col items-center justify-center p-4" style={{ aspectRatio: '9/16' }}>
                          {wr.reviewerHandle ? (
                            <Link to={`/profile/${wr.reviewerHandle}`} className="mb-3 flex-shrink-0">
                              {wr.reviewerAvatarUrl ? (
                                <img src={wr.reviewerAvatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400/60 hover:border-emerald-400 transition-colors" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center hover:bg-emerald-500/30 transition-colors">
                                  <span className="text-emerald-300 font-black text-base">{wr.reviewerHandle[0].toUpperCase()}</span>
                                </div>
                              )}
                            </Link>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-3 flex-shrink-0">
                              <span className="text-emerald-300 font-black text-base">{wr.userId?.charAt(0)?.toUpperCase() || 'U'}</span>
                            </div>
                          )}
                          <div className="flex gap-0.5 text-amber-400 text-sm mb-3">
                            {[...Array(5)].map((_, i) => (
                              <span key={i}>{i < wr.rating ? '★' : '☆'}</span>
                            ))}
                          </div>
                          {wr.contentText && (
                            <p className="text-white/80 text-xs leading-relaxed italic text-center overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical' }}>
                              "{wr.contentText}"
                            </p>
                          )}
                        </div>
                      )}
                      <div className="p-3 flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {wr.embedUrl && (
                            <div className="flex gap-0.5 text-xs text-amber-500">
                              {[...Array(5)].map((_, i) => (
                                <span key={i}>{i < wr.rating ? '★' : '☆'}</span>
                              ))}
                            </div>
                          )}
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            {((wr.trustWeight?.final ?? 0) * 100).toFixed(0)}%
                            {wr.trustWeight?.scoutBonus > 0 && <span className="text-blue-600">⚡</span>}
                          </span>
                          {wr.reviewerBadges?.slice(0, 2).map(b => (
                            <BadgeIcon key={b.badgeType} badgeType={b.badgeType as any} size="sm" showLabel={false} />
                          ))}
                        </div>
                        {wr.embedUrl && wr.contentText && (
                          <p className="text-stone-500 text-[11px] leading-snug italic overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                            "{wr.contentText}"
                          </p>
                        )}
                        {wr.reviewerHandle ? (
                          <Link
                            to={`/profile/${wr.reviewerHandle}`}
                            className="text-[10px] text-emerald-600 hover:text-emerald-500 font-bold truncate transition-colors"
                          >
                            @{wr.reviewerHandle}
                          </Link>
                        ) : null}
                        <span className="text-[10px] text-stone-400 mt-auto pt-0.5">
                          {new Date(wr.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {store.reviews && store.reviews.length > 0 ? (
                store.reviews.map(review => (
                  <div key={review.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-lg">
                        {review.userName.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <div>
                          <h4 className="font-bold text-stone-900">{review.userName}</h4>
                          <div className="flex gap-1 text-sm text-amber-500">
                            {[...Array(5)].map((_, i) => (
                              <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs font-medium text-stone-400 uppercase tracking-widest">{review.date}</span>
                      </div>
                      <p className="text-stone-600 leading-relaxed italic">"{review.comment}"</p>
                    </div>
                  </div>
                ))
              ) : weightedReviews.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 border-dashed">
                  <p className="text-stone-400 italic">No reviews yet. Be the first to share your experience!</p>
                </div>
              ) : null}
            </div>
          </section>
          )}
        </div>

        <div className="space-y-8 min-w-0">
          <IntegrityCard score={integrityScore} isLoading={isLoadingIntegrity} />

          <PresenceCheckin storeId={store.id} storeName={store.name} />

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="text-lg font-black text-stone-900 mb-6 uppercase tracking-wider">Information</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Rating</span>
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  ★ {store.rating || '4.0'}
                  <span className="text-[10px] text-stone-400 font-normal ml-1">({store.reviews?.length || 0} reviews)</span>
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Province</span>
                <span className="font-bold text-stone-800">{store.province}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Verification</span>
                <VerificationBadge 
                  status={store.verificationStatus} 
                  confidenceScore={store.confidenceScore} 
                  compact 
                />
              </div>
              {store.sourceUrl && (
                <div className="flex justify-between items-center py-3 border-b border-stone-100">
                  <span className="text-stone-500 font-medium">Data Source</span>
                  <a href={store.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-bold hover:underline truncate max-w-[150px]">
                    {(() => { try { return new URL(store.sourceUrl).hostname; } catch { return 'Source'; } })()}
                  </a>
                </div>
              )}
            </div>
            
            <div className="mt-8 space-y-3">
              {store.website && (
                <a 
                  href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10"
                >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                   Visit Official Site
                </a>
              )}
              
              <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full border-2 border-stone-200 text-stone-600 py-4 rounded-xl font-bold hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Get Directions
              </a>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="text-lg font-black text-stone-900 mb-6 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Operating Hours
            </h3>
            
            {isLoadingInsights ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="h-3 bg-stone-100 rounded w-16"></div>
                    <div className="h-3 bg-stone-100 rounded w-24"></div>
                  </div>
                ))}
              </div>
            ) : hoursList ? (
              <div className="space-y-3">
                {hoursList.map((item, idx) => (
                  <div key={idx} className={`flex justify-between text-sm ${item.day === currentDay ? 'font-black text-emerald-600' : 'text-stone-600'}`}>
                    <span>{item.day}</span>
                    <span className="font-medium">{item.time}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-stone-400 italic">Hours not verified. Please contact store directly.</p>
            )}
          </div>

          <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
            <h3 className="text-lg font-black text-stone-900 mb-4 uppercase tracking-wider">Report an Issue</h3>
            <p className="text-xs text-stone-500 mb-4 leading-relaxed">
              Think this listing is incorrect, doesn't exist, or has moved? Let us know so we can improve our directory.
            </p>
            <FlagButton storeId={store.id} />
          </div>

          <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100">
             <h4 className="text-emerald-900 font-black mb-4">Are you the owner?</h4>
             <p className="text-sm text-emerald-700 mb-6 leading-relaxed">
               Claim this listing to update your information, respond to reviews, and access analytics.
             </p>
             <Link to="/owners" className="block w-full text-center bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10">
               Claim This Listing
             </Link>
          </div>
        </div>
      </div>

      {reviewVideoMode === 'recorder' && store && (
        <VideoRecorder
          storeId={store.id}
          storeName={store.name}
          storeType={store.type}
          onComplete={(review) => {
            setReviewVideoMode('none');
            if (review.videoAssetId) {
              setReviewVideoAssetId(review.videoAssetId);
            }
            loadMedia();
          }}
          onCancel={() => setReviewVideoMode('none')}
        />
      )}

      {reviewVideoMode === 'uploader' && store && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 flex items-center justify-center p-4">
          <div className="max-w-lg w-full relative">
            <button
              onClick={() => setReviewVideoMode('none')}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <VideoUploader
              storeId={store.id}
              onComplete={(mediaId) => {
                setReviewVideoMode('none');
                if (typeof mediaId === 'number') {
                  setReviewVideoAssetId(mediaId);
                }
                loadMedia();
              }}
              onCancel={() => setReviewVideoMode('none')}
            />
          </div>
        </div>
      )}

      {showVideoRecorder && store && (
        <VideoRecorder
          storeId={store.id}
          storeName={store.name}
          storeType={store.type}
          onComplete={(review) => {
            setShowVideoRecorder(false);
            setWeightedReviews(prev => [review, ...prev]);
            loadMedia();
          }}
          onCancel={() => setShowVideoRecorder(false)}
        />
      )}

      {showVideoUploader && store && (
        <div className="fixed inset-0 z-50 bg-stone-900/80 flex items-center justify-center p-4">
          <div className="max-w-lg w-full relative">
            <button
              onClick={() => setShowVideoUploader(false)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <VideoUploader
              storeId={store.id}
              onComplete={() => {
                setShowVideoUploader(false);
                loadMedia();
              }}
              onCancel={() => setShowVideoUploader(false)}
            />
          </div>
        </div>
      )}

      {lightboxPhoto && store.storePhotos && (
        <div
          className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {store.storePhotos.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxPhoto({ url: store.storePhotos![(lightboxPhoto.index - 1 + store.storePhotos!.length) % store.storePhotos!.length], index: (lightboxPhoto.index - 1 + store.storePhotos!.length) % store.storePhotos!.length })}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 text-white/70 hover:text-white transition p-2"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <button
                  onClick={() => setLightboxPhoto({ url: store.storePhotos![(lightboxPhoto.index + 1) % store.storePhotos!.length], index: (lightboxPhoto.index + 1) % store.storePhotos!.length })}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 text-white/70 hover:text-white transition p-2"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                </button>
              </>
            )}
            <img
              src={lightboxPhoto.url}
              alt={`${store.name} interior photo`}
              className="w-full rounded-2xl object-contain max-h-[80vh]"
            />
            <p className="text-white/50 text-xs text-center mt-3">{lightboxPhoto.index + 1} / {store.storePhotos.length}</p>
          </div>
        </div>
      )}

      {videoModalUrl && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setVideoModalUrl(null)}
        >
          <div
            className="relative w-full max-w-3xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setVideoModalUrl(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative w-full rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={`${videoModalUrl}?autoplay=true`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
