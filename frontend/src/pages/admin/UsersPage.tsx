import { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Shield, Loader2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { userService, type UserItem } from '../../services/userService';
import { orgService, type OrgItem } from '../../services/orgService';
import { useAuthStore } from '../../store/authStore';

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr', label: 'HR' },
  { value: 'tech', label: 'Tech' },
];

const getRoleBadgeStyle = (role: string): React.CSSProperties => {
  switch (role) {
    case 'super_admin':
      return { backgroundColor: 'color-mix(in srgb, #ef4444 15%, transparent)', color: '#ef4444' };
    case 'admin':
      return { backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' };
    case 'hr':
      return { backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' };
    case 'tech':
      return { backgroundColor: 'color-mix(in srgb, #8b5cf6 15%, transparent)', color: '#8b5cf6' };
    default:
      return { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
  }
};

const getStatusBadgeStyle = (isActive: boolean): React.CSSProperties => {
  return isActive
    ? { backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }
    : { backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)' };
};

const formatLastLogin = (dateStr: string | null): string => {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function UsersPage() {
  const currentRole = useAuthStore((s) => s.role);
  const currentOrgId = useAuthStore((s) => s.organizationId);
  const isSuperAdmin = currentRole === 'super_admin';

  // Roles an admin can assign to new users in their org
  const CREATE_ROLE_OPTIONS = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r.value === 'hr' || r.value === 'tech');

  // Roles visible in the filter dropdown — admin never manages super_admin users
  const FILTER_ROLE_OPTIONS = isSuperAdmin
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((r) => r.value !== 'super_admin');

  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);

  const [organizations, setOrganizations] = useState<OrgItem[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('hr');
  const [formOrgId, setFormOrgId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userService.list(
        page,
        PAGE_SIZE,
        roleFilter || undefined,
        search || undefined,
        isSuperAdmin ? orgFilter || undefined : undefined
      );
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, orgFilter, isSuperAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    orgService
      .list()
      .then((res) => setOrganizations(res.organizations))
      .catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('hr');
    // Pre-fill org for non-super-admin (their own org)
    setFormOrgId(isSuperAdmin ? '' : (currentOrgId ?? ''));
    setShowModal(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormName(user.full_name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormOrgId(user.organization_id || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingUser) {
        await userService.update(editingUser.id, {
          full_name: formName,
          organization_id: formOrgId || undefined,
        });
        toast.success('User updated successfully');
      } else {
        await userService.create({
          full_name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
          organization_id: formOrgId || undefined,
        });
        toast.success('User created successfully');
      }
      closeModal();
      fetchUsers();
    } catch {
      toast.error(editingUser ? 'Failed to update user' : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} user "${user.full_name}"?`)) return;
    try {
      await userService.update(user.id, { is_active: !user.is_active });
      toast.success(`User ${action}d successfully`);
      fetchUsers();
    } catch {
      toast.error(`Failed to ${action} user`);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
          >
            <Users size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Users Management
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {total} user{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          <Plus size={16} />
          Create User
        </button>
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
      >
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Roles</option>
          {FILTER_ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {isSuperAdmin && organizations.length > 0 && (
          <select
            value={orgFilter}
            onChange={(e) => {
              setOrgFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Organizations</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Users Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th
                className="text-left px-4 py-3 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Name
              </th>
              <th
                className="text-left px-4 py-3 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Email
              </th>
              <th
                className="text-left px-4 py-3 font-medium w-28"
                style={{ color: 'var(--text-secondary)' }}
              >
                Role
              </th>
              <th
                className="text-left px-4 py-3 font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Organization
              </th>
              <th
                className="text-center px-4 py-3 font-medium w-24"
                style={{ color: 'var(--text-secondary)' }}
              >
                Status
              </th>
              <th
                className="text-left px-4 py-3 font-medium w-44"
                style={{ color: 'var(--text-secondary)' }}
              >
                Last Login
              </th>
              <th
                className="text-right px-4 py-3 font-medium w-28"
                style={{ color: 'var(--text-secondary)' }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <Loader2
                    className="animate-spin inline-block"
                    size={24}
                    style={{ color: 'var(--accent)' }}
                  />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="text-center py-12"
                  style={{ color: 'var(--text-muted)' }}
                >
                  No users found. Create your first user.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const org = organizations.find((o) => o.id === user.organization_id);
                return (
                  <tr
                    key={user.id}
                    className="transition-colors hover:brightness-95"
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Shield size={14} style={{ color: 'var(--text-muted)' }} />
                        <span
                          className="font-medium truncate max-w-[200px]"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {user.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="truncate max-w-[220px] block"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {user.email}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                        style={getRoleBadgeStyle(user.role)}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {org ? org.name : user.organization_id ? user.organization_id : '--'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={getStatusBadgeStyle(user.is_active)}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatLastLogin(user.last_login_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--accent)' }}
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--danger)' }}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
              )
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1" style={{ color: 'var(--text-muted)' }}>
                      ...
                    </span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className="w-8 h-8 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: p === page ? 'var(--accent)' : 'transparent',
                      color: p === page ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg disabled:opacity-30 transition-colors"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit User Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={closeModal}
        >
          <div
            className="w-full max-w-lg rounded-xl p-6"
            style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--card-shadow)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingUser ? 'Edit User' : 'Create User'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="Enter email address"
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Password (create only) */}
              {!editingUser && (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Role
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {CREATE_ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Organization */}
              {isSuperAdmin ? (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Organization
                  </label>
                  <select
                    value={formOrgId}
                    onChange={(e) => setFormOrgId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="">No Organization</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Organization
                  </label>
                  <input
                    type="text"
                    disabled
                    value={organizations.find((o) => o.id === currentOrgId)?.name ?? 'Your Organization'}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none opacity-60 cursor-not-allowed"
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                    }}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
