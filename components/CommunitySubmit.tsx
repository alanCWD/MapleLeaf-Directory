import React, { useState } from 'react';
import { Province } from '../types';
import { submitCommunityStore } from '../services/api';
import { useAuth } from '../hooks/useAuth';

export const CommunitySubmit: React.FC = () => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [province, setProvince] = useState('');
  const [type, setType] = useState<'Sovereign' | 'Local Gem'>('Sovereign');
  const [website, setWebsite] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [submitterNote, setSubmitterNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-stone-50 pt-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-[32px] border border-stone-200 p-12 text-center shadow-sm">
            <div className="text-6xl mb-6">🔐</div>
            <h2 className="text-2xl font-black text-stone-900 mb-4">Sign In Required</h2>
            <p className="text-stone-500 font-medium mb-8">
              Please sign in to submit a store. This helps us track contributions and build trust in our community data.
            </p>
            <a
              href="/api/login"
              className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition shadow-lg shadow-emerald-200"
            >
              Sign In to Continue
            </a>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !address.trim() || !province) {
      setError('Please fill in the store name, address/location, and province.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitCommunityStore({
        name: name.trim(),
        address: address.trim(),
        province,
        type,
        website: website.trim() || undefined,
        sourceUrl: sourceUrl.trim() || undefined,
        submitterNote: submitterNote.trim() || undefined,
      });
      setSubmitted(true);
      setName('');
      setAddress('');
      setProvince('');
      setWebsite('');
      setSourceUrl('');
      setSubmitterNote('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50 pt-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-[32px] border border-stone-200 p-12 text-center shadow-sm">
            <div className="text-6xl mb-6">&#127807;</div>
            <h2 className="text-2xl font-black text-stone-900 mb-4">Submission Received</h2>
            <p className="text-stone-500 font-medium mb-8">
              Thanks for helping grow the directory. Your submission will be verified and reviewed by our team. 
              Sovereign and trading post shops may be approved with less formal verification requirements.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pt-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4 border border-emerald-100">
            Community Powered
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-stone-900 tracking-tight mb-3">
            Know a Shop? <span className="text-emerald-500">Tell Us.</span>
          </h1>
          <p className="text-stone-500 font-medium max-w-lg mx-auto">
            Help us find sovereign shops, trading posts, and independent dispensaries that aren't in mainstream directories.
            Many of these shops don't have websites or Google listings -- your local knowledge matters.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-[32px] border border-stone-200 p-8 shadow-sm space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Store Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sacred Leaf Trading Post"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Location / Address *</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Highway 97A near Enderby, BC or exact address if known"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
            />
            <p className="text-xs text-stone-400 mt-1 font-medium">Approximate location is fine for informal shops (e.g. "off Highway 97A near reserve")</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Province *</label>
              <select
                value={province}
                onChange={e => setProvince(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 outline-none text-stone-900 font-medium"
              >
                <option value="">Select Province</option>
                {Object.values(Province).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Type *</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as 'Sovereign' | 'Local Gem')}
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 outline-none text-stone-900 font-medium"
              >
                <option value="Sovereign">Sovereign (Indigenous / Trading Post)</option>
                <option value="Local Gem">Local Gem (Independent)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Website or Social Media</label>
            <input
              type="text"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="e.g. facebook.com/storename or website URL (optional)"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Evidence Link</label>
            <input
              type="text"
              value={sourceUrl}
              onChange={e => setSourceUrl(e.target.value)}
              placeholder="Link to news article, social media post, or forum thread mentioning this shop (optional)"
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Tell us what you know</label>
            <textarea
              value={submitterNote}
              onChange={e => setSubmitterNote(e.target.value)}
              placeholder="e.g. I've been there, it's on the reserve just off the highway. They sell flower and pre-rolls. Open most days."
              rows={3}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none text-stone-900 placeholder-stone-300 font-medium resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-400 transition shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Store'}
          </button>

          <p className="text-xs text-stone-400 text-center font-medium">
            Submissions are automatically verified where possible and sent to admin review. Sovereign shops require less formal evidence for approval.
          </p>
        </form>
      </div>
    </div>
  );
};
