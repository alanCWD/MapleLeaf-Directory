
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, type AuthUser } from '../hooks/useAuth';

const UserMenu: React.FC<{ user: AuthUser; onClose: () => void }> = ({ user, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const goTo = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div ref={menuRef} className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden z-[9999] animate-fade-in">
      <div className="p-4 border-b border-stone-100 bg-stone-50">
        <p className="font-bold text-stone-900 text-sm truncate">{user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'User'}</p>
        {user.email && <p className="text-xs text-stone-500 truncate">{user.email}</p>}
        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700">
          {user.role}
        </span>
      </div>
      <div className="p-2">
        {(user.role === 'owner' || user.role === 'admin') && (
          <button onClick={() => goTo('/owners')} className="w-full text-left block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
            My Stores
          </button>
        )}
        {user.role === 'admin' && (
          <>
            <button onClick={() => goTo('/admin/review')} className="w-full text-left block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
              Admin Review
            </button>
            <button onClick={() => goTo('/admin/users')} className="w-full text-left block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
              User Management
            </button>
            <button onClick={() => goTo('/admin/sync')} className="w-full text-left block px-3 py-2 rounded-xl text-sm font-medium text-stone-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
              Database Engine
            </button>
          </>
        )}
        <div className="border-t border-stone-100 mt-1 pt-1">
          <a href="/api/logout" className="block px-3 py-2 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 transition">
            Sign Out
          </a>
        </div>
      </div>
    </div>
  );
};

export const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-4 z-50 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="glass mt-2 rounded-3xl border border-white/40 shadow-xl shadow-emerald-900/5 px-8 overflow-visible">
        <div className="flex justify-between h-16 items-center gap-x-12">
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center transform group-hover:rotate-12 transition-transform duration-300 shadow-lg shadow-emerald-200">
              <span className="text-white font-black text-xl">M</span>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-stone-900 whitespace-nowrap">
              MapleLeaf <span className="text-emerald-500">Directory</span>
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-4">
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
              <div className="relative">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 pl-3 pr-1 py-1 rounded-full hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-200"
                >
                  <span className="text-sm font-bold text-stone-700 max-w-[100px] truncate">
                    {user.firstName || 'Account'}
                  </span>
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-emerald-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
                      {(user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                </button>
                {showUserMenu && <UserMenu user={user} onClose={() => setShowUserMenu(false)} />}
              </div>
            ) : (
              <a 
                href="/api/login"
                className="bg-emerald-500 text-white px-6 py-2.5 rounded-2xl font-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 text-sm whitespace-nowrap"
              >
                Sign In
              </a>
            )}
          </div>

          <div className="md:hidden flex items-center gap-3">
            {!isLoading && isAuthenticated && user ? (
              <div 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="relative cursor-pointer"
              >
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-emerald-200" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
                    {(user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                {showUserMenu && <UserMenu user={user} onClose={() => setShowUserMenu(false)} />}
              </div>
            ) : !isLoading ? (
              <a href="/api/login" className="text-sm font-bold text-emerald-600 hover:text-emerald-500">Sign In</a>
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
