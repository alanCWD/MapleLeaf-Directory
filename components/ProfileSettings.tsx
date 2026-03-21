import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/api';

export const ProfileSettings: React.FC = () => {
  const { user, isAuthenticated, isLoading, refetch } = useAuth();
  const [handle, setHandle] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setHandle(user.handle || '');
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await updateUserProfile({ handle: handle.trim(), avatarFile: avatarFile || undefined });
      setSuccess('Profile updated!');
      setAvatarFile(null);
      await refetch();
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-4xl animate-spin mb-4">⏳</div>
        <p className="text-stone-400 font-bold">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Sign In Required</h2>
        <a href="#/auth" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Sign In
        </a>
      </div>
    );
  }

  const currentAvatar = avatarPreview || user.avatarUrl || user.profileImageUrl;
  const initials = (handle?.[0] || user.firstName?.[0] || user.email?.[0] || 'U').toUpperCase();

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-black text-stone-900 mb-2">Profile Settings</h1>
      <p className="text-stone-500 font-medium mb-8">Customize your public identity on LegacyLeaf.</p>

      <form onSubmit={handleSave} className="bg-white rounded-[32px] border border-stone-200 shadow-sm p-8 space-y-8">
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative group"
            title="Change profile photo"
          >
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt="Profile"
                className="w-24 h-24 rounded-full object-cover border-4 border-emerald-200 group-hover:border-emerald-400 transition-colors shadow-md"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-3xl border-4 border-emerald-200 group-hover:border-emerald-400 transition-colors shadow-md">
                {initials}
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-bold">Change</span>
            </div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <p className="text-xs text-stone-400">Click to upload a profile photo (JPG, PNG, HEIC — max 10MB)</p>
        </div>

        <div>
          <label className="block text-sm font-black text-stone-700 mb-2">
            Username Handle
          </label>
          <div className="flex items-center border-2 border-stone-200 rounded-2xl overflow-hidden focus-within:border-emerald-400 transition-colors bg-stone-50">
            <span className="pl-4 text-stone-400 font-black text-lg select-none">@</span>
            <input
              type="text"
              value={handle}
              onChange={e => {
                const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
                setHandle(val);
              }}
              placeholder="your_handle"
              className="flex-1 px-2 py-3 bg-transparent font-bold text-stone-900 placeholder-stone-300 outline-none"
            />
          </div>
          <p className="text-xs text-stone-400 mt-1.5">Letters, numbers, and underscores only. This replaces your name everywhere on the site.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm font-bold">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-bold">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-500 text-white py-3 rounded-2xl font-black text-base hover:bg-emerald-400 transition disabled:opacity-50 shadow-lg shadow-emerald-200"
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};
