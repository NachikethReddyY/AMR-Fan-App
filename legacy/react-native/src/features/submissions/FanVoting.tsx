import { useEffect, useState, useSyncExternalStore } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Action, Text } from '../points/controls';
import { useHistory } from '../points/provider';
import { api } from '../account/native-auth';
import { useAccount } from '../account/provider';
import { privateStorage } from '../account/storage';
import { useProfileContext, useResource } from '../account/useResource';
import type { Context } from '../account/resource';
import { createParticipationApi } from './participation-api';
import {
  createContributionController,
  reviewContribution,
} from './participation-state';
import type { SharedSubmission } from './participation-contracts';
import { ParticipationStatus } from './ParticipationStatus';

const participation = createParticipationApi(api.request);
export function FanVoting() {
  const context = useProfileContext();
  return context ? (
    <Voting key={`${context.token}:${context.profileId}`} context={context} />
  ) : null;
}
function Voting({ context }: { context: Context }) {
  const { controller: session } = useAccount();
  const { controller: history } = useHistory();
  const { state: ranking, controller: list } = useResource(
    participation.ranking,
  );
  const [controller] = useState(() =>
    createContributionController(participation, privateStorage, session.expire),
  );
  const paid = useSyncExternalStore(controller.subscribe, controller.getState);
  const [review, setReview] = useState<SharedSubmission | null>(null);
  const [amount, setAmount] = useState('10');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void controller.setContext(context);
    return () => {
      void controller.setContext(null);
    };
  }, [controller, context.token, context.profileId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () =>
      controller.subscribe(() => {
        const result = controller.getState();
        if (result.kind === 'success' || result.kind === 'rejected') {
          setReview(null);
          void list.refresh();
          void history.refresh();
        }
      }),
    [controller, list, history],
  );
  const locked = paid.kind === 'loading' || paid.kind === 'retry';
  function confirm() {
    if (!review || locked) return;
    try {
      const intent = reviewContribution(review, amount, randomUUID());
      setError(null);
      void controller.submit(intent);
    } catch {
      setError('Enter a whole number of points from 10 to 2,147,483,647.');
    }
  }
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.title}>
        {review || paid.kind === 'retry' ? 'Review contribution' : 'Fan voting'}
      </Text>
      {paid.kind === 'retry' ? (
        <>
          <Text accessibilityLiveRegion="polite">{paid.error}</Text>
          <Text selectable>
            {review?.text ??
              (ranking.kind === 'ready'
                ? ranking.items.find(
                    (item) => item.id === paid.input.submissionId,
                  )?.text
                : undefined) ??
              `Submission ${paid.input.submissionId}`}
          </Text>
          <Text>
            {paid.input.points.toLocaleString()} points confirmed. Retrying
            checks the original contribution; it does not create a new one.
          </Text>
          <Action
            label="Retry same contribution"
            onPress={() => {
              void controller.retry();
            }}
          />
        </>
      ) : review ? (
        <>
          <Text selectable>{review.text}</Text>
          <ParticipationStatus item={review} />
          <Text>Contribution points</Text>
          <TextInput
            accessibilityLabel="Contribution points"
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={10}
            editable={!locked}
            style={styles.input}
          />
          <Text>
            This spend is non-refundable. Each point adds one ranking point.
            Selection and fulfilment are not guaranteed.
          </Text>
          <Action
            label={`Confirm contribution: ${amount || '0'} points`}
            disabled={locked}
            onPress={confirm}
          />
          <Action
            secondary
            label="Back to fan voting"
            disabled={locked}
            onPress={() => {
              setReview(null);
              setError(null);
            }}
          />
        </>
      ) : (
        <>
          <Text>
            Contribute at least 10 points to an approved question or activity.
            Contributions are non-refundable. The 500-point submission fee does
            not add ranking points.
          </Text>
          {paid.kind === 'success' && (
            <Text accessibilityLiveRegion="polite">
              {paid.result.points.toLocaleString()} points contributed. Recorded
              total: {paid.result.rankingPointsAfter} ranking points.
            </Text>
          )}
          {paid.kind === 'rejected' && (
            <Text accessibilityLiveRegion="polite">{paid.error}</Text>
          )}
          <Action
            secondary
            label={
              ranking.kind === 'loading'
                ? 'Loading fan voting…'
                : 'Refresh fan voting'
            }
            disabled={
              locked ||
              ranking.kind === 'loading' ||
              (ranking.kind === 'ready' && ranking.busy)
            }
            onPress={() => {
              void list.refresh();
            }}
          />
          {ranking.kind === 'error' && (
            <Text accessibilityLiveRegion="polite">{ranking.error}</Text>
          )}
          {ranking.kind === 'ready' && (
            <>
              {ranking.items.length === 0 && (
                <Text>No approved submissions yet.</Text>
              )}
              {ranking.items.map((item) => (
                <View key={item.id} style={styles.row}>
                  <Text selectable>{item.text}</Text>
                  <ParticipationStatus item={item} />
                  {item.status === 'backlog' && (
                    <Action
                      label="Review contribution"
                      disabled={locked || ranking.busy}
                      onPress={() => {
                        setReview(item);
                        setAmount('10');
                        setError(null);
                      }}
                    />
                  )}
                </View>
              ))}
              {ranking.error && (
                <Text accessibilityLiveRegion="polite">
                  {ranking.error} Refresh the ranking if its order has changed.
                </Text>
              )}
              {ranking.nextCursor && (
                <Action
                  secondary
                  label={
                    ranking.busy ? 'Loading more…' : 'Load more fan voting'
                  }
                  disabled={locked || ranking.busy}
                  onPress={() => {
                    void list.more();
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      {paid.kind === 'loading' && (
        <Text accessibilityLiveRegion="polite">Checking contribution…</Text>
      )}
      {error && <Text accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 16, marginTop: 24 },
  title: { fontFamily: 'Geist_600SemiBold', color: '#F5F5F3' },
  row: {
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#3D3D3D',
    padding: 12,
    color: '#F5F5F3',
    fontFamily: 'Geist_400Regular',
    fontSize: 17,
  },
});
