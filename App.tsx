
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
import { PersonalScout } from './components/PersonalScout';
import { LeadBanner } from './components/LeadBanner';
import { AdminReviewQueue } from './components/AdminReviewQueue';
import { CommunitySubmit } from './components/CommunitySubmit';
import { VerificationFilter } from './components/VerificationFilter';
import { Store, Province, StoreType, UserProfile, VerificationStatus } from './types';
import { fetchStores, bulkUpsertStores, updateStore as apiUpdateStore } from './services/api';

const FAVORITES_KEY = 'mapleleaf_favs_v2';
const PROFILE_KEY = 'mapleleaf_user_profile';

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
  const [vibeRecommendedIds, setVibeRecommendedIds] = useState<string[] | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [hideUnverified, setHideUnverified] = useState(false);
  const [verificationFilter, setVerificationFilter] = useState<VerificationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadStores = async () => {
    try {
      const data = await fetchStores();
      setStores(data);
    } catch (err) {
      console.error('Failed to load stores from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStores();

    const savedFavs = localStorage.getItem(FAVORITES_KEY);
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    const savedProfile = localStorage.getItem(PROFILE_KEY);
    if (savedProfile) setUserProfile(JSON.parse(savedProfile));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => console.warn("Location disabled")
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);
  };

  const handleSyncStores = async (newStores: Store[]) => {
    try {
      const result = await bulkUpsertStores(newStores);
      setStores(prev => {
        const storeMap = new Map<string, Store>(prev.map(s => [s.id, s]));
        result.stores.forEach(ns => {
          storeMap.set(ns.id, ns);
        });
        return Array.from(storeMap.values());
      });
      return result.stores;
    } catch (err) {
      console.error('Failed to sync stores:', err);
      setStores(prev => {
        const storeMap = new Map<string, Store>(prev.map(s => [s.id, s]));
        newStores.forEach(ns => {
          if (!storeMap.has(ns.id)) {
            storeMap.set(ns.id, ns);
          }
        });
        return Array.from(storeMap.values());
      });
      return newStores;
    }
  };

  const handleSearchResults = async (newStores: Store[]) => {
    await handleSyncStores(newStores);
    setSelectedProvince(null);
    setSelectedType(null);
    setShowOnlyFavorites(false);
    setVibeRecommendedIds(null);
    
    const listEl = document.getElementById('listings-container');
    if (listEl) {
      listEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleUpdateStore = async (updatedStore: Store) => {
    try {
      const saved = await apiUpdateStore(updatedStore.id, updatedStore);
      setStores(prev => prev.map(s => s.id === saved.id ? saved : s));
    } catch (err) {
      console.error('Failed to update store:', err);
      setStores(prev => prev.map(s => s.id === updatedStore.id ? updatedStore : s));
    }
  };

  const filteredStores = stores.filter(s => {
    const provinceMatch = !selectedProvince || s.province === selectedProvince;
    const typeMatch = !selectedType || s.type === selectedType;
    const favoriteMatch = !showOnlyFavorites || favorites.includes(s.id);
    const vibeMatch = !vibeRecommendedIds || vibeRecommendedIds.includes(s.id);
    const verificationMatch = !verificationFilter || s.verificationStatus === verificationFilter;
    const unverifiedMatch = !hideUnverified || s.verificationStatus === 'verified' || s.confidenceScore >= 0.6;
    const notRejected = s.verificationStatus !== 'rejected';
    return provinceMatch && typeMatch && favoriteMatch && vibeMatch && verificationMatch && unverifiedMatch && notRejected;
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
                  {userProfile?.email && (
                    <div className="mb-8 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between animate-fade-in">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">✨</span>
                        <p className="text-emerald-900 font-bold text-sm">Welcome back! Your personalized profile is currently filtering your results.</p>
                      </div>
                      <button onClick={() => {
                        localStorage.removeItem(PROFILE_KEY);
                        setUserProfile(null);
                        setVibeRecommendedIds(null);
                      }} className="text-emerald-600 text-xs font-black uppercase tracking-widest hover:underline px-3 py-1 bg-white rounded-lg border border-emerald-100">
                        Clear Personalization
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <ProvinceSelector selected={selectedProvince} onSelect={(p) => {
                      setSelectedProvince(p);
                      setVibeRecommendedIds(null);
                    }} />
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
                  <TypeSelector selected={selectedType} onSelect={(t) => {
                    setSelectedType(t);
                    setVibeRecommendedIds(null);
                  }} />

                  <VerificationFilter
                    selected={verificationFilter}
                    onSelect={setVerificationFilter}
                    hideUnverified={hideUnverified}
                    onToggleHideUnverified={() => setHideUnverified(!hideUnverified)}
                  />
                  
                  <div className="mt-12">
                    <div className="flex justify-between items-end mb-8">
                      <div>
                        {vibeRecommendedIds && (
                          <div className="flex items-center gap-2 mb-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit animate-pulse">
                            <span>✨ Profile Match Active</span>
                            <button onClick={() => setVibeRecommendedIds(null)} className="hover:text-emerald-900 ml-1">✕</button>
                          </div>
                        )}
                        <h2 className="text-3xl font-black text-stone-900 tracking-tight">
                          {selectedProvince ? `${selectedProvince} Listings` : 'Directory Results'}
                        </h2>
                      </div>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">{filteredStores.length} stores mapped</p>
                    </div>

                    {isLoading ? (
                      <div className="text-center py-24 bg-white rounded-[40px] border-4 border-dashed border-stone-100">
                        <div className="text-6xl mb-6 animate-spin">⏳</div>
                        <p className="text-stone-400 font-bold text-lg">Loading directory...</p>
                      </div>
                    ) : filteredStores.length === 0 ? (
                      <div className="text-center py-24 bg-white rounded-[40px] border-4 border-dashed border-stone-100">
                        <div className="text-6xl mb-6">🏜️</div>
                        <p className="text-stone-400 font-bold text-lg">No stores found matching your criteria.</p>
                        <p className="text-stone-300 text-sm mt-2">Try adjusting your filters or expanding your search.</p>
                      </div>
                    ) : (
                      <>
                        <StoreList stores={filteredStores.slice(0, 8)} favorites={favorites} onToggleFavorite={toggleFavorite} />
                        
                        {filteredStores.length > 4 && !userProfile?.email && (
                          <div className="my-16">
                            <LeadBanner />
                          </div>
                        )}

                        {filteredStores.length > 8 && (
                          <div className="mt-12">
                            <StoreList stores={filteredStores.slice(8)} favorites={favorites} onToggleFavorite={toggleFavorite} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <PersonalScout stores={stores} onRecommendation={(ids) => {
                  setVibeRecommendedIds(ids);
                  const el = document.getElementById('listings-container');
                  el?.scrollIntoView({ behavior: 'smooth' });
                  const savedProfile = localStorage.getItem(PROFILE_KEY);
                  if (savedProfile) setUserProfile(JSON.parse(savedProfile));
                }} />
              </>
            } />
            <Route path="/store/:id" element={<StoreDetail stores={stores} onUpdateStore={handleUpdateStore} />} />
            <Route path="/owners" element={<OwnerPortal />} />
            <Route path="/admin/sync" element={<AdminSync onSync={handleSyncStores} />} />
            <Route path="/admin/review" element={<AdminReviewQueue />} />
            <Route path="/submit" element={<CommunitySubmit />} />
          </Routes>
        </main>
        <footer className="bg-[#0a2e1f] text-emerald-200/50 py-16 mt-20 border-t border-emerald-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-12 mb-12 border-b border-emerald-800/30 pb-12">
               <div>
                  <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Directory</h4>
                  <ul className="space-y-4 text-sm font-medium">
                    <li><Link to="/" className="hover:text-emerald-400 transition">Find Dispensaries</Link></li>
                    <li><Link to="/admin/sync" className="hover:text-emerald-400 transition">Database Engine</Link></li>
                    <li><Link to="/admin/review" className="hover:text-emerald-400 transition">Review Queue</Link></li>
                  </ul>
               </div>
               <div>
                  <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Partnerships</h4>
                  <ul className="space-y-4 text-sm font-medium">
                    <li><Link to="/owners" className="hover:text-emerald-400 transition">Claim Listing</Link></li>
                    <li><Link to="/owners" className="hover:text-emerald-400 transition">Marketing Services</Link></li>
                    <li><Link to="/owners" className="hover:text-emerald-400 transition">Sovereign Shops</Link></li>
                  </ul>
               </div>
               <div>
                  <h4 className="text-white font-black uppercase tracking-widest text-sm mb-6">Company</h4>
                  <ul className="space-y-4 text-sm font-medium">
                    <li><a href="#" className="hover:text-emerald-400 transition">About MapleLeaf</a></li>
                    <li><a href="#" className="hover:text-emerald-400 transition">Privacy Policy</a></li>
                    <li><a href="#" className="hover:text-emerald-400 transition">Contact Support</a></li>
                  </ul>
               </div>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-xs text-emerald-100/30 font-medium">© 2024 MapleLeaf Directory. Data sourced via Gemini AI with real-world verification. For educational and informational purposes only.</p>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-emerald-900 rounded-full flex items-center justify-center hover:bg-emerald-600 transition cursor-pointer">
                  <span className="text-white text-[10px] font-black">FB</span>
                </div>
                <div className="w-8 h-8 bg-emerald-900 rounded-full flex items-center justify-center hover:bg-emerald-600 transition cursor-pointer">
                  <span className="text-white text-[10px] font-black">IG</span>
                </div>
                <div className="w-8 h-8 bg-emerald-900 rounded-full flex items-center justify-center hover:bg-emerald-600 transition cursor-pointer">
                  <span className="text-white text-[10px] font-black">X</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </HashRouter>
  );
};

export default App;
