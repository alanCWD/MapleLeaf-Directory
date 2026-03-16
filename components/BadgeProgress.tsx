
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BadgeIcon } from './BadgeIcon';
import { fetchBadgeProgress } from '../services/api';
import type { BadgeProgress as BadgeProgressData, UserBadge } from '../services/api';
import { useAuth } from '../hooks/useAuth';

type BadgeType =
  | 'explorer'
  | 'local_scout'
  | 'regional_builder'
  | 'cross_region_contributor'
  | 'provincial_connector'
  | 'bc_culture_guide'
  | 'founding_bc_architect';

interface BadgeDefinition {
  type: BadgeType;
  name: string;
  emoji: string;
  tier: string;
  description: string;
  qualityNote: string;
  getProgress: (data: BadgeProgressData) => { current: number; target: number; label: string }[];
  extraNote?: string;
}

const badgeDefinitions: BadgeDefinition[] = [
  {
    type: 'explorer',
    name: 'Explorer',
    emoji: '🌱',
    tier: 'Tier 1 — Entry',
    description: 'Welcome to the community. Start documenting local cannabis culture.',
    qualityNote: 'No quality floor required',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 1, label: 'Store review' },
      { current: data.culturePosts, target: 1, label: 'Culture post (media upload)' },
    ],
  },
  {
    type: 'local_scout',
    name: 'Local Scout',
    emoji: '📍',
    tier: 'Tier 2 — Regional Grounding',
    description: 'Build local density by reviewing multiple stores in one region.',
    qualityNote: 'Quality average ≥ 0.9',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 5, label: 'Store reviews' },
      { current: data.distinctStores, target: 3, label: 'Different stores visited' },
      { current: data.culturePosts, target: 3, label: 'Culture posts' },
      { current: Math.round(data.qualityAverage * 100), target: 90, label: 'Quality average (%)' },
    ],
  },
  {
    type: 'regional_builder',
    name: 'Regional Builder',
    emoji: '🔥',
    tier: 'Tier 3 — Store Diversity',
    description: 'Go deep in one region — breadth of stores and early revisits matter.',
    qualityNote: 'Quality average ≥ 1.0',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 12, label: 'Store reviews' },
      { current: data.distinctStores, target: 8, label: 'Different stores visited' },
      { current: data.culturePosts, target: 8, label: 'Culture posts' },
      { current: data.repeatVisitStores, target: 2, label: 'Stores with a repeat visit' },
      { current: Math.round(data.qualityAverage * 100), target: 100, label: 'Quality average (%)' },
    ],
  },
  {
    type: 'cross_region_contributor',
    name: 'Cross-Region Contributor',
    emoji: '🌉',
    tier: 'Tier 4 — Geographic Expansion',
    description: 'Venture beyond your home region and document cannabis culture across BC.',
    qualityNote: 'Quality average ≥ 1.05',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 18, label: 'Store reviews' },
      { current: data.distinctStores, target: 12, label: 'Different stores visited' },
      { current: data.regionsCount, target: 2, label: 'BC regions covered' },
      { current: data.culturePosts, target: 15, label: 'Culture posts' },
      { current: data.repeatVisitStores, target: 3, label: 'Stores with a repeat visit' },
      { current: Math.round(data.qualityAverage * 100), target: 105, label: 'Quality average (%)' },
    ],
  },
  {
    type: 'provincial_connector',
    name: 'Provincial Connector',
    emoji: '🏔',
    tier: 'Tier 5 — Wide BC Coverage',
    description: 'Span three BC regions and prove your commitment to geographic diversity.',
    qualityNote: 'Quality average ≥ 1.1 — No single store > 20% of your reviews',
    extraNote: 'Single-store farming stops working at this tier.',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 30, label: 'Store reviews' },
      { current: data.distinctStores, target: 20, label: 'Different stores visited' },
      { current: data.regionsCount, target: 3, label: 'BC regions covered' },
      { current: data.culturePosts, target: 25, label: 'Culture posts' },
      { current: data.repeatVisitStores, target: 5, label: 'Stores with a repeat visit' },
      { current: Math.round(data.qualityAverage * 100), target: 110, label: 'Quality average (%)' },
      { current: data.singleStoreMaxPct <= 20 ? 1 : 0, target: 1, label: 'Single store ≤ 20% of reviews' },
    ],
  },
  {
    type: 'bc_culture_guide',
    name: 'BC Culture Guide',
    emoji: '🧭',
    tier: 'Tier 6 — Top Tier (BC Phase)',
    description: 'The highest standard: breadth across four regions, depth through revisits, and seasonal storytelling.',
    qualityNote: 'Quality average ≥ 1.15 — No single store > 15% of your reviews',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 45, label: 'Store reviews' },
      { current: data.distinctStores, target: 30, label: 'Different stores visited' },
      { current: data.regionsCount, target: 4, label: 'BC regions covered' },
      { current: data.culturePosts, target: 40, label: 'Culture posts' },
      { current: data.repeatVisitStores, target: 8, label: 'Stores with a repeat visit' },
      { current: data.seasonalRevisits, target: 3, label: 'Stores revisited in different seasons' },
      { current: Math.round(data.qualityAverage * 100), target: 115, label: 'Quality average (%)' },
      { current: data.singleStoreMaxPct <= 15 ? 1 : 0, target: 1, label: 'Single store ≤ 15% of reviews' },
    ],
  },
  {
    type: 'founding_bc_architect',
    name: 'Founding BC Architect',
    emoji: '🏆',
    tier: 'Tier 7 — Elite (Optional)',
    description: 'Aspirational and rare. All five regions, deep revisit history, and elite quality. A permanent mark of legacy.',
    qualityNote: 'Quality average ≥ 1.2 — No single store > 12% of your reviews',
    extraNote: 'Requires at least one store revisited across three distinct time periods.',
    getProgress: (data) => [
      { current: data.uniqueStoreReviews, target: 60, label: 'Store reviews' },
      { current: data.distinctStores, target: 40, label: 'Different stores visited' },
      { current: data.regionsCount, target: 5, label: 'BC regions covered (all five)' },
      { current: data.culturePosts, target: 60, label: 'Culture posts' },
      { current: data.repeatVisitStores, target: 10, label: 'Stores with a repeat visit' },
      { current: data.timePeriodRevisits, target: 1, label: 'Store revisited across 3 time periods' },
      { current: Math.round(data.qualityAverage * 100), target: 120, label: 'Quality average (%)' },
      { current: data.singleStoreMaxPct <= 12 ? 1 : 0, target: 1, label: 'Single store ≤ 12% of reviews' },
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
};

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

  const highestEarned = [...badgeDefinitions].reverse().find((d) => earnedBadgeTypes.has(d.type));

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
          Geography-first progression — cover BC, visit stores across regions, and build real community depth.
        </p>
      </div>

      {progress.badges.length > 0 && (
        <div className="mb-10 p-6 bg-emerald-50 border border-emerald-100 rounded-3xl">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-4">Earned Badges</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {progress.badges.map((b) => (
              <BadgeIcon key={b.badgeType} badgeType={b.badgeType as BadgeType} size="lg" />
            ))}
          </div>
          {highestEarned && (
            <p className="text-xs text-emerald-600 font-bold">
              Current rank: {highestEarned.emoji} {highestEarned.name}
            </p>
          )}
        </div>
      )}

      <div className="mb-6 p-4 bg-stone-50 border border-stone-100 rounded-2xl">
        <h3 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-3">Your Stats</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Store Reviews', value: progress.uniqueStoreReviews },
            { label: 'Unique Stores', value: progress.distinctStores },
            { label: 'Culture Posts', value: progress.culturePosts },
            { label: 'Regions Covered', value: `${progress.regionsCount} / 5` },
            { label: 'Repeat Visits', value: progress.repeatVisitCount },
            { label: 'Quality Average', value: `${progress.qualityAverage.toFixed(2)}` },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl p-3 border border-stone-100">
              <div className="text-lg font-black text-stone-900">{stat.value}</div>
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {badgeDefinitions.map((def) => {
          const earned = earnedBadgeTypes.has(def.type);
          const badge = earnedBadgeMap[def.type];
          const progressItems = def.getProgress(progress);
          const allMet = progressItems.every((p) => p.current >= p.target);

          return (
            <div
              key={def.type}
              className={`rounded-3xl border-2 p-6 transition-all ${
                earned
                  ? 'border-emerald-200 bg-white shadow-lg shadow-emerald-100/50'
                  : 'border-stone-100 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
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

              <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">{def.tier}</p>
              <p className="text-sm text-stone-600 mb-1">{def.description}</p>
              <p className="text-xs text-stone-400 mb-1 italic">{def.qualityNote}</p>
              {def.extraNote && (
                <p className="text-xs text-amber-600 font-bold mb-3">{def.extraNote}</p>
              )}

              <div className={`mt-4 ${earned ? 'opacity-60' : ''}`}>
                {progressItems.map((p) => (
                  <ProgressBar key={p.label} current={p.current} target={p.target} label={p.label} />
                ))}
              </div>

              {!earned && allMet && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-xs font-bold text-amber-700">
                    You meet the criteria! Your badge will be awarded on your next review activity.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 p-6 bg-stone-50 border border-stone-100 rounded-3xl">
        <h3 className="text-xs font-black uppercase tracking-widest text-stone-500 mb-3">How Repeat Visits Work</h3>
        <ul className="space-y-1 text-xs text-stone-500">
          <li>• Repeat visits must be at least 30 days apart</li>
          <li>• Must include an operational update or layout / seasonal / staffing change note</li>
          <li>• Same-store reviews diminish in quality weight (1st: 1.0×, 2nd: 0.8×, 3rd: 0.6×, 4th+: 0.4×)</li>
          <li>• Marked "Significant Change Visit" reviews are exempt from diminishing returns</li>
        </ul>
      </div>
    </div>
  );
};
