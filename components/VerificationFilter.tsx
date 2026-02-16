
import React from 'react';
import type { VerificationStatus } from '../types';

interface VerificationFilterProps {
  selected: VerificationStatus | null;
  onSelect: (status: VerificationStatus | null) => void;
  hideUnverified: boolean;
  onToggleHideUnverified: () => void;
}

export const VerificationFilter: React.FC<VerificationFilterProps> = ({
  selected,
  onSelect,
  hideUnverified,
  onToggleHideUnverified,
}) => {
  const filters: { label: string; value: VerificationStatus | 'All' }[] = [
    { label: 'All Listings', value: 'All' },
    { label: 'Verified', value: 'verified' },
    { label: 'AI-Suggested', value: 'ai_suggested' },
    { label: 'Historically Closed', value: 'historically_closed' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4">
      <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">Trust Level:</span>
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onSelect(f.value === 'All' ? null : f.value as VerificationStatus)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
            (selected === f.value || (!selected && f.value === 'All'))
              ? 'bg-stone-900 text-white border-stone-900 shadow-md'
              : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
          }`}
        >
          {f.label}
        </button>
      ))}
      <label className="flex items-center gap-2 ml-4 cursor-pointer group">
        <input
          type="checkbox"
          checked={hideUnverified}
          onChange={onToggleHideUnverified}
          className="w-4 h-4 accent-emerald-600 rounded"
        />
        <span className="text-xs font-bold text-stone-500 group-hover:text-stone-700 transition">
          Hide low-confidence listings
        </span>
      </label>
    </div>
  );
};
