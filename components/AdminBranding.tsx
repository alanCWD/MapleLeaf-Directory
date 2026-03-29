import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  adminDeleteBrandingAsset,
  adminGetBrandingAssets,
  adminUploadBrandingAsset,
  type BrandingAssetInfo,
} from '../services/api';

interface AssetCardProps {
  label: string;
  description: string;
  assetKey: string;
  info: BrandingAssetInfo | undefined;
  accept: string;
  previewType: 'image' | 'video';
  onUploaded: (key: string, url: string) => void;
  onDeleted: (key: string) => void;
}

const AssetCard: React.FC<AssetCardProps> = ({
  label,
  description,
  assetKey,
  info,
  accept,
  previewType,
  onUploaded,
  onDeleted,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const result = await adminUploadBrandingAsset(assetKey, file);
        onUploaded(assetKey, result.url);
      } catch (err: any) {
        setError(err.message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [assetKey, onUploaded]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove the ${label} asset? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await adminDeleteBrandingAsset(assetKey);
      onDeleted(assetKey);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const cacheBust = info?.url ? `${info.url}?t=${Date.now()}` : null;

  return (
    <div className="bg-stone-900/60 border border-stone-700/50 rounded-3xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-bold text-white text-base">{label}</h3>
        <p className="text-stone-400 text-xs mt-0.5">{description}</p>
      </div>

      {info?.exists && cacheBust ? (
        <div className="relative rounded-2xl overflow-hidden bg-stone-800 border border-stone-700/50 flex items-center justify-center min-h-[120px]">
          {previewType === 'image' ? (
            <img
              src={cacheBust}
              alt={label}
              className="max-h-40 max-w-full object-contain"
            />
          ) : (
            <video
              src={cacheBust}
              controls
              className="max-h-48 max-w-full rounded-xl"
            />
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-xl transition disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 min-h-[120px] rounded-2xl border-2 border-dashed cursor-pointer transition
            ${dragging
              ? 'border-emerald-400 bg-emerald-900/20'
              : 'border-stone-600 hover:border-emerald-500 hover:bg-emerald-900/10'
            }
          `}
        >
          <span className="text-2xl">{previewType === 'video' ? '🎬' : '🖼️'}</span>
          {uploading ? (
            <span className="text-emerald-400 text-sm font-medium">Uploading…</span>
          ) : (
            <>
              <span className="text-stone-300 text-sm font-medium">Click or drag to upload</span>
              <span className="text-stone-500 text-xs">{accept}</span>
            </>
          )}
        </div>
      )}

      {!info?.exists && (
        <button
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 rounded-2xl transition disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : `Upload ${label}`}
        </button>
      )}

      {info?.exists && !uploading && (
        <button
          onClick={() => !uploading && inputRef.current?.click()}
          disabled={uploading}
          className="w-full bg-stone-700 hover:bg-stone-600 text-stone-200 font-semibold text-sm py-2.5 rounded-2xl transition disabled:opacity-50"
        >
          Replace File
        </button>
      )}

      {error && (
        <p className="text-red-400 text-xs font-medium bg-red-900/20 border border-red-800/50 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
};

export const AdminBranding: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Record<string, BrandingAssetInfo>>({});
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await adminGetBrandingAssets();
      setAssets(data.assets);
    } catch (err: any) {
      setFetchError(err.message || 'Failed to load branding assets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated && isAdmin) {
      loadAssets();
    }
  }, [authLoading, isAuthenticated, isAdmin, loadAssets]);

  const handleUploaded = useCallback((key: string, url: string) => {
    setAssets((prev) => ({
      ...prev,
      [key]: { ...prev[key], exists: true, url },
    }));
  }, []);

  const handleDeleted = useCallback((key: string) => {
    setAssets((prev) => ({
      ...prev,
      [key]: { ...prev[key], exists: false, url: null },
    }));
  }, []);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Admin Access Required</h2>
        <a href="/api/login" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Sign In
        </a>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">⛔</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Access Denied</h2>
        <p className="text-stone-500 font-medium mb-8">You need admin privileges to access this page.</p>
        <Link to="/" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Back to Directory
        </Link>
      </div>
    );
  }

  const ASSET_DEFS = [
    {
      group: 'Brand Logos',
      subtitle: 'Used across the platform for identity and watermarking.',
      items: [
        {
          key: 'logo-light',
          label: 'Logo — Light Version',
          description: 'Displayed on dark backgrounds (PNG, WebP, or SVG recommended).',
          accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
          previewType: 'image' as const,
        },
        {
          key: 'logo-dark',
          label: 'Logo — Dark Version',
          description: 'Displayed on light backgrounds (PNG, WebP, or SVG recommended).',
          accept: '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml',
          previewType: 'image' as const,
        },
      ],
    },
    {
      group: 'Video Watermark',
      subtitle: 'Overlaid on all video reviews and posts.',
      items: [
        {
          key: 'watermark',
          label: 'Watermark Image',
          description: 'PNG with transparency recommended. Shown bottom-right of video frame.',
          accept: '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp',
          previewType: 'image' as const,
        },
      ],
    },
    {
      group: 'Video Intro & Outro',
      subtitle: 'Stitched automatically onto the start and end of every video review.',
      items: [
        {
          key: 'intro-video',
          label: 'Intro Video',
          description: 'MP4, MOV, or WebM. Plays before the store review clip.',
          accept: '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm',
          previewType: 'video' as const,
        },
        {
          key: 'outro-video',
          label: 'Outro Video',
          description: 'MP4, MOV, or WebM. Plays after the store review clip.',
          accept: '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm',
          previewType: 'video' as const,
        },
      ],
    },
  ];

  const uploadedCount = Object.values(assets).filter((a) => a.exists).length;
  const totalCount = 5;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 pb-16">
      <div className="max-w-4xl mx-auto px-4 pt-10">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-[40px] p-8 mb-8 shadow-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-black text-white mb-1">Branding Assets</h1>
              <p className="text-emerald-100 text-sm">
                Manage logos, watermarks, and intro/outro videos.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl px-5 py-3 text-center">
              <div className="text-2xl font-black text-white">{uploadedCount}/{totalCount}</div>
              <div className="text-emerald-100 text-xs font-medium">Assets uploaded</div>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-3xl p-5 mb-6 text-red-300 text-sm font-medium">
            {fetchError}
            <button
              onClick={loadAssets}
              className="ml-4 underline text-red-200 hover:text-white transition"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !fetchError ? (
          <div className="flex items-center justify-center py-24 text-stone-400">
            <div className="animate-spin text-3xl mr-3">⏳</div>
            <span className="text-lg font-medium">Loading branding assets…</span>
          </div>
        ) : (
          <div className="space-y-8">
            {ASSET_DEFS.map((group) => (
              <div key={group.group}>
                <div className="mb-4">
                  <h2 className="text-lg font-black text-white">{group.group}</h2>
                  <p className="text-stone-400 text-sm">{group.subtitle}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {group.items.map((item) => (
                    <AssetCard
                      key={item.key}
                      assetKey={item.key}
                      label={item.label}
                      description={item.description}
                      accept={item.accept}
                      previewType={item.previewType}
                      info={assets[item.key]}
                      onUploaded={handleUploaded}
                      onDeleted={handleDeleted}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <p className="text-stone-500 text-xs">
            Uploaded files are stored on the server and take effect immediately for new video renders.
          </p>
        </div>
      </div>
    </div>
  );
};
