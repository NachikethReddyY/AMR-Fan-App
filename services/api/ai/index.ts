import { configSchema } from './transport.ts';
import { createLuna } from './luna.ts';
import { createLaya } from './laya.ts';

/** Server-only singleton. Callers own permission, authorization and persistent review. */
export function createAi(configuration: unknown) {
  const parsed = configSchema.safeParse(configuration);
  // Do not expose schema errors: they can include configured credential values.
  if (!parsed.success) throw new Error('Invalid AI server configuration');
  return { ...createLuna(parsed.data), ...createLaya(parsed.data) };
}
