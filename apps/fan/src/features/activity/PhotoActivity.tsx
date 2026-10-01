import { useEffect, useRef, useState } from 'react';
import { Image, Linking, StyleSheet, TextInput, View } from 'react-native';
import { Action, Text } from '../points/controls';
import { capturePhoto } from './native-camera';
import { createActivityAttempt, type ActivityResult } from './lifecycle';
import type { Photo } from './capture';

type State =
  | { kind: 'capturing' }
  | { kind: 'denied'; canAskAgain: boolean }
  | { kind: 'review'; photo: Photo }
  | { kind: 'checking' }
  | { kind: 'message'; message: string };

/** Mount inside the existing scrollable tab content, keyed by account/profile identity. */
export function PhotoActivity({
  onClose,
  check,
  canCheck = true,
}: {
  onClose: () => void;
  check: (signal: AbortSignal) => Promise<ActivityResult>;
  canCheck?: boolean;
}) {
  const [state, setState] = useState<State>({ kind: 'capturing' });
  const [description, setDescription] = useState('');
  const [bus, setBus] = useState(false);
  const [start, setStart] = useState('');
  const [destination, setDestination] = useState('');
  const mounted = useRef(true);
  const generation = useRef(0);
  const retained = useRef<Photo | null>(null);
  const captureBusy = useRef(false);
  const [attempt] = useState(() => createActivityAttempt());
  function clearPhoto() {
    if (retained.current) retained.current.base64 = '';
    retained.current = null;
  }
  async function take() {
    if (captureBusy.current) return;
    captureBusy.current = true;
    const version = ++generation.current;
    clearPhoto();
    setState({ kind: 'capturing' });
    try {
      const result = await capturePhoto();
      if (!mounted.current || version !== generation.current) {
        if (result.kind === 'photo') result.base64 = '';
        return;
      }
      if (result.kind === 'photo') {
        retained.current = result;
        setState({ kind: 'review', photo: result });
      } else if (result.kind === 'denied') setState(result);
      else onClose();
    } catch {
      if (mounted.current && version === generation.current)
        setState({
          kind: 'message',
          message: 'Could not keep the photo safely. Try taking another photo.',
        });
    } finally {
      captureBusy.current = false;
    }
  }
  useEffect(() => {
    mounted.current = true;
    const currentGeneration = generation;
    const startCamera = setTimeout(() => void take(), 0);
    return () => {
      clearTimeout(startCamera);
      mounted.current = false;
      currentGeneration.current++;
      attempt.cancel();
      clearPhoto();
    };
    // Start the native camera only when this isolated flow mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function close() {
    generation.current++;
    attempt.cancel();
    clearPhoto();
    setDescription('');
    setStart('');
    setDestination('');
    onClose();
  }
  async function submit() {
    if (state.kind !== 'review' || !canCheck) return;
    const photo = state.photo;
    const version = ++generation.current;
    const input = {
      photo,
      description: description.trim(),
      bus: bus
        ? { start: start.trim(), destination: destination.trim() }
        : null,
    };
    setState({ kind: 'checking' });
    setDescription('');
    setStart('');
    setDestination('');
    try {
      const result = await attempt.submit(input, (_input, signal) =>
        check(signal),
      );
      if (mounted.current && version === generation.current)
        setState({
          kind: 'message',
          message: result
            ? 'Activity checks are unavailable. No points awarded.'
            : 'Activity check cancelled. No points awarded.',
        });
    } catch {
      if (mounted.current && version === generation.current)
        setState({
          kind: 'message',
          message:
            'Could not check the activity. Take a new photo to try again.',
        });
    } finally {
      clearPhoto();
    }
  }
  return (
    <View style={styles.content}>
      <Action label="Close" secondary onPress={close} />
      <Text accessibilityRole="header" style={styles.title}>
        Photo activity
      </Text>
      {!canCheck && (
        <Text accessibilityLiveRegion="polite">Checking your session…</Text>
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
            onPress={() => {
              if (state.canAskAgain) void take();
              else
                void Linking.openSettings().catch(() =>
                  setState({
                    kind: 'message',
                    message: 'Open your phone Settings to allow camera access.',
                  }),
                );
            }}
          />
          {!state.canAskAgain && (
            <Action
              label="Try camera again"
              secondary
              onPress={() => void take()}
            />
          )}
        </>
      )}
      {state.kind === 'review' && (
        <>
          <Image
            source={{ uri: `data:image/jpeg;base64,${state.photo.base64}` }}
            accessibilityLabel="Captured activity photo"
            style={styles.photo}
            resizeMode="contain"
          />
          <Action label="Retake photo" secondary onPress={() => void take()} />
          <Text>Description</Text>
          <TextInput
            accessibilityLabel="Activity description"
            multiline
            maxLength={1600}
            value={description}
            onChangeText={setDescription}
            placeholder="What did you do?"
            placeholderTextColor="#A9BAB1"
            style={styles.description}
          />
          <Action
            label={bus ? 'Remove bus details' : 'Bus journey (optional)'}
            secondary
            onPress={() => setBus(!bus)}
          />
          {bus && (
            <>
              <Text>Start</Text>
              <TextInput
                accessibilityLabel="Bus start"
                maxLength={200}
                value={start}
                onChangeText={setStart}
                style={styles.input}
              />
              <Text>Destination</Text>
              <TextInput
                accessibilityLabel="Bus destination"
                maxLength={200}
                value={destination}
                onChangeText={setDestination}
                style={styles.input}
              />
            </>
          )}
          <Text style={styles.muted}>
            Your photo stays on this phone while activity checks are
            unavailable.
          </Text>
          <Action
            label="Check activity"
            disabled={
              !canCheck ||
              !description.trim() ||
              (bus && (!start.trim() || !destination.trim()))
            }
            onPress={() => void submit()}
          />
        </>
      )}
      {state.kind === 'checking' && (
        <>
          <Text accessibilityLiveRegion="polite">Checking activity…</Text>
          <Action label="Cancel" secondary onPress={close} />
        </>
      )}
      {state.kind === 'message' && (
        <>
          <Text accessibilityLiveRegion="polite">{state.message}</Text>
          <Action label="Take another photo" onPress={() => void take()} />
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  content: { gap: 16, backgroundColor: '#081310', paddingVertical: 16 },
  title: { fontSize: 26, lineHeight: 34, fontFamily: 'Geist_600SemiBold' },
  photo: { width: '100%', height: 240, backgroundColor: '#172720' },
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
  input: {
    minHeight: 48,
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
