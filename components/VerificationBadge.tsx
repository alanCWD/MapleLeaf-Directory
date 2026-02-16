
import React from 'react';
import type { VerificationStatus } from '../types';

interface VerificationBadgeProps {
  status: VerificationStatus;
  confidenceScore: number;
  compact?: boolean;
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({ status, confidenceScore, compact = false }) => {
  const config = {
    verified: {
      label: 'Verified',
      icon: (
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
      bg: 'bg-blue-600',
      text: 'text-white',
    },
    ai_suggested: {
      label: 'AI-Suggested',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-amber-500',
      text: 'text-white',
    },
    historically_closed: {
      label: 'Historically Closed',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-stone-500',
      text: 'text-white',
    },
    rejected: {
      label: 'Rejected',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      bg: 'bg-red-500',
      text: 'text-white',
    },
  };

  const c = config[status] || config.ai_suggested;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${c.bg} ${c.text} shadow-sm`}>
        {c.icon}
        {c.label}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${c.bg} ${c.text} shadow-lg`}>
      {c.icon}
      <span>{c.label}</span>
      {status === 'ai_suggested' && (
        <span className="opacity-70 ml-1">{Math.round(confidenceScore * 100)}%</span>
      )}
    </div>
  );
};
