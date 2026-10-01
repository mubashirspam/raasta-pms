'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Card, CardTitle, CardHint } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ContactLinks } from '@/components/ContactLinks';
import { updateMyContacts } from '@/lib/actions/profile';
import { SOCIAL_FIELDS, CONTACT_KEYS, type Contacts } from '@/lib/domain/contacts';

type Form = Record<keyof Contacts, string>;

function toForm(c: Contacts): Form {
  return Object.fromEntries(CONTACT_KEYS.map((k) => [k, c[k] ?? ''])) as Form;
}

interface Props {
  fullName: string;
  username: string;
  subtitle: string;
  contacts: Contacts;
  updatedAt: string | null;
}

export function ProfileClient({ fullName, username, subtitle, contacts, updatedAt }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => toForm(contacts));
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [saving, setSaving] = useState(false);

  const filled = CONTACT_KEYS.filter((k) => contacts[k]).length;

  const set = (k: keyof Contacts) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const handleCancel = () => {
    setForm(toForm(contacts));
    setErrors({});
    setEditing(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateMyContacts(form);
    setSaving(false);

    if (!result.success) {
      setErrors(result.fieldErrors ?? {});
      toast.error(result.error ?? 'Could not save');
      return;
    }
    toast.success('Profile saved');
    setErrors({});
    setEditing(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-raasta-ink">My Profile</h1>
        <p className="text-sm text-raasta-muted mt-0.5">Your contact number and social links</p>
      </div>

      <Card>
        <p className="text-raasta-ink font-semibold">{fullName}</p>
        <p className="text-xs text-raasta-muted mt-0.5">{subtitle}</p>
        <p className="text-xs text-raasta-faint mt-0.5">@{username}</p>
      </Card>

      {!editing ? (
        <Card>
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <CardTitle>Contact &amp; social</CardTitle>
              <CardHint>
                {filled === 0
                  ? 'Nothing added yet'
                  : `${filled} of ${CONTACT_KEYS.length} added`}
                {updatedAt &&
                  ` · updated ${new Date(updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}`}
              </CardHint>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {filled === 0 ? 'Add' : 'Edit'}
            </Button>
          </div>
          <ContactLinks contacts={contacts} showMissing />
        </Card>
      ) : (
        <Card>
          <CardTitle className="mb-1">Edit contact &amp; social</CardTitle>
          <CardHint>Leave a field empty to remove it. Only the admin can see these.</CardHint>
          <form onSubmit={handleSave} className="space-y-4 mt-4">
            <Input
              label="WhatsApp number"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+971 50 123 4567"
              value={form.whatsapp}
              onChange={set('whatsapp')}
              error={errors.whatsapp}
              hint="With country code"
            />
            {SOCIAL_FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={f.placeholder}
                value={form[f.key]}
                onChange={set(f.key)}
                error={errors[f.key]}
              />
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={saving}>
                Save
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
