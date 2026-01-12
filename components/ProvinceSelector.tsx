
import React from 'react';
import { Province } from '../types';

interface ProvinceSelectorProps {
  selected: Province | null;
  onSelect: (p: Province | null) => void;
}

export const ProvinceSelector: React.FC<ProvinceSelectorProps> = ({ selected, onSelect }) => {
  return (
    <div className="flex flex-wrap gap-2 overflow-x-auto pb-4 scrollbar-hide">
      <button 
        onClick={() => onSelect(null)}
        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition ${!selected ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'}`}
      >
        All Canada
      </button>
      {Object.values(Province).map(p => (
        <button 
          key={p}
          onClick={() => onSelect(p)}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition ${selected === p ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-stone-600 border border-stone-200 hover:border-emerald-300'}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
};
