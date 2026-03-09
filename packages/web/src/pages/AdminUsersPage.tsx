import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card } from '../components/ui/Card.js';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { Select } from '../components/ui/Select.js';
import { useUsers, useInviteUser, useUpdateUser } from '../hooks/useUsers.js';
import { useUIStore } from '../stores/ui.store.js';
import { ROLE_LABELS } from '@busybirdies/shared';
import type { User } from '@busybirdies/shared';

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'client', label: 'Client' },
];

const INVITE_ROLE_OPTIONS = [
  { value: '', label: 'Select role', disabled: true },
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
];

const inviteSchema = z.object({
  full_name: z.string().min(1, 'Full name is required.').max(100),
  email: z.string().email('Please enter a valid email address.'),
  role: z.enum(['admin', 'agent'], { errorMap: () => ({ message: 'Please select a role.' }) }),
});

type InviteFormData = z.infer<typeof inviteSchema>;

function InviteUserModal({ onClose }: { onClose: () => void }) {
  const inviteUser = useInviteUser();
  const addToast = useUIStore((s) => s.addToast);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { full_name: '', email: '', role: 'agent' },
  });

  const onSubmit = async (data: InviteFormData) => {
    try {
      await inviteUser.mutateAsync(data);
      addToast({ type: 'success', message: `Invitation sent to ${data.email}` });
      onClose();
    } catch {
      addToast({ type: 'error', message: 'Failed to invite user. Please try again.' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
      <div className="bg-surface rounded-xl shadow-lg border border-border w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary">Invite User</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          <Input
            label="Full name"
            type="text"
            placeholder="Jane Smith"
            error={errors.full_name?.message}
            disabled={inviteUser.isPending}
            {...register('full_name')}
          />
          <Input
            label="Email address"
            type="email"
            placeholder="jane@company.com"
            error={errors.email?.message}
            disabled={inviteUser.isPending}
            {...register('email')}
          />
          <Select
            label="Role"
            options={INVITE_ROLE_OPTIONS}
            error={errors.role?.message}
            disabled={inviteUser.isPending}
            {...register('role')}
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={inviteUser.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={inviteUser.isPending}
              disabled={inviteUser.isPending}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserRow({ user }: { user: User }) {
  const updateUser = useUpdateUser(user.id);
  const addToast = useUIStore((s) => s.addToast);

  const handleToggleActive = async () => {
    try {
      await updateUser.mutateAsync({ is_active: !user.is_active });
      addToast({
        type: 'success',
        message: `User ${user.is_active ? 'deactivated' : 'activated'} successfully.`,
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to update user. Please try again.' });
    }
  };

  return (
    <tr className="border-t border-border hover:bg-surface-alt transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{user.full_name}</p>
          <p className="text-xs text-text-secondary">{user.email}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          user.role === 'admin'
            ? 'bg-purple-100 text-purple-700'
            : user.role === 'agent'
            ? 'bg-blue-100 text-blue-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {ROLE_LABELS[user.role]}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          user.is_active
            ? 'bg-success/10 text-success'
            : 'bg-danger/10 text-danger'
        }`}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          user.email_verified
            ? 'bg-success/10 text-success'
            : 'bg-warning/10 text-warning'
        }`}>
          {user.email_verified ? 'Verified' : 'Unverified'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary">
        {new Date(user.created_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleToggleActive}
          isLoading={updateUser.isPending}
          disabled={updateUser.isPending}
        >
          {user.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      </td>
    </tr>
  );
}

export function AdminUsersPage() {
  const addToast = useUIStore((s) => s.addToast);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useUsers({
    role: roleFilter || undefined,
    search: search || undefined,
    page,
    per_page: 25,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  if (isError) {
    addToast({ type: 'error', message: 'Failed to load users.' });
  }

  return (
    <div>
      {showInviteModal && (
        <InviteUserModal onClose={() => setShowInviteModal(false)} />
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Users</h1>
        <Button onClick={() => setShowInviteModal(true)}>
          Invite User
        </Button>
      </div>

      <Card padding="lg">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email..."
              className="flex-1 rounded-md border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
          <Select
            options={ROLE_FILTER_OPTIONS}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="w-40"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-12 text-text-secondary text-sm">Loading users...</div>
        ) : !data?.data?.length ? (
          <div className="text-center py-12 text-text-secondary text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-text-secondary uppercase tracking-wide">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Joined</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pagination.total_pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-text-secondary">
              Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.pagination.total)} of {data.pagination.total} users
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page === data.pagination.total_pages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
