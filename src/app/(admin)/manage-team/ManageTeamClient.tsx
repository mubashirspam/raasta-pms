'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { addMember, updateMember, deleteMember } from '@/lib/actions/members';
import { changePinAction } from '@/lib/actions/auth';
import { useAdmin } from '@/context/AdminContext';
import type {
  TeamMember, EmployeeCategory, Position,
} from '@/db/schema';

type MemberWithRelations = TeamMember & {
  category: EmployeeCategory;
  position: Position;
};

interface Props {
  members: MemberWithRelations[];
  categories: EmployeeCategory[];
  positions: Position[];
}

export function ManageTeamClient({ members, categories, positions }: Props) {
  const router = useRouter();
  const { logout } = useAdmin();
  const [tab, setTab] = useState<'list' | 'add' | 'settings'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add member form
  const [fullName, setFullName] = useState('');
  const [memberCode, setMemberCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [joiningDate, setJoiningDate] = useState('');

  // Change PIN form
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  const resetForm = () => {
    setFullName(''); setMemberCode(''); setCategoryId('');
    setPositionId(''); setTeamName(''); setJoiningDate('');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await addMember({
      fullName,
      memberCode,
      categoryId: Number(categoryId),
      positionId: Number(positionId),
      teamName: teamName || undefined,
      joiningDate: joiningDate || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error ?? 'Failed to add member');
    } else {
      toast.success('Member added');
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
      setTimeout(async () => { await logout(); router.refresh(); }, 1500);
    }
  };

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Manage Team</h1>
        <Button variant="ghost" size="sm" onClick={async () => { await logout(); router.refresh(); }}>
          Logout
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-raasta-dark rounded-xl p-1">
        {(['list', 'add', 'settings'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-raasta-card text-white' : 'text-gray-500 hover:text-white'
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
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Active</p>
              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <Card key={m.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{m.fullName}</p>
                        <p className="text-xs text-gray-500">{m.memberCode} · {m.position.name} · {m.category.name}</p>
                        {m.teamName && <p className="text-xs text-gray-600 mt-0.5">Team: {m.teamName}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="green">Active</Badge>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className="text-xs text-gray-500 hover:text-amber-400 ml-1 px-2 py-1 rounded hover:bg-amber-400/5"
                        >
                          Deactivate
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/5"
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
              <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Inactive</p>
              <div className="space-y-2">
                {inactiveMembers.map((m) => (
                  <Card key={m.id} className="opacity-60">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{m.fullName}</p>
                        <p className="text-xs text-gray-500">{m.memberCode} · {m.position.name}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="gray">Inactive</Badge>
                        <button
                          onClick={() => handleToggleActive(m)}
                          className="text-xs text-green-500 hover:text-green-400 ml-1 px-2 py-1 rounded"
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
              <p className="text-gray-500 text-sm">No team members yet. Add one using the + Add tab.</p>
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
            <Input
              label="Member Code * (e.g. NJ-001)"
              value={memberCode}
              onChange={(e) => setMemberCode(e.target.value.toUpperCase())}
              required
            />
            <Select
              label="Category *"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              placeholder="Select category"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />
            <Select
              label="Position *"
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              placeholder="Select position"
              options={positions.map((p) => ({ value: p.id, label: p.name }))}
              required
            />
            <Input
              label="Team Name (optional)"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <Input
              label="Joining Date (optional)"
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
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
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Current PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-gold-500/60"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-gold-500/60"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Confirm New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-center text-2xl tracking-widest focus:outline-none focus:border-gold-500/60"
                required
              />
            </div>
            {pinError && <p className="text-xs text-red-400">{pinError}</p>}
            <Button type="submit" className="w-full" loading={submitting}>
              Change PIN
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
