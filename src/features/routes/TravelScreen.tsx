import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createFixtureRouteProvider,
  type RouteMode,
  type RouteOption,
  type RouteResult,
} from './routes';

const fixtureProvider = createFixtureRouteProvider();
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
  onSelect,
}: {
  route: RouteOption;
  selected: boolean;
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
      accessibilityLabel={`${modeLabels[route.mode]}, ${detail}${isAvailable ? `, ${legs}` : ''}${selected ? ', selected' : ''}`}
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
        {selected && <Text style={styles.selectedText}>Selected</Text>}
      </View>
      <Text style={styles.routeDetail}>{detail}</Text>
      {isAvailable && <Text style={styles.routeLegs}>{legs}</Text>}
    </Pressable>
  );
}

function Result({
  result,
  selectedId,
  onSelect,
}: {
  result: RouteResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (result.kind === 'unavailable') {
    const messages: Record<
      Extract<RouteResult, { kind: 'unavailable' }>['reason'],
      string
    > = {
      outside_fixture_coverage:
        'No demo routes for these places. Use the listed Singapore demo trip.',
      no_route:
        'No route found between these places. Try another start or destination.',
      missing_data: 'Route details are incomplete. Try again later.',
      provider_error: 'Routes could not be loaded. Try again later.',
      live_not_configured:
        'Live routes are not configured. Demo routes remain available.',
    };
    return <Text style={styles.message}>{messages[result.reason]}</Text>;
  }
  return (
    <View>
      <Text style={styles.source}>
        {result.source.kind === 'fixture'
          ? result.source.label
          : `Live routes from ${result.source.provider}`}
      </Text>
      {result.routes.length === 0 ? (
        <Text style={styles.message}>No routes found. Try another trip.</Text>
      ) : (
        result.routes.map((route) => (
          <RouteRow
            key={route.id}
            route={route}
            selected={selectedId === route.id}
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
  const [result, setResult] = useState<RouteResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function compare() {
    setLoading(true);
    setSelectedId(null);
    try {
      setResult(await fixtureProvider.search({ origin, destination }));
    } catch {
      setResult({ kind: 'unavailable', reason: 'provider_error' });
    } finally {
      setLoading(false);
    }
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
          setResult(null);
          setSelectedId(null);
        }}
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
          setResult(null);
          setSelectedId(null);
        }}
        style={styles.input}
        placeholderTextColor="#A9A9A3"
        autoCorrect={false}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Compare demo routes"
        onPress={compare}
        disabled={loading || !origin.trim() || !destination.trim()}
        style={styles.action}
      >
        <Text style={styles.actionText}>Compare demo routes</Text>
      </Pressable>
      {loading && (
        <ActivityIndicator
          accessibilityLabel="Loading routes"
          color="#CEDC00"
        />
      )}
      {result && !loading && (
        <Result
          result={result}
          selectedId={selectedId}
          onSelect={setSelectedId}
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
  selectedRoute: { borderLeftColor: '#CEDC00' },
  unavailableRoute: { opacity: 0.8 },
  routeHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
