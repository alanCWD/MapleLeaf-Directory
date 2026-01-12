
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProvinceSelector } from './components/ProvinceSelector';
import { TypeSelector } from './components/TypeSelector';
import { StoreList } from './components/StoreList';
import { OwnerPortal } from './components/OwnerPortal';
import { AdminSync } from './components/AdminSync';
import { StoreDetail } from './components/StoreDetail';
import { Store, Province, StoreType } from './types';

const STORAGE_KEY = 'mapleleaf_db_v2';
const FAVORITES_KEY = 'mapleleaf_favs_v2';

// Scroll to top on navigation helper
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const App: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<Province | null>(null);
  const [selectedType, setSelectedType] = useState<StoreType | null>(null);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | undefined>();

  // Initialize
  useEffect(() => {
    const savedStores = localStorage.getItem(STORAGE_KEY);
    if (savedStores) {
      setStores(JSON.parse(savedStores));
    }
    const savedFavs = localStorage.getItem(FAVORITES_KEY);
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn("Location disabled")
      );
    }
  }, []);

  // Persist Updates with Size Safety
  useEffect(() => {
    if (stores.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stores));
      } catch (e) {
        console.error("Local Storage Quota Exceeded. Transition to cloud DB recommended.");
      }
    }
  }, [stores]);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  };

  // Fixed handleSyncStores to avoid spread errors with interface types
  const handleSyncStores = (newStores: Store[]) => {
    setStores(prev => {
      // Explicitly type the Map to ensure proper inference and avoid spread errors on interface types
      const storeMap = new Map<string, Store>(prev.map(s => [s.id, s]));
      newStores.forEach(ns => {
        const existing = storeMap.get(ns.id);
        if (!existing) {
          storeMap.set(ns.id, ns);
        } else {
          // Merge logic: Update existing store if new data has more details. 
          // Spreading existing object types avoids the "Spread types may only be created from object types" error.
          const merged: Store = { ...existing, ...ns };
          storeMap.set(ns.id, merged);
        }
      });
      return Array.from(storeMap.values());
    });
  };

  const handleSearchResults = (newStores: Store[]) => {
    // 1. Sync the new stores to our persistent database
    handleSyncStores(newStores);
    
    // 2. Clear filters so the search results are actually visible
    setSelectedProvince(null);
    setSelectedType(null);
    setShowOnlyFavorites(false);
    
    // Smooth scroll to the results list
    const listEl = document.getElementById('listings-container');
    if (listEl) {
      listEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleUpdateStore = (updatedStore: Store) => {
    setStores(prev => prev.map(s => s.id === updatedStore.id ? updatedStore : s));
  };

  const filteredStores = stores.filter(s => {
    const provinceMatch = !selectedProvince || s.province === selectedProvince;
    const typeMatch = !selectedType || s.type === selectedType;
    const favoriteMatch = !showOnlyFavorites || favorites.includes(s.id);
    return provinceMatch && typeMatch && favoriteMatch;
  });

  return (
    <HashRouter>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-stone-50">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={
              <>
                <Hero onSearchResults={handleSearchResults} userLocation={userLocation} />
                <div className="max-w-7xl mx-auto px-4 py-12" id="listings-container">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <ProvinceSelector selected={selectedProvince} onSelect={setSelectedProvince} />
                    <button
                      onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                      className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all border ${
                        showOnlyFavorites ? 'bg-rose-600 text-white border-rose-600 shadow-lg' : 'bg-white text-stone-600 border-stone-200 hover:border-rose-300'
                      }`}
                    >
                      <svg className={`w-4 h-4 ${showOnlyFavorites ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                      {showOnlyFavorites ? 'Favorites Only' : 'Show Favorites'}
                    </button>
                  </div>
                  <TypeSelector selected={selectedType} onSelect={setSelectedType} />
                  <div className="mt-12">
                    <div className="flex justify-between items-end mb-8">
                      <h2 className="text-3xl font-black text-stone-900 tracking-tight">
                        {selectedProvince ? `${selectedProvince} Listings` : 'Directory Results'}
                      </h2>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{filteredStores.length} stores mapped</p>
                    </div>
                    <StoreList stores={filteredStores} favorites={favorites} onToggleFavorite={toggleFavorite} />
                  </div>
                </div>
              </>
            } />
            <Route path="/store/:id" element={<StoreDetail stores={stores} onUpdateStore={handleUpdateStore} />} />
            <Route path="/owners" element={<OwnerPortal />} />
            <Route path="/admin/sync" element={<AdminSync onSync={handleSyncStores} />} />
          </Routes>
        </main>
        <footer className="bg-stone-900 text-stone-500 py-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-sm">© 2024 MapleLeaf Directory. Data sourced via Hybrid AI Grounding.</p>
            <div className="flex gap-6">
              <Link to="/admin/sync" className="text-xs font-bold hover:text-emerald-500 transition">Database Engine</Link>
              <Link to="/owners" className="text-xs font-bold hover:text-emerald-500 transition">Owner Portal</Link>
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
