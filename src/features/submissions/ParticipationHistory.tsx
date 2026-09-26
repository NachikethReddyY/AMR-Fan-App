import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { useProfileContext, useResource } from '../account/useResource';
import { createParticipationApi } from './participation-api';
import { ParticipationStatus } from './ParticipationStatus';

const participation = createParticipationApi(api.request);
export function ParticipationHistory() {
  const context = useProfileContext();
  return context ? (
    <History key={`${context.token}:${context.profileId}`} />
  ) : null;
}
function History() {
  const { state, controller } = useResource(participation.history);
  // The endpoint links both submission fees and contributions to their current
  // submission. Show each submission once, without rewriting either receipt.
  const items =
    state.kind === 'ready'
      ? [...new Map(state.items.map((row) => [row.submissionId, row])).values()]
      : [];
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        Participation status
      </Text>
      <Action
        secondary
        label={
          state.kind === 'loading'
            ? 'Loading participation…'
            : 'Refresh participation status'
        }
        disabled={
          state.kind === 'loading' || (state.kind === 'ready' && state.busy)
        }
        onPress={() => {
          void controller.refresh();
        }}
      />
      {state.kind === 'error' && (
        <Text accessibilityLiveRegion="polite">{state.error}</Text>
      )}
      {state.kind === 'ready' && (
        <>
          {items.length === 0 && (
            <Text>No submissions or contributions yet.</Text>
          )}
          {items.map((row) => (
            <View key={row.submissionId} style={styles.row}>
              {row.participation ? (
                <>
                  <Text selectable>{row.participation.text}</Text>
                  <ParticipationStatus item={row.participation} />
                </>
              ) : (
                <Text>
                  Submission {row.moderation}. The 500-point fee is
                  non-refundable.
                </Text>
              )}
            </View>
          ))}
          {state.error && (
            <Text accessibilityLiveRegion="polite">{state.error}</Text>
          )}
          {state.nextCursor && (
            <Action
              secondary
              label={state.busy ? 'Loading more…' : 'Load more participation'}
              disabled={state.busy}
              onPress={() => {
                void controller.more();
              }}
            />
          )}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 16 },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
});
