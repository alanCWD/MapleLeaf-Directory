
import React, { useState } from 'react';
import { joinWaitlistAPI } from '../services/api';

export const LeadBanner: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await joinWaitlistAPI(email);
      setIsSubmitted(true);
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="bg-emerald-600 rounded-[32px] p-8 text-center text-white mb-12 shadow-xl animate-fade-in border-4 border-white/20">
        <h3 className="text-xl font-black">You're on the list! 🌿</h3>
        <p className="text-emerald-100 font-medium">Watch your inbox for the next sovereign shop drop.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-900 via-[#0a2e1f] to-purple-900 rounded-[32px] p-8 md:p-12 mb-12 flex flex-col md:flex-row items-center justify-between gap-8 border border-emerald-800/50 shadow-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl -ml-24 -mb-24"></div>
      
      <div className="relative z-10 max-w-md text-center md:text-left">
        <h3 className="text-2xl md:text-3xl font-black text-white mb-3">Never miss a <span className="text-emerald-400">new drop.</span></h3>
        <p className="text-stone-300 font-medium leading-relaxed">Get notified weekly about new sovereign shops and exclusive boutique harvests in your province.</p>
      </div>

      <form onSubmit={handleSubmit} className="relative z-10 w-full md:w-auto flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <input 
            type="email" 
            required
            placeholder="Enter your email" 
            className="bg-white/10 border border-white/20 text-white placeholder-stone-400 px-6 py-4 rounded-2xl focus:outline-none focus:border-emerald-400 focus:bg-white/20 w-full sm:min-w-[280px] backdrop-blur-md transition-all font-medium"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            disabled={isLoading}
          />
          {error && <p className="text-red-400 text-sm font-medium px-2">{error}</p>}
        </div>
        <button 
          type="submit"
          disabled={isLoading}
          className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-black transition shadow-lg shadow-emerald-900/40 whitespace-nowrap active:scale-95"
        >
          {isLoading ? 'Joining…' : 'Join List'}
        </button>
      </form>
    </div>
  );
};
