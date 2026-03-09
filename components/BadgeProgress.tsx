
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BadgeIcon } from './BadgeIcon';
import { fetchBadgeProgress } from '../services/api';
import type { BadgeProgress as BadgeProgressData, UserBadge } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface BadgeDefinition {
  type: 'verified_scout' | 'legacy_archivist' | 'integrity_anchor';
  name: string;
  description: string;
  trustImpact: string;
  getProgress: (data: BadgeProgressData) => { current: number; target: number; label: string }[];
}

const badgeDefinitions: BadgeDefinition[] = [
  {
    type: 'verified_scout',
    name: 'Verified Scout',
    description: 'Awarded to active video reviewers who provide verified visual proof across multiple stores.',
    trustImpact: '+0.3 trust weight bonus on all reviews',
    getProgress: (data) => [
      { current: data.videoReviewCount, target: 3, label: 'Verified video reviews' },
      { current: data.distinctVideoStores, target: 2, label: 'Distinct stores with video' },
    ],
  },
  {
    type: 'legacy_archivist',
    name: 'Legacy Archivist',
    description: 'Awarded to prolific community contributors who help build the directory through reviews, submissions, or media.',
    trustImpact: 'Reputation badge (display only)',
    getProgress: (data) => [
      { current: data.totalReviewCount, target: 10, label: 'Reviews written' },
      { current: data.communitySubmissionCount, target: 5, label: 'Community submissions' },
      { current: data.mediaUploadCount, target: 3, label: 'Media uploads' },
    ],
  },
  {
    type: 'integrity_anchor',
    name: 'Integrity Anchor',
    description: 'Awarded to consistently trustworthy reviewers with high trust weights and zero flagged reviews.',
    trustImpact: 'Reputation badge (display only)',
    getProgress: (data) => [
      { current: data.totalReviewCount, target: 8, label: 'Reviews written' },
      { current: Math.round(data.avgTrustWeight * 100), target: 70, label: 'Avg trust weight (%)' },
      { current: data.flaggedCount === 0 ? 1 : 0, target: 1, label: 'Zero flagged reviews' },
    ],
  },
];

const ProgressBar: React.FC<{ current: number; target: number; label: string }> = ({ current, target, label }) => {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const met = current >= target;

  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold text-stone-600">{label}</span>
        <span className={`text-xs font-black ${met ? 'text-emerald-600' : 'text-stone-400'}`}>
          {current}/{target} {met && '✓'}
        </span>
      </div>
      <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : 'bg-stone-300'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const BadgeProgress: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [progress, setProgress] = useState<BadgeProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchBadgeProgress()
      .then(setProgress)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl animate-spin mb-4">⏳</div>
        <p className="text-stone-400 font-bold">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">🔒</div>
        <h2 className="text-2xl font-black text-stone-900 mb-2">Sign In Required</h2>
        <p className="text-stone-500 mb-6">Sign in to track your badge progress and achievements.</p>
        <a
          href="#/auth"
          className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-black hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-200"
        >
          Sign In
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-4xl animate-spin mb-4">⏳</div>
        <p className="text-stone-400 font-bold">Loading badge progress...</p>
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-2xl font-black text-stone-900 mb-2">Something went wrong</h2>
        <p className="text-stone-500">{error || 'Failed to load badge progress'}</p>
      </div>
    );
  }

  const earnedBadgeTypes = new Set(progress.badges.map((b) => b.badgeType));
  const earnedBadgeMap: Record<string, UserBadge> = {};
  for (const b of progress.badges) {
    earnedBadgeMap[b.badgeType] = b;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link to="/" className="text-sm font-bold text-emerald-600 hover:text-emerald-500 transition">
          ← Back to Directory
        </Link>
      </div>

      <div className="mb-10">
        <h1 className="text-3xl font-black text-stone-900 tracking-tight mb-2">My Badges</h1>
        <p className="text-stone-500 text-sm">
          Track your progress toward earning trust badges. Badges are awarded automatically based on your activity.
        </p>
      </div>

      {progress.badges.length > 0 && (
        <div className="mb-10 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-4">Earned Badges</h3>
          <div className="flex flex-wrap gap-3">
            {progress.badges.map((b) => (
              <BadgeIcon key={b.badgeType} badgeType={b.badgeType as any} size="lg" />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {badgeDefinitions.map((def) => {
          const earned = earnedBadgeTypes.has(def.type);
          const badge = earnedBadgeMap[def.type];
          const progressItems = def.getProgress(progress);
          const isArchivist = def.type === 'legacy_archivist';
          const allMet = isArchivist
            ? progressItems.some((p) => p.current >= p.target)
            : progressItems.every((p) => p.current >= p.target);

          return (
            <div
              key={def.type}
              className={`rounded-3xl border-2 p-6 transition-all ${
                earned
                  ? 'border-emerald-200 bg-white shadow-lg shadow-emerald-100/50'
                  : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BadgeIcon badgeType={def.type} size="md" />
                  {earned && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Earned
                    </span>
                  )}
                </div>
                {earned && badge && (
                  <span className="text-[10px] text-stone-400 font-medium">
                    {new Date(badge.awardedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <p className="text-sm text-stone-600 mb-1">{def.description}</p>
              <p className="text-xs text-stone-400 mb-4 italic">{def.trustImpact}</p>

              {isArchivist && (
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">
                  Qualify via any one path:
                </p>
              )}

              <div className={earned ? 'opacity-60' : ''}>
                {progressItems.map((p, i) => (
                  <ProgressBar key={p.label} current={p.current} target={p.target} label={p.label} />
                ))}
              </div>

              {!earned && allMet && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-xs font-bold text-amber-700">
                    🎉 You meet the criteria! Your badge will be awarded on your next review activity.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
