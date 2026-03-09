
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAdminUsersAPI, updateUserRoleAPI, deleteUserAPI, type AdminUser } from '../services/api';
import { BadgeIcon } from './BadgeIcon';

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

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery ||
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.lastName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    owner: users.filter(u => u.role === 'owner').length,
    user: users.filter(u => u.role === 'user').length,
  };

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
                              <BadgeIcon key={b.badgeType} badgeType={b.badgeType as any} size="sm" showLabel={true} />
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
                        <div className="flex items-center gap-2 flex-shrink-0">
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
