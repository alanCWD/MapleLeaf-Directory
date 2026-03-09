
import React from 'react';

type BadgeType = 'verified_scout' | 'legacy_archivist' | 'integrity_anchor';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeIconProps {
  badgeType: BadgeType;
  size?: BadgeSize;
  showLabel?: boolean;
}

const badgeConfig: Record<BadgeType, { label: string; bg: string; text: string; icon: (className: string) => React.ReactNode }> = {
  verified_scout: {
    label: 'Verified Scout',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    ),
  },
  legacy_archivist: {
    label: 'Legacy Archivist',
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  integrity_anchor: {
    label: 'Integrity Anchor',
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: (cls: string) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
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
