import { useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, TextInput, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { capturePhoto } from './native-camera';
import {
  createActivityAttempt,
  createRequestId,
  duplicatePhoto,
  validDescription,
  type ActivityPhoto,
  type ActivityResult,
} from './lifecycle';
import type {
  ActivityAssessmentResult,
  ActivityCapability,
  ActivityRecovery,
  ActivitySubmissionInput,
} from './api';

type State =
  | { kind: 'checking_capability' }
  | { kind: 'capturing' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'review' }
  | { kind: 'submitting' }
  | { kind: 'outcome_unconfirmed'; requestId: string }
  | { kind: 'recovering'; requestId: string }
  | { kind: 'result'; result: ActivityAssessmentResult }
  | { kind: 'message'; message: string };

type Props = {
  onClose: () => void;
  check?: (signal: AbortSignal) => Promise<ActivityCapability | ActivityResult>;
  submit?: (
    input: ActivitySubmissionInput,
    signal: AbortSignal,
  ) => Promise<ActivityAssessmentResult>;
  recover?: (
    requestId: string,
    signal: AbortSignal,
  ) => Promise<ActivityRecovery>;
  canCheck?: boolean;
  onSettled?: () => void;
  missionId?: string | null;
};

export function PhotoActivity({
  onClose,
  check,
  submit,
  recover,
  canCheck = true,
  onSettled,
  missionId: initialMissionId = null,
}: Props) {
  const [state, setState] = useState<State>({ kind: 'checking_capability' });
  const [photos, setPhotos] = useState<ActivityPhoto[]>([]);
  const photosRef = useRef<ActivityPhoto[]>([]);
  const [description, setDescription] = useState('');
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [missionId, setMissionId] = useState<string | null>(initialMissionId);
  const [capability, setCapability] = useState<ActivityCapability | null>(null);
  const mounted = useRef(true);
  const generation = useRef(0);
  const captureBusy = useRef(false);
  const attempt = useRef(createActivityAttempt());
  const requestId = useRef<string | null>(null);
  const capabilityRequest = useRef<AbortController | null>(null);
  const recoveryRequest = useRef<AbortController | null>(null);

  function clearPhotos() {
    photosRef.current.forEach((photo) => (photo.base64 = ''));
    photosRef.current = [];
    setPhotos([]);
  }
  function close() {
    generation.current++;
    attempt.current.cancel();
    capabilityRequest.current?.abort();
    capabilityRequest.current = null;
    recoveryRequest.current?.abort();
    recoveryRequest.current = null;
    requestId.current = null;
    clearPhotos();
    setDescription('');
    setCaptureMessage(null);
    setMissionId(null);
    onClose();
  }
  async function capture(index?: number, available = capability) {
    if (captureBusy.current || !available || available.kind !== 'available')
      return;
    captureBusy.current = true;
    const version = ++generation.current;
    setState({ kind: 'capturing' });
    try {
      const result = await capturePhoto();
      if (!mounted.current || version !== generation.current) {
        if (result.kind === 'photo') result.base64 = '';
        return;
      }
      if (result.kind === 'denied') return setState(result);
      if (result.kind !== 'photo')
        return setState({ kind: 'message', message: 'Camera was cancelled.' });
      setCaptureMessage(null);
      const photo: ActivityPhoto = {
        ...result,
        id: `${Date.now()}-${Math.random()}`,
      };
      result.base64 = '';
      if (duplicatePhoto(photosRef.current, photo.base64)) {
        photo.base64 = '';
        setCaptureMessage(
          'That photo is already selected. Choose a different photo.',
        );
        setState({ kind: 'review' });
        return;
      }
      const current = photosRef.current;
      const next =
        index === undefined ? [...current, photo].slice(0, 5) : [...current];
      if (index !== undefined) {
        next[index]?.base64 && (next[index].base64 = '');
        next[index] = photo;
      }
      photosRef.current = next;
      setPhotos(next);
      setState({ kind: 'review' });
    } catch (error) {
      if (mounted.current && version === generation.current)
        setState({
          kind: 'message',
          message:
            error instanceof Error
              ? error.message
              : 'Could not keep the photo safely.',
        });
    } finally {
      captureBusy.current = false;
    }
  }
  async function checkCapability() {
    if (!check || !canCheck) return;
    capabilityRequest.current?.abort();
    const controller = new AbortController();
    capabilityRequest.current = controller;
    const version = ++generation.current;
    setState({ kind: 'checking_capability' });
    try {
      const result = await check(controller.signal);
      if (
        !mounted.current ||
        controller.signal.aborted ||
        version !== generation.current
      )
        return;
      const available =
        'creditedPoints' in result
          ? ({ kind: 'unavailable', reason: 'disabled' } as const)
          : result;
      setCapability(available);
      if (available.kind === 'available') await capture(undefined, available);
      else
        setState({
          kind: 'message',
          message: 'Activity checks are unavailable. Try again later.',
        });
    } catch (error) {
      if (
        mounted.current &&
        !controller.signal.aborted &&
        version === generation.current
      )
        setState({
          kind: 'message',
          message:
            error instanceof Error
              ? error.message
              : 'Activity checks are unavailable. Try again later.',
        });
    } finally {
      if (capabilityRequest.current === controller)
        capabilityRequest.current = null;
    }
  }
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    capabilityRequest.current = controller;
    const cleanupAttempt = attempt.current;
    const cleanupGeneration = generation;
    const version = ++generation.current;
    if (!canCheck || !check)
      return () => {
        controller.abort();
        mounted.current = false;
        cleanupGeneration.current++;
        cleanupAttempt.cancel();
        photosRef.current.forEach((photo) => (photo.base64 = ''));
        photosRef.current = [];
      };
    void check(controller.signal)
      .then((result) => {
        if (
          !mounted.current ||
          controller.signal.aborted ||
          version !== generation.current
        )
          return;
        const available =
          'creditedPoints' in result
            ? ({ kind: 'unavailable', reason: 'disabled' } as const)
            : result;
        setCapability(available);
        if (available.kind === 'available') void capture(undefined, available);
        else
          setState({
            kind: 'message',
            message: 'Activity checks are unavailable. Try again later.',
          });
      })
      .catch((error) => {
        if (mounted.current && !controller.signal.aborted)
          setState({
            kind: 'message',
            message:
              error instanceof Error
                ? error.message
                : 'Activity checks are unavailable. Try again later.',
          });
      });
    return () => {
      controller.abort();
      if (capabilityRequest.current === controller)
        capabilityRequest.current = null;
      mounted.current = false;
      cleanupGeneration.current++;
      cleanupAttempt.cancel();
      capabilityRequest.current?.abort();
      capabilityRequest.current = null;
      recoveryRequest.current?.abort();
      recoveryRequest.current = null;
      photosRef.current.forEach((photo) => (photo.base64 = ''));
      photosRef.current = [];
    };
    // Capability must succeed before the camera opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function submitActivity() {
    if (
      !submit ||
      state.kind !== 'review' ||
      photos.length < 1 ||
      !validDescription(description)
    )
      return;
    const currentRequestId = requestId.current ?? createRequestId();
    requestId.current = currentRequestId;
    const version = ++generation.current;
    setState({ kind: 'submitting' });
    try {
      const result = await attempt.current.submit(
        { photos, description, missionId, requestId: currentRequestId },
        submit,
      );
      if (!mounted.current || version !== generation.current) return;
      if (!result)
        return setState({
          kind: 'outcome_unconfirmed',
          requestId: currentRequestId,
        });
      const assessment =
        'creditedPoints' in result
          ? ({ kind: 'unavailable', reason: 'disabled' } as const)
          : result;
      requestId.current = null;
      setState({ kind: 'result', result: assessment });
      onSettled?.();
    } catch {
      if (mounted.current && version === generation.current)
        setState({ kind: 'outcome_unconfirmed', requestId: currentRequestId });
    }
  }
  async function recoverResult() {
    const currentRequestId = requestId.current;
    if (!recover || !currentRequestId || state.kind !== 'outcome_unconfirmed')
      return;
    const version = ++generation.current;
    recoveryRequest.current?.abort();
    const controller = new AbortController();
    recoveryRequest.current = controller;
    setState({ kind: 'recovering', requestId: currentRequestId });
    try {
      const recovered = await recover(currentRequestId, controller.signal);
      if (
        !mounted.current ||
        controller.signal.aborted ||
        version !== generation.current ||
        requestId.current !== currentRequestId
      )
        return;
      const result = recovered.kind === 'replay' ? recovered.result : recovered;
      requestId.current = null;
      setState({ kind: 'result', result });
      onSettled?.();
    } catch {
      if (
        mounted.current &&
        version === generation.current &&
        requestId.current === currentRequestId
      )
        setState({ kind: 'outcome_unconfirmed', requestId: currentRequestId });
    } finally {
      if (recoveryRequest.current === controller)
        recoveryRequest.current = null;
    }
  }
  return (
    <View style={styles.content}>
      <Action label="Close" secondary onPress={close} />
      <Text accessibilityRole="header" style={styles.title}>
        Photo activity
      </Text>
      {state.kind === 'checking_capability' && (
        <Text accessibilityLiveRegion="polite">
          Checking activity availability…
        </Text>
      )}
      {state.kind === 'capturing' && (
        <Text accessibilityLiveRegion="polite">Opening camera…</Text>
      )}
      {state.kind === 'denied' && (
        <>
          <Text accessibilityLiveRegion="polite">
            Allow camera access to take a photo.
          </Text>
          <Action
            label={state.canAskAgain ? 'Allow camera' : 'Open Settings'}
            onPress={() =>
              state.canAskAgain
                ? void capture()
                : void Linking.openSettings().catch(() =>
                    setState({
                      kind: 'message',
                      message: 'Could not open settings. Try again.',
                    }),
                  )
            }
          />
        </>
      )}
      {(state.kind === 'message' ||
        state.kind === 'outcome_unconfirmed' ||
        state.kind === 'recovering') && (
        <>
          <Text accessibilityLiveRegion="polite">
            {state.kind === 'outcome_unconfirmed'
              ? 'Submission outcome is unconfirmed and may already be saved. Check the saved result before closing; closing clears only this local draft.'
              : state.kind === 'recovering'
                ? 'Checking the saved result…'
                : state.message}
          </Text>
          {state.kind === 'outcome_unconfirmed' ? (
            <Action
              label="Check saved result"
              onPress={() => void recoverResult()}
            />
          ) : state.kind === 'message' ? (
            <Action label="Try again" onPress={() => void checkCapability()} />
          ) : null}
        </>
      )}
      {(state.kind === 'review' || state.kind === 'submitting') && (
        <>
          <View style={styles.photos}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.slot}>
                <Image
                  source={{ uri: `data:image/jpeg;base64,${photo.base64}` }}
                  accessibilityLabel={`Activity photo ${index + 1} of ${photos.length}`}
                  style={styles.photo}
                  resizeMode="contain"
                />
                <Action
                  label="Remove"
                  secondary
                  disabled={state.kind === 'submitting'}
                  onPress={() => {
                    photo.base64 = '';
                    const next = photosRef.current.filter(
                      (item) => item.id !== photo.id,
                    );
                    photosRef.current = next;
                    setPhotos(next);
                  }}
                />
              </View>
            ))}
          </View>
          <Text>Status: Photo {photos.length} selected</Text>
          {captureMessage ? (
            <Text accessibilityLiveRegion="polite">{captureMessage}</Text>
          ) : null}
          {capability?.kind === 'available' &&
          capability.mode === 'synthetic_test' ? (
            <Text accessibilityLiveRegion="polite">
              Test assessment: this result uses the synthetic provider.
            </Text>
          ) : null}
          {photos.length < 5 ? (
            <Action
              label="Add photo"
              secondary
              disabled={state.kind === 'submitting'}
              onPress={() => void capture()}
            />
          ) : (
            <Text>Maximum 5 photos selected.</Text>
          )}
          <Text>Description · 1–1,600 characters ({description.length})</Text>
          <TextInput
            accessibilityLabel="Activity description"
            multiline
            maxLength={1600}
            value={description}
            editable={state.kind !== 'submitting'}
            onChangeText={setDescription}
            style={styles.description}
          />
          <Text style={styles.muted}>
            Evidence score describes photo evidence quality. It is not CO₂ or a
            points multiplier.
          </Text>
          <Action
            label={
              state.kind === 'submitting'
                ? 'Submitting activity…'
                : 'Submit activity'
            }
            disabled={
              state.kind === 'submitting' ||
              photos.length < 1 ||
              !validDescription(description)
            }
            onPress={() => void submitActivity()}
          />
        </>
      )}
      {state.kind === 'result' && (
        <Result result={state.result} onClose={close} />
      )}
    </View>
  );
}
function Result({
  result,
  onClose,
}: {
  result: ActivityAssessmentResult;
  onClose: () => void;
}) {
  if (result.kind !== 'accepted')
    return (
      <>
        <Text accessibilityLiveRegion="polite">
          {result.kind === 'unavailable'
            ? unavailableMessage(result.reason)
            : result.kind === 'uncertain'
              ? 'We could not confirm the activity from this evidence. Try a clearer photo and description.'
              : result.kind === 'rejected'
                ? 'This evidence does not show a supported activity.'
                : result.kind === 'cancelled'
                  ? 'The activity check was cancelled.'
                  : 'The activity check expired. Try again.'}
        </Text>
        <Action label="Start new submission" onPress={onClose} />
      </>
    );
  return (
    <>
      <Text accessibilityRole="header">
        Evidence score {result.evidenceScore} / 100
      </Text>
      <Text>{result.rationale}</Text>
      {result.reward?.kind === 'awarded' ? (
        <Text>50 points awarded</Text>
      ) : result.reward?.kind === 'not_awarded' ? (
        <Text>0 points: {rewardMessage(result.reward.reason)}</Text>
      ) : (
        <Text>No reward receipt was returned.</Text>
      )}
      {result.mission?.kind === 'updated' ? (
        <Text>
          Mission progress: {result.mission.progress} of {result.mission.target}
          {result.mission.completed ? ' (completed)' : ''}.
        </Text>
      ) : result.mission?.kind === 'not_awarded' ? (
        <Text>
          Mission progress was not updated:{' '}
          {missionMessage(result.mission.reason)}
        </Text>
      ) : null}
      <Action label="Done" onPress={onClose} />
    </>
  );
}
function unavailableMessage(
  reason: Extract<ActivityAssessmentResult, { kind: 'unavailable' }>['reason'],
) {
  return reason === 'disabled'
    ? 'Activity checks are currently unavailable.'
    : reason === 'busy'
      ? 'Activity checks are busy. Try again shortly.'
      : reason === 'timeout'
        ? 'The activity check timed out. You can try again.'
        : reason === 'provider'
          ? 'The activity check provider is unavailable. Try again later.'
          : 'The activity result could not be read safely. Try again with a clearer photo.';
}
function rewardMessage(
  reason: 'daily_cap' | 'duplicate_evidence' | 'mission_ineligible',
) {
  return reason === 'daily_cap'
    ? 'daily reward limit reached'
    : reason === 'duplicate_evidence'
      ? 'this evidence was already rewarded'
      : 'the selected mission was not eligible';
}
function missionMessage(
  reason:
    | 'mission_ineligible'
    | 'not_enrolled'
    | 'expired'
    | 'upcoming'
    | 'archived'
    | 'category_mismatch'
    | 'version_mismatch'
    | 'completed'
    | 'duplicate_event',
) {
  return reason === 'not_enrolled'
    ? 'enroll before submitting for this mission'
    : reason === 'expired'
      ? 'the mission has expired'
      : reason === 'upcoming'
        ? 'the mission has not started'
        : reason === 'completed'
          ? 'the mission is already complete'
          : reason === 'category_mismatch'
            ? 'the activity category does not match'
            : reason === 'version_mismatch'
              ? 'the mission changed before submission'
              : reason === 'duplicate_event'
                ? 'this activity was already counted'
                : 'the mission is not eligible';
}
const styles = StyleSheet.create({
  content: { gap: 16, backgroundColor: '#081310', paddingVertical: 16 },
  title: { fontSize: 26, lineHeight: 34, fontFamily: 'Geist_600SemiBold' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  slot: { width: '47%', gap: 8 },
  photo: { width: '100%', height: 150, backgroundColor: '#172720' },
  description: {
    minHeight: 112,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#547066',
    borderRadius: 10,
    padding: 12,
    color: '#F5F5F3',
    fontSize: 17,
    fontFamily: 'Geist_400Regular',
  },
  muted: { color: '#B7C1BB' },
});
