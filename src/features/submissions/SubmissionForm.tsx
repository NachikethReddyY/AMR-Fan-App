import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Action, Text } from '../points/controls';
import { useHistory } from '../points/provider';
import { useAccount } from '../account/provider';
import { api } from '../account/native-auth';
import { privateStorage } from '../account/storage';
import { useProfileContext } from '../account/useResource';
import { createSubmissionsApi } from './api';
import { createSubmissionController } from './state';
import { submissionInput, type SubmissionInput } from './contracts';
import { SubmissionStatus } from './SubmissionStatus';
const submissions = createSubmissionsApi(api.request);
export function SubmissionForm() {
  const ctx = useProfileContext();
  const { controller: session } = useAccount();
  const { controller: history } = useHistory();
  const [text, setText] = useState('');
  const [tag, setTag] = useState<SubmissionInput['tag']>(null);
  const [parent, setParent] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<SubmissionInput | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [controller] = useState(() =>
    createSubmissionController(submissions, privateStorage, session.expire),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    void controller.setContext(ctx);
    return () => {
      void controller.setContext(null);
    };
  }, [controller, ctx?.token, ctx?.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      controller.subscribe(() => {
        const state = controller.getState();
        if (state.kind === 'success') {
          setConfirmation(null);
          setText('');
          setParent(null);
          void history.refresh();
        }
        if (state.kind === 'rejected') setConfirmation(null);
      }),
    [controller, history],
  );
  const locked = state.kind === 'loading' || state.kind === 'retry';
  function review() {
    const input = submissionInput.safeParse({
      requestId: randomUUID(),
      text,
      tag,
      confirmedFee: 500,
      resubmissionOf: parent,
    });
    if (!input.success) {
      setError('Enter 1–1,600 characters without control characters.');
      return;
    }
    setError(null);
    setConfirmation(input.data);
  }
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Fan submissions</Text>
      <Text>
        Submit a question or activity idea. Each submission costs 500 points,
        non-refundable even if rejected. Voting is not available here yet.
      </Text>
      {parent && (
        <Text>Preparing a new paid resubmission of a rejected entry.</Text>
      )}
      <TextInput
        accessibilityLabel="Submission text"
        value={text}
        onChangeText={(v) => {
          setText(v);
          setConfirmation(null);
        }}
        multiline
        maxLength={1600}
        editable={!locked}
        style={styles.input}
      />
      <Text>Optional tag</Text>
      <View style={styles.tags}>
        {([null, 'question', 'activity', 'other'] as const).map((value) => (
          <Pressable
            key={value ?? 'none'}
            accessibilityRole="radio"
            accessibilityState={{ selected: tag === value, disabled: locked }}
            disabled={locked}
            onPress={() => {
              setTag(value);
              setConfirmation(null);
            }}
            style={[styles.tag, tag === value && styles.selected]}
          >
            <Text>{value ?? 'No tag'}</Text>
          </Pressable>
        ))}
      </View>
      <Action
        label="Review 500-point submission"
        disabled={locked}
        onPress={review}
      />
      {confirmation && (
        <View style={styles.confirm}>
          <Text selectable>{confirmation.text}</Text>
          <Text>Confirm a non-refundable fee of 500 points.</Text>
          <Action
            label="Confirm submission: 500 points"
            disabled={locked}
            onPress={() => {
              void controller.submit(confirmation);
            }}
          />
          <Action
            label="Cancel submission confirmation"
            disabled={locked}
            onPress={() => setConfirmation(null)}
          />
        </View>
      )}
      {error && <Text accessibilityLiveRegion="polite">{error}</Text>}
      {state.kind === 'retry' && (
        <>
          <Text accessibilityLiveRegion="polite">{state.error}</Text>
          <Action
            label="Retry same submission"
            onPress={() => {
              void controller.retry();
            }}
          />
        </>
      )}
      {state.kind === 'loading' && (
        <Text accessibilityLiveRegion="polite">Checking submission…</Text>
      )}
      {state.kind === 'rejected' && (
        <Text accessibilityLiveRegion="polite">{state.error}</Text>
      )}
      {state.kind === 'success' && (
        <Text accessibilityLiveRegion="polite">
          Submission received. Receipt status: {state.result.status}. Refresh
          status below for the latest review.
        </Text>
      )}
      <SubmissionStatus
        key={state.kind === 'success' ? state.result.id : 'list'}
        onResubmit={(s) => {
          if (locked) return;
          setText(s.text);
          setTag(s.tag);
          setParent(s.id);
          setConfirmation(null);
        }}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 16, marginTop: 24 },
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#3D3D3D',
    padding: 12,
    color: '#F5F5F3',
    fontFamily: 'Geist_400Regular',
    fontSize: 17,
    textAlignVertical: 'top',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    minHeight: 48,
    padding: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  selected: { borderBottomColor: '#CEDC00' },
  confirm: { gap: 12, padding: 16, backgroundColor: '#2B2B2B' },
});
