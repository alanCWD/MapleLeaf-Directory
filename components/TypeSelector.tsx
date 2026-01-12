
import React from 'react';
import { StoreType } from '../types';

// Fix: Updated TypeSelectorProps to use StoreType | null for both selected and onSelect
// to ensure compatibility with the React state setter in App.tsx.
interface TypeSelectorProps {
  // Use StoreType | null to match the state type in App.tsx
  selected: StoreType | null;
  // Use a signature that only expects StoreType or null, matching the state setter's capabilities.
  onSelect: (type: StoreType | null) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ selected, onSelect }) => {
  const types: { label: string; value: StoreType | 'All' }[] = [
    { label: 'All Types', value: 'All' },
    { label: 'Licensed Stores', value: 'Licensed' },
    { label: 'Indigenous Shops', value: 'Aboriginal' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {types.map((t) => (
        <button
          key={t.value}
          // The component logic correctly converts the 'All' option into a null value for the parent state
          onClick={() => onSelect(t.value === 'All' ? null : t.value as StoreType)}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
            (selected === t.value || (!selected && t.value === 'All'))
              ? 'bg-stone-900 text-white shadow-lg'
              : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-500 hover:text-emerald-600'
          }`}
        >
          {t.value === 'Licensed' && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          {t.value === 'Aboriginal' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
          {t.label}
        </button>
      ))}
    </div>
  );
};
