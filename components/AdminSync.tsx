
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { bulkSyncProvince, getMajorCities } from '../services/geminiService';
import { Province, Store, VerificationStatus } from '../types';
import { bulkVerifyStores } from '../services/api';

interface AdminSyncProps {
  onSync: (stores: Store[]) => Promise<Store[]> | void;
}

export const AdminSync: React.FC<AdminSyncProps> = ({ onSync }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeepDiscovery, setIsDeepDiscovery] = useState(false);
  const [autoVerify, setAutoVerify] = useState(true);
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
    if (autoVerify) {
      addLog(`🔍 Auto-verification enabled. Stores will be checked against real-world sources.`);
    }
    
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
            const processedStores: Store[] = rawStores.map(s => {
              const safeId = btoa((s.name || '') + (s.address || ''))
                .replace(/[^a-zA-Z0-9]/g, '')
                .substring(0, 12);

              return {
                ...s,
                id: `store-${safeId}`,
                province: p,
                isClaimed: false,
                rating: s.rating || 4.0,
                type: (s.type as any) || 'Local Gem',
                verificationStatus: 'ai_suggested' as VerificationStatus,
                confidenceScore: 0,
                evidenceSources: [],
                evidenceCount: 0,
                flagCount: 0,
                adminReviewed: false,
                placesApiMatch: false,
              } as Store;
            });

            const savedStores = await onSync(processedStores);
            const storeList = savedStores || processedStores;
            totalFound += storeList.length;
            addLog(`✅ Parsed ${storeList.length} stores in ${region || p}`);

            if (autoVerify && storeList.length > 0) {
              addLog(`🔍 Running verification pipeline on ${storeList.length} stores...`);
              try {
                const storeIds = storeList.map(s => s.id);
                const verificationResult = await bulkVerifyStores(storeIds);
                
                let verified = 0;
                let unverified = 0;
                for (const r of verificationResult.results) {
                  if (r.verification?.verificationStatus === 'verified') verified++;
                  else unverified++;
                }
                addLog(`✅ Verification complete: ${verified} verified, ${unverified} unverified`);
              } catch (verifyErr: any) {
                addLog(`⚠️ Verification error: ${verifyErr?.message || 'Check console'}`);
              }
            }
          } else {
            addLog(`📭 No results found in ${region || p}`);
          }
        } catch (err: any) {
          addLog(`⚠️  Error in ${region || p}: ${err?.message || 'Check Console'}`);
        }
        
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    setIsSyncing(false);
    setCurrentProvince(null);
    setCurrentCity(null);
    addLog(`🏁 DISCOVERY COMPLETE. Total new unique records: ${totalFound}`);
    if (autoVerify) {
      addLog(`📋 Check the Review Queue for stores needing manual approval.`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] border border-stone-200 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-900 via-[#0a2e1f] to-purple-900 p-10 text-white relative">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl -mb-16 -mr-16"></div>
          <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
            <div>
              <h2 className="text-3xl font-black mb-2 tracking-tight">Master Database Sync</h2>
              <p className="text-emerald-100/60 font-medium">Manage Canada-wide data discovery & verification.</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <label className="flex items-center gap-3 cursor-pointer bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md transition-all hover:bg-white/20">
                <input 
                  type="checkbox" 
                  checked={isDeepDiscovery}
                  onChange={(e) => setIsDeepDiscovery(e.target.checked)}
                  disabled={isSyncing}
                  className="w-5 h-5 accent-emerald-400"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Deep Discovery</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer bg-white/10 px-5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md transition-all hover:bg-white/20">
                <input 
                  type="checkbox" 
                  checked={autoVerify}
                  onChange={(e) => setAutoVerify(e.target.checked)}
                  disabled={isSyncing}
                  className="w-5 h-5 accent-blue-400"
                />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">Auto-Verify</span>
              </label>
              {isSyncing && (
                <div className="flex items-center gap-2 bg-emerald-500/30 text-emerald-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse border border-emerald-400/20">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  SYNC ACTIVE
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6 border-b border-stone-100 pb-10">
            <div className="text-center md:text-left">
              <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1">Current Focus</p>
              <p className="text-stone-800 text-lg font-black">{currentProvince || 'System Idle'}</p>
              <p className="text-emerald-600 text-xs font-bold uppercase tracking-wider">{currentCity || 'Province-Wide Scan'}</p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <button 
                onClick={startDiscovery}
                disabled={isSyncing}
                className={`w-full md:w-auto px-12 py-5 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-lg ${isSyncing ? 'bg-stone-50 text-stone-300 cursor-not-allowed border border-stone-100' : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xl shadow-emerald-600/20'}`}
              >
                {isSyncing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Mapping Canada...
                  </>
                ) : 'Run Discovery Engine'}
              </button>
              <Link 
                to="/admin/review" 
                className="text-xs font-bold text-emerald-600 hover:text-emerald-500 uppercase tracking-widest"
              >
                Open Review Queue →
              </Link>
            </div>
          </div>

          <div className="bg-[#0a2e1f] rounded-[32px] p-8 h-[500px] overflow-y-auto shadow-inner font-mono text-xs leading-relaxed border-8 border-stone-100">
            <div className="flex justify-between items-center mb-6 border-b border-emerald-800/50 pb-4">
              <h4 className="font-black text-emerald-500/50 uppercase tracking-[0.2em] text-[10px]">System Kernel Output</h4>
              <button onClick={() => setLogs([])} className="text-emerald-500/30 hover:text-emerald-400 text-[10px] font-black uppercase tracking-widest">Clear Log</button>
            </div>
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={i} className={`p-1 ${log.includes('⚠️') ? 'text-rose-400' : log.includes('✅') ? 'text-emerald-400' : log.includes('🏙️') ? 'text-sky-400' : log.includes('🔍') ? 'text-blue-400' : 'text-emerald-100/40'}`}>
                  {log}
                </div>
              ))}
              {logs.length === 0 && <p className="text-emerald-900 italic text-sm">Awaiting instruction...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
