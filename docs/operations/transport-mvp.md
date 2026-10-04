# Transport MVP

The transport MVP is a small Singapore-only planning service. It demonstrates
the product decision layer without claiming live arrival data or journey
verification.

`services/api/transport/planner.ts` owns the demo timetable and journey
planner. It models Orchard, Dhoby Ghaut, City Hall, Bayfront, Marina Bay and
Bugis. Train and bus departures run every five minutes from 06:00 to 23:00
Singapore time. The planner includes walking, waits, rides and interchange
buffers, and supports normal, delayed and cancelled demo scenarios.

`services/api/transport/http.ts` exposes a standalone read-only HTTP service:

```text
GET  /health
GET  /v1/transport/departures?stopId=orchard&mode=train&at=...
POST /v1/transport/plan
```

The existing API also exposes `POST /v1/transport/plan` as a public, read-only
demo endpoint. It has no account or journey authority and is bounded by the
API request limit. This lets both phone apps demonstrate the idea before live
authentication and provider setup; the standalone service remains useful for a
BB-1 or isolated demo host.

Every response identifies simulated timetable data, returns `awardEligible:
false`, and reports an unavailable state when a place or provider is outside
coverage. The transport API never awards points and never accepts a client role,
profile, or journey result.

Set `OSRM_BASE_URL` to a self-hosted OSRM endpoint to enable the car option. The
adapter sends only fixed Singapore demo stop coordinates, bounds the request to
three seconds, validates the response, and returns an OSRM/OpenStreetMap
provenance label. Without that environment variable, car routing is explicitly
`road_router_not_configured`. OSRM is a routing engine, not a live traffic feed.

```sh
pnpm install --frozen-lockfile
pnpm --filter @amr/api transport:test
TRANSPORT_HOST=127.0.0.1 TRANSPORT_PORT=8081 pnpm --filter @amr/api transport:start
```

Run the standalone process from a checked-out revision on BB-1 with Node 24 and
pnpm 12. Bind it to a private interface or reverse proxy it behind the host's
existing TLS/auth boundary. Do not expose PostgreSQL, map extracts or private
provider credentials. The confirmed BB-1 address is `bb-1@100.117.231.37` on
port 22. The interactive address was reachable, but the local non-interactive
key was not unlocked during this run, so no remote files were changed.

The Android native screen renders Singapore tiles with osmdroid and includes
OpenStreetMap contributor attribution. iOS uses its existing MapKit surface.
Neither map surface requires a paid provider key for the demo.

This is a demo planning API. Live GTFS/GTFS-Realtime feeds, geocoding, traffic,
GPS tracking, rerouting, voice prompts and production journey awards remain
separate work.

Written by gpt-6-astra through Codex (T3 Code).
