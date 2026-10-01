import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/domain/helpers';
import {
  SOCIAL_FIELDS,
  displayLink,
  whatsappHref,
  type Contacts,
} from '@/lib/domain/contacts';

const ROWS = [
  { key: 'whatsapp', label: 'WhatsApp', color: '#25a244' },
  ...SOCIAL_FIELDS.map(({ key, label, color }) => ({ key, label, color })),
] as const;

/**
 * A member's contact details as tappable rows: WhatsApp opens a chat, every
 * other row opens the profile. With `showMissing`, empty fields stay listed as
 * "Not added" so the gaps are visible; otherwise they are left out.
 */
export function ContactLinks({
  contacts,
  showMissing = false,
  className,
}: {
  contacts: Contacts;
  showMissing?: boolean;
  className?: string;
}) {
  const rows = showMissing ? ROWS : ROWS.filter((r) => contacts[r.key]);
  if (rows.length === 0) {
    return <p className={cn('text-xs text-raasta-faint', className)}>No contact details added</p>;
  }

  return (
    <ul className={cn('divide-y divide-raasta-line', className)}>
      {rows.map(({ key, label, color }) => {
        const value = contacts[key];
        const href = value ? (key === 'whatsapp' ? whatsappHref(value) : value) : null;
        const text = value ? (key === 'whatsapp' ? value : displayLink(value)) : null;
        return (
          <li key={key} className="flex items-center gap-3 py-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: value ? color : 'transparent', boxShadow: value ? undefined : `inset 0 0 0 1.5px ${color}` }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-raasta-muted w-20 shrink-0">{label}</span>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 min-w-0 text-sm text-raasta-ink hover:text-gold-700 hover:underline"
              >
                <span className="truncate">{text}</span>
                <ExternalLink className="w-3 h-3 shrink-0 text-raasta-faint" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-sm text-raasta-faint">Not added</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The filled-in contacts as a row of small buttons, each opening its link in a
 * new tab — compact enough to sit inside a member card.
 */
export function ContactButtons({ contacts }: { contacts?: Contacts }) {
  const rows = contacts ? ROWS.filter((r) => contacts[r.key]) : [];
  if (!contacts || rows.length === 0) {
    return <p className="text-xs text-raasta-faint mt-1.5">No contact details added</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {rows.map(({ key, label, color }) => {
        const value = contacts[key]!;
        return (
          <a
            key={key}
            href={key === 'whatsapp' ? whatsappHref(value) : value}
            target="_blank"
            rel="noopener noreferrer"
            title={key === 'whatsapp' ? value : displayLink(value)}
            className="inline-flex items-center gap-1.5 bg-raasta-surface border border-raasta-border rounded-lg px-2 py-1 text-xs font-medium text-raasta-ink hover:border-gold-300 hover:bg-gold-50 transition-colors"
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
            {label}
          </a>
        );
      })}
    </div>
  );
}
