# Server route queries

The server-only Google Routes boundary lives in `server/routes/`. It uses the
existing fetch, Zod and native TypeScript tooling. No Google key, query, provider
body or geometry is logged. No route query is persisted or sent to AI.

## Entry point and authentication

`createRouteQuery({env})` in `server/routes/query.ts` constructs one query function
at API startup. It takes the actor returned by `authenticateSession` and an
unknown request body. A null actor fails with 401 before a provider call. The
actor is trusted server context, never a request field. Unknown fields, including
account/profile IDs, endpoints, factors and geometry, fail validation.

`POST /v1/routes/query` runs after the existing bearer session check in
`server/api/app.ts`. Actual local HTTP tests use persisted revocable sessions in
the worktree's isolated PostgreSQL test namespace. There is no saved query or
cross-account query identifier to retrieve.

Input has `origin` and `destination`, each either a nonempty address of at most
200 characters or `{latitude, longitude}` with globally valid finite coordinates;
`modes`, one to four unique `DRIVE`, `TRANSIT`, `WALK`, `BICYCLE` values; and
`extraMinutes`, a whole number from 0 through 1440. No race window is required.

`RouteQueryResult` is the exported query result type. It retains validated query
endpoints, normalized routes and ordered legs, per-mode outcomes, per-route
estimates, the deterministic recommendation and factor/source metadata. A route
success has a non-null UTC ISO-8601 `fetchedAt` string; failures have no timestamp.
Each `RouteEvidence` in `server/routes/normalize.ts` names the exact route ID and
primary request mode. Its geometry is either validated returned endpoints and
ordered decoded polyline5 points or `unavailable: missing_geometry`. Invalid
geometry rejects that mode's response. Fixture/live provenance belongs to the
provider result, never to an address or the parser's default label.

Consumers must preserve source, normalized legs and geometry together in the
selected server-returned snapshot. Future journey persistence and assessment
belong to #8. This boundary establishes no adherence threshold or award.

## Configuration

| Variable | Behavior |
| --- | --- |
| `AMR_GOOGLE_ROUTES_KEY` | Server-only existing Google credential. Absent means `live_not_configured`. Never use an `EXPO_PUBLIC_` variable. |
| `AMR_GOOGLE_ROUTES_ENDPOINT` | Defaults to `https://routes.googleapis.com/directions/v2:computeRoutes`. Live configuration accepts exactly that HTTPS endpoint, with no userinfo, query, fragment or redirect. |
| `AMR_ROUTES_TIMEOUT_MS` | Decimal integer 25 to 5000, default 3000, per mode including response-body reading and geometry validation. |
| `AMR_ROUTES_SYNTHETIC` | Default false. True requires `NODE_ENV=test`, an explicit `http://127.0.0.1:<port>/directions/v2:computeRoutes` endpoint and no Google key. Sends only a fixed synthetic key and labels results as fixtures. |

Changing the endpoint is an explicit server configuration operation, never
client input. The loopback exception is test-only and cannot carry a real key.
The live transport rejects redirects, preventing credential forwarding to a
second host. Invalid configuration fails startup with a generic message.

One query requests each selected primary mode once, with at most two requests
in flight. A second concurrent query fails `busy` without queueing or spending.
There are no retries or alternative-route requests. The server reserves the
whole query's call budget before sending: at most 60 mode calls per minute and
1000 per provider-instance lifetime. The query function separately allows six
queries per authenticated principal per minute and keeps at most 100 principal
counters per window. These are single-process local-candidate limits. Restart
resets them. Before public/multi-process deployment, configure an enforceable
shared spend limit and provider quota; no paid service is provisioned here.

The exact field mask requests route distance/duration, ordered step
distance/duration/mode/transit vehicle, returned leg endpoints and one route
polyline. `HIGH_QUALITY` requests usable geometry. A mode response is limited to
128 KiB, three routes, one leg per route (no intermediate waypoints), 128 steps
and 2048 decoded geometry points per route. Excessive or missing required data
is unavailable, never truncated into apparently complete evidence. Supplied
geometry must contain at least two distinct coordinates. Repeated
consecutive points remain valid within a usable path, as do closed loops with
distinct intermediate points; all-identical paths fail closed. Distances
are bounded to 20,000 km and durations to seven days. Step totals allow at most
one rounding unit per step; transit may include waiting time. Non-transit
duration must agree with its steps. Endpoint agreement permits two polyline5
quantization units, a parser consistency tolerance, not a journey threshold.

