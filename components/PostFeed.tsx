import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchPublishedPosts } from '../services/api';
import type { CreatorPost } from '../types';

export const PostFeed: React.FC = () => {
  const { isCreator } = useAuth();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const limit = 12;

  useEffect(() => {
    setIsLoading(true);
    fetchPublishedPosts({ page, limit })
      .then(result => {
        setPosts(result.posts);
        setTotal(result.total);
      })
      .catch(err => console.error('Failed to load posts:', err))
      .finally(() => setIsLoading(false));
  }, [page]);

  const totalPages = Math.ceil(total / limit);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '...' : text;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <Link to="/" className="text-xs font-bold text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-1 mb-3">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            Back to Directory
          </Link>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight">Creator Posts</h1>
          <p className="text-stone-500 font-medium mt-1">Stories and experiences from our community creators</p>
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
            {posts.map(post => {
              const heroImage = post.media?.find(m => m.mediaType === 'image');
              return (
                <Link
                  key={post.id}
                  to={`/posts/${post.id}`}
                  className="group bg-white rounded-[28px] border border-stone-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                >
                  {heroImage ? (
                    <div className="aspect-[16/10] overflow-hidden bg-stone-100">
                      <img src={heroImage.cdnUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="aspect-[16/10] bg-gradient-to-br from-emerald-50 to-stone-50 flex items-center justify-center">
                      <span className="text-5xl opacity-30">📝</span>
                    </div>
                  )}
                  <div className="p-6">
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
                    <h3 className="font-black text-stone-900 text-lg leading-tight mb-1 group-hover:text-emerald-600 transition-colors">
                      {post.title}
                    </h3>
                    {post.subtitle && (
                      <p className="text-stone-500 text-sm font-medium mb-2">{truncate(post.subtitle, 80)}</p>
                    )}
                    {post.bodyText && (
                      <p className="text-stone-400 text-sm line-clamp-2">{truncate(post.bodyText, 120)}</p>
                    )}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-100">
                      {post.authorImageUrl ? (
                        <img src={post.authorImageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black">
                          {(post.authorName?.[0] || 'A').toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-stone-600 truncate">{post.authorName || 'Anonymous'}</span>
                      <span className="text-xs text-stone-300 ml-auto">{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
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
