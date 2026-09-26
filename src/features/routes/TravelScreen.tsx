import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ArrowRight } from 'lucide-react-native';

import { Action, Text } from '../points/controls';
import { useProfileContext } from '../account/useResource';
import { useAccount } from '../account/provider';
import type { Comparison } from './api';
import {
  estimateAmount,
  estimateLabel,
  recommendationLabels,
} from './measurement';
import { randomUUID } from 'expo-crypto';
import { journeyApi } from '../journeys/runtime';
import {
  createJourneyController,
  type JourneyComparison,
} from '../journeys/controller';
import { useJourneyRecorder } from '../journeys/provider';
import { Recording } from '../journeys/Recording';
import { Recovery } from '../journeys/Recovery';
import { routeWarning } from '../journeys/route-warning';
import type { RouteMode, RouteOption } from './routes';
type RouteEstimate = Comparison['estimates'][number]['estimate'];
const modeLabels: Record<RouteMode, string> = {
  bus: 'Bus',
  train: 'Train',
  car: 'Car',
  electric_car: 'Electric car',
  cab: 'Cab',
  walk: 'Walk',
  cycle: 'Cycle',
};

function minutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}
function distance(meters: number) {
  return `${(meters / 1000).toFixed(1)} km`;
}

function RouteRow({
  route,
  selected,
  recommended,
  estimate,
  onSelect,
  warning,
}: {
  warning: string | null;
  route: RouteOption;
  selected: boolean;
  recommended: boolean;
  estimate: RouteEstimate;
  onSelect: () => void;
}) {
  const isAvailable = route.availability.kind === 'available';
  const detail =
    isAvailable &&
    route.durationSeconds !== null &&
    route.distanceMeters !== null
      ? `${minutes(route.durationSeconds)} · ${distance(route.distanceMeters)}`
      : route.availability.kind === 'unavailable'
        ? route.availability.reason
        : 'Missing route data';
  const legs = route.legs.map((leg) => leg.description).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isAvailable, selected }}
      accessibilityLabel={`${modeLabels[route.mode]}, ${detail}, ${estimateLabel(estimate)}${recommended ? ', recommended' : ''}${isAvailable ? `, ${legs}` : ''}${selected ? ', selected' : ''}${warning ? `, ${warning}` : ''}`}
      disabled={!isAvailable}
      onPress={onSelect}
      style={[
        styles.route,
        selected && styles.selectedRoute,
        !isAvailable && styles.unavailableRoute,
      ]}
    >
      <View style={styles.routeHeading}>
        <Text style={styles.routeTitle}>{modeLabels[route.mode]}</Text>
        {(recommended || selected) && (
          <Text style={styles.selectedText}>
            {[recommended && 'Recommended', selected && 'Selected']
              .filter(Boolean)
              .join(' · ')}
          </Text>
        )}
      </View>
      <Text style={styles.routeDetail}>{detail}</Text>
      {isAvailable && (
        <Text style={styles.routeDetail}>{estimateLabel(estimate)}</Text>
      )}
      {isAvailable && <Text style={styles.routeLegs}>{legs}</Text>}
      {isAvailable && warning && (
        <Text style={styles.routeLegs}>{warning}</Text>
      )}
    </Pressable>
  );
}

