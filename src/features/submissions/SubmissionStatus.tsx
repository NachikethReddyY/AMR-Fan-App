import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { api } from '../account/native-auth';
import { useResource } from '../account/useResource';
import { createSubmissionsApi } from './api';
import type { Submission } from './contracts';
const submissions = createSubmissionsApi(api.request);
export function SubmissionStatus({
  onResubmit,
}: {
  onResubmit?: (submission: Submission) => void;
}) {
  const { state, controller } = useResource(submissions.list);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Submission status</Text>
      <Action
        label={
          state.kind === 'loading'
            ? 'Loading submissions…'
            : 'Refresh submissions'
        }
        disabled={state.kind === 'loading'}
        onPress={() => {
          void controller.refresh();
        }}
      />
      {state.kind === 'error' && (
        <Text accessibilityLiveRegion="polite">{state.error}</Text>
      )}
      {state.kind === 'ready' && (
        <>
          {state.items.length === 0 && <Text>No submissions yet.</Text>}
          {state.items.map((s) => (
            <View key={s.id} style={styles.row}>
              <Text selectable>{s.text}</Text>
              <Text>Status: {s.status}</Text>
              {s.tag && <Text>Tag: {s.tag}</Text>}
              <Text>
                500 points paid, non-refundable ·{' '}
                {new Date(s.createdAt).toLocaleString()}
              </Text>
              {s.moderatedAt && (
                <Text>Reviewed {new Date(s.moderatedAt).toLocaleString()}</Text>
              )}
              {s.status === 'rejected' && onResubmit && (
                <Action
                  label="Prepare paid resubmission"
                  onPress={() => onResubmit(s)}
                />
              )}
            </View>
          ))}
          {state.error && <Text>{state.error}</Text>}
          {state.nextCursor && (
            <Action
              label={state.busy ? 'Loading…' : 'Load more submissions'}
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
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
});
