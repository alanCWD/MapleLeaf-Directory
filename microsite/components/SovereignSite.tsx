
import React, { useState, useEffect, useCallback } from 'react';
import type { MicrositeConfig } from '../types.ts';
import { fetchPublishedPosts, fetchIntegrityScore } from '../../services/api';
import type { IntegrityScoreCard } from '../../services/api';
import type { CreatorPost } from '../../types';
import { IntegrityCard } from '../../components/IntegrityCard';
import { getStoreHeaderImage } from '../../utils/defaultStoreImages';

interface SovereignSiteProps {
  store: MicrositeConfig;
  directoryOrigin: string;
  isPreview?: boolean;
}

function formatHour(time: string): string {
  return time;
}

function getDayAbbrev(day: string): string {
  return day.slice(0, 3);
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const FONT_GOOGLE_URLS: Record<string, string> = {
  modern: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap',
  classic: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Open+Sans:wght@400;600&display=swap',
  playful: 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap',
  elegant: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Lato:wght@400;700&display=swap',
};

const FONT_CSS_VARS: Record<string, { heading: string; body: string }> = {
  system: { heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', body: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  modern: { heading: '"Inter", sans-serif', body: '"Inter", sans-serif' },
  classic: { heading: '"Merriweather", Georgia, serif', body: '"Open Sans", sans-serif' },
  playful: { heading: '"Nunito", sans-serif', body: '"Nunito", sans-serif' },
  elegant: { heading: '"Playfair Display", Georgia, serif', body: '"Lato", sans-serif' },
};

export const SovereignSite: React.FC<SovereignSiteProps> = ({ store, directoryOrigin, isPreview = false }) => {
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [integrityScore, setIntegrityScore] = useState<IntegrityScoreCard | null>(null);
  const [isLoadingIntegrity, setIsLoadingIntegrity] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ url: string; index: number } | null>(null);

  const brandColor = store.themeConfig?.brandColor || '#065f46';
  const accentColor = store.themeConfig?.accentColor || '';
  const fontPairing = store.themeConfig?.fontPairing || 'system';
  const tagline = store.themeConfig?.tagline || '';
  const subHeadline = store.themeConfig?.subHeadline || '';
  const sections = store.themeConfig?.sections || {};
  const showHours = sections.showHours !== false;
  const showGallery = sections.showGallery !== false;
  const showPosts = sections.showPosts !== false;
  const showContact = sections.showContact !== false;
  const headerImageUrl = getStoreHeaderImage(store.tenantId, store.headerImageUrl);

  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  const hours = Array.isArray(store.hours) ? store.hours : [];
  const sortedHours = [...hours].sort((a, b) => {
    const ai = DAYS_ORDER.indexOf(a.day);
    const bi = DAYS_ORDER.indexOf(b.day);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${store.name}, ${store.address}, ${store.province}, Canada`)}`;
  const directoryListingUrl = `${directoryOrigin}/#/store/${store.tenantId}`;
  const directoryPostUrl = (postId: number) => `${directoryOrigin}/#/posts/${postId}`;

  const addressParts = store.address.split(',');
  const city = (addressParts.length > 1 ? addressParts[addressParts.length - 1]?.trim() : addressParts[0]?.trim()) || store.province;

  useEffect(() => {
    document.title = `${store.name} — ${city}, ${store.province}`;

    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setOg = (property: string, content: string) => {
      let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', property);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const desc = `${store.name} is a ${store.type} cannabis dispensary in ${store.address}, ${store.province}, Canada. ${store.featuredOfferings?.length ? `Specializing in: ${store.featuredOfferings.slice(0, 3).join(', ')}.` : ''}`;

    setMeta('description', desc);
    setOg('og:title', store.name);
    setOg('og:description', desc);
    setOg('og:type', 'business.business');
    setOg('og:image', headerImageUrl);
    setOg('og:url', window.location.href);

    const fontUrl = FONT_GOOGLE_URLS[fontPairing];
    const linkId = 'sovereign-font-link';
    let fontLink = document.getElementById(linkId) as HTMLLinkElement | null;
    if (fontUrl) {
      if (!fontLink) {
        fontLink = document.createElement('link');
        fontLink.id = linkId;
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);
      }
      fontLink.href = fontUrl;
    } else if (fontLink) {
      fontLink.href = '';
    }
  }, [store, headerImageUrl, fontPairing]);

  useEffect(() => {
    fetchPublishedPosts({ storeId: store.tenantId, limit: 6 })
      .then(r => setPosts(r.posts))
      .catch(() => setPosts([]))
      .finally(() => setIsLoadingPosts(false));

    setIsLoadingIntegrity(true);
    fetchIntegrityScore(store.tenantId)
      .then(setIntegrityScore)
      .catch(() => setIntegrityScore(null))
      .finally(() => setIsLoadingIntegrity(false));
  }, [store.tenantId]);

  const closeLightbox = useCallback(() => setLightboxPhoto(null), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!lightboxPhoto) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight' && store.storePhotos) {
        const next = (lightboxPhoto.index + 1) % store.storePhotos.length;
        setLightboxPhoto({ url: store.storePhotos[next], index: next });
      }
      if (e.key === 'ArrowLeft' && store.storePhotos) {
        const prev = (lightboxPhoto.index - 1 + store.storePhotos.length) % store.storePhotos.length;
        setLightboxPhoto({ url: store.storePhotos[prev], index: prev });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxPhoto, store.storePhotos, closeLightbox]);

  const photos = store.storePhotos || [];

  const fontVars = FONT_CSS_VARS[fontPairing] || FONT_CSS_VARS.system;

  return (
    <div
      className="min-h-screen bg-stone-50 flex flex-col overflow-x-hidden"
      style={{
        '--brand': brandColor,
        '--font-heading': fontVars.heading,
        '--font-body': fontVars.body,
        fontFamily: 'var(--font-body)',
        ...(accentColor ? { '--accent': accentColor } : {}),
      } as React.CSSProperties}
    >
      {isPreview && (
        <div className="sticky top-0 z-50 bg-amber-400 text-amber-950 text-sm font-bold py-2.5 px-4 flex items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Preview Mode — this is how your site looks to visitors.</span>
          </div>
          <a
            href="#/owners"
            className="text-xs font-black uppercase tracking-widest bg-amber-950/15 hover:bg-amber-950/25 px-3 py-1 rounded-lg transition whitespace-nowrap"
          >
            Back to Portal
          </a>
        </div>
      )}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full bg-white/10 transition"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white/70 hover:text-white p-3 rounded-full bg-white/10 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  const prev = (lightboxPhoto.index - 1 + photos.length) % photos.length;
                  setLightboxPhoto({ url: photos[prev], index: prev });
                }}
                aria-label="Previous"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-4 text-white/70 hover:text-white p-3 rounded-full bg-white/10 transition"
                onClick={(e) => {
                  e.stopPropagation();
                  const next = (lightboxPhoto.index + 1) % photos.length;
                  setLightboxPhoto({ url: photos[next], index: next });
                }}
                aria-label="Next"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
          <img
            src={lightboxPhoto.url}
            alt={`Interior photo ${lightboxPhoto.index + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <div className="absolute bottom-4 text-white/50 text-xs font-bold">
              {lightboxPhoto.index + 1} / {photos.length}
            </div>
          )}
        </div>
      )}

      <header
        className="relative overflow-hidden"
        style={{ minHeight: '420px' }}
      >
        <img
          src={headerImageUrl}
          alt={store.name}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/1600x600/065f46/ffffff?text=${encodeURIComponent(store.name)}`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <nav className="relative z-10 flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            {store.themeConfig?.logoUrl ? (
              <img src={store.themeConfig.logoUrl} alt={`${store.name} logo`} className="h-10 w-auto rounded-lg" />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {store.name[0]}
              </div>
            )}
            <span className="text-white font-black text-lg tracking-tight">{store.name}</span>
          </div>
          {store.phone && (
            <a
              href={`tel:${store.phone}`}
              className="hidden md:flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-4 py-2 rounded-xl text-sm font-bold transition backdrop-blur-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {store.phone}
            </a>
          )}
        </nav>
        <div className="relative z-10 px-6 pb-10 pt-16 md:pt-24 max-w-4xl">
          <div className="flex flex-wrap gap-2 mb-4">
            <span
              className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest text-white shadow-lg"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {store.type}
            </span>
            {store.verificationStatus === 'verified' && (
              <span className="bg-emerald-500/90 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                Verified
              </span>
            )}
            {store.isClaimed && (
              <span className="bg-blue-500/90 text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 01-2.812 2.812c.051.64.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                </svg>
                Owner Managed
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white mb-3 tracking-tight leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
            {store.name}
          </h1>
          <p className="text-white/90 text-xl font-semibold mb-2 leading-snug">
            {tagline || `Sovereign cannabis — ${store.province}, Canada`}
          </p>
          {(subHeadline || store.storeInsights?.community) && (
            <p className="text-stone-200 text-base mb-3 max-w-xl leading-relaxed">
              {subHeadline || store.storeInsights?.community}
            </p>
          )}
          <p className="text-stone-300 text-lg flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {store.address}, {store.province}
          </p>
        </div>
      </header>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-12">

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
            {store.phone && (
              <a
                href={`tel:${store.phone}`}
                className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-300 transition text-center shadow-sm"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Call Us</div>
                  <div className="text-sm font-bold text-stone-800 mt-0.5 truncate">{store.phone}</div>
                </div>
              </a>
            )}

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-300 transition text-center shadow-sm"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 01-1.447-.894L15 7m0 10V7" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Get Directions</div>
                <div className="text-sm font-bold text-stone-800 mt-0.5">Open Maps</div>
              </div>
            </a>

            {store.website && (
              <a
                href={store.website.startsWith('http') ? store.website : `https://${store.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-stone-200 p-5 hover:border-stone-300 transition text-center shadow-sm"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Visit Website</div>
                  <div className="text-sm font-bold text-stone-800 mt-0.5 truncate">
                    {store.website.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0]}
                  </div>
                </div>
              </a>
            )}

            {store.rating != null && (
              <div className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-stone-200 p-5 text-center shadow-sm">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Rating</div>
                  <div className="text-sm font-bold text-stone-800 mt-0.5">{store.rating.toFixed(1)} / 5</div>
                </div>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-10">

              {store.featuredOfferings && store.featuredOfferings.length > 0 && (
                <section>
                  <h2
                    className="text-2xl font-black mb-6 tracking-tight flex items-center gap-3"
                    style={{ color: 'var(--brand)' }}
                  >
                    <span className="w-1.5 h-7 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: 'var(--brand)' }} />
                    Featured Selection
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {store.featuredOfferings.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-stone-200 shadow-sm px-5 py-4 flex items-center justify-between"
                      >
                        <span className="font-bold text-stone-800">{item}</span>
                        <span
                          className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full text-white"
                          style={{ backgroundColor: 'var(--brand)' }}
                        >
                          In Stock
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {showGallery && photos.length > 0 && (
                <section>
                  <h2
                    className="text-2xl font-black mb-6 tracking-tight flex items-center gap-3"
                    style={{ color: 'var(--brand)', fontFamily: 'var(--font-heading)' }}
                  >
                    <span className="w-1.5 h-7 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: 'var(--brand)' }} />
                    Inside the Store
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {photos.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => setLightboxPhoto({ url, index: idx })}
                        className="relative aspect-square overflow-hidden rounded-2xl group focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': 'var(--brand)' } as React.CSSProperties}
                      >
                        <img
                          src={url}
                          alt={`Interior photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {showPosts && (isLoadingPosts || posts.length > 0) && (
                <section>
                  <h2
                    className="text-2xl font-black mb-6 tracking-tight flex items-center gap-3"
                    style={{ color: 'var(--brand)', fontFamily: 'var(--font-heading)' }}
                  >
                    <span className="w-1.5 h-7 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: 'var(--brand)' }} />
                    Latest from the Hub
                  </h2>
                  {isLoadingPosts ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[1, 2].map(i => (
                        <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse">
                          <div className="h-3 bg-stone-100 rounded w-1/3 mb-3" />
                          <div className="h-5 bg-stone-100 rounded w-2/3 mb-2" />
                          <div className="h-3 bg-stone-100 rounded w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {posts.map(post => (
                        <a
                          key={post.id}
                          href={directoryPostUrl(post.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:border-stone-300 hover:shadow-md transition"
                        >
                          {post.media && post.media[0]?.cdnUrl && (
                            <div className="relative aspect-video rounded-xl overflow-hidden mb-4">
                              <img
                                src={post.media[0].cdnUrl}
                                alt={post.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex items-center gap-2 mb-2">
                            {post.authorImageUrl ? (
                              <img src={post.authorImageUrl} alt="" className="w-6 h-6 rounded-full" />
                            ) : (
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                                style={{ backgroundColor: 'var(--brand)' }}
                              >
                                {(post.authorName?.[0] || 'U').toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs text-stone-500 font-medium">{post.authorName || 'Community'}</span>
                            <span className="text-stone-300">·</span>
                            <span className="text-xs text-stone-400">
                              {new Date(post.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <h3 className="font-black text-stone-900 leading-snug">{post.title}</h3>
                          {post.subtitle && (
                            <p className="text-sm text-stone-500 mt-1 line-clamp-2">{post.subtitle}</p>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="space-y-6">
              {showHours && sortedHours.length > 0 && (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
                  <h3 className="font-black text-stone-900 mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Hours
                  </h3>
                  <div className="space-y-1.5">
                    {sortedHours.map((h) => {
                      const isToday = h.day === currentDay;
                      return (
                        <div
                          key={h.day}
                          className={`flex justify-between items-center py-1.5 px-2 rounded-lg text-sm ${isToday ? 'font-black' : 'font-medium'}`}
                          style={isToday ? { backgroundColor: `${brandColor}15`, color: brandColor } : { color: '#44403c' }}
                        >
                          <span>{getDayAbbrev(h.day)}</span>
                          <span>{formatHour(h.time)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {showContact && (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-6">
                  <h3 className="font-black text-stone-900 mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" style={{ color: 'var(--brand)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location
                  </h3>
                  <address className="not-italic text-stone-700 text-sm font-medium leading-relaxed mb-4">
                    {store.address}<br />{store.province}, Canada
                  </address>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
                    style={{ backgroundColor: 'var(--brand)' }}
                  >
                    Get Directions
                  </a>
                </div>
              )}

              <IntegrityCard score={integrityScore} isLoading={isLoadingIntegrity} />
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm"
              style={{ backgroundColor: 'var(--brand)' }}
            >
              {store.name[0]}
            </div>
            <div>
              <div className="font-black text-stone-900 text-sm">{store.name}</div>
              <div className="text-xs text-stone-400">{store.address.split(',')[0]?.trim()}, {store.province}</div>
            </div>
          </div>

          <a
            href={directoryListingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-800 px-4 py-2 rounded-xl text-xs font-bold transition"
          >
            <span className="text-emerald-600">🌿</span>
            <span>Powered by <span className="font-black text-emerald-700">LegacyLeaf</span></span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </footer>
    </div>
  );
};
