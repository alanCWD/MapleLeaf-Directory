import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { fetchPostById, deleteCreatorPost } from '../services/api';
import type { CreatorPost } from '../types';

export const PostDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [post, setPost] = useState<CreatorPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    fetchPostById(parseInt(id))
      .then(setPost)
      .catch(() => setError('Post not found'))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!post) return;
    setDeleting(true);
    try {
      await deleteCreatorPost(post.id);
      navigate('/posts');
    } catch {
      setError('Failed to delete post');
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const isOwner = user && post && user.id === post.userId;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-stone-400 font-bold">Loading post...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">📭</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Post Not Found</h2>
        <p className="text-stone-500 font-medium mb-8">{error || 'This post may have been removed or is not yet published.'}</p>
        <Link to="/posts" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Browse Posts
        </Link>
      </div>
    );
  }

  const images = post.media?.filter(m => m.mediaType === 'image') || [];
  const videos = post.media?.filter(m => m.mediaType === 'video') || [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <Link to="/posts" className="text-xs font-bold text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-1 mb-6">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Culture Hub
      </Link>

      <article className="bg-white rounded-[32px] border border-stone-200 shadow-sm overflow-hidden">
        {images.length > 0 && (
          <div className={images.length === 1 ? '' : 'grid grid-cols-2 gap-1'}>
            {images.map((img, i) => (
              <div key={img.id || i} className={`${images.length === 1 ? 'aspect-[16/9]' : 'aspect-square'} overflow-hidden bg-stone-100`}>
                <img src={img.cdnUrl} alt={img.caption || ''} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {videos.length > 0 && videos.map((v, i) => {
          const isBunnyUrl = v.cdnUrl && (v.cdnUrl.includes('.b-cdn.net') || v.cdnUrl.includes('.bunny.net') || v.cdnUrl.includes('.mediadelivery.net'));
          if (!isBunnyUrl) return null;
          return (
            <div key={v.id || i} className="aspect-video bg-black">
              <iframe
                src={v.cdnUrl}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          );
        })}

        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              post.contentTier === 'raw' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {post.contentTier === 'raw' ? '🔥 Raw' : '✨ Clean'}
            </span>
            {post.storeName && (
              <Link
                to={`/store/${post.storeId}`}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-500 transition"
              >
                @ {post.storeName}
              </Link>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight leading-tight mb-3">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="text-xl text-stone-500 font-medium mb-6">{post.subtitle}</p>
          )}

          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-stone-100">
            {post.authorImageUrl ? (
              <img src={post.authorImageUrl} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-stone-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black">
                {(post.authorName?.[0] || 'A').toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-bold text-stone-900 text-sm">{post.authorName || 'Anonymous'}</p>
              <p className="text-xs text-stone-400">{formatDate(post.createdAt)}</p>
            </div>
          </div>

          {post.bodyText && (
            <div className="prose prose-stone max-w-none">
              {post.bodyText.split('\n').map((paragraph, i) => (
                paragraph.trim() ? (
                  <p key={i} className="text-stone-700 leading-relaxed mb-4">{paragraph}</p>
                ) : (
                  <br key={i} />
                )
              ))}
            </div>
          )}

          {(isOwner || isAdmin) && (
            <div className="mt-10 pt-6 border-t border-stone-100">
              {confirmDelete ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-stone-500 font-medium">Are you sure?</span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-stone-100 text-stone-600 hover:bg-stone-200 transition"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition border border-red-200"
                >
                  Delete Post
                </button>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
};
