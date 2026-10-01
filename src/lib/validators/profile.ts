import { z } from 'zod';
import {
  SOCIAL_FIELDS,
  normalizeSocial,
  normalizeWhatsapp,
  type Contacts,
} from '@/lib/domain/contacts';

const field = z.string().max(400).optional().default('');

/**
 * The profile form as typed, normalised to what is stored: blanks become null,
 * the number becomes +digits and every link an https link on its own platform.
 * Each problem is reported against its own field.
 */
export const contactsSchema = z
  .object({
    whatsapp: field,
    ...Object.fromEntries(SOCIAL_FIELDS.map((f) => [f.key, field])),
  } as Record<keyof Contacts, typeof field>)
  .transform((raw, ctx): Contacts => {
    const out = {} as Contacts;

    const wa = normalizeWhatsapp(raw.whatsapp);
    if (wa.error) ctx.addIssue({ code: 'custom', path: ['whatsapp'], message: wa.error });
    out.whatsapp = wa.value;

    for (const f of SOCIAL_FIELDS) {
      const r = normalizeSocial(f, raw[f.key]);
      if (r.error) ctx.addIssue({ code: 'custom', path: [f.key], message: r.error });
      out[f.key] = r.value;
    }
    return out;
  });