function Result({
  value,
  selectedId,
  extraMinutes,
  onSelect,
}: {
  value: JourneyComparison;
  selectedId: string | null;
  extraMinutes: number | null;
  onSelect: (id: string) => void;
}) {
  const { result, recommendation } = value;
  if (result.kind === 'unavailable')
    return (
      <Text style={styles.message}>
        {result.reason === 'live_not_configured'
          ? 'Route provider is not configured. No routes are available.'
          : 'Routes unavailable. Try another trip or retry shortly.'}
      </Text>
    );
  const recommendationMessage =
    recommendation.kind === 'unavailable'
      ? `Recommendation unavailable: ${recommendation.reason.replaceAll('_', ' ')}. No zero estimate is assumed.`
      : null;
  return (
    <View>
      <Text style={styles.source}>
        {result.source.kind === 'fixture'
          ? result.source.label
          : `Live routes from ${result.source.provider}`}
      </Text>
      <Text style={styles.label}>Acceptable extra travel time</Text>
      <Text style={styles.message}>
        {extraMinutes === null
          ? 'Enter whole extra minutes above.'
          : `Up to ${extraMinutes} extra min from the fastest available route.`}
      </Text>
      {recommendation.kind !== 'unavailable' && (
        <View style={styles.summary} accessibilityRole="summary">
          <Text style={styles.summaryLabel}>Recommended route</Text>
          <Text style={styles.summaryTitle}>
            {modeLabels[recommendation.route.mode]}
          </Text>
          <Text style={styles.duration}>
            {recommendation.route.durationSeconds === null
              ? 'Duration unavailable'
              : minutes(recommendation.route.durationSeconds)}
          </Text>
          <Text style={styles.routeDetail}>
            Fastest {minutes(recommendation.fastestSeconds)} · Limit{' '}
            {minutes(recommendation.limitSeconds)}
          </Text>
          <Text style={styles.routeDetail}>
            {estimateLabel(recommendation.estimate)}
          </Text>
          <Text style={styles.routeDetail}>
            Baseline: one person driving{' '}
            {distance(recommendation.baselineDistanceMeters)},{' '}
            {estimateAmount(recommendation.baseline)}
          </Text>
          <Text style={styles.routeDetail}>
            {recommendationLabels(recommendation).avoided}
          </Text>
          <Text style={[styles.routeLegs, styles.summaryNote]}>
            {recommendationLabels(recommendation).basis}
          </Text>
        </View>
      )}
      <Text style={styles.message}>
        Cab and electric-car routes are unavailable from this provider. Route
        estimates are not earned points.
      </Text>
      {recommendationMessage && (
        <Text style={styles.message}>{recommendationMessage}</Text>
      )}
      {result.routes.length === 0 ? (
        <Text style={styles.message}>No routes found. Try another trip.</Text>
      ) : (
        result.routes.map((route) => (
          <RouteRow
            key={route.id}
            warning={routeWarning(
              result.source,
              route.legs.map((l) => l.mode),
            )}
            route={route}
            selected={selectedId === route.id}
            recommended={
              recommendation.kind !== 'unavailable' &&
              recommendation.route.id === route.id
            }
            estimate={
              value.estimates.find((e) => e.routeId === route.id)?.estimate ?? {
                kind: 'unavailable',
                reason: 'missing_data',
              }
            }
            onSelect={() => onSelect(route.id)}
          />
        ))
      )}
      {selectedId && <Text style={styles.message}>Route selected.</Text>}
    </View>
  );
}