Containment cooperatively yields to the event loop at checkpoints after a 4 ms
work slice. Checks remain complete: no geometry sampling, simplification or
truncation. Point/segment checks and batches of at most 256 nearby edges have
checkpoints; each individual ring scan remains bounded by the pinned dataset.
At most two mode normalizations share the existing provider request slots. The
same abort deadline covers network and CPU work, with no background queue or
worker pool.

The R30-2 local regression accepts four modes, three routes per mode, 2048 points
and 128 steps per route. Its newly agreed target is at most 50 ms maximum delay
for a 10 ms heartbeat, plus a concurrent independent-client health response
during normalization. This is a synthetic local acceptance test, not a production
SLA. Authenticated measurements and host-load observations remain in private
evidence; the focused route suite retains the full-shape heartbeat regression.

The [Compute Routes contract](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
defines these primary modes, units and selected fields. Transit requests have
no bus/train guarantee; actual step vehicles determine the normalized mode.
Google documents that [transit preferences may return other modes](https://developers.google.com/maps/documentation/routes/transit-route).
DRIVE stays conventional car. Cab and electric-car availability are not inferred.
Provider errors, unsupported modes and absent routes are separate outcomes.

## Geographic applicability and sources

Contains information from **URA Master Plan 2019 Region Boundary (No Sea)**,
accessed 25 September 2026 from [data.gov.sg](https://data.gov.sg/datasets/d_bf4d24df9129d5a8ff8cf82e20959ee0/view),
made available under the [Singapore Open Data Licence 1.0](https://data.gov.sg/open-data-licence).
No official endorsement is implied. The dataset describes indicative planning
regions, not a legal national border or a complete present-day coastline.

The unmodified 1,477,466-byte GeoJSON is pinned as deterministic gzip at
`server/routes/data/singapore-regions.geojson.gz`. Compression preserves upstream
line endings independently of Git text conversion and formatting. Dataset period: December 2019;
catalog revision: 3 December 2025. SHA-256:
`2ac87b6da63c39d6311c7bc018aafddbffcfa18fd8faed09243207c9b502627d`.
Startup bounds decompression to 2 MB, then verifies checksum and structure. Download used the public dataset's
`poll-download` API, without an account. Signed download URLs are not committed.
The separately inspected SLA national-map download returned HTTP 403; no
credential lookup or additional service was attempted.

Deterministic containment checks returned endpoints and every supplied geometry
segment against the union of polygons, including holes. Outer boundaries,
missing geometry, uncovered areas and paths leaving the union yield
`geography_unverified`. This conservatively limits indicative Singapore factors.
It does not establish a travelled trace, jurisdiction, or geometry omitted by
the provider. Addresses and the Google `regionCode` bias are not geography proof.
Future reclaimed land or generalized coastal geometry can remain unavailable.

The retained CAG factors cover conventional car, public bus and MRT. Returned
rail other than SUBWAY/METRO_RAIL, or other bus vehicle categories, stays
`unsupported_transit_factor`; the general parser can still show those routes.
Walking/cycling zeroes describe sourced operational travel only. Unknown
geography never receives those zeroes. If any candidate's factor applicability
is unverified, the query withholds the recommendation while retaining all route
availability and individually supported estimates. It never discards a faster
route to relax the fan's time limit.

## Source lineage and verification

Pure `routes.ts`, `googleRoutes.ts` and their tests come from reviewed PR24 head
`82dccb68aee0c04f615308f92a023046179f865d`. `emissions.ts`, `recommendation.ts`
and their tests come from reviewed PR26 head
`518ca37b02a8b8164f9838e697416177ae0c3642`. All eight files match their source
apart from `.ts` import suffixes needed by Node. No held screen, navigation,
native configuration or whole UI commit was copied. PR24/26 remain held for
their own small-iPhone Dynamic Type/VoiceOver proof; this candidate does not
approve phone behavior or close #6/#7.

Run `pnpm route:test`, `pnpm route:test:database`, `pnpm account:test:database`,
`pnpm exec jest src/features/routes --runInBand`, `pnpm check`,
`pnpm security:check` and `pnpm security:dast`. The database commands use only
the namespace assigned to this checkout; see [local setup](local-development.md).
The root check and CI include route unit/HTTP tests. Synthetic tests run temporary
127.0.0.1 port-0 HTTP servers and close them in `finally`. No live Google request
was made: no authorized credential configuration was available. Live mode
coverage, actual Google response compatibility and provider cost remain pending.
Raw evidence is private under `.evidence/route-provider/`. Application DAST uses
the real account/route API in its existing isolated container, with no host port
or live credential. Its unauthenticated passive scan is separate from protected
POST-route and session behavior tested through actual HTTP/PostgreSQL.

Written by gpt-6-astra through Codex (T3 Code).
