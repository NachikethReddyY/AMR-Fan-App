import { StyleSheet, View } from 'react-native';
import { Action, Text } from '../points/controls';
import type { Recorder } from './recorder';
import { receiptText } from './receipt';
import { routeWarning } from './route-warning';
import type { Context } from '../account/resource';
export function Recording({
  state,
  recorder,
  context,
  onPlan,
}: {
  state: ReturnType<Recorder['getState']>;
  recorder: Recorder;
  context: Context;
  onPlan: () => void;
}) {
  const c = state.capture;
  if (!c) return null;
  const finished = c.phase === 'finished';
  const finishing = c.finish !== null;
  const receipt = state.award ? receiptText(state.award) : null;
  const warning = routeWarning(
    c.journey.source,
    c.selection?.modes ?? [c.journey.mode],
  );
  return (
    <View style={styles.body}>
      <Text style={styles.title}>Travel</Text>
      <Text style={styles.text}>
        {c.journey.mode.replaceAll('_', ' ')} · Selected journey
      </Text>
      {c.selection && (
        <Text style={styles.text}>
          {c.selection.origin} to {c.selection.destination}
          {c.selection.durationSeconds !== null
            ? ` · ${Math.round(c.selection.durationSeconds / 60)} min planned`
            : ''}
        </Text>
      )}
      <View style={styles.summary}>
        <Text style={styles.title}>
          {finished
            ? 'Journey finished'
            : finishing
              ? 'Finishing journey'
              : c.phase === 'starting'
                ? 'Confirming journey start'
                : state.collecting
                  ? 'Recording journey'
                  : 'Recording paused'}
        </Text>
        <Text style={styles.text}>
          {c.sentCount + c.samples.length} locations saved · {c.samples.length}{' '}
          waiting to sync
        </Text>
      </View>
      {warning && <Text style={styles.text}>{warning}</Text>}
      {!finished && (
        <>
          <Text style={styles.text}>
            {state.collecting
              ? 'Location recording is on, including while your phone is locked. Closing the app can interrupt recording.'
              : finishing
                ? 'Recording stopped. Your finish time is saved while sync completes.'
                : 'Location is saved only after the server confirms Start and access is allowed.'}
          </Text>
          {!finishing && (
            <>
              <Action
                label="I've arrived"
                onPress={() => {
                  void recorder.finish('arrival');
                }}
              />
              <Action
                label="Stop recording"
                secondary
                onPress={() => {
                  void recorder.finish('stopped');
                }}
              />
              {c.phase === 'active' && !state.collecting && (
                <Action
                  label="Resume recording"
                  disabled={state.busy}
                  onPress={() => {
                    void recorder.resume(context);
                  }}
                />
              )}
            </>
          )}
        </>
      )}
      {finished && (
        <>
          <Text style={styles.text}>
            {c.journey.assessment.startRecorded
              ? 'Start recorded.'
              : 'Start evidence missing.'}{' '}
            {c.journey.assessment.arrivalRecorded
              ? 'Arrival recorded.'
              : 'Arrival evidence missing.'}
          </Text>
          {state.award && receipt ? (
            <>
              <Text style={styles.title}>
                {receipt.label}: {state.award.creditedPoints}
              </Text>
              <Text style={styles.text}>
                Total for this journey: {state.award.cumulativeAutomaticCredit}{' '}
                points.
              </Text>
              <Text style={styles.text}>{receipt.basis}</Text>
              {receipt.detail && (
                <Text style={styles.text}>{receipt.detail}</Text>
              )}
            </>
          ) : (
            <Text style={styles.text}>
              Assessment and points are awaiting sync.
            </Text>
          )}
          <Text style={styles.text}>
            GPS does not verify transport mode or carbon savings.
          </Text>
        </>
      )}
      {state.message && (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {state.message}
        </Text>
      )}
      <Action
        label={finished ? 'Refresh assessment and points' : 'Retry sync'}
        secondary
        disabled={state.busy}
        onPress={() => {
          void recorder.retry();
        }}
      />
      {finished && (
        <Action
          label="Plan another journey"
          disabled={state.busy}
          onPress={() => {
            onPlan();
            void recorder.clear();
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  body: { marginHorizontal: 20, paddingBottom: 24, gap: 12 },
  title: {
    color: '#F5F5F3',
    fontSize: 30,
    lineHeight: 38,
    fontFamily: 'Geist_600SemiBold',
  },
  text: { color: '#E0E0DC', fontSize: 17, lineHeight: 25 },
  summary: {
    backgroundColor: '#004A4D',
    padding: 20,
    marginHorizontal: -20,
    gap: 8,
  },
});
