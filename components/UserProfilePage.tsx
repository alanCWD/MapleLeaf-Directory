import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchUserProfile } from '../services/api';
import type { PublicUserProfile } from '../services/api';
import { SocialPlatformIcon } from './SocialPlatformIcon';

export const UserProfilePage: React.FC = () => {
  const { handle } = useParams<{ handle: string }>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!handle) return;
    setIsLoading(true);
    fetchUserProfile(handle)
      .then(setProfile)
      .catch((err: Error) => setError(err.message || 'Profile not found'))
      .finally(() => setIsLoading(false));
  }, [handle]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl animate-spin mb-4">⏳</div>
        <p className="text-stone-400 font-bold">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">👤</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Profile Not Found</h2>
        <p className="text-stone-500 font-medium mb-8">{error || 'This user profile does not exist.'}</p>
        <Link to="/" className="inline-block bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition">
          Go Home
        </Link>
      </div>
    );
  }

  const initials = (profile.handle?.[0] || 'U').toUpperCase();

  function extractDisplayName(platform: string, url: string): string {
    if (platform === 'discord') return url;
    try {
      const u = new URL(url);
      const segments = u.pathname.split('/').filter(Boolean);
      if (platform === 'reddit') {
        return '@' + (segments[1] || segments[0] || url);
      }
      return '@' + (segments[0] || url);
    } catch {
      return url;
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/" className="text-xs font-bold text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-1 mb-8">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Directory Home
      </Link>

      <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-50 to-stone-50 px-8 py-10 flex items-center gap-6 border-b border-stone-100">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-3xl border-4 border-white shadow-md flex-shrink-0">
              {initials}
            </div>
          )}
          <div>
            {profile.handle ? (
              <h1 className="text-2xl font-black text-stone-900">@{profile.handle}</h1>
            ) : (
              <h1 className="text-2xl font-black text-stone-900">Community Member</h1>
            )}
            <p className="text-sm text-stone-400 font-medium mt-1">
              {profile.posts.length} post{profile.posts.length !== 1 ? 's' : ''} · {profile.reviews.length} review{profile.reviews.length !== 1 ? 's' : ''}
            </p>
            {profile.socialLinks && profile.socialLinks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {profile.socialLinks.map((link) => (
                  link.platform !== 'discord' ? (
                    <a
                      key={link.platform}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-emerald-600 transition-colors bg-white border border-stone-200 rounded-full px-2.5 py-1 shadow-sm"
                    >
                      <SocialPlatformIcon platform={link.platform} className="w-3.5 h-3.5" />
                      <span>{extractDisplayName(link.platform, link.url)}</span>
                      {link.verified && (
                        <svg className="w-3 h-3 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      )}
                    </a>
                  ) : (
                    <span key={link.platform} className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 bg-white border border-stone-200 rounded-full px-2.5 py-1 shadow-sm">
                      <SocialPlatformIcon platform="discord" className="w-3.5 h-3.5" />
                      <span>{link.url} on Discord</span>
                    </span>
                  )
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 space-y-10">
          {profile.posts.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
                Posts
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {profile.posts.map(post => {
                  const heroImage = post.media?.find(m => m.mediaType === 'image');
                  return (
                    <Link
                      key={post.id}
                      to={`/posts/${post.id}`}
                      className="group bg-stone-50 rounded-2xl border border-stone-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all flex"
                    >
                      {heroImage && (
                        <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-stone-100">
                          <img src={heroImage.cdnUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="p-4 flex-grow min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                            post.contentTier === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {post.contentTier === 'raw' ? '🔥 Raw' : '✨ Clean'}
                          </span>
                          <span className="text-[10px] text-stone-400">{formatDate(post.createdAt)}</span>
                        </div>
                        <h3 className="font-bold text-stone-900 text-sm truncate group-hover:text-emerald-600 transition-colors">{post.title}</h3>
                        {post.storeName && (
                          <p className="text-[10px] text-stone-400 mt-0.5">@ {post.storeName}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {profile.reviews.length > 0 && (
            <section>
              <h2 className="text-lg font-black text-stone-900 mb-4 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-purple-500 rounded-full"></span>
                Reviews
              </h2>
              <div className="space-y-3">
                {profile.reviews.map(review => (
                  <Link
                    key={review.id}
                    to={`/store/${review.storeId}`}
                    className="block bg-stone-50 rounded-2xl border border-stone-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-stone-900 text-sm truncate">{review.storeName}</p>
                        {review.reviewText && (
                          <p className="text-stone-500 text-xs mt-1 line-clamp-2">{review.reviewText}</p>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1">{formatDate(review.createdAt)}</p>
                      </div>
                      <div className="flex-shrink-0 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <span key={star} className={`text-sm ${star <= review.rating ? 'text-amber-400' : 'text-stone-200'}`}>★</span>
                        ))}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {profile.posts.length === 0 && profile.reviews.length === 0 && (
            <div className="text-center py-12">
              <p className="text-stone-400 font-bold">Nothing posted yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
