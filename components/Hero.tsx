
import React, { useState } from 'react';
import { searchStores } from '../services/geminiService';
import { Store } from '../types';

interface HeroProps {
  onSearchResults: (results: Store[]) => void;
  userLocation?: { lat: number; lng: number };
}

export const Hero: React.FC<HeroProps> = ({ onSearchResults, userLocation }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    
    try {
      const result = await searchStores(query, userLocation);
      
      if (result.stores && result.stores.length > 0) {
        const processedStores: Store[] = result.stores.map((s: any) => ({
          ...s,
          id: `search-${btoa((s.name || '') + (s.address || '')).substring(0, 12)}`,
          isClaimed: false,
          rating: s.rating || 4.0,
          type: s.type || 'Licensed',
          province: s.province
        } as Store));
        
        onSearchResults(processedStores);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative bg-emerald-900 py-24 overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full mix-blend-overlay filter blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-400 rounded-full mix-blend-overlay filter blur-3xl"></div>
      </div>
      
      <div className="relative max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-4xl md:text-6xl font-black text-white mb-6 leading-tight">
          Your Local Canadian <br/><span className="text-emerald-400">Cannabis Connection</span>
        </h1>
        <p className="text-xl text-emerald-100/80 mb-10 max-w-2xl mx-auto">
          Discover licensed dispensaries and indigenous-owned shops across every province. Real-time directory powered by AI.
        </p>

        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2 bg-white p-2 rounded-2xl shadow-2xl max-w-2xl mx-auto">
          <div className="flex-grow flex items-center px-4">
            <svg className="w-5 h-5 text-stone-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input 
              type="text" 
              placeholder="e.g., 'Aboriginal dispensaries in Shannonville'..." 
              className="w-full py-3 text-stone-800 placeholder-stone-400 focus:outline-none"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            disabled={isSearching}
            className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-500 transition disabled:opacity-50 min-w-[140px]"
          >
            {isSearching ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Discovery Active
              </span>
            ) : 'Find Now'}
          </button>
        </form>
      </div>
    </div>
  );
};
