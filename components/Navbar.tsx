
import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BadgeIcon } from './BadgeIcon';

export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showUserMenu]);

  const avatarSrc = user?.avatarUrl || user?.profileImageUrl;
  const profileIncomplete = isAuthenticated && user && !user.socialLinks?.length;

  const avatarEl = avatarSrc ? (
    <img src={avatarSrc} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-emerald-200" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
      {(user?.handle?.[0] || user?.firstName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
    </div>
  );

  const avatar = profileIncomplete ? (
    <div className="relative">
      {avatarEl}
      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-400 border-2 border-white rounded-full" title="Complete your profile" />
    </div>
  ) : avatarEl;

  return (
    <nav className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-8 pt-4">
      <div className="glass mx-auto max-w-7xl mt-2 rounded-3xl border border-white/40 shadow-xl shadow-emerald-900/5 px-4 sm:px-8">
        <div className="flex justify-between h-16 items-center gap-x-2 md:gap-x-12">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 group flex-shrink-0 min-w-0">
            <div className="w-10 h-10 flex-shrink-0 bg-emerald-500 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-lg shadow-emerald-200">
              <span className="text-white font-black text-xl">L</span>
            </div>
            <span className="text-base sm:text-xl font-extrabold tracking-tight text-stone-900 truncate">
              LegacyLeaf <span className="text-emerald-500 hidden sm:inline">Directory</span>
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-4">
            <Link 
              to="/posts" 
              className="text-stone-600 px-4 py-2.5 rounded-2xl font-bold hover:text-emerald-500 hover:bg-emerald-50 transition-all text-sm whitespace-nowrap"
            >
              Hub
            </Link>
            <Link 
              to="/submit" 
              className="text-stone-600 px-4 py-2.5 rounded-2xl font-bold hover:text-emerald-500 hover:bg-emerald-50 transition-all text-sm whitespace-nowrap"
            >
              Submit a Store
            </Link>
            <Link 
              to="/owners" 
              className="text-stone-600 px-4 py-2.5 rounded-2xl font-bold hover:text-emerald-500 hover:bg-emerald-50 transition-all text-sm whitespace-nowrap"
            >
              Claim Store
            </Link>
            
            {isLoading ? (
              <div className="w-9 h-9 rounded-full bg-stone-200 animate-pulse" />
            ) : isAuthenticated && user ? (
              <div
                className="cursor-pointer"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-200">
                  <span className="text-sm font-bold text-stone-700 max-w-[100px] truncate">
                    {user.handle ? `@${user.handle}` : (user.firstName || 'Account')}
                  </span>
                  {avatar}
                </div>
              </div>
            ) : (
              <a 
                href="#/auth"
                className="bg-emerald-500 text-white px-6 py-2.5 rounded-2xl font-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 text-sm whitespace-nowrap"
              >
                Sign In
              </a>
            )}
          </div>

          <div className="md:hidden flex items-center gap-3">
            {!isLoading && isAuthenticated && user ? (
              <div onClick={() => setShowUserMenu(!showUserMenu)} className="cursor-pointer">
                {avatar}
              </div>
            ) : !isLoading ? (
              <a href="#/auth" className="text-sm font-bold text-emerald-600 hover:text-emerald-500">Sign In</a>
            ) : null}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-stone-900 hover:bg-emerald-50 rounded-xl transition-all duration-300 active:scale-90"
              aria-label="Toggle Menu"
            >
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

      {showUserMenu && user && (
        <div
          ref={dropdownRef}
          className="absolute right-0 sm:right-4 top-[72px] w-64 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden z-[9999] animate-fade-in"
          style={{ maxWidth: 'calc(100vw - 2rem)' }}
        >
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            {user.handle ? (
              <p className="font-bold text-emerald-700 text-sm truncate">@{user.handle}</p>
            ) : (
              <p className="font-bold text-stone-900 text-sm truncate">
                {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}
              </p>
            )}
            {user.email && <p className="text-xs text-stone-500 truncate">{user.email}</p>}
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
              {user.role}
            </span>
            {user.badges && user.badges.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {user.badges.map((b) => (
                  <BadgeIcon key={b.badgeType} badgeType={b.badgeType as any} size="sm" showLabel={false} />
                ))}
              </div>
            )}
          </div>
          {profileIncomplete && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <a href="#/settings/profile" onClick={() => setShowUserMenu(false)} className="text-xs font-bold text-amber-700 hover:underline">
                Add a social link to complete your profile
              </a>
            </div>
          )}
          <div className="p-2">
            {(user.role === 'owner' || user.role === 'admin') && (
              <a href="#/owners" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                My Stores
              </a>
            )}
            {user.role === 'admin' && (
              <>
                <a href="#/admin/stores" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Store Management
                </a>
                <a href="#/admin/review" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Admin Review
                </a>
                <a href="#/admin/users" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  User Management
                </a>
                <a href="#/admin/sync" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Database Engine
                </a>
                <a href="#/admin/branding" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Branding Assets
                </a>
                <a href="#/admin/waitlist" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Waitlist
                </a>
                <a href="#/admin/drops" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                  Store Drops
                </a>
              </>
            )}
            <a href="#/settings/profile" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
              Profile Settings
            </a>
            <a href="#/badges" onClick={() => setShowUserMenu(false)} className="block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
              My Badges
            </a>
            <div className="border-t border-stone-100 mt-1 pt-1">
              <a href="/api/logout" className="block px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition">
                Sign Out
              </a>
            </div>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div className="md:hidden absolute top-20 left-0 right-0 px-4 animate-slide-up">
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
                to="/posts" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center py-4 text-stone-600 font-bold hover:text-emerald-500"
              >
                Hub
              </Link>
              <Link 
                to="/submit" 
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center py-4 text-stone-600 font-bold hover:text-emerald-500"
              >
                Submit a Store
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