export function TravelScreen() {
  const [origin, setOrigin] = useState('Marina Bay Sands, Singapore');
  const [destination, setDestination] = useState('Singapore Botanic Gardens');
  const context = useProfileContext();
  const { controller: session } = useAccount();
  const [controller] = useState(() =>
    createJourneyController(journeyApi.prepare, randomUUID, session.expire),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    controller.clear();
    return () => controller.clear();
  }, [controller, context?.token, context?.profileId]);
  const recording = useJourneyRecorder();
  const loading = state.kind === 'loading';
  const [extraMinutesText, setExtraMinutesText] = useState('15');
  const extraMinutes =
    /^\d+$/.test(extraMinutesText) && Number(extraMinutesText) <= 1440
      ? Number(extraMinutesText)
      : null;
  const disabled =
    loading ||
    !context ||
    !origin.trim() ||
    !destination.trim() ||
    extraMinutes === null;
  async function compare() {
    if (!context || extraMinutes === null) return;
    await controller.compare(context, {
      origin: origin.trim(),
      destination: destination.trim(),
      extraMinutes,
    });
  }
  if (context && recording.state.capture)
    return (
      <Recording
        state={recording.state}
        recorder={recording.recorder}
        context={context}
        onPlan={controller.clear}
      />
    );
  const selected =
    state.kind === 'ready' && state.plan.kind === 'prepared'
      ? state.plan.candidates.find((c) => c.routeId === state.selectedId)
      : null;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Travel</Text>
      {context && <Recovery key={context.profileId} context={context} />}
      <Text style={styles.intro}>
        Compare routes between places in Singapore.
      </Text>
      <Text style={styles.label}>From</Text>
      <TextInput
        accessibilityLabel="Start"
        value={origin}
        onChangeText={(value) => {
          setOrigin(value);
          controller.clear();
        }}
        maxLength={200}
        style={styles.input}
        placeholderTextColor="#A9A9A3"
        autoCorrect={false}
      />
      <Text style={styles.label}>To</Text>
      <TextInput
        accessibilityLabel="Destination"
        value={destination}
        onChangeText={(value) => {
          setDestination(value);
          controller.clear();
        }}
        maxLength={200}
        style={styles.input}
        placeholderTextColor="#A9A9A3"
        autoCorrect={false}
      />
      <Text style={styles.label}>Extra minutes</Text>
      <TextInput
        accessibilityLabel="Acceptable extra travel time in minutes"
        value={extraMinutesText}
        onChangeText={(value) => {
          if (/^\d{0,4}$/.test(value)) {
            setExtraMinutesText(value);
            controller.clear();
          }
        }}
        keyboardType="number-pad"
        style={styles.input}
        placeholderTextColor="#A9A9A3"
      />
      <View style={styles.compareAction}>
        <Action
          label="Compare routes"
          icon={ArrowRight}
          disabled={disabled}
          onPress={() => {
            void compare();
          }}
        />
      </View>
      {extraMinutes === null && (
        <Text style={styles.message}>
          Enter whole extra minutes from 0 to 1,440.
        </Text>
      )}
      {loading && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          Loading routes…
        </Text>
      )}
      {state.kind === 'error' && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {state.message}
        </Text>
      )}
      {recording.state.message && (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {recording.state.message}
        </Text>
      )}
      {state.kind === 'ready' && (
        <Result
          value={state.value}
          selectedId={state.selectedId}
          extraMinutes={extraMinutes}
          onSelect={controller.select}
        />
      )}
      {selected?.kind === 'prepared' && context && (
        <>
          <Text style={styles.message}>
            Record your location during this journey, including while your phone
            is locked. Choose Allow all the time for background access. Stop at
            any time.
          </Text>
          <Action
            label="Start journey"
            disabled={recording.state.busy}
            onPress={() => {
              const route =
                state.kind === 'ready'
                  ? state.plan.display?.routes.find(
                      (r) => r.routeId === selected.routeId,
                    )
                  : null;
              void recording.recorder.begin(context, selected.journey, {
                modes: route?.legs.map((l) => l.mode),
                origin: origin.trim(),
                destination: destination.trim(),
                distanceMeters: route?.distanceMeters ?? null,
                durationSeconds: route?.durationSeconds ?? null,
              });
            }}
          />
        </>
      )}
      {selected?.kind === 'unavailable' && (
        <Text style={styles.message}>
          Recording unavailable for this route:{' '}
          {selected.reason.replaceAll('_', ' ')}.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, paddingBottom: 24 },
  title: {
    color: '#F5F5F3',
    fontSize: 30,
    lineHeight: 38,
    fontFamily: 'Geist_600SemiBold',
    marginBottom: 8,
  },
  intro: { color: '#E0E0DC', fontSize: 17, lineHeight: 25, marginBottom: 24 },
  label: { color: '#E0E0DC', fontSize: 17, marginBottom: 8 },
  input: {
    minHeight: 48,
    color: '#F5F5F3',
    fontSize: 17,
    fontFamily: 'Geist_400Regular',
    paddingVertical: 12,
    borderColor: '#3D3D3D',
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  compareAction: { marginBottom: 24 },
  source: { color: '#E0E0DC', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  route: {
    minHeight: 80,
    backgroundColor: '#222222',
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  summary: {
    backgroundColor: '#004A4D',
    padding: 20,
    marginHorizontal: -20,
    marginBottom: 20,
    gap: 8,
  },
  summaryLabel: { color: '#D6E5E1', fontSize: 14, lineHeight: 20 },
  summaryTitle: {
    color: '#F5F5F3',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Geist_600SemiBold',
  },
  duration: {
    color: '#F5F5F3',
    fontSize: 44,
    lineHeight: 52,
    fontFamily: 'Geist_600SemiBold',
  },
  summaryNote: { color: '#D6E5E1' },
  selectedRoute: { borderLeftColor: '#CEDC00' },
  unavailableRoute: { opacity: 0.8 },
  routeHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  routeTitle: {
    color: '#F5F5F3',
    fontSize: 17,
    fontFamily: 'Geist_600SemiBold',
    flexShrink: 1,
  },
  selectedText: { color: '#F5F5F3', fontSize: 15 },
  routeDetail: { color: '#E0E0DC', fontSize: 17, marginTop: 6 },
  routeLegs: { color: '#A9A9A3', fontSize: 14, lineHeight: 20, marginTop: 4 },
  message: {
    color: '#E0E0DC',
    fontSize: 15,
    lineHeight: 22,
    marginVertical: 12,
  },
});
