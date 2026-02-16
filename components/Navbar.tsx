
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="glass mt-2 rounded-3xl border border-white/40 shadow-xl shadow-emerald-900/5 px-8">
        <div className="flex justify-between h-16 items-center gap-x-12">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-lg shadow-emerald-200">
              <span className="text-white font-black text-xl">M</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-stone-900 whitespace-nowrap">
              MapleLeaf <span className="text-emerald-500">Directory</span>
            </span>
          </Link>
          
          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/admin/review" 
              className="text-stone-600 px-4 py-2.5 rounded-2xl font-bold hover:text-emerald-500 hover:bg-emerald-50 transition-all text-sm whitespace-nowrap"
            >
              Admin Review
            </Link>
            <Link 
              to="/owners" 
              className="bg-emerald-500 text-white px-8 py-2.5 rounded-2xl font-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 text-sm whitespace-nowrap"
            >
              Claim Store
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-stone-900 hover:bg-emerald-50 rounded-xl transition-all duration-300 active:scale-90"
              aria-label="Toggle Menu"
            >
              {/* Standard 3 Horizontal Black Bars */}
              <svg 
                className={`w-8 h-8 transition-all ${isMenuOpen ? 'text-emerald-600' : 'text-stone-900'}`} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-20 left-4 right-4 animate-slide-up">
          <div className="glass rounded-[32px] border border-white/40 shadow-2xl p-4 overflow-hidden">
            <div className="flex flex-col gap-2">
              <Link 
                to="/owners" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-900/10 active:scale-95"
              >
                Claim Store
              </Link>
              <Link 
                to="/admin/review" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center py-4 text-stone-600 font-bold hover:text-emerald-500"
              >
                Admin Review
              </Link>
              <Link 
                to="/" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center py-4 text-stone-600 font-bold hover:text-emerald-500"
              >
                Directory Home
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
