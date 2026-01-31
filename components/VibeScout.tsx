
import React, { useState, useEffect } from 'react';
import { Store, UserProfile } from '../types';
import { getVibeRecommendations } from '../services/geminiService';

interface VibeScoutProps {
  stores: Store[];
  onRecommendation: (storeIds: string[]) => void;
}

const PROFILE_KEY = 'mapleleaf_user_profile';

export const VibeScout: React.FC<VibeScoutProps> = ({ stores, onRecommendation }) => {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) {
      const profile = JSON.parse(saved);
      if (profile.email) setEmail(profile.email);
      if (profile.preferences) setAnswers(profile.preferences);
    }
  }, []);

  const steps = [
    {
      id: 'priority',
      question: "Budget or Boutique?",
      options: [
        { label: 'Budget Finds (Best Value)', value: 'budget', icon: '🏷️' },
        { label: 'Boutique Shelf (Top Quality)', value: 'boutique', icon: '💎' },
        { label: 'Sovereign Roots (Traditional)', value: 'sovereign', icon: '🌿' }
      ]
    },
    {
      id: 'method',
      question: "Flower or Edibles?",
      options: [
        { label: 'Flower & Pre-rolls', value: 'flower', icon: '🍃' },
        { label: 'Edibles & Infusions', value: 'edibles', icon: '🍬' },
        { label: 'Concentrates & Vapes', value: 'extracts', icon: '🍯' }
      ]
    },
    {
      id: 'intent',
      question: "Social or Medical?",
      options: [
        { label: 'Social & Recreational', value: 'social', icon: '🎉' },
        { label: 'Medical & Wellness', value: 'medical', icon: '🏥' },
        { label: 'Quick & Discreet', value: 'efficient', icon: '⏱️' }
      ]
    }
  ];

  const handleOption = (value: string) => {
    const newAnswers = { ...answers, [steps[step].id]: value };
    setAnswers(newAnswers);
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      processRecommendations(newAnswers);
    }
  };

  const processRecommendations = async (finalAnswers: any) => {
    if (stores.length === 0) {
      setStep(steps.length);
      return;
    }
    setIsLoading(true);
    try {
      const ids = await getVibeRecommendations(finalAnswers, stores);
      onRecommendation(ids);
      setStep(steps.length);
    } catch (e) {
      console.error(e);
      setStep(steps.length);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: UserProfile = {
      email,
      preferences: answers as any
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setIsSuccess(true);
    setTimeout(() => {
      setIsOpen(false);
      setStep(0);
      setIsSuccess(false);
    }, 2500);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 z-40 bg-stone-900 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 hover:scale-105 transition-transform border border-stone-700 group ring-4 ring-emerald-500/10"
      >
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-xl animate-pulse group-hover:rotate-12 transition-transform">🎯</div>
        <div className="text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Personal Scout</p>
          <p className="text-sm font-bold">Start Micro-Quiz</p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative border border-white/20">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition z-10 p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="p-8 pt-12">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="relative inline-block mb-6">
                <div className="w-16 h-16 border-4 border-emerald-500/20 rounded-full"></div>
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-stone-800 text-lg font-black mb-2">Finding Your Match...</p>
              <p className="text-stone-400 text-sm">Matching your quiz results with Canadian retailers.</p>
            </div>
          ) : isSuccess ? (
            <div className="py-20 text-center">
              <div className="text-7xl mb-6">📬</div>
              <h3 className="text-3xl font-black text-stone-900 mb-2">Check your email!</h3>
              <p className="text-stone-500 px-8">Your curated recommendations and a first-time discount code have been sent.</p>
            </div>
          ) : step < steps.length ? (
            <div className="animate-slide-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-grow h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${((step + 1) / steps.length) * 100}%` }}></div>
                </div>
                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{step + 1} / {steps.length}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-stone-900 mb-8 leading-tight">{steps[step].question}</h2>
              <div className="grid gap-3">
                {steps[step].options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleOption(opt.value)}
                    className="w-full flex items-center gap-5 p-5 rounded-2xl border-2 border-stone-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left active:scale-95 shadow-sm hover:shadow-md"
                  >
                    <span className="text-3xl group-hover:scale-125 transition-transform duration-300 bg-stone-50 p-3 rounded-xl group-hover:bg-emerald-100">{opt.icon}</span>
                    <div>
                        <span className="block font-bold text-stone-700 group-hover:text-emerald-900">{opt.label}</span>
                        <span className="text-[10px] text-stone-400 uppercase font-bold tracking-tighter">Click to select</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-slide-up text-center">
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-[32px] flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner">🎯</div>
              <h2 className="text-3xl font-black text-stone-900 mb-3">Quiz Complete</h2>
              <p className="text-stone-500 mb-8 px-4">We've identified shops matching your "{steps[0].options.find(o => o.value === answers.priority)?.label}" preference and "{steps[2].options.find(o => o.value === answers.intent)?.label}" intention.</p>
              
              <form onSubmit={handleCapture} className="space-y-4">
                <div className="bg-stone-50 p-6 rounded-3xl border border-stone-100 text-left mb-6">
                  <label className="block text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 text-center">Get Your Results & Future Drops</label>
                  <input 
                    type="email" 
                    required
                    placeholder="Enter your email" 
                    className="w-full bg-white border border-stone-200 rounded-xl p-4 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-sm transition-all text-center font-medium"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 active:scale-[0.98] uppercase tracking-widest"
                >
                  Show My Top Matches
                </button>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-stone-400 text-xs font-bold hover:text-stone-600 transition py-2"
                >
                  Skip & see all listings
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
