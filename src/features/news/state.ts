import type { NewsItem } from './feed';

export const INITIAL_VISIBLE_STORIES = 5;

export function nextVisibleStoryCount(current: number, total: number): number {
  return Math.min(current + INITIAL_VISIBLE_STORIES, total);
}

export type NewsState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: NewsItem[]; refreshing: boolean; error?: string };

export function failedNewsRefresh(current: NewsState): NewsState {
  if (current.kind === 'ready' && current.items.length > 0) {
    return {
      kind: 'ready',
      items: current.items,
      refreshing: false,
      error: 'Could not refresh news. Showing the last loaded stories.',
    };
  }
  return { kind: 'error', message: 'Could not load news. Try again.' };
}
