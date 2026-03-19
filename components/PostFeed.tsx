import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchPublishedPosts } from '../services/api';
import type { CreatorPost } from '../types';

interface PostFeedProps {
  storeId?: string;
  storeName?: string;
  compact?: boolean;
}

export const PostFeed: React.FC<PostFeedProps> = ({ storeId: propStoreId, storeName, compact }) => {
  const { isCreator, isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const storeId = propStoreId || searchParams.get('storeId') || undefined;
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const limit = compact ? 6 : 12;

  useEffect(() => {
    setIsLoading(true);
    fetchPublishedPosts({ storeId, page, limit })
      .then(result => {
        setPosts(result.posts);
        setTotal(result.total);
      })
      .catch(err => console.error('Failed to load posts:', err))
      .finally(() => setIsLoading(false));
  }, [page, storeId]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  const renderPostCard = (post: CreatorPost) => {
    const heroImage = post.media?.find(m => m.mediaType === 'image');
    const isRawLocked = post.contentTier === 'raw' && !isAuthenticated;

    const cardInner = (
      <>
        {heroImage ? (
          <div className="aspect-[16/10] overflow-hidden bg-stone-100">
            <img
              src={heroImage.cdnUrl}
              alt=""
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isRawLocked ? 'blur-sm scale-105' : ''}`}
            />
          </div>
        ) : (
          <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-stone-50 flex items-center justify-center">
            <span className={`text-5xl opacity-30 ${isRawLocked ? 'blur-sm' : ''}`}>📝</span>
          </div>
        )}

        <div className={`p-6 ${isRawLocked ? 'select-none' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
              post.contentTier === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {post.contentTier === 'raw' ? '🔥 Raw' : '✨ Clean'}
            </span>
            {post.storeName && (
              <span className="text-[10px] font-bold text-stone-400 truncate max-w-[120px]">
                @ {post.storeName}
              </span>
            )}
          </div>
          <h3 className={`font-black text-stone-900 text-lg leading-tight mb-1 group-hover:text-emerald-600 transition-colors ${isRawLocked ? 'blur-sm' : ''}`}>
            {post.title}
          </h3>
          {post.subtitle && (
            <p className={`text-stone-500 text-sm font-medium mb-2 ${isRawLocked ? 'blur-sm' : ''}`}>
              {truncate(post.subtitle, 80)}
            </p>
          )}
          {post.bodyText && (
            <p className={`text-stone-400 text-sm line-clamp-2 ${isRawLocked ? 'blur-sm' : ''}`}>
              {truncate(post.bodyText, 120)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-100">
            {post.authorImageUrl ? (
              <img src={post.authorImageUrl} alt="" className={`w-6 h-6 rounded-full object-cover ${isRawLocked ? 'blur-sm' : ''}`} />
            ) : (
              <div className={`w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black ${isRawLocked ? 'blur-sm' : ''}`}>
                {(post.authorName?.[0] || 'A').toUpperCase()}
              </div>
            )}
            <span className={`text-xs font-bold text-stone-600 truncate ${isRawLocked ? 'blur-sm' : ''}`}>
              {post.authorName || 'Anonymous'}
            </span>
            <span className="text-xs text-stone-300 ml-auto">{formatDate(post.createdAt)}</span>
          </div>
        </div>

        {isRawLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-[28px]">
            <div className="bg-white/95 rounded-2xl px-5 py-4 shadow-lg text-center max-w-[200px]">
              <span className="text-2xl mb-2 block">🔒</span>
              <p className="text-sm font-black text-stone-800 mb-1">Raw Content</p>
              <p className="text-xs text-stone-500 mb-3">Sign in to read unfiltered posts from creators.</p>
              <a
                href="#/auth"
                onClick={e => e.stopPropagation()}
                className="inline-block bg-emerald-500 text-white text-xs font-black px-4 py-1.5 rounded-xl hover:bg-emerald-400 transition"
              >
                Sign In
              </a>
            </div>
          </div>
        )}
      </>
    );

    if (isRawLocked) {
      return (
        <div
          key={post.id}
          className="group relative bg-white rounded-[28px] border border-stone-200 overflow-hidden"
        >
          {cardInner}
        </div>
      );
    }

    return (
      <Link
        key={post.id}
        to={`/posts/${post.id}`}
        className="group relative bg-white rounded-[28px] border border-stone-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
      >
        {cardInner}
      </Link>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {!compact && (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <Link to="/" className="text-xs font-bold text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-1 mb-3">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            Back to Directory
          </Link>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">
            {storeName ? `Posts about ${storeName}` : 'Culture Hub'}
          </h1>
          <p className="text-stone-500 font-medium mt-1">
            {storeName ? `Stories and experiences about ${storeName}` : 'Stories and experiences from our community creators'}
          </p>
        </div>
        {isCreator && (
          <Link
            to="/posts/create"
            className="bg-emerald-500 text-white px-6 py-3 rounded-2xl font-black hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Create Post
          </Link>
        )}
      </div>
      )}

      {isLoading ? (
        <div className="text-center py-24 bg-white rounded-[40px] border-4 border-dashed border-stone-100">
          <div className="text-6xl mb-6 animate-spin">⏳</div>
          <p className="text-stone-400 font-bold text-lg">Loading posts...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-[40px] border-4 border-dashed border-stone-100">
          <div className="text-6xl mb-6">📝</div>
          <p className="text-stone-400 font-bold text-lg">No posts yet.</p>
          <p className="text-stone-300 text-sm mt-2">Be the first creator to share something with the community.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => renderPostCard(post))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-10">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm font-bold text-stone-500 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
