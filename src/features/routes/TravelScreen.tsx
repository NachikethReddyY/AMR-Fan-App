import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '../points/controls';
import { useProfileContext } from '../account/useResource';
import { useAccount } from '../account/provider';
import { api } from '../account/native-auth';
import { createTravelApi, type Comparison } from './api';
import { createTravelController } from './state';
import type { RouteMode, RouteOption } from './routes';
type RouteEstimate = Comparison['estimates'][number]['estimate'];
const read = createTravelApi(api.request);
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
function carbon(kg: number) {
  return `${kg.toFixed(2)} kg CO2e`;
}

function estimateLabel(estimate: RouteEstimate) {
  if (estimate.kind === 'estimated')
    return `${carbon(estimate.kgCo2e)} estimated`;
  if (estimate.reason === 'missing_factor')
    return 'Emissions estimate unavailable: no compatible factor';
  return 'Emissions estimate unavailable';
}

function RouteRow({
  route,
  selected,
  recommended,
  estimate,
  onSelect,
}: {
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
      accessibilityLabel={`${modeLabels[route.mode]}, ${detail}, ${estimateLabel(estimate)}${recommended ? ', recommended' : ''}${isAvailable ? `, ${legs}` : ''}${selected ? ', selected' : ''}`}
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
    </Pressable>
  );
}

function Result({
  value,
  selectedId,
  extraMinutes,
  onSelect,
}: {
  value: Comparison;
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
      {recommendation?.kind === 'recommended' && (
        <View style={styles.summary} accessibilityRole="summary">
          <Text style={styles.routeTitle}>
            Recommended: {modeLabels[recommendation.route.mode]}
          </Text>
          <Text style={styles.routeDetail}>
            Fastest {minutes(recommendation.fastestSeconds)} · Limit{' '}
            {minutes(recommendation.limitSeconds)}
          </Text>
          <Text style={styles.routeDetail}>
            {carbon(recommendation.estimate.kgCo2e)} estimated
          </Text>
          <Text style={styles.routeDetail}>
            Baseline: one person driving{' '}
            {distance(recommendation.baselineDistanceMeters)},{' '}
            {carbon(recommendation.baseline.kgCo2e)}
          </Text>
          <Text style={styles.routeDetail}>
            {recommendation.avoidedKgCo2e >= 0
              ? `${recommendation.avoidedKgCo2e.toFixed(2)} kg estimated CO2e avoided`
              : `${(-recommendation.avoidedKgCo2e).toFixed(2)} kg more CO2e than driving`}
          </Text>
          <Text style={styles.routeLegs}>
            Indicative demo estimates. Changi Airport Group FY2024/25
            passenger-km factors; walking and cycling count operational travel
            only. Not measured savings.
          </Text>
        </View>
      )}
      <Text style={styles.message}>
        Cab and electric-car routes are unavailable from this provider.
        Estimates are indicative, not earned points.
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
            route={route}
            selected={selectedId === route.id}
            recommended={
              recommendation?.kind === 'recommended' &&
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
      {selectedId && (
        <Text style={styles.message}>
          Route selected for comparison. Journey recording is not available yet.
        </Text>
      )}
    </View>
  );
}

export function TravelScreen() {
  const [origin, setOrigin] = useState('Marina Bay Sands, Singapore');
  const [destination, setDestination] = useState('Singapore Botanic Gardens');
  const context = useProfileContext();
  const { controller: session } = useAccount();
  const [controller] = useState(() =>
    createTravelController(read, session.expire),
  );
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => () => controller.clear(), [controller]);
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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Travel</Text>
      <Text style={styles.intro}>
        Compare routes between places in Singapore.
      </Text>
      <Text style={styles.label}>Start</Text>
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
      <Text style={styles.label}>Destination</Text>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compare routes"
        accessibilityState={{ disabled }}
        onPress={compare}
        disabled={disabled}
        style={styles.action}
      >
        <Text style={styles.actionText}>Compare routes</Text>
      </Pressable>
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
      {state.kind === 'ready' && (
        <Result
          value={state.value}
          selectedId={state.selectedId}
          extraMinutes={extraMinutes}
          onSelect={controller.select}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 20, paddingBottom: 24 },
  title: { color: '#F5F5F3', fontSize: 30, fontWeight: '600', marginBottom: 8 },
  intro: { color: '#E0E0DC', fontSize: 17, lineHeight: 25, marginBottom: 24 },
  label: { color: '#E0E0DC', fontSize: 17, marginBottom: 8 },
  input: {
    minHeight: 48,
    color: '#F5F5F3',
    fontSize: 17,
    borderColor: '#3D3D3D',
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#04524B',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  actionText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
  source: { color: '#E0E0DC', fontSize: 15, lineHeight: 22, marginBottom: 14 },
  route: {
    minHeight: 80,
    backgroundColor: '#222222',
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  summary: { backgroundColor: '#191919', padding: 14, marginBottom: 16 },
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
    fontWeight: '600',
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
