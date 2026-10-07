import { XMLParser, XMLValidator } from 'fast-xml-parser';

const MAX_FEED_CHARS = 512_000;
const MAX_FEED_BYTES = 512_000;
const MAX_ITEMS = 50;
const OFFICIAL_HOST = 'www.astonmartinf1.com';
const OFFICIAL_IMAGE_HOST = 'assets.astonmartinf1.com';
const DEFAULT_NEWS_FEED_URL =
  'https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml';

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string | null;
  imageUrl: string | null;
};

type FeedResponse = {
  ok: boolean;
  headers: Pick<Headers, 'get'>;
  body: ReadableStream<Uint8Array> | null;
};
type FeedRequest = (url: string, init: RequestInit) => Promise<FeedResponse>;

type XmlRecord = Record<string, unknown>;

function record(value: unknown): XmlRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as XmlRecord)
    : null;
}

function plainText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateFeedUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function resolveNewsFeedUrl(
  configured: string | undefined,
): string | null {
  return configured?.trim()
    ? validateFeedUrl(configured)
    : DEFAULT_NEWS_FEED_URL;
}

export function formatPublishedDate(
  publishedAt: string | null,
  locale?: string,
): string {
  if (!publishedAt) return 'Date unavailable';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(publishedAt));
}

function officialArticleUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== 'https:' ||
      url.hostname !== OFFICIAL_HOST ||
      url.port !== '' ||
      url.username ||
      url.password ||
      !url.pathname.startsWith('/en-GB/news/')
    ) {
      return null;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function officialImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    const parameters = [...url.searchParams.entries()];
    if (
      url.protocol !== 'https:' ||
      url.hostname !== OFFICIAL_IMAGE_HOST ||
      url.port !== '' ||
      url.username ||
      url.password ||
      !url.pathname.startsWith('/public/cms/') ||
      url.pathname.includes('%') ||
      url.pathname.includes('//') ||
      !/\.(?:jpe?g|png|webp)$/i.test(url.pathname) ||
      url.hash !== '' ||
      parameters.length !== 2 ||
      !parameters.some(
        ([key, width]) =>
          key === 'w' &&
          /^(?:[1-9]\d{0,2}|[1-4]\d{2})$/.test(width) &&
          Number(width) <= 480,
      ) ||
      !parameters.some(([key, fit]) => key === 'fit' && fit === 'fill')
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function parseNewsFeed(xml: string): NewsItem[] {
  if (
    xml.length > MAX_FEED_CHARS ||
    /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  ) {
    throw new Error('Invalid news feed');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });
  const channel = record(record(parser.parse(xml))?.rss)?.channel;
  const entries = record(channel)?.item;
  if (
    !channel ||
    (entries !== undefined && !Array.isArray(entries) && !record(entries))
  ) {
    throw new Error('Invalid news feed');
  }

  const items =
    entries === undefined ? [] : Array.isArray(entries) ? entries : [entries];
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  for (const value of items.slice(0, MAX_ITEMS)) {
    const item = record(value);
    if (!item) continue;
    const url = officialArticleUrl(item.link);
    const title = plainText(item.title, 200);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    const date = plainText(item.pubDate, 80);
    const timestamp = Date.parse(date);
    const media = record(item['media:content']);
    result.push({
      id: url,
      title,
      summary: plainText(item.description, 500),
      url,
      publishedAt: Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : null,
      imageUrl:
        media?.['@_medium'] === 'image'
          ? officialImageUrl(media['@_url'])
          : null,
    });
  }
  return result;
}

export async function loadNewsFeed(
  url: string,
  signal: AbortSignal,
  request: FeedRequest = fetch,
): Promise<NewsItem[]> {
  const response = await request(url, {
    signal,
    headers: { Accept: 'application/rss+xml, application/xml;q=0.9' },
  });
  if (!response.ok) throw new Error('Feed unavailable');
  const byteLength = Number(response.headers.get('content-length'));
  if (byteLength > MAX_FEED_BYTES) throw new Error('Feed too large');
  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Feed body unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let xml = '';
  let bytes = 0;
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        break;
      }
      bytes += chunk.value.byteLength;
      if (bytes > MAX_FEED_BYTES) throw new Error('Feed too large');
      xml += decoder.decode(chunk.value, { stream: true });
      if (xml.length > MAX_FEED_CHARS) throw new Error('Feed too large');
    }
    xml += decoder.decode();
    return parseNewsFeed(xml);
  } finally {
    if (!completed) {
      try {
        await reader.cancel();
      } catch {
        // The request may already have been aborted by the caller.
      }
    }
    reader.releaseLock();
  }
}
