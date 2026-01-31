
import React from 'react';
import { StoreType } from '../types';

interface TypeSelectorProps {
  selected: StoreType | null;
  onSelect: (type: StoreType | null) => void;
}

export const TypeSelector: React.FC<TypeSelectorProps> = ({ selected, onSelect }) => {
  const types: { label: string; value: StoreType | 'All' }[] = [
    { label: 'All Independent', value: 'All' },
    { label: 'Sovereign Shops', value: 'Sovereign' },
    { label: 'Local Gems', value: 'Local Gem' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {types.map((t) => (
        <button
          key={t.value}
          onClick={() => onSelect(t.value === 'All' ? null : t.value as StoreType)}
          className={`px-6 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-2 ${
            (selected === t.value || (!selected && t.value === 'All'))
              ? 'bg-stone-900 text-white shadow-lg'
              : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-500 hover:text-emerald-600'
          }`}
        >
          {t.value === 'Sovereign' && <span className="w-2 h-2 rounded-full bg-purple-500"></span>}
          {t.value === 'Local Gem' && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          {t.label}
        </button>
      ))}
    </div>
  );
};
