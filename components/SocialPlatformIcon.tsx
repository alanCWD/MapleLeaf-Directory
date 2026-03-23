import React from 'react';

interface Props {
  platform: string;
  size?: number;
  className?: string;
}

export const SocialPlatformIcon: React.FC<Props> = ({ platform, size = 20, className = '' }) => {
  const s = size;
  switch (platform) {
    case 'instagram':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} fill="none">
          <defs>
            <linearGradient id={`ig-${s}`} x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f09433" />
              <stop offset="25%" stopColor="#e6683c" />
              <stop offset="50%" stopColor="#dc2743" />
              <stop offset="75%" stopColor="#cc2366" />
              <stop offset="100%" stopColor="#bc1888" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="22" height="22" rx="6" fill={`url(#ig-${s})`} />
          <circle cx="12" cy="12" r="5" stroke="white" strokeWidth="2" />
          <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
        </svg>
      );
    case 'facebook':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} fill="none">
          <rect width="24" height="24" rx="5" fill="#1877F2" />
          <path d="M15.5 4H13a4 4 0 00-4 4v2H7v3h2v7h3v-7h2l.5-3H12V8a1 1 0 011-1h2.5V4z" fill="white" />
        </svg>
      );
    case 'x':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} fill="none">
          <rect width="24" height="24" rx="5" fill="#000" />
          <path d="M17.75 3.75h3L13.5 10.9l8.5 10.35H15.2l-5.1-6.67-5.84 6.67H1.1l7.55-8.64L1.25 3.75h7l4.6 6.08 4.9-6.08zm-1.08 16.2h1.65L7.4 5.45H5.6l11.07 14.5z" fill="white" />
        </svg>
      );
    case 'reddit':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} fill="none">
          <circle cx="12" cy="12" r="12" fill="#FF4500" />
          <path d="M19.5 12a1.5 1.5 0 00-2.55-1.07A7.7 7.7 0 0013 9.65l.55-2.6 1.8.38a1.1 1.1 0 101.1-1.08 1.1 1.1 0 00-1.05.75l-2-.43-.65 3.03c-1.7.08-3.23.62-4.35 1.45A1.5 1.5 0 104.5 12a1.5 1.5 0 00.73 1.28c-.04.17-.06.35-.06.53 0 2.22 2.47 4.02 5.5 4.02s5.5-1.8 5.5-4.02c0-.18-.02-.36-.06-.53A1.5 1.5 0 0019.5 12zm-12 1a.75.75 0 111.5 0 .75.75 0 01-1.5 0zm4.08 2.8c-.56.56-1.62.76-2.08.76s-1.52-.2-2.08-.76a.4.4 0 01.56-.56c.37.37 1.07.56 1.52.56s1.15-.19 1.52-.56a.4.4 0 01.56.56zm.17-2.05a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" fill="white" />
        </svg>
      );
    case 'discord':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className={className} fill="none">
          <rect width="24" height="24" rx="5" fill="#5865F2" />
          <path d="M17.6 5.9a14.9 14.9 0 00-3.7-.95.06.06 0 00-.06.03c-.16.28-.34.65-.47.94a13.8 13.8 0 00-4.14 0 9.5 9.5 0 00-.47-.94.06.06 0 00-.06-.03 14.9 14.9 0 00-3.7.95.05.05 0 00-.03.02C2.94 9.58 2.34 13.1 2.65 16.6a.07.07 0 00.02.04 14.9 14.9 0 004.48 2.27.07.07 0 00.07-.03c.35-.47.66-.97.92-1.49a.06.06 0 00-.03-.08 9.8 9.8 0 01-1.4-.67.06.06 0 010-.1c.09-.07.19-.14.28-.22a.06.06 0 01.06-.01c2.93 1.34 6.1 1.34 9 0a.06.06 0 01.06.01c.09.08.18.15.28.22a.06.06 0 010 .1 9.2 9.2 0 01-1.41.67.06.06 0 00-.03.08c.27.52.58 1.02.92 1.49a.06.06 0 00.07.03 14.9 14.9 0 004.49-2.27.065.065 0 00.02-.04c.36-3.83-.61-7.15-2.6-10.1a.05.05 0 00-.03-.01zM9.01 14.5c-.9 0-1.64-.83-1.64-1.84s.73-1.84 1.64-1.84c.92 0 1.65.83 1.64 1.84 0 1.01-.72 1.84-1.64 1.84zm6 0c-.9 0-1.63-.83-1.63-1.84s.72-1.84 1.63-1.84c.92 0 1.65.83 1.63 1.84 0 1.01-.71 1.84-1.63 1.84z" fill="white" />
        </svg>
      );
    default:
      return <span style={{ width: s, height: s }} className={`inline-flex items-center justify-center text-stone-400 ${className}`}>?</span>;
  }
};

export const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  x: 'X (Twitter)',
  reddit: 'Reddit',
  discord: 'Discord',
};

export const PLATFORMS = ['instagram', 'facebook', 'x', 'reddit', 'discord'] as const;
export type SocialPlatform = typeof PLATFORMS[number];
