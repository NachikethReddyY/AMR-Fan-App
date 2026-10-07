import { useCallback, useEffect, useRef, useState } from 'react';
import { fetch as expoFetch } from 'expo/fetch';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { ArrowUpRight, RefreshCw } from 'lucide-react-native';
import { Action, Text } from '../points/controls';
import { formatPublishedDate, loadNewsFeed, resolveNewsFeedUrl } from './feed';
import {
  failedNewsRefresh,
  INITIAL_VISIBLE_STORIES,
  nextVisibleStoryCount,
  type NewsState,
} from './state';

const feedUrl = resolveNewsFeedUrl(process.env.EXPO_PUBLIC_NEWS_FEED_URL);

function StoryImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <Image
      source={{ uri }}
      style={styles.storyImage}
      resizeMode="cover"
      accessible={false}
      onError={() => setFailed(true)}
    />
  );
}

export function NewsScreen() {
  const [state, setState] = useState<NewsState>({ kind: 'loading' });
  const [openError, setOpenError] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_STORIES);
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!feedUrl) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState((current) =>
      current.kind === 'ready'
        ? { kind: 'ready', items: current.items, refreshing: true }
        : { kind: 'loading' },
    );
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const items = await loadNewsFeed(feedUrl, controller.signal, expoFetch);
      if (request.current === controller) {
        setState({ kind: 'ready', items, refreshing: false });
      }
    } catch {
      if (request.current === controller) {
        setState(failedNewsRefresh);
      }
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void refresh();
    });
    return () => {
      active = false;
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  const openArticle = async (url: string) => {
    setOpenError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenError(true);
    }
  };

  return (
    <View style={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text accessibilityRole="header" style={styles.title}>
            News
          </Text>
          <Text style={styles.subtitle}>Latest stories from the team</Text>
        </View>
        {feedUrl && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh news"
            accessibilityState={{
              disabled:
                state.kind === 'loading' ||
                (state.kind === 'ready' && state.refreshing),
            }}
            disabled={
              state.kind === 'loading' ||
              (state.kind === 'ready' && state.refreshing)
            }
            onPress={() => void refresh()}
            style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
          >
            <RefreshCw color="#CEDC00" size={20} accessible={false} />
          </Pressable>
        )}
      </View>
      <Text style={styles.source}>
        ASTON MARTIN ARAMCO F1 · OFFICIAL STORIES
      </Text>

      {!feedUrl ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>News feed not connected</Text>
          <Text>
            Team stories will appear here once the news feed is connected.
          </Text>
        </View>
      ) : state.kind === 'loading' ? (
        <Text accessibilityLiveRegion="polite">Loading news…</Text>
      ) : state.kind === 'error' ? (
        <View style={styles.messageBox}>
          <Text accessibilityLiveRegion="polite">{state.message}</Text>
          <Action label="Try again" onPress={() => void refresh()} />
        </View>
      ) : (
        <>
          {state.error && (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {state.error}
            </Text>
          )}
          {state.refreshing && (
            <Text accessibilityLiveRegion="polite" style={styles.muted}>
              Refreshing news…
            </Text>
          )}
          {state.items.length === 0 ? (
            <View style={styles.messageBox}>
              <Text>No official stories are available in this feed yet.</Text>
            </View>
          ) : (
            state.items.slice(0, visibleCount).map((item) => {
              const publishedDate = formatPublishedDate(item.publishedAt);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="link"
                  accessibilityLabel={`${item.title}, ${publishedDate}, opens on astonmartinf1.com`}
                  onPress={() => void openArticle(item.url)}
                  style={({ pressed }) => [
                    styles.story,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.storyHeader}>
                    <Text style={styles.date}>{publishedDate}</Text>
                    <ArrowUpRight
                      color="#CEDC00"
                      size={20}
                      accessible={false}
                    />
                  </View>
                  {item.imageUrl && (
                    <StoryImage key={item.imageUrl} uri={item.imageUrl} />
                  )}
                  <Text style={styles.storyTitle}>{item.title}</Text>
                  {item.summary ? (
                    <Text style={styles.summary}>{item.summary}</Text>
                  ) : null}
                  <Text style={styles.readStory}>
                    Read on astonmartinf1.com
                  </Text>
                </Pressable>
              );
            })
          )}
          {state.items.length > visibleCount && (
            <Action
              label={`Show ${Math.min(INITIAL_VISIBLE_STORIES, state.items.length - visibleCount)} more stories`}
              secondary
              onPress={() =>
                setVisibleCount((current) =>
                  nextVisibleStoryCount(current, state.items.length),
                )
              }
            />
          )}
        </>
      )}
      {openError && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          Could not open the article. Try again.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { marginHorizontal: 20, gap: 18 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingCopy: { flex: 1, gap: 4 },
  title: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: { color: '#A9A9A3', fontSize: 17, lineHeight: 25 },
  source: {
    color: '#CEDC00',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Geist_600SemiBold',
    letterSpacing: 1,
  },
  refresh: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#26382B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  messageBox: {
    backgroundColor: '#14221C',
    borderColor: '#344C40',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    gap: 16,
  },
  messageTitle: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  story: {
    borderTopWidth: 1,
    borderTopColor: '#344C40',
    paddingVertical: 20,
    gap: 10,
    minHeight: 120,
  },
  storyHeader: { flexDirection: 'row', alignItems: 'center' },
  storyImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 2,
    backgroundColor: '#26382B',
  },
  date: { color: '#A9A9A3', fontSize: 14, lineHeight: 20, flex: 1 },
  storyTitle: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
  },
  summary: { color: '#D0D5CF', fontSize: 16, lineHeight: 24 },
  readStory: { color: '#CEDC00', fontSize: 14, lineHeight: 20 },
  error: { color: '#F1B6A8', fontSize: 15, lineHeight: 22 },
  muted: { color: '#A9A9A3', fontSize: 15, lineHeight: 22 },
});
