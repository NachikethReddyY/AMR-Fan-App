/** Cross-client wire contracts. Runtime validation remains in each boundary adapter. */
export type ActivityPhotoRequest = {
  profileId: string;
  capture: 'camera' | 'gallery';
  mime: 'image/jpeg' | 'image/png';
  photoBase64: string;
  description: string;
  requestId: string;
  activity: 'bus-trip' | 'other';
};

export type ActivityPhotoResponse =
  | {
      kind: 'verified';
      activity: string;
      object: string;
      creditedPoints: number;
      receiptId: string;
    }
  | { kind: 'rejected'; activity: string; object: string; creditedPoints: 0 }
  | { kind: 'unavailable'; creditedPoints: 0; reason?: string };

export type RouteQueryRequest = {
  origin: string;
  destination: string;
  extraMinutes: number;
  modes: readonly ['DRIVE', 'TRANSIT', 'WALK', 'BICYCLE'];
};
