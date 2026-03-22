import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { updateUserProfile } from '../services/api';

const PLATFORM_CONFIG: Record<string, { label: string; placeholder: string; isUrl: boolean; icon: string }> = {
  instagram: { label: 'Instagram', placeholder: 'https://instagram.com/yourname', isUrl: true, icon: '📸' },
  facebook:  { label: 'Facebook',  placeholder: 'https://facebook.com/yourname',  isUrl: true, icon: '📘' },
  x:         { label: 'X (Twitter)', placeholder: 'https://x.com/yourname',       isUrl: true, icon: '🐦' },
  reddit:    { label: 'Reddit',    placeholder: 'https://reddit.com/user/yourname', isUrl: true, icon: '🟠' },
  discord:   { label: 'Discord',   placeholder: 'yourUsername (2–32 chars)',        isUrl: false, icon: '💬' },
};

export const ProfileSettings: React.FC = () => {
  const { user, isAuthenticated, isLoading, refetch } = useAuth();
  const location = useLocation();
  const isSetupMode = new URLSearchParams(location.search).get('setup') === 'true';
  const [handle, setHandle] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [socialPlatform, setSocialPlatform] = useState('');
  const [socialUrl, setSocialUrl] = useState('');
  const [socialPublic, setSocialPublic] = useState(false);
  const [socialVerified, setSocialVerified] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setHandle(user.handle || '');
      setSocialPlatform(user.socialLinkPlatform || '');
      setSocialUrl(user.socialLinkUrl || '');
      setSocialPublic(user.socialLinkPublic ?? false);
      setSocialVerified(user.socialLinkVerified ?? false);
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

  const handlePlatformChange = (platform: string) => {
    setSocialPlatform(platform);
    setSocialUrl('');
    setSocialVerified(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!socialPlatform) {
      setError('A social media link is required. Please select a platform and enter your link.');
      return;
    }
    if (!socialUrl.trim()) {
      setError('Please enter your social media link or username.');
      return;
    }

    setSaving(true);
    try {
      const result = await updateUserProfile({
        handle: handle.trim(),
        avatarFile: avatarFile || undefined,
        socialLinkPlatform: socialPlatform || undefined,
        socialLinkUrl: socialUrl.trim() || undefined,
        socialLinkPublic: socialPublic,
      });
      setSocialVerified(result.socialLinkVerified);
      setSuccess(
        result.socialLinkVerified
          ? 'Profile updated! Your social link was verified.'
          : socialUrl.trim() && socialPlatform && socialPlatform !== 'discord'
          ? 'Profile updated. (Social link could not be automatically verified — it may still be visible.)'
          : 'Profile updated!'
      );
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
  const platformConfig = socialPlatform ? PLATFORM_CONFIG[socialPlatform] : null;

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {isSetupMode && !user?.socialLinkPlatform && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="font-black text-amber-900 text-sm mb-1">Welcome! One last step 🎉</p>
          <p className="text-amber-800 text-xs leading-relaxed">
            To participate in the LegacyLeaf community, please add a social media link below. This helps verify you're a real person and lets other members know who you are.
          </p>
        </div>
      )}
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

        <div className="space-y-3">
          <label className="block text-sm font-black text-stone-700">
            Social Media Link <span className="font-medium text-red-400 text-xs">*</span>
          </label>
          <p className="text-xs text-stone-400">Select a platform and enter your link to complete your profile.</p>

          <div className="grid grid-cols-5 gap-2">
            {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => handlePlatformChange(socialPlatform === key ? '' : key)}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-xs font-bold transition ${
                  socialPlatform === key
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : 'border-stone-200 bg-stone-50 text-stone-500 hover:border-stone-300'
                }`}
              >
                <span className="text-lg">{cfg.icon}</span>
                <span className="truncate w-full text-center text-[10px]">{cfg.label}</span>
              </button>
            ))}
          </div>

          {socialPlatform && platformConfig && (
            <div className="space-y-3 pt-1">
              <div className="border-2 border-stone-200 rounded-2xl overflow-hidden focus-within:border-emerald-400 transition-colors bg-stone-50">
                <input
                  type={platformConfig.isUrl ? 'url' : 'text'}
                  value={socialUrl}
                  onChange={e => { setSocialUrl(e.target.value); setSocialVerified(false); }}
                  placeholder={platformConfig.placeholder}
                  className="w-full px-4 py-3 bg-transparent font-medium text-stone-900 placeholder-stone-300 outline-none text-sm"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setSocialPublic(v => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${socialPublic ? 'bg-emerald-500' : 'bg-stone-300'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${socialPublic ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <span className="text-sm font-bold text-stone-700">
                    {socialPublic ? 'Visible on your public profile' : 'Private (not shown publicly)'}
                  </span>
                </label>

                {socialUrl.trim() && socialPlatform && socialPlatform !== 'discord' && (
                  socialVerified ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Verified
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      Unverified
                    </span>
                  )
                )}
              </div>
            </div>
          )}
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
