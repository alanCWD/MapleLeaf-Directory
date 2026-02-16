
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Store, Review } from '../types';
import { getStoreInsights } from '../services/geminiService';
import { VerificationBadge } from './VerificationBadge';
import { EvidencePanel } from './EvidencePanel';
import { FlagButton } from './FlagButton';

interface StoreDetailProps {
  stores: Store[];
  onUpdateStore: (store: Store) => void;
}

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
  const [store, setStore] = useState<Store | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  
  const [newReview, setNewReview] = useState({ userName: '', rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    const found = stores.find(s => s.id === id);
    if (found) {
      setStore(found);
      if (found.hours && !insights) {
        setInsights(prev => prev ? prev : { hours: found.hours });
      }
    }
  }, [id, stores]);

  useEffect(() => {
    if (store && !insights?.atmosphere) {
      fetchInsights();
    }
  }, [store]);

  const getHashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seed = store?.id ? getHashCode(store.id) : 0;
  
  const interiorPool = ['lounge', 'decor', 'furniture', 'interior', 'lighting', 'modern', 'vintage', 'plants', 'bohemian', 'industrial'];
  const detailTags = [
    interiorPool[seed % interiorPool.length],
    interiorPool[(seed + 3) % interiorPool.length],
    'atmosphere'
  ];

  const nameSlug = store?.name.toLowerCase().replace(/[^a-z]/g, '') || 'store';
  const detailHeaderUrl = `https://loremflickr.com/1600/600/${detailTags.join(',')},${nameSlug}?lock=${(seed + 8000) % 20000}`;

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

    const schemaData = {
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

    script.text = JSON.stringify(schemaData);

    return () => {
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [store, insights, detailHeaderUrl]);

  const fetchInsights = async () => {
    if (!store) return;
    setIsLoadingInsights(true);
    try {
      const data = await getStoreInsights(store.name);
      setInsights(data);
      
      if (Array.isArray(data.hours) && JSON.stringify(data.hours) !== JSON.stringify(store.hours)) {
        onUpdateStore({
          ...store,
          hours: data.hours
        });
      }
    } catch (err) {
      console.error("Failed to load insights", err);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!store || !newReview.userName || !newReview.comment) return;

    setIsSubmittingReview(true);
    
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
    setIsSubmittingReview(false);
    setShowReviewForm(false);
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
    <div className="bg-stone-50 min-h-screen pb-24">
      <div className="relative h-[400px] overflow-hidden">
        <img 
          src={detailHeaderUrl} 
          alt={store.name} 
          className={`w-full h-full object-cover ${store.verificationStatus === 'historically_closed' ? 'grayscale' : ''}`}
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/1600x600/065f46/ffffff?text=${encodeURIComponent(store.name)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-900 via-stone-900/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12">
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
              <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tight">{store.name}</h1>
              <p className="text-xl text-stone-300 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                {store.address}, {store.province}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {store.website && (
                <a 
                  href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-500 transition shadow-xl flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                  Visit Website
                </a>
              )}
              <a 
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white text-stone-900 px-8 py-4 rounded-2xl font-bold hover:bg-stone-100 transition shadow-xl flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 10V7"></path></svg>
                Get Directions
              </a>
              {!store.isClaimed && (
                <Link to="/owners" className="bg-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-500 transition shadow-xl shadow-emerald-900/40">
                  Claim Listing
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 grid lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
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

          <section id="reviews">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <h2 className="text-2xl font-extrabold text-stone-900 flex items-center gap-2">
                <span className="w-2 h-8 bg-purple-500 rounded-full"></span>
                Community Reviews
              </h2>
              <button 
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/10"
              >
                {showReviewForm ? 'Cancel Review' : 'Write a Review'}
              </button>
            </div>

            {showReviewForm && (
              <div className="bg-white p-8 rounded-3xl border border-emerald-200 shadow-sm mb-12 animate-fade-in">
                <h3 className="text-lg font-bold text-stone-900 mb-6">Rate your experience</h3>
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
                  <button 
                    type="submit"
                    disabled={isSubmittingReview}
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                  >
                    {isSubmittingReview ? 'Posting...' : 'Post Review'}
                  </button>
                </form>
              </div>
            )}

            <div className="space-y-6">
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
              ) : (
                <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 border-dashed">
                  <p className="text-stone-400 italic">No reviews yet. Be the first to share your experience!</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
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
    </div>
  );
};
