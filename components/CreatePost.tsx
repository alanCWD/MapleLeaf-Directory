import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createCreatorPost, uploadPostImage, initPostVideoUpload, fetchStores } from '../services/api';
import type { Store, ContentTier } from '../types';
import * as tus from 'tus-js-client';

interface MediaItem {
  mediaType: 'image' | 'video';
  cdnUrl: string;
  previewUrl?: string;
  bunnyId?: string;
  caption: string;
  file?: File;
  uploading?: boolean;
  error?: string;
}

type MediaMode = 'none' | 'images' | 'video';
type VideoUploadState = 'idle' | 'initializing' | 'uploading' | 'processing' | 'done' | 'error';

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
  const [mediaMode, setMediaMode] = useState<MediaMode>('none');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ id: number; status: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [videoState, setVideoState] = useState<VideoUploadState>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState('');
  const [videoData, setVideoData] = useState<{ videoId: string; embedUrl: string } | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);

  useEffect(() => {
    fetchStores().then(setStores).catch(() => {});
  }, []);

  const filteredStores = storeSearch.trim()
    ? stores.filter(s => s.name.toLowerCase().includes(storeSearch.toLowerCase())).slice(0, 8)
    : [];

  const selectedStore = stores.find(s => s.id === storeId);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setMediaMode('images');
    for (let i = 0; i < Math.min(files.length, 10 - mediaItems.length); i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) {
        setError(`${file.name} is too large (max 20MB)`);
        continue;
      }

      let previewUrl = '';
      try { previewUrl = await readFileAsDataUrl(file); } catch { /* preview optional */ }

      const item: MediaItem = {
        mediaType: 'image',
        cdnUrl: '',
        previewUrl,
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

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 500 * 1024 * 1024;
    if (file.size > maxSize) {
      setVideoError(`Video too large. Maximum size is 500MB (yours: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`);
      return;
    }

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi)$/i)) {
      setVideoError('Unsupported file type. Please use MP4, MOV, WebM, or AVI.');
      return;
    }

    setMediaMode('video');
    setVideoState('initializing');
    setVideoError('');
    setVideoProgress(0);

    try {
      const videoTitle = title.trim() || file.name.replace(/\.[^.]+$/, '');
      const creds = await initPostVideoUpload(videoTitle);

      setVideoState('uploading');

      const upload = new tus.Upload(file, {
        endpoint: 'https://video.bunnycdn.com/tusupload',
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filetype: file.type,
          title: videoTitle,
        },
        headers: {
          AuthorizationSignature: creds.signature,
          AuthorizationExpire: String(creds.expirationTime),
          VideoId: creds.videoId,
          LibraryId: String(creds.libraryId),
        },
        onError: (err) => {
          setVideoError(err.message || 'Upload failed. Please try again.');
          setVideoState('error');
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          setVideoProgress(Math.round((bytesUploaded / bytesTotal) * 100));
        },
        onSuccess: () => {
          setVideoState('processing');
          setVideoData({ videoId: creds.videoId, embedUrl: creds.embedUrl });
          setTimeout(() => {
            setVideoState('done');
          }, 2000);
        },
      });

      uploadRef.current = upload;
      upload.start();
    } catch (err: any) {
      setVideoError(err.message || 'Failed to initialize video upload.');
      setVideoState('error');
    }

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeVideo = () => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      uploadRef.current = null;
    }
    setVideoState('idle');
    setVideoData(null);
    setVideoProgress(0);
    setVideoError('');
    setMediaMode('none');
  };

  const removeMedia = (index: number) => {
    setMediaItems(prev => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setMediaMode('none');
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError('Title is required'); return; }
    setSubmitting(true);
    setError('');

    const uploadedMedia: Array<{ mediaType: string; cdnUrl: string; bunnyId?: string; caption: string }> = [];

    if (mediaMode === 'images') {
      mediaItems
        .filter(m => !m.uploading && !m.error && m.cdnUrl)
        .forEach(m => uploadedMedia.push({
          mediaType: 'image',
          cdnUrl: m.cdnUrl,
          bunnyId: m.bunnyId,
          caption: m.caption,
        }));
    } else if (mediaMode === 'video' && videoData) {
      uploadedMedia.push({
        mediaType: 'video',
        cdnUrl: videoData.embedUrl,
        bunnyId: videoData.videoId,
        caption: '',
      });
    }

    try {
      const post = await createCreatorPost({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        bodyText: bodyText.trim() || undefined,
        contentTier,
        storeId: storeId || undefined,
        media: uploadedMedia,
      });
      if (post.status === 'published') {
        navigate(`/posts/${post.id}`);
        return;
      }
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
        <div className="text-4xl mb-4 animate-spin">&#x23F3;</div>
        <p className="text-stone-400 font-bold">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">&#x270D;&#xFE0F;</div>
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
        <div className="text-6xl mb-6">&#x1F3A8;</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Creator Access Required</h2>
        <p className="text-stone-500 font-medium mb-6">
          Creator access lets you publish posts and share your experiences with the community.
        </p>
        <p className="text-stone-400 text-sm mb-8">
          To request creator access, please contact an admin or reach out via the community channels. An admin can grant creator status in the user management panel.
        </p>
        <div className="flex gap-3 justify-center">
          <Link to="/posts" className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
            Browse Posts
          </Link>
          <Link to="/" className="bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition">
            Back to Directory
          </Link>
        </div>
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
          <button onClick={() => { setSuccess(null); setTitle(''); setSubtitle(''); setBodyText(''); setMediaItems([]); setStoreId(''); setMediaMode('none'); removeVideo(); }} className="bg-stone-100 text-stone-700 px-8 py-3 rounded-2xl font-bold hover:bg-stone-200 transition">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  const isVideoUploading = videoState === 'initializing' || videoState === 'uploading' || videoState === 'processing';
  const hasVideo = videoState === 'done' && videoData;
  const canSubmit = title.trim() && !submitting && !mediaItems.some(m => m.uploading) && !isVideoUploading;

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
                <span className="text-lg">&#x2728;</span>
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
                <span className="text-lg">&#x1F525;</span>
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
          <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-3">
            Media <span className="text-stone-300">(up to 10 images OR 1 video)</span>
          </label>

          {mediaMode !== 'video' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {mediaItems.map((item, idx) => (
                  <div key={idx} className="relative rounded-2xl overflow-hidden border border-stone-200 aspect-square bg-stone-100">
                    {item.uploading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
                        <div className="animate-spin text-2xl">&#x23F3;</div>
                      </div>
                    ) : item.error ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-2">
                        <p className="text-xs text-red-500 text-center">{item.error}</p>
                      </div>
                    ) : (
                      <img
                        src={item.previewUrl || item.cdnUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
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
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </>
          )}

          {mediaMode !== 'images' && !hasVideo && !isVideoUploading && mediaItems.length === 0 && (
            <div className={`${mediaMode === 'none' && mediaItems.length === 0 ? 'mt-3' : ''}`}>
              {mediaMode === 'none' && mediaItems.length === 0 && (
                <div className="text-center text-xs text-stone-400 mb-2">or</div>
              )}
              <button
                onClick={() => videoInputRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-stone-200 p-6 flex flex-col items-center justify-center hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
              >
                <svg className="w-8 h-8 text-stone-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-stone-400 font-bold">Upload Video</span>
                <span className="text-[10px] text-stone-300 mt-1">MP4, MOV, WebM, AVI (max 500MB)</span>
              </button>
              <input
                ref={videoInputRef}
                type="file"
                accept=".mp4,.mov,.webm,.avi,video/mp4,video/quicktime,video/webm,video/x-msvideo"
                onChange={handleVideoSelect}
                className="hidden"
              />
            </div>
          )}

          {(isVideoUploading || hasVideo) && (
            <div className="rounded-2xl border border-stone-200 p-6 bg-stone-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="font-bold text-sm text-stone-900">
                    {videoState === 'done' ? 'Video Ready' : videoState === 'processing' ? 'Processing...' : videoState === 'uploading' ? 'Uploading...' : 'Initializing...'}
                  </span>
                </div>
                <button onClick={removeVideo} className="text-xs text-stone-400 hover:text-red-500 font-bold">
                  Remove
                </button>
              </div>
              {videoState === 'uploading' && (
                <div className="w-full bg-stone-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${videoProgress}%` }} />
                </div>
              )}
              {videoState === 'processing' && (
                <p className="text-xs text-stone-400">Your video is being processed. This may take a moment.</p>
              )}
              {videoState === 'done' && (
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-emerald-600 font-bold">Upload complete</span>
                </div>
              )}
            </div>
          )}

          {videoError && (
            <div className="mt-2 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-xl text-xs font-medium">
              {videoError}
              <button onClick={() => { setVideoError(''); setVideoState('idle'); setMediaMode('none'); }} className="ml-2 underline">
                Try again
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
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
