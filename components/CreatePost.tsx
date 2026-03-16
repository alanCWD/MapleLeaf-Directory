import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createCreatorPost, uploadPostImage, fetchStores } from '../services/api';
import type { Store, ContentTier } from '../types';

interface MediaItem {
  mediaType: 'image' | 'video';
  cdnUrl: string;
  bunnyId?: string;
  caption: string;
  file?: File;
  uploading?: boolean;
  error?: string;
}

export const CreatePost: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading, isCreator } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [contentTier, setContentTier] = useState<ContentTier>('clean');
  const [storeId, setStoreId] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [stores, setStores] = useState<Store[]>([]);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => {});
  }, []);

  const filteredStores = storeSearch.trim()
    ? stores.filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase())).slice(0, 8)
    : [];

  const selectedStore = stores.find(s => s.id === storeId);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < Math.min(files.length, 10 - mediaItems.length); i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} is too large (max 20MB)`);
        continue;
      }
      const item: MediaItem = {
        mediaType: 'image',
        cdnUrl: URL.createObjectURL(file),
        caption: '',
        file,
        uploading: true,
      };
      setMediaItems(prev => [...prev, item]);

      try {
        const result = await uploadPostImage(file);
        setMediaItems(prev =>
          prev.map(m =>
            m.file === file ? { ...m, cdnUrl: result.cdnUrl, uploading: false } : m
          )
        );
      } catch (err: any) {
        setMediaItems(prev =>
          prev.map(m =>
            m.file === file ? { ...m, uploading: false, error: err.message } : m
          )
        );
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');

    const uploadedMedia = mediaItems
      .filter(m => !m.uploading && !m.error && m.cdnUrl)
      .map(m => ({
        mediaType: m.mediaType,
        cdnUrl: m.cdnUrl,
        bunnyId: m.bunnyId,
        caption: m.caption,
      }));

    try {
      const post = await createCreatorPost({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        bodyText: bodyText.trim() || undefined,
        contentTier,
        storeId: storeId || undefined,
        media: uploadedMedia,
      });
      setSuccess({ id: post.id, status: post.status });
    } catch (err: any) {
      setError(err.message || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-stone-400 font-bold">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">✍️</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Sign In to Create Posts</h2>
        <p className="text-stone-500 font-medium mb-8">You need to be signed in to create content.</p>
        <a href="#/auth" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Sign In
        </a>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🎨</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Creator Access Required</h2>
        <p className="text-stone-500 font-medium mb-8">
          You need creator access to publish posts. An admin can grant this in the user management panel.
        </p>
        <Link to="/" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Back to Directory
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-emerald-100">
          <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-stone-900 mb-3">
          {success.status === 'published' ? 'Post Published!' : success.status === 'pending_moderation' ? 'Post Submitted for Review' : 'Post Could Not Be Published'}
        </h2>
        <p className="text-stone-500 font-medium mb-8">
          {success.status === 'published'
            ? 'Your post is now live and visible to everyone.'
            : success.status === 'pending_moderation'
            ? 'Your "Raw" post has been submitted and will be reviewed by an admin before publishing.'
            : 'The content did not pass the automatic moderation check. Please revise and try again.'}
        </p>
        <div className="flex gap-3 justify-center">
          {success.status === 'published' && (
            <Link to={`/posts/${success.id}`} className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
              View Post
            </Link>
          )}
          <Link to="/posts" className="bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition">
            All Posts
          </Link>
          <button onClick={() => { setSuccess(null); setTitle(''); setSubtitle(''); setBodyText(''); setMediaItems([]); setStoreId(''); }} className="bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/posts" className="text-xs font-bold text-stone-400 hover:text-emerald-600 uppercase tracking-widest transition-colors flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          Back to Posts
        </Link>
        <h1 className="text-3xl font-black text-stone-900 mt-3 tracking-tight">Create a Post</h1>
        <p className="text-stone-500 font-medium mt-1">Share your experience with the community</p>
      </div>

      <div className="bg-white rounded-[32px] border border-stone-200 shadow-sm p-8 md:p-10 space-y-8">
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-3">Content Tier</label>
          <div className="flex gap-3">
            <button
              onClick={() => setContentTier('clean')}
              className={`flex-1 p-4 rounded-2xl border-2 text-left transition-all ${
                contentTier === 'clean'
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-stone-200 bg-stone-50 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">✨</span>
                <span className="font-black text-stone-900">Clean</span>
              </div>
              <p className="text-xs text-stone-500">Auto-moderated. Publishes immediately if content passes checks.</p>
            </button>
            <button
              onClick={() => setContentTier('raw')}
              className={`flex-1 p-4 rounded-2xl border-2 text-left transition-all ${
                contentTier === 'raw'
                  ? 'border-amber-400 bg-amber-50'
                  : 'border-stone-200 bg-stone-50 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔥</span>
                <span className="font-black text-stone-900">Raw</span>
              </div>
              <p className="text-xs text-stone-500">Unfiltered content. Requires admin approval before publishing.</p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Give your post a title..."
            maxLength={200}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium text-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Subtitle <span className="text-stone-300">(optional)</span></label>
          <input
            type="text"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            placeholder="A short subtitle or tagline..."
            maxLength={200}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Body <span className="text-stone-300">(optional)</span></label>
          <textarea
            value={bodyText}
            onChange={e => setBodyText(e.target.value)}
            placeholder="Write your story, experience, or thoughts..."
            rows={8}
            className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium resize-y"
          />
        </div>

        <div className="relative">
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Link to Store <span className="text-stone-300">(optional)</span></label>
          {selectedStore ? (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <span className="font-bold text-emerald-900">{selectedStore.name}</span>
              <span className="text-xs text-emerald-600">{selectedStore.address}</span>
              <button onClick={() => { setStoreId(''); setStoreSearch(''); }} className="ml-auto text-stone-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ) : (
            <input
              type="text"
              value={storeSearch}
              onChange={e => { setStoreSearch(e.target.value); setShowStoreDropdown(true); }}
              onFocus={() => setShowStoreDropdown(true)}
              placeholder="Search for a store to link..."
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
            />
          )}
          {showStoreDropdown && filteredStores.length > 0 && !selectedStore && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg max-h-60 overflow-y-auto">
              {filteredStores.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setStoreId(s.id); setStoreSearch(s.name); setShowStoreDropdown(false); }}
                  className="w-full text-left px-4 py-3 hover:bg-emerald-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="font-bold text-stone-900 text-sm">{s.name}</span>
                  <span className="text-xs text-stone-400 ml-2">{s.address}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-3">Images <span className="text-stone-300">(up to 10)</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {mediaItems.map((item, idx) => (
              <div key={idx} className="relative rounded-2xl overflow-hidden border border-stone-200 aspect-square bg-stone-100">
                {item.uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                    <div className="animate-spin text-2xl">⏳</div>
                  </div>
                ) : item.error ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-2">
                    <p className="text-xs text-red-500 text-center">{item.error}</p>
                  </div>
                ) : (
                  <img src={item.cdnUrl} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  onClick={() => removeMedia(idx)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80"
                >
                  &times;
                </button>
              </div>
            ))}
            {mediaItems.length < 10 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-stone-200 aspect-square flex flex-col items-center justify-center hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer"
              >
                <svg className="w-8 h-8 text-stone-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs text-stone-400 font-bold">Add Image</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || mediaItems.some(m => m.uploading)}
            className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Publishing...' : contentTier === 'raw' ? 'Submit for Review' : 'Publish Post'}
          </button>
          <Link
            to="/posts"
            className="bg-stone-100 text-stone-700 px-6 py-4 rounded-2xl font-bold hover:bg-stone-200 transition flex items-center"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
};
