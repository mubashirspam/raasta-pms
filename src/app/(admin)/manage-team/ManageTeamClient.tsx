'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { RefreshCw } from 'lucide-react';
import { addMember, updateMember, deleteMember, regenerateMemberPin } from '@/lib/actions/members';
import { changePinAction } from '@/lib/actions/auth';
import type {
  TeamMember, EmployeeCategory, Position,
} from '@/db/schema';

type MemberWithRelations = TeamMember & {
  category: EmployeeCategory;
  position: Position;
};

type Login = { userId: string; username: string; pin: string };

interface Props {
  members: MemberWithRelations[];
  logins: Record<string, Login>;
  categories: EmployeeCategory[];
  positions: Position[];
}

export function ManageTeamClient({ members, logins, categories, positions }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'list' | 'add' | 'settings'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add member form
  const [fullName, setFullName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [positionId, setPositionId] = useState('');

  // Positions belong to a category, so only offer the ones that match.
  const availablePositions = categoryId
    ? positions.filter((p) => p.categoryId === Number(categoryId))
    : [];

  // Change PIN form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const resetForm = () => {
    setFullName(''); setCategoryId('');
    setPositionId('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await addMember({
      fullName,
      categoryId: Number(categoryId),
      positionId: Number(positionId),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? 'Failed to add member');
    } else {
      toast.success(
        `Member added — code ${result.memberCode}, login ${result.username} / PIN ${result.pin}`,
        { duration: 8000 },
      );
      resetForm();
      setTab('list');
      router.refresh();
    }
  };

  const handleToggleActive = async (m: MemberWithRelations) => {
    const result = await updateMember(m.id, { isActive: !m.isActive });
    if (result.success) {
      toast.success(m.isActive ? 'Member deactivated' : 'Member reactivated');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this member? If they have historical data they will be deactivated instead.')) return;
    const result = await deleteMember(id);
    if (result.success) {
      toast.success(result.error ?? 'Member removed');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Failed');
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (!/^\d{4}$/.test(newPin)) { setPinError('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    setSubmitting(true);
    const result = await changePinAction(currentPin, newPin);
    setSubmitting(false);
    if (!result.success) {
      setPinError(result.error ?? 'Failed');
    } else {
      toast.success('PIN changed. You will be logged out.');
      setTimeout(() => router.refresh(), 1500);
    }
  };

  const handleRegenerate = async (userId: string) => {
    const result = await regenerateMemberPin(userId);
    if (!result.success) return toast.error(result.error ?? 'Could not regenerate PIN');
    toast.success(`New PIN: ${result.pin}`);
    router.refresh();
  };

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-raasta-ink">Manage Team</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-raasta-subtle rounded-xl p-1">
        {(['list', 'add', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-raasta-surface text-raasta-ink' : 'text-raasta-muted hover:text-raasta-ink'
            }`}
          >
            {t === 'list' ? `Members (${members.length})` : t === 'add' ? '+ Add' : 'Settings'}
          </button>
        ))}
      </div>

      {/* Member list */}
      {tab === 'list' && (
        <div className="space-y-4">
          {activeMembers.length > 0 && (
            <div>
              <p className="text-xs text-raasta-muted font-medium mb-2 uppercase tracking-wide">Active</p>
              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <Card key={m.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-raasta-ink font-semibold text-sm truncate">{m.fullName}</p>
                        <p className="text-xs text-raasta-muted">{m.memberCode} · {m.position.name} · {m.category.name}</p>
                        <Credentials login={logins[m.id]} onRegenerate={handleRegenerate} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="green">Active</Badge>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className="text-xs text-raasta-muted hover:text-warn-500 ml-1 px-2 py-1 rounded hover:bg-warn-50"
                        >
                          Deactivate
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-xs text-bad-500 hover:text-bad-600 px-2 py-1 rounded hover:bg-bad-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {inactiveMembers.length > 0 && (
            <div>
              <p className="text-xs text-raasta-muted font-medium mb-2 uppercase tracking-wide">Inactive</p>
              <div className="space-y-2">
                {inactiveMembers.map((m) => (
                  <Card key={m.id} className="opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-raasta-ink font-semibold text-sm truncate">{m.fullName}</p>
                        <p className="text-xs text-raasta-muted">{m.memberCode} · {m.position.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="gray">Inactive</Badge>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className="text-xs text-ok-500 hover:text-ok-600 ml-1 px-2 py-1 rounded hover:bg-ok-50"
                        >
                          Reactivate
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {members.length === 0 && (
            <Card>
              <p className="text-raasta-muted text-sm">No team members yet. Add one using the + Add tab.</p>
            </Card>
          )}
        </div>
      )}

      {/* Add member */}
      {tab === 'add' && (
        <Card>
          <CardTitle className="mb-4">Add Team Member</CardTitle>
          <form onSubmit={handleAddMember} className="space-y-4">
            <Input
              label="Full Name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <Select
              label="Category *"
              value={categoryId}
              onChange={(e) => { setCategoryId(e.target.value); setPositionId(''); }}
              placeholder="Select category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Select
              label="Position *"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              placeholder={categoryId ? 'Select position' : 'Select a category first'}
              options={availablePositions.map((p) => ({ value: p.id, label: p.name }))}
              required
            />
            <Button type="submit" className="w-full" loading={submitting}>
              Add Member
            </Button>
          </form>
        </Card>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <Card>
          <CardTitle className="mb-4">Change Admin PIN</CardTitle>
          <form onSubmit={handleChangePin} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-center text-2xl tracking-widest focus:outline-none focus:border-gold-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-center text-2xl tracking-widest focus:outline-none focus:border-gold-400"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-raasta-muted uppercase tracking-wide">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-subtle border border-raasta-border rounded-xl px-3 py-2.5 text-raasta-ink text-center text-2xl tracking-widest focus:outline-none focus:border-gold-400"
                required
              />
            </div>
            {pinError && <p className="text-xs text-bad-500">{pinError}</p>}
            <Button type="submit" className="w-full" loading={submitting}>
              Change PIN
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

function Credentials({
  login,
  onRegenerate,
}: {
  login?: Login;
  onRegenerate: (userId: string) => void;
}) {
  if (!login) {
    return <p className="text-xs text-raasta-faint mt-1.5">No login yet</p>;
  }
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <span className="inline-flex items-center gap-1.5 bg-raasta-subtle border border-raasta-border rounded-lg px-2 py-1">
        <span className="text-[11px] text-raasta-muted">user</span>
        <span className="text-xs font-mono text-raasta-ink">{login.username}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 bg-raasta-subtle border border-raasta-border rounded-lg px-2 py-1">
        <span className="text-[11px] text-raasta-muted">PIN</span>
        <span className="text-xs font-mono font-semibold text-raasta-ink tabular-nums">{login.pin}</span>
      </span>
      <button
        type="button"
        onClick={() => onRegenerate(login.userId)}
        aria-label={`Generate a new PIN for ${login.username}`}
        className="p-1 rounded-lg text-raasta-faint hover:text-gold-600 hover:bg-gold-50 transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
