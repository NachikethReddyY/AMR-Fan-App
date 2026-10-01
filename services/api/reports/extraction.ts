import type { Source } from '../ai/contracts.ts';
import {
  fieldNames,
  integer,
  object,
  onlyKeys,
  boundedText,
  validateCandidate,
  type Candidate,
} from './contracts.ts';

export type ExtractReport = (source: Source) => Promise<unknown>;
const reasons = [
  'invalid-input',
  'disabled',
  'busy',
  'timeout',
  'provider',
  'invalid-output',
  'ungrounded',
] as const;
export type ExtractionResult =
  | {
      kind: 'review';
      candidates: Candidate[];
      metadata: { model: string; adapterVersion: string };
    }
  | { kind: 'unavailable'; reason: (typeof reasons)[number] };

/** Caller supplies stored source pages, current authorization and transfer permission. */
export async function extractCandidates({
  source,
  extractReport,
}: {
  source: Source;
  extractReport: ExtractReport;
}): Promise<ExtractionResult> {
  if (
    !source.pages.length ||
    source.pages.length > 8 ||
    source.pages.reduce((n, p) => n + p.text.length, 0) > 12000 ||
    new Set(source.pages.map((page) => page.page)).size !== source.pages.length
  )
    return { kind: 'unavailable', reason: 'invalid-input' };
  let response: unknown;
  try {
    response = await extractReport(source);
  } catch {
    return { kind: 'unavailable', reason: 'provider' };
  }
  try {
    const raw = object(response);
    if (raw.kind === 'unavailable') {
      onlyKeys(raw, ['kind', 'reason', 'reviewRequired']);
      const reason = reasons.find((value) => raw.reason === value);
      if (!reason || raw.reviewRequired !== true)
        throw new Error('Invalid failure');
      return { kind: 'unavailable', reason };
    }
    onlyKeys(raw, [
      'kind',
      'documentId',
      'reviewRequired',
      'metadata',
      'candidates',
    ]);
    if (
      raw.kind !== 'review' ||
      raw.documentId !== source.documentId ||
      raw.reviewRequired !== true ||
      !Array.isArray(raw.candidates) ||
      raw.candidates.length > 24
    )
      throw new Error('Invalid extraction');
    const metadata = object(raw.metadata);
    onlyKeys(metadata, ['model', 'adapterVersion']);
    const model = boundedText(metadata.model, 100);
    const adapterVersion = boundedText(metadata.adapterVersion, 100);
    if (
      model !== 'gpt-6-luna' &&
      !(source.permission === 'synthetic' && model === 'synthetic-fixture')
    )
      throw new Error('Unexpected extractor');
    const candidates = raw.candidates.map((value: unknown) => {
      const candidate = object(value);
      onlyKeys(candidate, ['fields', 'missing', 'evidence']);
      const fields = object(candidate.fields);
      onlyKeys(
        fields,
        fieldNames.filter((key) => key !== 'method'),
      );
      const input: Record<string, unknown> = {
        evidence: candidate.evidence,
        method: null,
      };
      for (const key of fieldNames) {
        if (key === 'method') continue;
        if (fields[key] === null) {
          input[key] = null;
          continue;
        }
        const span = object(fields[key]);
        onlyKeys(span, ['text', 'start', 'end']);
        input[key] = boundedText(span.text, 160);
        integer(span.start, 0, 12000);
        integer(span.end, 1, 12000);
      }
      const validated = validateCandidate(input, source.pages);
      for (const key of fieldNames) {
        if (key === 'method' || fields[key] === null) continue;
        const span = object(fields[key]);
        if (
          span.start !== validated.fields[key]?.start ||
          span.end !== validated.fields[key]?.end
        )
          throw new Error('Changed evidence span');
      }
      if (
        !Array.isArray(candidate.missing) ||
        JSON.stringify(candidate.missing) !==
          JSON.stringify(validated.missing.filter((key) => key !== 'method'))
      )
        throw new Error('Invalid missing fields');
      return validated;
    });
    return { kind: 'review', candidates, metadata: { model, adapterVersion } };
  } catch {
    return { kind: 'unavailable', reason: 'invalid-output' };
  }
}
