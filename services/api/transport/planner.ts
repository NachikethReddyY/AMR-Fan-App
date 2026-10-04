import {
  planInput,
  type DepartureResult,
  type PlanInput,
  type PlanResult,
  type Source,
  type TransportDeparture,
  type TransportCoordinate,
  type TransportLeg,
  type TransportMode,
  type TransportRoute,
} from './contracts.ts';

const zone = '+08:00';
const stops = new Set([
  'orchard',
  'dhoby-ghaut',
  'city-hall',
  'bayfront',
  'marina-bay',
  'bugis',
]);
const coordinates: Record<string, TransportCoordinate> = {
  orchard: { latitude: 1.3048, longitude: 103.8329 },
  'dhoby-ghaut': { latitude: 1.2988, longitude: 103.8455 },
  'city-hall': { latitude: 1.2931, longitude: 103.852 },
  bayfront: { latitude: 1.2816, longitude: 103.8602 },
  'marina-bay': { latitude: 1.2764, longitude: 103.8545 },
  bugis: { latitude: 1.3008, longitude: 103.8558 },
};
const aliases = (v: PlanInput['origin']) =>
  typeof v === 'string'
    ? (() => {
        const normalized = v
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
        return (
          [...stops].find(
            (id) => normalized === id || normalized.startsWith(`${id}-`),
          ) ?? normalized
        );
      })()
    : null;
const source = (now: string): Source => ({
  kind: 'simulated',
  label: 'Simulated Singapore timetable. Not live arrivals.',
  dataFreshness: now,
});
export type RoadRouter = (
  origin: string,
  destination: string,
  departAt: Date,
) => Promise<TransportRoute | null>;
function iso(value: Date) {
  return value.toISOString();
}
function localParts(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.valueOf())) throw new Error('Invalid date.');
  const local = new Date(d.getTime() + 8 * 3600_000);
  return {
    date: local.toISOString().slice(0, 10),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}
