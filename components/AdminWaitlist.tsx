
import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAdminWaitlistAPI } from '../services/api';

interface WaitlistEntry {
  id: number;
  email: string;
  createdAt: string;
}

export const AdminWaitlist: React.FC = () => {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminWaitlistAPI();
      setEntries(data);
    } catch (err) {
      console.error('Failed to load waitlist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      load();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isAdmin]);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-800 mb-4">Sign in required</h2>
        <p className="text-stone-600">You must be signed in as an admin to view this page.</p>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-2xl font-black text-stone-800 mb-4">Access denied</h2>
        <p className="text-stone-600">Admin access is required to view this page.</p>
      </div>
    );
  }

  const filtered = entries.filter(e =>
    e.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-stone-900 mb-1">Waitlist</h1>
        <p className="text-stone-500 font-medium">
          {isLoading ? 'Loading…' : `${entries.length} subscriber${entries.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by email…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-stone-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-medium">{searchQuery ? 'No results match your search.' : 'No one on the waitlist yet.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-6 py-4 font-bold text-stone-600 uppercase tracking-wide text-xs">#</th>
                <th className="text-left px-6 py-4 font-bold text-stone-600 uppercase tracking-wide text-xs">Email</th>
                <th className="text-left px-6 py-4 font-bold text-stone-600 uppercase tracking-wide text-xs">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, idx) => (
                <tr key={entry.id} className="border-b border-stone-100 last:border-0 hover:bg-emerald-50/40 transition-colors">
                  <td className="px-6 py-4 text-stone-400 font-mono text-xs">{idx + 1}</td>
                  <td className="px-6 py-4 text-stone-800 font-medium">{entry.email}</td>
                  <td className="px-6 py-4 text-stone-500">{formatDate(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
