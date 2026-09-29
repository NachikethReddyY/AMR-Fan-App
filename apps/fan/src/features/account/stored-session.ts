import { z } from 'zod';
import { providerSessionSchema } from './supabase.ts';
import type { StoredSession } from './session.ts';
const schema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('active'),
    token: z.string().min(1).max(16384),
    selected: z.enum(['real', 'demo']),
    provider: providerSessionSchema.optional(),
  }),
  z.object({
    kind: z.literal('revoking'),
    token: z.string().min(1).max(16384),
    provider: providerSessionSchema.optional(),
  }),
]);
export function parseStoredSession(raw: string): StoredSession {
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new Error('Stored sign-in could not be read.');
  }
}
