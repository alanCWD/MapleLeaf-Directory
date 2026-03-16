
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAdminUsersAPI, updateUserRoleAPI, deleteUserAPI, adminAwardBadge, adminRevokeBadge, setCreatorStatus, type AdminUser } from '../services/api';
import { BadgeIcon } from './BadgeIcon';

const BADGE_TYPES = [
  { value: 'explorer', label: 'Explorer', color: 'green' },
  { value: 'local_scout', label: 'Local Scout', color: 'blue' },
  { value: 'regional_builder', label: 'Regional Builder', color: 'orange' },
  { value: 'cross_region_contributor', label: 'Cross-Region Contributor', color: 'purple' },
  { value: 'provincial_connector', label: 'Provincial Connector', color: 'slate' },
  { value: 'bc_culture_guide', label: 'BC Culture Guide', color: 'teal' },
  { value: 'founding_bc_architect', label: 'Founding BC Architect', color: 'amber' },
] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 border-red-200',
  owner: 'bg-amber-100 text-amber-700 border-amber-200',
  user: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState<string | null>(null);
  const [awardingBadgeFor, setAwardingBadgeFor] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{ userId: string; badgeType: string } | null>(null);
  const { isAuthenticated, isLoading: authLoading, isAdmin, user: currentUser } = useAuth();

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getAdminUsersAPI();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadUsers();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [authLoading, isAdmin]);

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">🔐</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Admin Access Required</h2>
        <p className="text-stone-500 font-medium mb-8">Please sign in with an admin account to manage users.</p>
        <a href="/api/login" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Sign In
        </a>
      </div>
    );
  }

  if (!authLoading && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6">⛔</div>
        <h2 className="text-2xl font-black text-stone-900 mb-4">Access Denied</h2>
        <p className="text-stone-500 font-medium mb-8">You need admin privileges to access this page.</p>
        <Link to="/" className="inline-block bg-emerald-500 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-400 transition">
          Back to Directory
        </Link>
      </div>
    );
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionInProgress(userId);
    try {
      const updated = await updateUserRoleAPI(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? updated : u));
    } catch (err: any) {
      console.error('Failed to update role:', err);
      alert(err.message || 'Failed to update role');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (userId: string) => {
    setActionInProgress(userId);
    try {
      await deleteUserAPI(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      setConfirmDelete(null);
    } catch (err: any) {
      console.error('Failed to delete user:', err);
      alert(err.message || 'Failed to delete user');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleAwardBadge = async (userId: string, badgeType: string) => {
    setActionInProgress(userId);
    try {
      const badge = await adminAwardBadge(userId, badgeType);
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        const existing = u.badges || [];
        if (existing.some(b => b.badgeType === badgeType)) return u;
        return { ...u, badges: [...existing, badge] };
      }));
      setAwardingBadgeFor(null);
    } catch (err: any) {
      console.error('Failed to award badge:', err);
      alert(err.message || 'Failed to award badge');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRevokeBadge = async (userId: string, badgeType: string) => {
    setActionInProgress(userId);
    try {
      await adminRevokeBadge(userId, badgeType);
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return { ...u, badges: (u.badges || []).filter(b => b.badgeType !== badgeType) };
      }));
      setConfirmRevoke(null);
    } catch (err: any) {
      console.error('Failed to revoke badge:', err);
      alert(err.message || 'Failed to revoke badge');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleCreator = async (userId: string, currentStatus: boolean) => {
    setActionInProgress(userId);
    try {
      await setCreatorStatus(userId, !currentStatus);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isCreator: !currentStatus } : u));
    } catch (err: any) {
      console.error('Failed to toggle creator status:', err);
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.lastName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesBadge = !badgeFilter || (u.badges && u.badges.some(b => b.badgeType === badgeFilter));
    return matchesSearch && matchesRole && matchesBadge;
  });

  const roleCounts = {
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    owner: users.filter(u => u.role === 'owner').length,
    user: users.filter(u => u.role === 'user').length,
  };

  const badgeCounts = Object.fromEntries(
    BADGE_TYPES.map(bt => [bt.value, users.filter(u => u.badges?.some(b => b.badgeType === bt.value)).length])
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] border border-stone-200 shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-900 p-10 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div>
              <h2 className="text-3xl font-black mb-2 tracking-tight">User Management</h2>
              <p className="text-stone-300 font-medium">
                View all registered users, change roles, and manage accounts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-amber-500/20 text-amber-300 px-4 py-2 rounded-xl text-sm font-bold border border-amber-500/30">
                {users.length} user{users.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={loadUsers}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-white/20 transition border border-white/10"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-grow bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none"
            />
            <div className="flex gap-2 flex-wrap">
              {(['all', 'admin', 'owner', 'user'] as const).map(role => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role === 'all' ? null : role)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                    (role === 'all' && !roleFilter) || roleFilter === role
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)} ({roleCounts[role]})
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-6 p-4 bg-stone-50 rounded-2xl border border-stone-200">
            <span className="text-xs font-black text-stone-500 uppercase tracking-widest self-center mr-1">Badges:</span>
            <button
              onClick={() => setBadgeFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                !badgeFilter ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              All
            </button>
            {BADGE_TYPES.map(bt => (
              <button
                key={bt.value}
                onClick={() => setBadgeFilter(badgeFilter === bt.value ? null : bt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  badgeFilter === bt.value
                    ? 'bg-stone-700 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                }`}
              >
                <span>{bt.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${badgeFilter === bt.value ? 'bg-stone-500' : 'bg-stone-200 text-stone-700'}`}>
                  {badgeCounts[bt.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 animate-spin">⏳</div>
              <p className="text-stone-400 font-bold">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-4">👥</div>
              <p className="text-stone-500 font-bold text-lg">
                {users.length === 0 ? 'No registered users yet.' : 'No users match your filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((u) => {
                const isCurrentUser = currentUser?.id === u.id;
                return (
                  <div
                    key={u.id}
                    className={`border rounded-2xl p-5 transition-all ${
                      isCurrentUser ? 'border-emerald-200 bg-emerald-50/30' : 'border-stone-200 bg-stone-50/50'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex items-start gap-4">
                        {u.profileImageUrl ? (
                          <img src={u.profileImageUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-stone-200 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                            {(u.firstName?.[0] || u.email?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-stone-900">
                              {u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u.email || 'Unknown User'}
                            </h4>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${ROLE_COLORS[u.role] || ROLE_COLORS.user}`}>
                              {u.role}
                            </span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200">
                                You
                              </span>
                            )}
                            {u.badges && u.badges.length > 0 && u.badges.map((b) => (
                              <span key={b.badgeType} className="inline-flex items-center gap-0.5">
                                <BadgeIcon badgeType={b.badgeType as any} size="sm" showLabel={true} />
                                {!isCurrentUser && (
                                  confirmRevoke?.userId === u.id && confirmRevoke?.badgeType === b.badgeType ? (
                                    <span className="inline-flex gap-0.5 ml-0.5">
                                      <button onClick={() => handleRevokeBadge(u.id, b.badgeType)} disabled={actionInProgress === u.id} className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black hover:bg-red-400 disabled:opacity-50 flex items-center justify-center" title="Confirm revoke">Y</button>
                                      <button onClick={() => setConfirmRevoke(null)} className="w-5 h-5 rounded-full bg-stone-300 text-stone-600 text-[9px] font-black hover:bg-stone-400 flex items-center justify-center" title="Cancel">N</button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setConfirmRevoke({ userId: u.id, badgeType: b.badgeType })} className="w-4 h-4 rounded-full bg-red-100 text-red-500 text-[9px] font-black hover:bg-red-200 flex items-center justify-center ml-0.5" title="Revoke badge">&times;</button>
                                  )
                                )}
                              </span>
                            ))}
                          </div>
                          {u.email && u.firstName && (
                            <p className="text-sm text-stone-500 mt-0.5">{u.email}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-stone-400">
                            <span>Joined: {new Date(u.createdAt).toLocaleDateString()}</span>
                            <span>{u.favoritesCount} favorite{u.favoritesCount !== 1 ? 's' : ''}</span>
                            <span>{u.claimsCount} claim{u.claimsCount !== 1 ? 's' : ''}</span>
                          </div>
                        </div>
                      </div>

                      {!isCurrentUser && (
                        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                          <div className="flex items-center gap-2">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={actionInProgress === u.id}
                              className="bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm font-bold text-stone-700 focus:border-emerald-400 focus:outline-none disabled:opacity-50"
                            >
                              <option value="user">User</option>
                              <option value="owner">Owner</option>
                              <option value="admin">Admin</option>
                            </select>
                            {confirmDelete === u.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleDelete(u.id)}
                                  disabled={actionInProgress === u.id}
                                  className="px-3 py-2 rounded-xl text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-50"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-3 py-2 rounded-xl text-sm font-bold bg-stone-200 text-stone-600 hover:bg-stone-300 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(u.id)}
                                disabled={actionInProgress === u.id}
                                className="px-3 py-2 rounded-xl text-sm font-bold bg-red-100 text-red-600 hover:bg-red-200 transition disabled:opacity-50"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleCreator(u.id, !!u.isCreator)}
                              disabled={actionInProgress === u.id}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition border disabled:opacity-50 ${
                                u.isCreator
                                  ? 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200'
                                  : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'
                              }`}
                            >
                              {u.isCreator ? '✍️ Creator' : '+ Creator'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {awardingBadgeFor === u.id ? (
                              <div className="flex items-center gap-1">
                                {BADGE_TYPES
                                  .filter(bt => !(u.badges || []).some(b => b.badgeType === bt.value))
                                  .map(bt => (
                                    <button
                                      key={bt.value}
                                      onClick={() => handleAwardBadge(u.id, bt.value)}
                                      disabled={actionInProgress === u.id}
                                      className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition disabled:opacity-50"
                                    >
                                      {bt.label}
                                    </button>
                                  ))
                                }
                                <button
                                  onClick={() => setAwardingBadgeFor(null)}
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-stone-200 text-stone-500 hover:bg-stone-300 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAwardingBadgeFor(u.id)}
                                disabled={actionInProgress === u.id}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition border border-emerald-200 disabled:opacity-50"
                              >
                                + Award Badge
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
