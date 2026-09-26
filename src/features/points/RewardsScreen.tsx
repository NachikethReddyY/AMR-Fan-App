import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useHistory } from './provider';
import { Balance } from './Balance';
import { Action, Text } from './controls';
import { Redemption } from '../rewards/Redemption';
import { ReceiptHistory } from '../rewards/ReceiptDetail';
import { SubmissionForm } from '../submissions/SubmissionForm';
import { SubmissionStatus } from '../submissions/SubmissionStatus';
import { useProfileContext } from '../account/useResource';
import { AccountPanel } from '../account/AccountPanel';

export function RewardsScreen() {
  const context = useProfileContext();
  const [section, setSection] = useState<'Redemption' | 'History'>('History');
  const { state, controller, account } = useHistory();
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  return (
    <View>
      <AccountPanel />
      <View style={styles.content}>
        <Text style={styles.title}>Rewards</Text>
        <Balance />
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['Redemption', 'History'] as const).map((name) => (
            <Pressable
              key={name}
              onPress={() => setSection(name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === name }}
              style={[styles.tab, section === name && styles.selected]}
            >
              <Text style={section === name && styles.selectedText}>
                {name}
              </Text>
            </Pressable>
          ))}
        </View>
        {section === 'Redemption' ? (
          context ? (
            <View key={`${context.token}:${context.profileId}:redemption`}>
              <Redemption />
              <SubmissionForm />
            </View>
          ) : (
            <Text>Sign in to view rewards and submissions.</Text>
          )
        ) : (
          <>
            {account.kind === 'signedIn' && (
              <Action
                label={
                  state.kind === 'loading' ? 'Refreshing…' : 'Refresh History'
                }
                disabled={state.kind === 'loading'}
                onPress={() => {
                  void controller.refresh();
                }}
              />
            )}
            {state.kind === 'ready' && (
              <>
                {state.page.entries.length === 0 && (
                  <Text>No points changes yet.</Text>
                )}
                {state.page.entries.map((entry) => (
                  <View
                    key={entry.id}
                    style={styles.row}
                    accessible
                    accessibilityLabel={`${entry.delta > 0 ? '+' : ''}${entry.delta} points. ${entry.reason}. Balance after ${entry.balanceAfter} points. ${new Date(entry.recordedAt).toLocaleString()}`}
                  >
                    <Text style={styles.delta}>
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta.toLocaleString()} points
                    </Text>
                    <Text>{entry.reason}</Text>
                    <Text>
                      Balance after: {entry.balanceAfter.toLocaleString()}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(entry.recordedAt).toLocaleString()}
                    </Text>
                  </View>
                ))}
                {state.error && (
                  <Text accessibilityLiveRegion="polite">{state.error}</Text>
                )}
                {state.page.nextCursor !== null && (
                  <Action
                    label={
                      state.loadingMore
                        ? 'Loading more…'
                        : state.error
                          ? 'Retry more History'
                          : 'Load more History'
                    }
                    disabled={state.loadingMore}
                    onPress={() => {
                      void controller.loadMore();
                    }}
                  />
                )}
              </>
            )}
            {context && (
              <View
                key={`${context.token}:${context.profileId}:rights`}
                style={{ gap: 24 }}
              >
                <ReceiptHistory />
                <SubmissionStatus />
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: { marginHorizontal: 20, gap: 16 },
  title: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    fontSize: 24,
    lineHeight: 30,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  tab: {
    minHeight: 48,
    padding: 12,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderBottomColor: '#CEDC00', borderBottomWidth: 3 },
  selectedText: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
  row: {
    paddingVertical: 16,
    gap: 8,
    borderBottomColor: '#3D3D3D',
    borderBottomWidth: 1,
  },
  delta: { fontFamily: 'Geist_600SemiBold', fontVariant: ['tabular-nums'] },
  date: { color: '#A9A9A3', fontSize: 14, lineHeight: 20 },
});
