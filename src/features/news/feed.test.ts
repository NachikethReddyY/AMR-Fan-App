import {
  loadNewsFeed,
  formatPublishedDate,
  parseNewsFeed,
  resolveNewsFeedUrl,
  validateFeedUrl,
} from './feed';

const article =
  'https://www.astonmartinf1.com/en-GB/news/feature/inside-the-team';
const xml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <title>Official news</title>
  <item><title>Inside &amp; out</title><link>${article}</link>
    <guid>${article}</guid><description>A look at &lt;the team&gt;.</description>
    <pubDate>Tue, 22 Sep 2026 00:00:00 GMT</pubDate></item>
</channel></rss>`;

describe('official news feed', () => {
  test('reads an RSS article and decodes its plain text', () => {
    expect(parseNewsFeed(xml)).toEqual([
      {
        id: article,
        title: 'Inside & out',
        summary: 'A look at <the team>.',
        url: article,
        publishedAt: '2026-09-22T00:00:00.000Z',
        imageUrl: null,
      },
    ]);
  });

  test('ignores duplicate and unsafe article URLs', () => {
    const items = [
      `<item><title>Valid</title><link>${article}</link></item>`,
      `<item><title>Duplicate</title><link>${article}</link></item>`,
      '<item><title>Off site</title><link>https://example.com/news/item</link></item>',
      '<item><title>Lookalike</title><link>https://www.astonmartinf1.com.evil.test/en-GB/news/x</link></item>',
      '<item><title>Other port</title><link>https://www.astonmartinf1.com:8443/en-GB/news/x</link></item>',
      '<item><title>Script</title><link>javascript:alert(1)</link></item>',
    ].join('');
    expect(parseNewsFeed(`<rss><channel>${items}</channel></rss>`)).toEqual([
      expect.objectContaining({ title: 'Valid', url: article }),
    ]);
  });

  test('reads official Media RSS images and ignores unsafe or absent images', () => {
    const officialImage =
      'https://assets.astonmartinf1.com/public/cms/story.jpg?w=480&fit=fill';
    const imageItem = (image: string) =>
      `<item><title>Story</title><link>${article}</link>${image}</item>`;
    const media = (url: string) =>
      `<media:content url="${url.replaceAll('&', '&amp;')}" medium="image" />`;
    const feed = (image: string) =>
      `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel>${imageItem(image)}</channel></rss>`;

    expect(parseNewsFeed(feed(media(officialImage)))[0]?.imageUrl).toBe(
      officialImage,
    );
    expect(
      parseNewsFeed(
        feed(`<media:content url="${officialImage}" medium="video" />`),
      )[0]?.imageUrl,
    ).toBeNull();
    for (const unsafe of [
      'http://assets.astonmartinf1.com/public/cms/story.jpg',
      'https://assets.astonmartinf1.com.evil.test/public/cms/story.jpg',
      'https://assets.astonmartinf1.com:8443/public/cms/story.jpg',
      'https://user:pass@assets.astonmartinf1.com/public/cms/story.jpg',
      'https://assets.astonmartinf1.com/private/story.jpg',
      'https://assets.astonmartinf1.com/public/cms/story.svg',
      'https://assets.astonmartinf1.com/public/cms/story.avif?w=480&fit=fill',
      'https://assets.astonmartinf1.com/public/cms/story.jpg?w=1500&fit=fill',
      'https://assets.astonmartinf1.com/public/cms/story.jpg?w=480&fit=fill&url=https://evil.test',
      'https://assets.astonmartinf1.com/public/cms/story.jpg?w=480&fit=fill#wow',
      'data:image/png;base64,aGVsbG8=',
    ]) {
      expect(parseNewsFeed(feed(media(unsafe)))[0]?.imageUrl).toBeNull();
    }
    expect(parseNewsFeed(feed(''))[0]?.imageUrl).toBeNull();
  });

  test('rejects malformed, oversized, and entity-bearing XML', () => {
    expect(() =>
      parseNewsFeed('<rss><channel><item></channel></rss>'),
    ).toThrow();
    expect(() =>
      parseNewsFeed('<!DOCTYPE rss [<!ENTITY x "secret">]><rss/>'),
    ).toThrow();
    expect(() => parseNewsFeed(' '.repeat(512_001))).toThrow();
  });

  test('requires a secure configured feed URL', () => {
    expect(validateFeedUrl('https://feeds.example.org/feed.xml')).toBe(
      'https://feeds.example.org/feed.xml',
    );
    expect(validateFeedUrl('')).toBeNull();
    expect(validateFeedUrl('http://feeds.example.org/feed.xml')).toBeNull();
    expect(
      validateFeedUrl('https://user:pass@feeds.example.org/feed.xml'),
    ).toBeNull();
  });

  test('uses the published feed by default and permits a secure override', () => {
    expect(resolveNewsFeedUrl(undefined)).toBe(
      'https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml',
    );
    expect(resolveNewsFeedUrl('')).toBe(
      'https://green-sky-08b27ad10.4.azurestaticapps.net/feed.xml',
    );
    expect(resolveNewsFeedUrl('https://feeds.example.org/feed.xml')).toBe(
      'https://feeds.example.org/feed.xml',
    );
    expect(resolveNewsFeedUrl('http://feeds.example.org/feed.xml')).toBeNull();
  });

  test('shows the source calendar day west of UTC', () => {
    expect(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Los_Angeles',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date('2026-09-22T00:00:00.000Z')),
    ).toBe('Sep 21, 2026');
    expect(formatPublishedDate('2026-09-22T00:00:00.000Z', 'en-US')).toBe(
      'Sep 22, 2026',
    );
    expect(formatPublishedDate(null, 'en-US')).toBe('Date unavailable');
  });

  test('loads once from a bounded stream and rejects HTTP failures', async () => {
    const signal = new AbortController().signal;
    const body = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Buffer.from(xml));
          controller.close();
        },
      });
    const request = jest.fn(async () => ({
      ok: true,
      headers: { get: () => null },
      body: body(),
    }));
    await expect(
      loadNewsFeed('https://feeds.example.org/feed.xml', signal, request),
    ).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      'https://feeds.example.org/feed.xml',
      expect.objectContaining({ signal }),
    );

    await expect(
      loadNewsFeed('https://feeds.example.org/feed.xml', signal, async () => ({
        ok: false,
        headers: { get: () => null },
        body: body(),
      })),
    ).rejects.toThrow('Feed unavailable');
  });

  test('rejects oversized or unstreamable bodies even when length lies', async () => {
    const signal = new AbortController().signal;
    const oversized = () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(300_000));
          controller.enqueue(new Uint8Array(300_001));
          controller.close();
        },
      });
    await expect(
      loadNewsFeed('https://feeds.example.org/feed.xml', signal, async () => ({
        ok: true,
        headers: { get: () => '512001' },
        body: oversized(),
      })),
    ).rejects.toThrow('Feed too large');
    await expect(
      loadNewsFeed('https://feeds.example.org/feed.xml', signal, async () => ({
        ok: true,
        headers: { get: () => '1' },
        body: oversized(),
      })),
    ).rejects.toThrow('Feed too large');
    await expect(
      loadNewsFeed('https://feeds.example.org/feed.xml', signal, async () => ({
        ok: true,
        headers: { get: () => '100' },
        body: null,
      })),
    ).rejects.toThrow('Feed body unavailable');
  });

  test('decodes a UTF-8 character split across stream chunks', async () => {
    const accented = xml.replace('Inside &amp; out', 'Lähdemaa');
    const bytes = Buffer.from(accented);
    const split = bytes.indexOf(Buffer.from('ä')) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, split));
        controller.enqueue(bytes.subarray(split));
        controller.close();
      },
    });
    const items = await loadNewsFeed(
      'https://feeds.example.org/feed.xml',
      new AbortController().signal,
      async () => ({ ok: true, headers: { get: () => null }, body }),
    );
    expect(items[0]?.title).toBe('Lähdemaa');
  });
});
