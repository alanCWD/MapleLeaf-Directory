import { useState, useEffect, useCallback } from 'react';
import type { UserBadge, SocialLink } from '../services/api';

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  handle: string | null;
  avatarUrl: string | null;
  role: string;
  isCreator: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  badges: UserBadge[];
  socialLinks: SocialLink[];
  socialLinkPlatform: string | null;
  socialLinkUrl: string | null;
  socialLinkPublic: boolean;
  socialLinkVerified: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/user', { credentials: 'include' });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch user');
      const data = await res.json();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    const handler = () => fetchUser();
    window.addEventListener('auth:user-updated', handler);
    return () => window.removeEventListener('auth:user-updated', handler);
  }, [fetchUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isOwner: user?.role === 'owner' || user?.role === 'admin',
    isCreator: user?.isCreator === true || user?.role === 'admin',
    refetch: fetchUser,
  };
}
