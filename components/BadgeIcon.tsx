
import React from 'react';

type BadgeType =
  | 'explorer'
  | 'local_scout'
  | 'regional_builder'
  | 'cross_region_contributor'
  | 'provincial_connector'
  | 'bc_culture_guide'
  | 'founding_bc_architect';

type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeIconProps {
  badgeType: BadgeType;
  size?: BadgeSize;
  showLabel?: boolean;
}

const badgeConfig: Record<BadgeType, { label: string; emoji: string; bg: string; text: string; icon: (className: string) => React.ReactNode }> = {
  explorer: {
    label: 'Explorer',
    emoji: '🌱',
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
      </svg>
    ),
  },
  local_scout: {
    label: 'Local Scout',
    emoji: '📍',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  regional_builder: {
    label: 'Regional Builder',
    emoji: '🔥',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
      </svg>
    ),
  },
  cross_region_contributor: {
    label: 'Cross-Region Contributor',
    emoji: '🌉',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
  },
  provincial_connector: {
    label: 'Provincial Connector',
    emoji: '🏔',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  bc_culture_guide: {
    label: 'BC Culture Guide',
    emoji: '🧭',
    bg: 'bg-teal-100',
    text: 'text-teal-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  founding_bc_architect: {
    label: 'Founding BC Architect',
    emoji: '🏆',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
};

const sizeConfig: Record<BadgeSize, { icon: string; pill: string; text: string }> = {
  sm: { icon: 'w-3 h-3', pill: 'px-1.5 py-0.5', text: 'text-[8px]' },
  md: { icon: 'w-3.5 h-3.5', pill: 'px-2.5 py-1', text: 'text-[10px]' },
  lg: { icon: 'w-4 h-4', pill: 'px-3 py-1.5', text: 'text-xs' },
};

export const BadgeIcon: React.FC<BadgeIconProps> = ({ badgeType, size = 'md', showLabel = true }) => {
  const badge = badgeConfig[badgeType];
  const sizes = sizeConfig[size];

  if (!badge) return null;

  if (size === 'sm' && !showLabel) {
    return (
      <span
        className={`inline-flex items-center justify-center ${badge.bg} ${badge.text} rounded-full ${sizes.pill}`}
        title={badge.label}
      >
        {badge.icon(sizes.icon)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${badge.bg} ${badge.text} rounded-full ${sizes.pill} font-black ${sizes.text} uppercase tracking-widest`}>
      {badge.icon(sizes.icon)}
      {showLabel && <span>{badge.label}</span>}
    </span>
  );
};
