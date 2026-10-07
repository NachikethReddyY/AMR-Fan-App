import {
  failedNewsRefresh,
  INITIAL_VISIBLE_STORIES,
  nextVisibleStoryCount,
} from './state';
import type { NewsItem } from './feed';

const item: NewsItem = {
  id: 'story',
  title: 'Story',
  summary: '',
  url: 'https://www.astonmartinf1.com/en-GB/news/feature/story',
  publishedAt: null,
  imageUrl: null,
};

test('a failed refresh after an empty feed offers retry', () => {
  expect(
    failedNewsRefresh({ kind: 'ready', items: [], refreshing: true }),
  ).toEqual({
    kind: 'error',
    message: 'Could not load news. Try again.',
  });
});

test('a failed refresh retains existing stories and names them honestly', () => {
  expect(
    failedNewsRefresh({ kind: 'ready', items: [item], refreshing: true }),
  ).toEqual({
    kind: 'ready',
    items: [item],
    refreshing: false,
    error: 'Could not refresh news. Showing the last loaded stories.',
  });
});

test('story batches start at five, reach every item, and stop at the feed length', () => {
  expect(INITIAL_VISIBLE_STORIES).toBe(5);
  expect(nextVisibleStoryCount(5, 12)).toBe(10);
  expect(nextVisibleStoryCount(10, 12)).toBe(12);
  expect(nextVisibleStoryCount(12, 12)).toBe(12);
  expect(nextVisibleStoryCount(5, 3)).toBe(3);
});
