/**
 * Contact details a member keeps on their profile: a WhatsApp number plus a
 * link for every platform the team posts to (the same platforms viral videos
 * are counted on). Shared by the profile form, its validator and the admin's
 * Profiles page so the three can never disagree on the list.
 */

export const SOCIAL_FIELDS = [
  {
    key: 'instagramUrl',
    label: 'Instagram',
    color: '#eb6834',
    hosts: ['instagram.com'],
    placeholder: 'instagram.com/yourname or @yourname',
    fromHandle: (h: string) => `https://www.instagram.com/${h}`,
  },
  {
    key: 'tiktokUrl',
    label: 'TikTok',
    color: '#1baf7a',
    hosts: ['tiktok.com'],
    placeholder: 'tiktok.com/@yourname or @yourname',
    fromHandle: (h: string) => `https://www.tiktok.com/@${h}`,
  },
  {
    key: 'youtubeUrl',
    label: 'YouTube',
    color: '#2a78d6',
    hosts: ['youtube.com', 'youtu.be'],
    placeholder: 'youtube.com/@yourchannel or @yourchannel',
    fromHandle: (h: string) => `https://www.youtube.com/@${h}`,
  },
  {
    key: 'facebookUrl',
    label: 'Facebook',
    color: '#eda100',
    hosts: ['facebook.com', 'fb.com'],
    placeholder: 'facebook.com/yourname',
    fromHandle: (h: string) => `https://www.facebook.com/${h}`,
  },
  {
    key: 'linkedinUrl',
    label: 'LinkedIn',
    color: '#e87ba4',
    hosts: ['linkedin.com'],
    placeholder: 'linkedin.com/in/yourname',
    // A bare LinkedIn name is ambiguous (person or company page), so only a
    // full link is accepted.
    fromHandle: null,
  },
] as const;

export type SocialKey = (typeof SOCIAL_FIELDS)[number]['key'];
export type ContactKey = 'whatsapp' | SocialKey;
export type Contacts = Record<ContactKey, string | null>;

export const CONTACT_KEYS: ContactKey[] = ['whatsapp', ...SOCIAL_FIELDS.map((f) => f.key)];

const HANDLE_RE = /^@?([A-Za-z0-9._-]{1,60})$/;

/**
 * A WhatsApp number in international form: "+971 50 123 4567", "00971501234567"
 * and "+971-50-123-4567" all become "+971501234567". A number without its
 * country code cannot be dialled from abroad, so it is rejected rather than
 * guessed at.
 */
export function normalizeWhatsapp(raw: string): { value: string | null; error?: string } {
  const s = raw.trim();
  if (!s) return { value: null };
  let compact = s.replace(/[\s\-().]/g, '');
  if (compact.startsWith('00')) compact = `+${compact.slice(2)}`;
  if (!compact.startsWith('+')) {
    return { value: null, error: 'Include the country code, e.g. +971 50 123 4567' };
  }
  if (!/^\+\d{8,15}$/.test(compact)) {
    return { value: null, error: 'Enter a valid WhatsApp number' };
  }
  return { value: compact };
}

/**
 * A profile link for one platform. Accepts a full link, a link without
 * "https://", or — where the platform has one — a bare @handle, and always
 * returns an https link on that platform's own domain. Anything pointing
 * elsewhere is rejected, so a link labelled Instagram really goes to Instagram.
 */
export function normalizeSocial(
  field: (typeof SOCIAL_FIELDS)[number],
  raw: string,
): { value: string | null; error?: string } {
  const s = raw.trim();
  if (!s) return { value: null };

  const handle = s.match(HANDLE_RE);
  // "john.doe" is a handle; "instagram.com" is the site itself.
  const namesSite = field.hosts.some((h) => s.toLowerCase().includes(h));
  if (handle && !namesSite && field.fromHandle) {
    return { value: field.fromHandle(handle[1]) };
  }

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { value: null, error: `Enter your ${field.label} link` };
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const onPlatform = field.hosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (!onPlatform || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return { value: null, error: `That link is not on ${field.label}` };
  }
  if (url.pathname === '/' || url.pathname === '') {
    return { value: null, error: `Link to your ${field.label} profile, not the home page` };
  }

  url.protocol = 'https:';
  url.hash = '';
  const value = url.toString();
  if (value.length > 300) return { value: null, error: `${field.label} link is too long` };
  return { value };
}

/** A wa.me link that opens a chat with the number. */
export function whatsappHref(number: string): string {
  return `https://wa.me/${number.replace(/^\+/, '')}`;
}

/** The part of a profile link worth showing: "instagram.com/najeeb". */
export function displayLink(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
