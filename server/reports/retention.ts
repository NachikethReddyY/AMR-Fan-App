import type { Page } from './contracts.ts';
import type { SourceStorage } from './storage.ts';

/** Original objects carry their initial write time; retrying never refreshes it. */
export async function sweepSources({
  storage,
  expiresBefore,
  saved,
}: {
  storage: Pick<SourceStorage, 'list' | 'remove'>;
  expiresBefore: Date | null;
  saved: (ids: string[]) => Promise<string[]>;
}) {
  if (expiresBefore && !Number.isFinite(expiresBefore.getTime()))
    throw new Error('Invalid report expiry cutoff.');
  const entries = await storage.list();
  const durable = new Set(await saved(entries.map((entry) => entry.id)));
  for (const entry of entries) {
    if (
      durable.has(entry.id) ||
      (expiresBefore !== null && entry.createdAt <= expiresBefore.getTime())
    )
      await storage.remove(entry.id);
  }
}

/** Plain text attachment: PDF text is never interpreted as HTML or executable markup. */
export function sourceText(
  document: {
    id: string;
    title: string;
    sourceKind: string;
    sha256: string | null;
    bytes: number | null;
    parserVersion: string | null;
  },
  pages: Page[],
) {
  return [
    document.title,
    `Document: ${document.id}`,
    `Source kind: ${document.sourceKind}`,
    `Original SHA-256: ${document.sha256}`,
    `Original bytes: ${document.bytes}`,
    `Parser: ${document.parserVersion}`,
    '',
    ...pages.map((page) => `Page ${page.page}\n${page.text}\n`),
  ].join('\n');
}
