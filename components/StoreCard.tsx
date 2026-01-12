
import React from 'react';
import { Link } from 'react-router-dom';
import { Store } from '../types';

interface StoreCardProps {
  store: Store;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({ store, isFavorite, onToggleFavorite }) => {
  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayHours = store.hours?.find(h => h.day === currentDay)?.time || 'Hours vary';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition group h-full flex flex-col relative">
      <div className="h-48 bg-stone-100 relative overflow-hidden">
        <img 
          src={`https://picsum.photos/seed/${store.id}/400/200`} 
          alt={store.name} 
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
        />
        
        {/* Type & Discovery Badges - Top Left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-sm w-fit ${store.type === 'Licensed' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
            {store.type}
          </span>
          {store.type === 'Aboriginal' && (
            <span className="bg-white/90 backdrop-blur-sm text-stone-700 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider w-fit border border-stone-200">
              Community Found
            </span>
          )}
        </div>

        {/* Action Buttons - Top Right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {/* Favorite Toggle */}
          <button 
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite();
            }}
            className={`p-2 rounded-full backdrop-blur-md border transition-all duration-300 ${
              isFavorite 
                ? 'bg-rose-500 border-rose-400 text-white shadow-lg scale-110' 
                : 'bg-white/80 border-stone-200 text-stone-400 hover:text-rose-500 hover:bg-white'
            }`}
          >
            <svg className={`w-4 h-4 ${isFavorite ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Claimed Status */}
          {store.isClaimed && (
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1.5 shadow-lg shadow-blue-900/20 border border-blue-400/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.64.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="hidden xs:inline">Claimed</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-stone-900 mb-1 leading-snug">{store.name}</h3>
        <p className="text-sm text-stone-500 mb-1 flex items-center gap-1">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          <span className="truncate">{store.address}</span>
        </p>

        {/* Operating Hours Display */}
        <p className="text-[11px] text-stone-400 mb-1 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Today: <span className="font-medium text-stone-500">{todayHours}</span>
        </p>

        {/* Website Link (If Available) */}
        {store.website && (
          <p className="text-[11px] text-stone-400 mb-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
            <a 
              href={store.website.startsWith('http') ? store.website : `https://${store.website}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-medium text-emerald-600 hover:underline truncate"
            >
              {store.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
            </a>
          </p>
        )}

        {/* Source Link (If Available) */}
        {store.sourceUrl && (
          <p className="text-[10px] text-stone-400 mb-3 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
            Source: <a href={store.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-500 truncate">{new URL(store.sourceUrl).hostname}</a>
          </p>
        )}
        
        {store.featuredOfferings && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {store.featuredOfferings.slice(0, 3).map(offering => (
              <span key={offering} className="text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full border border-stone-200">
                {offering}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-auto pt-4 border-t border-stone-100">
          <div className="flex items-center gap-1">
            <span className="text-amber-500">★</span>
            <span className="text-sm font-bold text-stone-700">{store.rating || 'N/A'}</span>
          </div>
          <Link to={`/store/${store.id}`} className="text-emerald-600 text-sm font-bold hover:text-emerald-500 transition-colors">
            Details →
          </Link>
        </div>
      </div>
    </div>
  );
};
