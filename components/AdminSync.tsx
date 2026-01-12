
import React, { useState } from 'react';
import { bulkSyncProvince, getMajorCities } from '../services/geminiService';
import { Province, Store } from '../types';

interface AdminSyncProps {
  onSync: (stores: Store[]) => void;
}

export const AdminSync: React.FC<AdminSyncProps> = ({ onSync }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeepDiscovery, setIsDeepDiscovery] = useState(false);
  const [currentProvince, setCurrentProvince] = useState<Province | null>(null);
  const [currentCity, setCurrentCity] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 99)]);
  };

  const startDiscovery = async () => {
    setIsSyncing(true);
    setLogs([]);
    addLog(`🚀 Initializing ${isDeepDiscovery ? 'DEEP' : 'STANDARD'} Discovery Engine...`);
    
    const provinces = Object.values(Province);
    let totalFound = 0;
    
    for (const p of provinces) {
      setCurrentProvince(p);
      addLog(`🌐 Indexing Province: ${p}...`);
      
      const regionsToSearch = isDeepDiscovery ? await getMajorCities(p) : [null];
      
      if (isDeepDiscovery) {
        addLog(`📍 Found ${regionsToSearch.length} major hubs in ${p}. Crawling...`);
      }

      for (const region of regionsToSearch) {
        if (region) {
          setCurrentCity(region);
          addLog(`🏙️  Deep scanning: ${region}...`);
        }
        
        try {
          const rawStores = await bulkSyncProvince(p, region || undefined);
          
          if (rawStores.length > 0) {
            const processedStores: Store[] = rawStores.map(s => ({
              ...s,
              // Use name + address hash for better deduplication
              id: `store-${btoa((s.name || '') + (s.address || '')).substring(0, 12)}`,
              province: p,
              isClaimed: false,
              rating: s.rating || 4.0,
              type: (s.type as any) || 'Licensed'
            } as Store));

            onSync(processedStores);
            totalFound += processedStores.length;
            addLog(`✅ Parsed ${processedStores.length} stores in ${region || p}`);
          }
        } catch (err: any) {
          addLog(`⚠️  Error in ${region || p}: ${err?.message || 'Check Console'}`);
        }
        
        // Anti-throttling delay
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsSyncing(false);
    setCurrentProvince(null);
    setCurrentCity(null);
    addLog(`🏁 DISCOVERY COMPLETE. Total new unique records: ${totalFound}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden">
        <div className="bg-stone-900 p-8 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black mb-2">Master Database Sync</h2>
              <p className="text-stone-400">Manage Canada-wide data discovery & persistence.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-stone-800 px-4 py-2 rounded-xl border border-stone-700">
                <input 
                  type="checkbox" 
                  checked={isDeepDiscovery}
                  onChange={(e) => setIsDeepDiscovery(e.target.checked)}
                  disabled={isSyncing}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-xs font-bold uppercase tracking-wider">Deep Discovery Mode</span>
              </label>
              {isSyncing && (
                <div className="flex items-center gap-2 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  SYNC ACTIVE
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 border-b border-stone-100 pb-8">
            <div className="text-center md:text-left">
              <p className="text-stone-500 text-sm">Region: <span className="font-bold text-stone-800">{currentProvince || 'Idle'}</span></p>
              <p className="text-stone-500 text-sm">Target: <span className="font-bold text-emerald-600 uppercase">{currentCity || 'Province-Wide'}</span></p>
            </div>
            <button 
              onClick={startDiscovery}
              disabled={isSyncing}
              className={`w-full md:w-auto px-10 py-4 rounded-xl font-bold transition flex items-center justify-center gap-3 ${isSyncing ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-xl'}`}
            >
              {isSyncing ? 'Synchronizing...' : 'Run Discovery Engine'}
            </button>
          </div>

          <div className="bg-black rounded-2xl p-6 h-96 overflow-y-auto shadow-inner font-mono text-[11px] leading-relaxed">
            <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-2">
              <h4 className="font-bold text-stone-500 uppercase tracking-widest">System Output</h4>
              <button onClick={() => setLogs([])} className="text-stone-600 hover:text-stone-400">Clear</button>
            </div>
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className={`${log.includes('❌') ? 'text-red-500' : log.includes('✅') ? 'text-emerald-400' : log.includes('🏙️') ? 'text-sky-400' : 'text-stone-400'}`}>
                  {log}
                </div>
              ))}
              {logs.length === 0 && <p className="text-stone-800 italic">System Ready...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
