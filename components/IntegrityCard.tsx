
import React from 'react';
import type { IntegrityScoreCard } from '../services/api';

interface IntegrityCardProps {
  score: IntegrityScoreCard | null;
  isLoading?: boolean;
  compact?: boolean;
}

function getScoreColor(score: number): { ring: string; text: string; bg: string; label: string } {
  if (score >= 7) return { ring: 'text-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', label: 'Strong' };
  if (score >= 4) return { ring: 'text-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', label: 'Developing' };
  return { ring: 'text-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Needs Data' };
}

function CircularProgress({ value, max = 10, size = 80, strokeWidth = 6, colorClass }: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  colorClass: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value / max, 1);
  const offset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-stone-100"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={colorClass}
      />
    </svg>
  );
}

export const IntegrityCard: React.FC<IntegrityCardProps> = ({ score, isLoading, compact }) => {
  if (isLoading) {
    return (
      <div className={`${compact ? 'flex items-center gap-2' : 'bg-white p-8 rounded-3xl border border-stone-200 shadow-sm'}`}>
        {compact ? (
          <div className="w-8 h-8 rounded-full bg-stone-100 animate-pulse" />
        ) : (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-stone-100 rounded w-32" />
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-stone-100" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-stone-100 rounded w-full" />
              <div className="h-3 bg-stone-100 rounded w-3/4" />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!score) {
    if (compact) return null;
    return (
      <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
        <h3 className="text-lg font-black text-stone-900 mb-4 uppercase tracking-wider flex items-center gap-2">
          <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Integrity Score
        </h3>
        <p className="text-xs text-stone-400 italic">No integrity data yet. Submit reviews to build this store's trust profile.</p>
      </div>
    );
  }

  const colors = getScoreColor(score.score);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${colors.bg} px-3 py-1.5 rounded-xl`}>
        <div className="relative w-8 h-8 flex items-center justify-center">
          <CircularProgress value={score.score} size={32} strokeWidth={3} colorClass={colors.ring} />
          <span className={`absolute text-[10px] font-black ${colors.text}`}>
            {score.score.toFixed(1)}
          </span>
        </div>
        <span className={`text-[10px] font-black uppercase tracking-wider ${colors.text}`}>
          {colors.label}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
      <h3 className="text-lg font-black text-stone-900 mb-6 uppercase tracking-wider flex items-center gap-2">
        <svg className="w-5 h-5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Integrity Score
      </h3>

      <div className="flex flex-col items-center mb-6">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <CircularProgress value={score.score} size={80} strokeWidth={6} colorClass={colors.ring} />
          <div className="absolute flex flex-col items-center">
            <span className={`text-xl font-black ${colors.text}`}>{score.score.toFixed(1)}</span>
            <span className="text-[8px] text-stone-400 font-bold uppercase">/10</span>
          </div>
        </div>
        <span className={`mt-2 text-xs font-black uppercase tracking-wider ${colors.text} ${colors.bg} px-3 py-1 rounded-full`}>
          {colors.label}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-xs text-stone-500 font-medium">Verified Presence</span>
          <span className="text-xs font-bold text-stone-800">{(score.verifiedPresenceRatio * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-xs text-stone-500 font-medium">Review Stability</span>
          <span className="text-xs font-bold text-stone-800">{(score.reviewStability * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center py-2 border-b border-stone-100">
          <span className="text-xs text-stone-500 font-medium">Content Richness</span>
          <span className="text-xs font-bold text-stone-800">{(score.contentRichness * 100).toFixed(0)}%</span>
        </div>
        <div className="flex justify-between items-center py-2">
          <span className="text-xs text-stone-500 font-medium">Weighted Rating</span>
          <span className="text-xs font-bold text-stone-800 flex items-center gap-1">
            <span className="text-amber-500">★</span> {score.weightedAvgRating.toFixed(1)}
          </span>
        </div>
      </div>

      {score.lastAuditDate && (
        <p className="text-[10px] text-stone-400 mt-4 text-center">
          Last audit: {new Date(score.lastAuditDate).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
