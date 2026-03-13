
import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from '../types';
import { VerificationBadge } from './VerificationBadge';
import { getStoreHeaderImage } from '../utils/defaultStoreImages';

interface StoreCardProps {
  store: Store;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, isFavorite, onToggleFavorite }) => {
  const imageUrl = getStoreHeaderImage(store.id, store.headerImageUrl);

  const isUnverified = store.verificationStatus === 'ai_suggested' && store.confidenceScore < 0.3;
  const isClosed = store.verificationStatus === 'historically_closed';

  return (
    <div className={`bg-white rounded-[32px] shadow-lg shadow-stone-900/5 border overflow-hidden hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group h-full flex flex-col relative ${
      isClosed ? 'border-stone-300 opacity-75' : isUnverified ? 'border-amber-200' : 'border-stone-100'
    }`}>
      <div className="h-48 bg-stone-50 relative overflow-hidden">
        <img 
          src={imageUrl} 
          alt={store.name} 
          className={`w-full h-full object-cover group-hover:scale-110 transition duration-700 brightness-95 group-hover:brightness-100 ${isClosed ? 'grayscale' : ''}`}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://placehold.co/400x300/065f46/ffffff?text=${encodeURIComponent(store.name)}`;
          }}
        />
        
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transform transition-transform ${store.type === 'Sovereign' ? 'bg-purple-600 text-white' : 'bg-emerald-600 text-white'}`}>
            {store.type}
          </span>
          <VerificationBadge 
            status={store.verificationStatus} 
            confidenceScore={store.confidenceScore} 
            compact 
          />
        </div>

        <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
          <button 
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center backdrop-blur-md border transition-all duration-300 ${
              isFavorite 
                ? 'bg-rose-500 border-rose-400 text-white shadow-xl scale-110 rotate-12' 
                : 'bg-white/90 border-white text-stone-400 hover:text-rose-500 hover:scale-110'
            }`}
          >
            <svg className={`w-5 h-5 ${isFavorite ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 flex-grow flex flex-col">
        <h3 className="text-xl font-black text-stone-900 mb-2 leading-tight group-hover:text-emerald-600 transition-colors">{store.name}</h3>
        <p className="text-sm text-stone-500 mb-4 flex items-center gap-2 font-medium">
          <span className="text-lg">📍</span>
          <span className="truncate">{store.address}</span>
        </p>

        {store.verificationStatus === 'ai_suggested' && (
          <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg mb-3 leading-relaxed">
            AI-suggested listing; may not exist. {store.evidenceCount > 0 ? `Based on ${store.evidenceCount} source${store.evidenceCount > 1 ? 's' : ''}.` : 'No independent verification.'}
          </p>
        )}

        {isClosed && (
          <p className="text-[10px] text-stone-500 bg-stone-100 border border-stone-200 px-3 py-1.5 rounded-lg mb-3">
            This location has been marked as historically closed.
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {store.featuredOfferings?.slice(0, 2).map(offering => (
            <span key={offering} className="text-[10px] bg-stone-50 text-stone-600 px-3 py-1 rounded-lg font-black uppercase tracking-wider border border-stone-100">
              {offering}
            </span>
          ))}
          <span className={`text-[10px] ${store.type === 'Sovereign' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'} px-3 py-1 rounded-lg font-black uppercase tracking-wider border`}>
            Independent
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-6 border-t border-stone-100">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-stone-50 px-3 py-1 rounded-xl">
              <span className="text-emerald-500 text-lg">★</span>
              <span className="text-sm font-black text-stone-900">{store.rating || '4.5'}</span>
            </div>
            {store.distanceKm != null && (
              <div className="flex items-center gap-1 bg-blue-50 border border-blue-100 px-3 py-1 rounded-xl">
                <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-black text-blue-600">{store.distanceKm} km</span>
              </div>
            )}
          </div>
          <Link to={`/store/${store.id}`} className="bg-emerald-500/10 text-emerald-600 px-5 py-2 rounded-2xl text-sm font-black hover:bg-emerald-500 hover:text-white transition-all">
            See Vault →
          </Link>
        </div>
      </div>
    </div>
  );
};
