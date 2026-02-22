
import React, { useState, useEffect } from 'react';
import { Store, UserProfile } from '../types';
import { getVibeRecommendations } from '../services/geminiService';

interface PersonalScoutProps {
  stores: Store[];
  onRecommendation: (storeIds: string[]) => void;
}

const PROFILE_KEY = 'legacyleaf_user_profile';

export const PersonalScout: React.FC<PersonalScoutProps> = ({ stores, onRecommendation }) => {
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
      question: "What's the wallet vibe?",
      description: "Are you chasing high-end harvests or just a great deal?",
      options: [
        { label: 'High-Roller (Premium Shelf)', value: 'boutique', icon: '💎' },
        { label: 'Deal-Hunter (Best Value)', value: 'budget', icon: '🏷️' },
        { label: 'The Roots (Indigenous Owned)', value: 'sovereign', icon: '🌿' }
      ]
    },
    {
      id: 'method',
      question: "What's the snack strategy?",
      description: "Smoky clouds or sweet treats? Pick your poison.",
      options: [
        { label: 'Classic Cloud (Flower)', value: 'flower', icon: '🌬️' },
        { label: 'Sweet Tooth (Edibles)', value: 'edibles', icon: '🍭' },
        { label: 'Deep Dive (Concentrates)', value: 'extracts', icon: '🍯' }
      ]
    },
    {
      id: 'intent',
      question: "What's the end game?",
      description: "Are we partying, healing, or just in a hurry?",
      options: [
        { label: 'Social Butterfly', value: 'social', icon: '🦋' },
        { label: 'Pure Zen (Medical)', value: 'medical', icon: '🧘' },
        { label: 'In & Out (Quick Pick-up)', value: 'efficient', icon: '🏃' }
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
        className="fixed bottom-8 right-8 z-40 bg-emerald-500 text-white p-4 rounded-[28px] shadow-2xl flex items-center gap-3 hover:scale-110 active:scale-95 transition-all group ring-8 ring-emerald-500/10"
      >
        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform">✨</div>
        <div className="text-left pr-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">AI MATCH</p>
          <p className="text-sm font-black">Match My Vibe</p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xl animate-fade-in">
      <div className="bg-[#FDFCF9] w-full max-w-lg rounded-[48px] shadow-2xl overflow-hidden relative border border-white/40">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-8 right-8 text-stone-400 hover:text-stone-900 transition z-10 p-2 hover:bg-stone-100 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <div className="p-10 pt-16">
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="relative inline-block mb-8">
                <div className="w-20 h-20 border-8 border-emerald-100 rounded-full"></div>
                <div className="absolute top-0 left-0 w-20 h-20 border-8 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-3xl">🧩</div>
              </div>
              <p className="text-2xl font-black text-stone-900 mb-2">Analyzing the Vibe...</p>
              <p className="text-stone-500 font-medium">Gemini is checking the best local stashes for you.</p>
            </div>
          ) : isSuccess ? (
            <div className="py-20 text-center">
              <div className="text-8xl mb-8 animate-bounce">💌</div>
              <h3 className="text-3xl font-black text-stone-900 mb-4">You're All Set!</h3>
              <p className="text-stone-500 font-medium px-8 leading-relaxed">We've personalized your directory. Check the map for your gold stars! ✨</p>
            </div>
          ) : step < steps.length ? (
            <div className="animate-slide-up">
              <div className="flex items-center gap-4 mb-10">
                <div className="flex-grow h-3 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-700" style={{ width: `${((step + 1) / steps.length) * 100}%` }}></div>
                </div>
                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">{step + 1} / {steps.length}</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-3 leading-tight tracking-tight">{steps[step].question}</h2>
              <p className="text-stone-500 font-medium mb-10">{steps[step].description}</p>
              <div className="grid gap-4">
                {steps[step].options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleOption(opt.value)}
                    className="w-full flex items-center gap-6 p-6 rounded-[28px] border-2 border-stone-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left active:scale-[0.97] shadow-sm hover:shadow-xl hover:shadow-emerald-900/5"
                  >
                    <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center text-4xl group-hover:scale-110 transition-transform duration-300 group-hover:bg-white shadow-inner">
                      {opt.icon}
                    </div>
                    <div>
                        <span className="block text-xl font-black text-stone-800 group-hover:text-emerald-900">{opt.label}</span>
                        <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">Tap to select</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-slide-up text-center">
              <div className="w-24 h-24 bg-purple-100 text-purple-600 rounded-[32px] flex items-center justify-center text-5xl mx-auto mb-8 shadow-inner rotate-3">🚀</div>
              <h2 className="text-4xl font-black text-stone-900 mb-4">Match Found!</h2>
              <p className="text-stone-500 font-medium mb-10 px-4 leading-relaxed">We found some spots that totally match your <b>{answers.priority}</b> needs. Let's get you there!</p>
              
              <form onSubmit={handleCapture} className="space-y-4">
                <div className="bg-emerald-50 p-8 rounded-[32px] border border-emerald-100 text-left mb-8 shadow-inner">
                  <label className="block text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 text-center">Save Profile & See Matches</label>
                  <input 
                    type="email" 
                    required
                    placeholder="Your best email" 
                    className="w-full bg-white border-2 border-emerald-100 rounded-2xl p-4 outline-none focus:border-emerald-500 focus:ring-8 focus:ring-emerald-500/5 shadow-sm transition-all text-center font-bold text-lg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-6 rounded-[24px] font-black hover:bg-emerald-500 transition-all shadow-2xl shadow-emerald-600/20 active:scale-[0.98] uppercase tracking-widest text-lg"
                >
                  Show Me the Goods!
                </button>
                <button 
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-stone-400 text-sm font-bold hover:text-stone-600 transition py-4"
                >
                  Nah, just show me everyone
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
