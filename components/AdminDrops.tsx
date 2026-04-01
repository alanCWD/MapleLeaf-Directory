
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { adminGetDrops, adminReviewDrop } from '../services/api';
import type { Drop } from '../services/api';

type StatusFilter = 'pending_approval' | 'scheduled' | 'sent' | 'rejected' | 'cancelled' | '';

const STATUS_COLORS: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sent: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-stone-200 text-stone-600',
  approved: 'bg-teal-100 text-teal-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending',
  scheduled: 'Scheduled',
  sent: 'Sent',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  approved: 'Approved',
};

const TYPE_ICONS: Record<string, string> = {
  product: '📦',
  event: '📅',
  announcement: '📢',
};

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const toDatetimeLocal = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface ReviewModalProps {
  drop: Drop;
  onClose: () => void;
  onDone: (updated: Drop) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ drop, onClose, onDone }) => {
  const minDateTime = toDatetimeLocal(new Date().toISOString());
  const [action, setAction] = useState<'approve' | 'reject'>('approve');
  const [scheduledAt, setScheduledAt] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (action === 'approve' && !scheduledAt) {
      setError('Please pick a date and time to schedule the send.');
      return;
    }
    setSubmitting(true);
    try {
      const updated = await adminReviewDrop(drop.id, action, {
        scheduledAt: action === 'approve' ? new Date(scheduledAt).toISOString() : undefined,
        adminNotes: adminNotes.trim() || undefined,
      });
      onDone(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-400 text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-xl font-black text-stone-900 mb-1">Review Drop</h2>
        <p className="text-sm text-stone-500 font-medium mb-6">
          {TYPE_ICONS[drop.type] || '📢'} {drop.type.charAt(0).toUpperCase() + drop.type.slice(1)} · {drop.storeName || drop.storeId}
        </p>

        <div className="bg-stone-50 rounded-2xl p-4 mb-6 border border-stone-200">
          <p className="font-bold text-stone-800 mb-1">{drop.title}</p>
          <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap line-clamp-4">{drop.body}</p>
          <p className="text-xs text-emerald-600 font-medium mt-2 truncate">
            Link: {drop.customLink || drop.autoLink}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAction('approve')}
              className={`flex-1 py-3 rounded-2xl font-black text-sm transition border-2 ${action === 'approve' ? 'bg-emerald-500 text-white border-emerald-500' : 'border-stone-200 text-stone-600 hover:border-emerald-300'}`}
            >
              Approve & Schedule
            </button>
            <button
              type="button"
              onClick={() => setAction('reject')}
              className={`flex-1 py-3 rounded-2xl font-black text-sm transition border-2 ${action === 'reject' ? 'bg-red-500 text-white border-red-500' : 'border-stone-200 text-stone-600 hover:border-red-300'}`}
            >
              Reject
            </button>
          </div>

          {action === 'approve' && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">
                Send Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minDateTime}
                onChange={e => setScheduledAt(e.target.value)}
                required
                className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:border-emerald-400 outline-none font-medium"
              />
              <p className="text-xs text-stone-400 mt-1">The email will be sent to all waitlist subscribers at this time.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-stone-500 mb-2">
              {action === 'reject' ? 'Rejection Reason (shown to store owner)' : 'Admin Notes (optional)'}
            </label>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              rows={3}
              placeholder={action === 'reject' ? 'Why is this drop being rejected?' : 'Any internal notes…'}
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl px-4 py-3 text-sm focus:border-emerald-400 outline-none resize-none font-medium"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-4 rounded-2xl font-black text-white transition disabled:opacity-40 ${
              action === 'approve' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500 hover:bg-red-400'
            }`}
          >
            {submitting ? 'Submitting…' : action === 'approve' ? 'Approve & Schedule Drop' : 'Reject Drop'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const AdminDrops: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending_approval');
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingDrop, setReviewingDrop] = useState<Drop | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await adminGetDrops({ status: statusFilter || undefined });
      setDrops(result.drops);
      setTotal(result.total);
    } catch (err) {
      console.error('Failed to load drops:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!authLoading && isAdmin) load();
    else if (!authLoading) setIsLoading(false);
  }, [authLoading, isAdmin, load]);

  const handleReviewDone = (updated: Drop) => {
    setReviewingDrop(null);
    setDrops(prev => prev.map(d => d.id === updated.id ? updated : d).filter(d => {
      if (!statusFilter) return true;
      return d.status === statusFilter;
    }));
    if (statusFilter && updated.status !== statusFilter) {
      setDrops(prev => prev.filter(d => d.id !== updated.id));
      setTotal(t => t - 1);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-800 mb-4">Sign in required</h2>
        <p className="text-stone-600">You must be signed in as an admin to view this page.</p>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h2 className="text-2xl font-black text-stone-800 mb-4">Access denied</h2>
        <p className="text-stone-600">Admin access is required to view this page.</p>
      </div>
    );
  }

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: 'Pending', value: 'pending_approval' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Sent', value: 'sent' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'All', value: '' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {reviewingDrop && (
        <ReviewModal
          drop={reviewingDrop}
          onClose={() => setReviewingDrop(null)}
          onDone={handleReviewDone}
        />
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-black text-stone-900 mb-1">Store Drops</h1>
        <p className="text-stone-500 font-medium">
          {isLoading ? 'Loading…' : `${total} drop${total !== 1 ? 's' : ''}`}
          {statusFilter ? ` · ${STATUS_LABELS[statusFilter] || statusFilter}` : ''}
        </p>
      </div>

      <div className="flex gap-2 mb-8 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition border ${
              statusFilter === tab.value
                ? 'bg-stone-900 text-white border-stone-900'
                : 'border-stone-200 text-stone-600 hover:border-stone-400 bg-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : drops.length === 0 ? (
        <div className="text-center py-24 text-stone-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-medium">No drops {statusFilter ? `with status "${STATUS_LABELS[statusFilter]}"` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drops.map(drop => (
            <div key={drop.id} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-lg">{TYPE_ICONS[drop.type] || '📢'}</span>
                    <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${STATUS_COLORS[drop.status] || 'bg-stone-100 text-stone-600'}`}>
                      {STATUS_LABELS[drop.status] || drop.status}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wide">{drop.type}</span>
                  </div>
                  <h3 className="font-black text-stone-900 text-lg leading-tight mb-0.5">{drop.title}</h3>
                  <p className="text-sm font-semibold text-stone-500">{drop.storeName || drop.storeId}</p>
                  {drop.storeAddress && <p className="text-xs text-stone-400">{drop.storeAddress}</p>}
                </div>

                {drop.status === 'pending_approval' && (
                  <button
                    onClick={() => setReviewingDrop(drop)}
                    className="flex-shrink-0 bg-stone-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-600 transition"
                  >
                    Review
                  </button>
                )}
              </div>

              <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-wrap mb-4 line-clamp-3">{drop.body}</p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-stone-400 font-medium border-t border-stone-100 pt-3">
                <span>
                  Link:{' '}
                  <a
                    href={drop.customLink || drop.autoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline truncate max-w-[200px] inline-block align-bottom"
                  >
                    {drop.customLink || drop.autoLink}
                  </a>
                  {drop.customLink && <span className="ml-1 text-blue-500 font-bold">(custom)</span>}
                </span>
                <span>Submitted: {formatDate(drop.createdAt)}</span>
                {drop.scheduledAt && <span>Scheduled: {formatDate(drop.scheduledAt)}</span>}
                {drop.sentAt && <span>Sent: {formatDate(drop.sentAt)}</span>}
              </div>

              {drop.adminNotes && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-sm text-amber-800">
                  <span className="font-bold">Admin notes: </span>{drop.adminNotes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
