
import React, { useState } from 'react';
import type { FlagReason } from '../types';
import { flagStore } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface FlagButtonProps {
  storeId: string;
  onFlagged?: () => void;
}

const flagReasons: { value: FlagReason; label: string }[] = [
  { value: 'does_not_exist', label: 'Does not exist' },
  { value: 'wrong_location', label: 'Wrong location/address' },
  { value: 'permanently_closed', label: 'Permanently closed' },
  { value: 'duplicate', label: 'Duplicate listing' },
  { value: 'other', label: 'Other issue' },
];

export const FlagButton: React.FC<FlagButtonProps> = ({ storeId, onFlagged }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<FlagReason | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    try {
      await flagStore(storeId, selectedReason, comment || undefined);
      setSubmitted(true);
      onFlagged?.();
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setSelectedReason(null);
        setComment('');
      }, 2000);
    } catch (err) {
      console.error('Failed to flag store:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-emerald-700 font-bold text-sm">Thank you for your report. We'll review this listing.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!isAuthenticated) {
            window.location.href = '/api/login';
            return;
          }
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 text-stone-400 hover:text-red-500 text-xs font-bold uppercase tracking-widest transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
        </svg>
        Report Issue
      </button>

      {isOpen && (
        <div className="mt-3 bg-white border border-stone-200 rounded-2xl p-5 shadow-xl">
          <h4 className="font-bold text-stone-800 text-sm mb-3">Why are you reporting this listing?</h4>
          <div className="space-y-2 mb-4">
            {flagReasons.map((r) => (
              <button
                key={r.value}
                onClick={() => setSelectedReason(r.value)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                  selectedReason === r.value
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-stone-50 border-stone-100 text-stone-600 hover:border-stone-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Additional details (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm resize-none focus:border-red-300 focus:outline-none"
            rows={2}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={!selectedReason || isSubmitting}
              className="flex-1 bg-red-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-500 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