function atLocal(date: string, minutes: number) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0) + (minutes - 480) * 60_000);
}
function serviceStart(input: string, offset: number) {
  const p = localParts(input);
  const start = Math.ceil((p.minutes - 360) / 5) * 5 + 360 + offset;
  const day = start > 1380 ? 1 : 0;
  return {
    date: new Date(
      new Date(`${p.date}T00:00:00${zone}`).getTime() + day * 86400_000,
    )
      .toISOString()
      .slice(0, 10),
    minutes: day ? 360 + offset : start,
  };
}
function stopId(value: PlanInput['origin']) {
  return aliases(value);
}
function known(value: PlanInput['origin']) {
  const id = stopId(value);
  return id !== null && stops.has(id);
}
function coordinate(value: string) {
  return coordinates[value.replace(/ (station|stop|interchange)$/, '')] ?? null;
}
function nextDeparture(
  stop: string,
  mode: 'train' | 'bus',
  after: Date,
  scenario: PlanInput['scenario'],
): TransportDeparture | null {
  const local = localParts(after.toISOString());
  const first = 360;
  const last = 1380;
  const offset = stop === 'dhoby-ghaut' ? -1 : stop === 'bugis' ? 1 : 0;
  let minute = Math.max(
    first,
    Math.ceil((local.minutes - first - offset) / 5) * 5 + first + offset,
  );
  let date = local.date;
  if (minute > last) {
    const tomorrow = new Date(after.getTime() + 86400_000);
    date = localParts(tomorrow.toISOString()).date;
    minute = first + offset;
  }
  if (scenario === 'train-cancelled' && mode === 'train') return null;
  const delay =
    (scenario === 'train-delay' && mode === 'train') ||
    (scenario === 'bus-delay' && mode === 'bus')
      ? 5
      : 0;
  const dep = atLocal(date, minute + delay);
  const rideMinutes = mode === 'train' ? 6 : 10;
  return {
    route: mode === 'train' ? 'North-South line' : 'City shuttle',
    direction: 'marina-bay',
    departsAt: iso(dep),
    arrivesAt: iso(new Date(dep.getTime() + rideMinutes * 60_000)),
    status: delay ? 'delayed' : 'scheduled',
  };
}
export function departures({
  stopId: stop,
  mode,
  at,
  scenario = 'normal',
}: {
  stopId: string;
  mode: 'train' | 'bus';
  at: string;
  scenario?: PlanInput['scenario'];
}): DepartureResult {
  if (!stops.has(stop)) throw new Error('Unknown Singapore stop.');
  const now = new Date(at);
  const items: TransportDeparture[] = [];
  let cursor = now;
  for (let i = 0; i < 4; i++) {
    const item = nextDeparture(stop, mode, cursor, scenario);
    if (!item) break;
    items.push(item);
    cursor = new Date(new Date(item.departsAt).getTime() + 60_000);
  }
  const p = localParts(at);
  const first = atLocal(p.date, 360);
  const last = atLocal(p.date, 1380);
  return {
    stopId: stop,
    mode,
    service: {
      kind: 'frequency',
      everyMinutes: 5,
      firstDeparture: iso(first),
      lastDeparture: iso(last),
    },
    source: source(new Date().toISOString()),
    departures: items,
  };
}
function leg(
  kind: TransportLeg['kind'],
  mode: TransportMode,
  from: string,
  to: string,
  start: Date,
  seconds: number,
  description: string,
): TransportLeg {
  const end = new Date(start.getTime() + seconds * 1000);
  return {
    kind,
    mode,
    from,
    to,
    startsAt: iso(start),
    endsAt: iso(end),
    durationSeconds: seconds,
    description,
    instruction: null,
    fromCoordinate: coordinate(from),
    toCoordinate: coordinate(to),
  };
}
function buildTransit(
  input: PlanInput,
  mode: 'train' | 'bus',
  now: Date,
  origin: string,
  destination: string,
): TransportRoute | null {
  const first = nextDeparture(origin, mode, now, input.scenario);
  if (!first) return null;
  const dep = new Date(first.departsAt);
  const legs: TransportLeg[] = [
    leg(
      'walk',
      'walk',
      origin,
      `${origin} ${mode === 'train' ? 'station' : 'stop'}`,
      now,
      120,
      'Walk to the stop',
    ),
  ];
  const waitStart = new Date(legs[0].endsAt);
  legs.push(
    leg(
      'wait',
      mode,
      `${origin} ${mode === 'train' ? 'station' : 'stop'}`,
      `${origin} ${mode === 'train' ? 'station' : 'stop'}`,
      waitStart,
      (dep.getTime() - waitStart.getTime()) / 1000,
      'Wait for the next scheduled service',
    ),
  );
  if (destination === 'bayfront') {
    legs.push(
      leg(
        'ride',
        mode,
        origin,
        'city-hall',
        dep,
        mode === 'train' ? 360 : 600,
        'Ride toward City Hall',
      ),
    );
    const transferAt = new Date(legs.at(-1)!.endsAt);
    legs.push(
      leg(
        'transfer',
        'walk',
        'city-hall',
        'city-hall interchange',
        transferAt,
        120,
        'Transfer between services',
      ),
    );
    const next = nextDeparture(
      'city-hall',
      mode,
      new Date(legs.at(-1)!.endsAt),
      input.scenario,
    );
    if (!next) return null;
    const second = new Date(next.departsAt);
    legs.push(
      leg(
        'wait',
        mode,
        'city-hall interchange',
        'city-hall interchange',
        new Date(legs.at(-1)!.endsAt),
        (second.getTime() - new Date(legs.at(-1)!.endsAt).getTime()) / 1000,
        'Wait for the connecting service',
      ),
    );
    legs.push(
      leg(
        'ride',
        mode,
        'city-hall',
        destination,
        second,
        mode === 'train' ? 360 : 600,
        'Ride to Bayfront',
      ),
    );
  } else
    legs.push(
      leg(
        'ride',
        mode,
        origin,
        destination,
        dep,
        mode === 'train' ? 420 : 600,
        mode === 'train' ? 'Train ride' : 'Bus ride',
      ),
    );
  const after = new Date(legs.at(-1)!.endsAt);
  legs.push(
    leg(
      'walk',
      'walk',
      destination,
      'destination',
      after,
      60,
      'Walk to destination',
    ),
  );
  const durationSeconds = legs.reduce(
    (sum, item) => sum + item.durationSeconds,
    0,
  );
  const waitSeconds = legs
    .filter((l) => l.kind === 'wait')
    .reduce((sum, item) => sum + item.durationSeconds, 0);
  const arrivesAt = legs.at(-1)!.endsAt;
  const deadline = input.arriveBy
    ? new Date(input.arriveBy).getTime()
    : Infinity;
  return {
    id: `simulated-${mode}`,
    mode,
    source: source(new Date().toISOString()),
    legs,
    durationSeconds,
    waitSeconds,
    transfers: legs.filter((l) => l.kind === 'transfer').length,
    arrivesAt,
    meetsDeadline: new Date(arrivesAt).getTime() <= deadline,
    distanceMeters: null,
  };
}
function buildMixedTransit(
  input: PlanInput,
  now: Date,
  origin: string,
  destination: string,
): TransportRoute | null {
  if (origin === 'city-hall' || destination === 'city-hall') return null;
  const first = nextDeparture(origin, 'train', now, input.scenario);
  if (!first) return null;
  const trainAt = new Date(first.departsAt);
  const legs: TransportLeg[] = [
    leg(
      'walk',
      'walk',
      origin,
      `${origin} station`,
      now,
      120,
      'Walk to the train station',
    ),
  ];
  const stationReady = new Date(legs[0].endsAt);
  legs.push(
    leg(
      'wait',
      'train',
      `${origin} station`,
      `${origin} station`,
      stationReady,
      (trainAt.getTime() - stationReady.getTime()) / 1000,
      'Wait for the next scheduled train',
    ),
    leg(
      'ride',
      'train',
      origin,
      'city-hall',
      trainAt,
      360,
      'Train to City Hall',
    ),
  );
  const transferAt = new Date(legs.at(-1)!.endsAt);
  legs.push(
    leg(
      'transfer',
      'walk',
      'city-hall',
      'city-hall interchange',
      transferAt,
      120,
      'Transfer to the bus',
    ),
  );
  const busReady = new Date(legs.at(-1)!.endsAt);
  const second = nextDeparture('city-hall', 'bus', busReady, input.scenario);
  if (!second) return null;
  const busAt = new Date(second.departsAt);
  legs.push(
    leg(
      'wait',
      'bus',
      'city-hall interchange',
      'city-hall interchange',
      busReady,
      (busAt.getTime() - busReady.getTime()) / 1000,
      'Wait for the connecting bus',
    ),
    leg(
      'ride',
      'bus',
      'city-hall',
      destination,
      busAt,
      600,
      'Bus to the destination',
    ),
  );
  const after = new Date(legs.at(-1)!.endsAt);
  legs.push(
    leg(
      'walk',
      'walk',
      destination,
      'destination',
      after,
      60,
      'Walk to destination',
    ),
  );
  const durationSeconds = legs.reduce(
    (sum, item) => sum + item.durationSeconds,
    0,
  );
  const waitSeconds = legs
    .filter((item) => item.kind === 'wait')
    .reduce((sum, item) => sum + item.durationSeconds, 0);
  const arrivesAt = legs.at(-1)!.endsAt;
  const deadline = input.arriveBy
    ? new Date(input.arriveBy).getTime()
    : Infinity;
  return {
    id: 'simulated-transit',
    mode: 'transit',
    source: source(new Date().toISOString()),
    legs,
    durationSeconds,
    waitSeconds,
    transfers: 1,
    arrivesAt,
    meetsDeadline: new Date(arrivesAt).getTime() <= deadline,
    distanceMeters: null,
  };
}
export async function planTransport(
  raw: unknown,
  options: { roadRouter?: RoadRouter } = {},
): Promise<PlanResult> {
  const input = planInput.parse(raw);
  const origin = stopId(input.origin);
  const destination = stopId(input.destination);
  const now = new Date(input.departAt);
  const common = source(new Date().toISOString());
  if (
    !origin ||
    !destination ||
    !known(input.origin) ||
    !known(input.destination) ||
    origin === destination
  )
    return {
      query: input,
      routes: [],
      unavailable: [
        { mode: 'train', reason: 'outside_demo_coverage' },
        { mode: 'bus', reason: 'outside_demo_coverage' },
        { mode: 'transit', reason: 'outside_demo_coverage' },
        { mode: 'walk', reason: 'outside_demo_coverage' },
        { mode: 'car', reason: 'road_router_not_configured' },
      ],
      recommendation: { kind: 'unavailable', reason: 'outside_demo_coverage' },
      awardEligible: false,
      source: common,
    };
  const routes: TransportRoute[] = [];
  const unavailable: { mode: TransportMode; reason: string }[] = [];
  if (input.modes.includes('train') && input.modes.includes('bus')) {
    const mixed = buildMixedTransit(input, now, origin, destination);
    if (mixed) routes.push(mixed);
    else unavailable.push({ mode: 'transit', reason: 'no_connecting_service' });
  }
  for (const mode of input.modes) {
    if (mode === 'train' || mode === 'bus') {
      const result = buildTransit(input, mode, now, origin, destination);
      if (result && result.meetsDeadline) routes.push(result);
      else if (result) routes.push(result);
      else
        unavailable.push({
          mode,
          reason:
            input.scenario === 'train-cancelled' && mode === 'train'
              ? 'service_cancelled'
              : 'no_service',
        });
    } else if (mode === 'walk') {
      const result = {
        id: 'simulated-walk',
        mode,
        source: common,
        legs: [
          leg(
            'walk',
            'walk',
            origin,
            destination,
            now,
            1800,
            'Walk to destination',
          ),
        ],
        durationSeconds: 1800,
        waitSeconds: 0,
        transfers: 0,
        arrivesAt: iso(new Date(now.getTime() + 1800_000)),
        meetsDeadline: input.arriveBy
          ? new Date(now.getTime() + 1800_000) <= new Date(input.arriveBy)
          : true,
        distanceMeters: 2100,
      };
      routes.push(result);
    } else if (options.roadRouter) {
      const result = await options.roadRouter(origin, destination, now);
      if (result)
        routes.push({
          ...result,
          meetsDeadline:
            input.arriveBy === undefined ||
            new Date(result.arrivesAt).getTime() <=
              new Date(input.arriveBy).getTime(),
        });
      else unavailable.push({ mode, reason: 'road_router_error' });
    } else unavailable.push({ mode, reason: 'road_router_not_configured' });
  }
  const eligible = routes.filter((r) => r.meetsDeadline);
  const best = eligible.toSorted(
    (a, b) => a.durationSeconds - b.durationSeconds,
  )[0];
  return {
    query: input,
    routes,
    unavailable,
    recommendation: best
      ? {
          kind: 'recommended',
          routeId: best.id,
          reason: 'Earliest arrival within the requested conditions.',
        }
      : {
          kind: 'unavailable',
          reason: input.arriveBy ? 'deadline_missed' : 'no_route',
        },
    awardEligible: false,
    source: common,
  };
}
