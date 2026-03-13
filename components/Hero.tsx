
import React, { useState } from 'react';
import { searchStoresAPI } from '../services/api';
import { Store, StoreType } from '../types';

interface HeroProps {
  onSearchResults: (results: Store[], query: string) => void;
  userLocation?: { lat: number; lng: number };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { 'Accept-Language': 'en' } }
  );
  if (!res.ok) throw new Error('Geocode failed');
  const data = await res.json();
  const city =
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.hamlet ||
    data.address?.county ||
    '';
  const province = data.address?.state || '';
  if (!city) throw new Error('Could not determine city');
  return province ? `${city}, ${province}` : city;
}

async function forwardGeocode(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(query + ', Canada');
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=ca`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export const Hero: React.FC<HeroProps> = ({ onSearchResults, userLocation }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const runSearch = async (searchQuery: string, location?: { lat: number; lng: number }) => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);

    try {
      const result = await searchStoresAPI(searchQuery, location);

      if (result.stores && result.stores.length > 0) {
        const processedStores: Store[] = result.stores.map((s: any) => {
          const safeId = btoa(unescape(encodeURIComponent((s.name || '') + (s.address || ''))))
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 12);

          return {
            ...s,
            id: `search-${safeId}`,
            isClaimed: false,
            rating: s.rating || 4.5,
            type: (s.type as StoreType) || 'Sovereign',
            province: s.province,
          } as Store;
        });

        onSearchResults(processedStores, searchQuery);
      } else {
        setSearchError('No sovereign or independent shops found for that area. Try a different search.');
      }
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchError(error?.message || 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const coords = await forwardGeocode(query) || userLocation;
    await runSearch(query, coords);
  };

  const handleNearMe = async () => {
    setIsLocating(true);
    setSearchError(null);

    try {
      let coords = userLocation;

      if (!coords) {
        coords = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => reject(new Error('Location permission denied'))
          );
        });
      }

      const cityQuery = await reverseGeocode(coords.lat, coords.lng);
      setQuery(cityQuery);
      setIsLocating(false);
      await runSearch(cityQuery, coords);
    } catch (err: any) {
      setIsLocating(false);
      setSearchError(err?.message || 'Could not detect your location. Try typing a city instead.');
    }
  };

  return (
    <div className="relative pt-32 pb-24 overflow-hidden w-full">
      {/* Floating Circles - Green and Purple Theme */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-100 rounded-full blur-2xl animate-float"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-purple-100 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-10 left-1/4 w-40 h-40 bg-lime-100 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="relative max-w-5xl mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest mb-8 border border-emerald-100 shadow-sm animate-bounce">
          <span>🍃 Sovereign & Independent Discovery</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-stone-900 mb-6 leading-[1.1] tracking-tight">
          Find Your <span className="text-emerald-500">Roots.</span> <br/>
          Find Your <span className="text-purple-600 relative inline-block">
            Flow.
            <svg className="absolute -bottom-2 left-0 w-full h-4 text-purple-600/40" viewBox="0 0 100 20" preserveAspectRatio="none">
              <path 
                d="M0 10 Q 12.5 2, 25 10 T 50 10 T 75 10 T 100 10" 
                stroke="currentColor" 
                strokeWidth="6" 
                fill="transparent" 
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>
        
        <p className="text-xl text-stone-500 mb-12 max-w-2xl mx-auto font-medium">
          Beyond the corporate shelf. Discover the hidden stashes, independent growers, and sovereign shops across Canada.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 bg-white p-3 rounded-[32px] shadow-2xl shadow-emerald-900/10 max-w-2xl mx-auto border border-stone-100 transform transition-all focus-within:scale-[1.02]">
          <div className="flex-grow flex items-center px-4">
            <div className="w-10 h-10 bg-stone-50 rounded-full flex items-center justify-center mr-3">
               <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            <input 
              type="text" 
              placeholder="Try 'Chilliwack, BC' or 'Sovereign flower in Tyendinaga'..." 
              className="w-full py-4 text-stone-800 placeholder-stone-400 focus:outline-none font-bold text-lg bg-transparent"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching || isLocating}
            className="bg-emerald-600 text-white px-10 py-4 rounded-[24px] font-black hover:bg-emerald-500 transition-all disabled:opacity-50 min-w-[160px] text-lg shadow-xl hover:shadow-emerald-200"
          >
            {isSearching ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Deep Searching...
              </span>
            ) : 'Explore Gems'}
          </button>
        </form>

        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleNearMe}
            disabled={isSearching || isLocating}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-stone-200 text-stone-600 text-sm font-bold hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all disabled:opacity-50 shadow-sm"
          >
            {isLocating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-emerald-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Locating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Near Me
              </>
            )}
          </button>
          <span className="text-stone-300 text-sm">or type any city in Canada</span>
        </div>

        {searchError && (
          <p className="mt-4 text-rose-500 text-sm font-bold animate-fade-in">{searchError}</p>
        )}
      </div>
    </div>
  );
};
