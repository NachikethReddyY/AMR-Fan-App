// Synthetic values in the exact documented OneMap response fields. No live calls.
// https://www.onemap.gov.sg/apidocs/routing and /search
export const start = { latitude: 1.29, longitude: 103.85 };
export const end = { latitude: 1.3, longitude: 103.85 };
export const road = {
  status_message: 'Found route between points',
  route_geometry: 'o}zFoezxRo}@?',
  status: 0,
  route_instructions: [
    [
      'Head',
      '',
      1000,
      '1.29,103.85',
      600,
      '1000m',
      'North',
      'North',
      'walking',
      'Head North',
    ],
    [
      'Arrive',
      '',
      0,
      '1.3,103.85',
      0,
      '0m',
      'North',
      'North',
      'walking',
      'Arrive',
    ],
  ],
  route_name: [''],
  route_summary: {
    start_point: '',
    end_point: '',
    total_time: 600,
    total_distance: 1000,
  },
};
export function transit() {
  const leg = (
    mode: string,
    a: number,
    b: number,
    points: string,
    time: number,
  ) => ({
    startTime: time,
    endTime: time + 300000,
    duration: 300,
    distance: 500.25,
    mode,
    transitLeg: mode !== 'WALK',
    from: { name: 'Synthetic start', lat: a, lon: 103.85 },
    to: { name: 'Synthetic end', lat: b, lon: 103.85 },
    legGeometry: { points, length: 2 },
  });
  return {
    plan: {
      from: { lat: 1.29, lon: 103.85 },
      to: { lat: 1.3, lon: 103.85 },
      itineraries: [
        {
          duration: 720,
          startTime: 1800000000000,
          endTime: 1800000720000,
          legs: [
            leg('WALK', 1.29, 1.295, 'o}zFoezxRg^?', 1800000000000),
            leg('BUS', 1.295, 1.3, 'w|{FoezxRg^?', 1800000420000),
          ],
        },
      ],
    },
  };
}
export function roadFor(mode: 'DRIVE' | 'WALK' | 'BICYCLE') {
  const instructionMode =
    mode === 'DRIVE' ? 'driving' : mode === 'BICYCLE' ? 'cycling' : 'walking';
  return {
    ...road,
    route_instructions: road.route_instructions.map((instruction) =>
      instruction.map((value, index) =>
        index === 8 ? instructionMode : value,
      ),
    ),
  };
}
export function address() {
  return {
    found: 1,
    totalNumPages: 1,
    pageNum: 1,
    results: [
      {
        SEARCHVAL: 'SYNTHETIC ADDRESS',
        BLK_NO: '1',
        ROAD_NAME: 'SYNTHETIC',
        BUILDING: 'NIL',
        ADDRESS: 'SYNTHETIC ADDRESS',
        POSTAL: '000000',
        X: '0',
        Y: '0',
        LATITUDE: '1.29',
        LONGITUDE: '103.85',
      },
    ],
  };
}
