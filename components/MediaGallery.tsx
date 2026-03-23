import React, { useState, useEffect, useCallback } from 'react';
import type { StoreMedia } from '../types';

interface MediaGalleryProps {
  media: StoreMedia[];
  isLoading?: boolean;
  isAuthenticated?: boolean;
  hideEmptyState?: boolean;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ media, isLoading = false, isAuthenticated = false, hideEmptyState = false }) => {
  const [selectedMedia, setSelectedMedia] = useState<StoreMedia | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedMedia(null);
  }, []);

  useEffect(() => {
    if (selectedMedia) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedMedia, handleKeyDown]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) setSelectedMedia(null);
  };

  const getStatusBadge = (status: StoreMedia['status']) => {
    switch (status) {
      case 'processing':
      case 'encoding':
      case 'uploading':
        return (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing
          </span>
        );
      case 'ready':
        return (
          <span className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
            Ready
          </span>
        );
      case 'failed':
        return (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Failed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="aspect-video bg-stone-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (media.length === 0) {
    if (hideEmptyState) return null;
    return (
      <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 border-dashed">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-stone-400 italic font-medium">No content yet. Be the first to share!</p>
        {!isAuthenticated && (
          <a href="#/auth" className="inline-block mt-4 bg-emerald-500 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-400 transition">
            Sign In to Share
          </a>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {media.map(item => (
          <button
            key={item.id}
            onClick={() => item.status === 'ready' && setSelectedMedia(item)}
            className={`relative aspect-video rounded-2xl overflow-hidden group border border-stone-200 bg-stone-100 ${
              item.status === 'ready' ? 'cursor-pointer hover:border-emerald-300' : 'cursor-default opacity-75'
            } transition-all`}
          >
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-100">
                <svg className="w-10 h-10 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}

            {item.status === 'ready' && (
              <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/40 transition-all flex items-center justify-center">
                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                  <svg className="w-6 h-6 text-stone-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}

            {getStatusBadge(item.status)}

            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-stone-900/70 to-transparent p-2">
              <p className="text-white text-xs font-bold truncate">{item.title}</p>
              {item.durationSeconds && (
                <p className="text-white/70 text-[10px]">
                  {Math.floor(item.durationSeconds / 60)}:{(item.durationSeconds % 60).toString().padStart(2, '0')}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selectedMedia && selectedMedia.embedUrl && (
        <div
          className="fixed inset-0 z-50 bg-stone-900/90 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
        >
          <div className="relative w-full max-w-4xl">
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition p-2"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="bg-stone-900 rounded-2xl overflow-hidden shadow-2xl">
              <div className="aspect-video">
                <iframe
                  src={selectedMedia.embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={selectedMedia.title}
                />
              </div>
              <div className="p-4">
                <h3 className="text-white font-bold text-lg">{selectedMedia.title}</h3>
                {selectedMedia.description && (
                  <p className="text-white/60 text-sm mt-1">{selectedMedia.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
