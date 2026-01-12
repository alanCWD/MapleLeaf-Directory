
import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-stone-900">MapleLeaf <span className="text-emerald-600">Directory</span></span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-stone-600 hover:text-emerald-600 font-medium transition">Find Stores</Link>
            <Link to="/owners" className="text-stone-600 hover:text-emerald-600 font-medium transition">List Your Business</Link>
            <Link to="/owners" className="bg-emerald-600 text-white px-5 py-2 rounded-full font-semibold hover:bg-emerald-700 transition shadow-sm">
              Claim Store
            </Link>
          </div>

          <div className="md:hidden">
            <button className="p-2 text-stone-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
