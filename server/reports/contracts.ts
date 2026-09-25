import { ApiError } from '../accounts/types.ts';
import { meaningCues } from '../ai/meaning.ts';

export const fieldNames = [
  'name',
  'value',
  'unit',
  'period',
  'category',
  'meaning',
  'method',
] as const;
export type Field = (typeof fieldNames)[number];
export type Span = { text: string; start: number; end: number };
export type Page = { page: number; text: string };
export type Candidate = {
  fields: Record<Field, Span | null>;
  missing: Field[];
  evidence: { page: number; quote: string; start: number; end: number };
};
export const requiredFields: readonly Field[] = [
  'name',
  'value',
  'unit',
  'period',
  'meaning',
];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PAGES = 100;
export const MAX_TEXT_CHARACTERS = 1_000_000;
export const PARSER_VERSION = 'amr-pdf-text-v1/pdfjs-dist-6.3.289';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new ApiError(400, 'Expected an object.');
  return Object.fromEntries(Object.entries(value));
}
export function onlyKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new ApiError(400, 'Unexpected report field.');
}
export function boundedText(value: unknown, max: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    throw new ApiError(400, 'Invalid report text.');
  return value;
}
export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new ApiError(400, 'Invalid report identifier.');
  return value.toLowerCase();
}
export function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new ApiError(400, 'Invalid report number.');
  return value;
}
function cutsToken(text: string, start: number, end: number) {
  const word = /[\p{L}\p{N}]/u;
  return (
    (word.test(text[start] ?? '') && word.test(text[start - 1] ?? '')) ||
    (word.test(text[end - 1] ?? '') && word.test(text[end] ?? ''))
  );
}
function cutsNumber(text: string, start: number, end: number) {
  for (const token of text.matchAll(
    /(?:[+\-−±]\p{Zs}*)?[.,]?\p{Nd}+(?:[.,'’\u066b\u066c\p{Zs}]+\p{Nd}+)*/gu,
  )) {
    const last = token.index + token[0].length;
    if (
      token.index < end &&
      last > start &&
      (start > token.index || end < last)
    )
      return true;
  }
  return false;
}
export function validateCandidate(
  value: unknown,
  pages: readonly Page[],
): Candidate {
  const input = object(value);
  onlyKeys(input, [...fieldNames, 'evidence']);
  const evidence = object(input.evidence);
  onlyKeys(evidence, ['page', 'quote', 'start', 'end']);
  const pageNumber = integer(evidence.page, 1, MAX_PAGES);
  const page = pages.find((p) => p.page === pageNumber);
  if (!page) throw new ApiError(400, 'Evidence page is unavailable.');
  const quote = boundedText(evidence.quote, 1800);
  const start = integer(evidence.start, 0, page.text.length);
  const end = integer(evidence.end, start + 1, page.text.length);
  if (page.text.slice(start, end) !== quote)
    throw new ApiError(400, 'Evidence must match the retained page exactly.');
  const fields: Candidate['fields'] = {
    name: null,
    value: null,
    unit: null,
    period: null,
    category: null,
    meaning: null,
    method: null,
  };
  const missing: Field[] = [];
  for (const key of fieldNames) {
    if (input[key] === null) {
      missing.push(key);
      continue;
    }
    const text = boundedText(input[key], key === 'method' ? 500 : 160);
    const relative = quote.indexOf(text);
    const offset = start + relative;
    if (
      relative < 0 ||
      cutsToken(page.text, offset, offset + text.length) ||
      (key === 'value' && cutsNumber(page.text, offset, offset + text.length))
    )
      throw new ApiError(
        400,
        'Fields must preserve complete literal source text.',
      );
    fields[key] = { text, start: offset, end: offset + text.length };
  }
  return { fields, missing, evidence: { page: pageNumber, quote, start, end } };
}
export function approvalMissing(candidate: Candidate): Field[] {
  const missing = requiredFields.filter(
    (field) => candidate.fields[field] === null,
  );
  const meaning = candidate.fields.meaning;
  if (
    meaning &&
    !meaningCues.some((cue) => {
      const offset = meaning.text.indexOf(cue);
      return (
        offset >= 0 && !cutsToken(meaning.text, offset, offset + cue.length)
      );
    })
  )
    missing.push('meaning');
  return missing;
}
export function requireApproval(candidate: Candidate) {
  if (approvalMissing(candidate).length)
    throw new ApiError(
      409,
      'Complete the source-backed required fields before approval.',
    );
}
export function candidateInput(candidate: Candidate) {
  return {
    name: candidate.fields.name?.text ?? null,
    value: candidate.fields.value?.text ?? null,
    unit: candidate.fields.unit?.text ?? null,
    period: candidate.fields.period?.text ?? null,
    category: candidate.fields.category?.text ?? null,
    meaning: candidate.fields.meaning?.text ?? null,
    method: candidate.fields.method?.text ?? null,
    evidence: candidate.evidence,
  };
}
