/** Explicit remote evaluation. Inputs are committed synthetic fixtures only. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createAi } from '../index.ts';
import { z } from 'zod';

const fixtureSchema = z.array(
  z.strictObject({
    id: z.string(),
    task: z.enum(['report', 'route']),
    language: z.string(),
    input: z.unknown(),
    expected: z.unknown(),
    alternatives: z.record(z.string(), z.array(z.string())).optional(),
  }),
);
const output = process.argv[2];
if (!output || !process.env.LUNA_API_KEY)
  throw new Error('Pass an evidence output path and server-only LUNA_API_KEY');
const ai = createAi({
  LUNA_BASE_URL: process.env.LUNA_BASE_URL ?? 'http://127.0.0.1:8317/v1',
  LUNA_API_KEY: process.env.LUNA_API_KEY,
  LUNA_REPORT_EXTRACTION_ENABLED: true,
});
const fixtures = fixtureSchema.parse(
  JSON.parse(
    await readFile(
      new URL(
        process.argv[3] === 'fresh'
          ? './luna-fresh-held-out.json'
          : './luna-held-out.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ),
);
const results = [];
for (const fixture of fixtures) {
  const started = performance.now();
  const result =
    fixture.task === 'report'
      ? await ai.extractReport(fixture.input)
      : await ai.explainRoute(fixture.input);
  const comparable =
    'candidates' in result
      ? result.candidates.map((candidate) =>
          Object.fromEntries(
            Object.entries(candidate.fields).map(([key, span]) => [
              key,
              span?.text ?? null,
            ]),
          ),
        )
      : 'text' in result
        ? result.kind
        : result.kind;
  // Fixture keys have canonical order; recursively sort objects for field equality.
  function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => `${key}:${stable(item)}`)
        .join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
  }
  results.push({
    id: fixture.id,
    task: fixture.task,
    language: fixture.language,
    kind: result.kind,
    reason: 'reason' in result ? result.reason : null,
    correct: stable(comparable) === stable(fixture.expected),
    semanticCorrect:
      Array.isArray(comparable) && Array.isArray(fixture.expected)
        ? comparable.length === fixture.expected.length &&
          comparable.every((candidate, index) => {
            const expected = fixture.expected;
            if (!Array.isArray(expected)) return false;
            const fields = z
              .record(z.string(), z.string().nullable())
              .safeParse(expected[index]);
            const actual = z
              .record(z.string(), z.string().nullable())
              .safeParse(candidate);
            return (
              fields.success &&
              actual.success &&
              Object.entries(fields.data).every(
                ([key, value]) =>
                  actual.data[key] === value ||
                  (typeof actual.data[key] === 'string' &&
                    fixture.alternatives?.[key]?.includes(actual.data[key])),
              )
            );
          })
        : comparable === fixture.expected,
    elapsedMs: Math.round(performance.now() - started),
    expected: fixture.expected,
    actual: comparable,
  });
}
await mkdir(
  fileURLToPath(new URL('../../../.evidence/local-ai/', import.meta.url)),
  { recursive: true },
);
await writeFile(
  output,
  JSON.stringify(
    {
      model: 'gpt-6-luna',
      adapterVersion: 'amr-ai-v2',
      samples: results.length,
      correct: results.filter((r) => r.correct).length,
      results,
    },
    null,
    2,
  ) + '\n',
  { flag: 'wx' },
);
process.stdout.write(
  JSON.stringify({
    samples: results.length,
    correct: results.filter((r) => r.correct).length,
  }) + '\n',
);
