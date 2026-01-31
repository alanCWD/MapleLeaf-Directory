
import React from 'react';
import { Store } from '../types';
import { StoreCard } from './StoreCard';

interface StoreListProps {
  stores: Store[];
  favorites: string[];
  onToggleFavorite: (id: string) => void;
}

export const StoreList: React.FC<StoreListProps> = ({ stores, favorites, onToggleFavorite }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {stores.map(store => (
        <StoreCard 
          key={store.id} 
          store={store} 
          isFavorite={favorites.includes(store.id)}
          onToggleFavorite={() => onToggleFavorite(store.id)}
        />
      ))}
    </div>
  );
};
