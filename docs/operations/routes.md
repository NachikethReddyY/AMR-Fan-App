# Server route queries

The server route boundary in `services/api/routes/` supports the user-selected
Singapore-first OneMap provider and the preserved Google adapter. Both use
existing fetch, Zod and native TypeScript tooling. Credentials, queries, provider
bodies and geometry are not logged or sent to AI. The existing prepared-journey
flow consumes the returned snapshot without a second provider query.

## Entry point and authentication

`createRouteQuery({env, googleBudget})` in `services/api/routes/query.ts` constructs one query function
at API startup. It takes the actor returned by `authenticateSession` and an
unknown request body. A null actor fails with 401 before a provider call. The
actor is trusted server context, never a request field. Unknown fields, including
account/profile IDs, endpoints, factors and geometry, fail validation.

`POST /v1/routes/query` runs after the existing bearer session check in
`services/api/api/app.ts`. Actual local HTTP tests use persisted revocable sessions in
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
Each `RouteEvidence` in `services/api/routes/normalize.ts` names the exact route ID and
primary request mode. Its geometry is either validated returned endpoints and
ordered decoded polyline5 points or `unavailable: missing_geometry`. Invalid
geometry rejects that mode's response. Fixture/live provenance belongs to the
provider result, never to an address or the parser's default label.

Consumers must preserve source, normalized legs and geometry together in the
selected server-returned snapshot. Future journey persistence and assessment
belong to #8. This boundary establishes no adherence threshold or award.

## OneMap configuration and limits

The earlier user selection was OneMap instead of billable Google. On 27 September
2026 the user authorized Google billing with the lifetime allowance described
below. This changes no OneMap behavior. The environment
example selects `AMR_ROUTES_PROVIDER=onemap` with no credentials, so live queries
remain unavailable. `google` retains the original adapter; `disabled` prevents
all provider calls. An omitted selector preserves legacy Google configuration,
which is disabled without its existing key. There is no cross-provider fallback.

| Variable | Behavior |
| --- | --- |
| `AMR_ROUTES_PROVIDER` | Provider switch: `onemap`, `google`, or `disabled`. `ROUTES_PROVIDER` and `MAP_PROVIDER` are accepted aliases. There is no cross-provider fallback. |
| `AMR_ONEMAP_EMAIL` and `AMR_ONEMAP_PASSWORD` | Environment-backed account login. The password is the actual OneMap account password, not an access token. `ONEMAP_EMAIL`, `ONEMAP_EMAIL_PASSWORD`, `ONEMAP_API_EMAIL`, and `ONEMAP_API_PASSWORD` are accepted compatibility names. Keep these in the mode-600 BB-1 auth env file, never the repository `.env`. |
| `AMR_ONEMAP_ACCESS_TOKEN` | Environment-backed existing OneMap access token. `ONEMAP_ACCESS_TOKEN`, `ONEMAP_API_KEY`, and the supplied `ONEMAP_APIKKEY` are accepted aliases. An explicit `AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT` or `ONEMAP_ACCESS_TOKEN_EXPIRES_AT` cutoff is preferred; without one, the adapter uses the documented three-day lifetime and requires a restart after expiry. |
| `AMR_ONEMAP_CREDENTIALS_FILE` | Assigned absolute path outside this worktree to JSON containing `email`/`password`, or the accepted `ONEMAP_EMAIL` plus `ONEMAP_APIKKEY` aliases. The regular file must belong to the server user, have mode 600, one link, and at most 16 KiB. Symlinks and repository files are rejected. No file path is supplied or discovered automatically. |
| `AMR_ONEMAP_ACCESS_TOKEN_FILE` | Alternative to the account credential file: an assigned absolute external path to a regular server-owned mode-600 file with one link. One token of 1–8192 characters using letters, digits, `.`, `_`, `~`, or `-`, optionally followed by one LF or CRLF; at most 8194 bytes. No JSON, `Bearer` prefix, spaces, symlinks or repository files. |
| `AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT` | Required with the access-token file. ISO timestamp with `Z` or an explicit timezone offset. This is an operator use-until cutoff, not proof of provider expiry. No default or date-only value. Missing/invalid pairs and simultaneous account/token configuration fail startup. |
| `AMR_ONEMAP_BASE_URL` | Exactly `https://www.onemap.gov.sg` for live use. Redirects are rejected. |
| `AMR_ROUTES_TIMEOUT_MS` | Existing 25–5000 ms bound, default 3000. Each auth/search/route request includes bounded body reading; route validation and geography use the same deadline. |
| `AMR_ROUTES_SYNTHETIC` | Test-only OneMap fixtures require `NODE_ENV=test`, an explicit `http://127.0.0.1:<port>` base, no credential/token file or token cutoff, and no Google key. Only fixed synthetic credentials are sent. |
| `AMR_ONEMAP_WINDOW_CALLS` | Optional positive integer ceiling for OneMap calls per rolling minute within one provider instance. Defaults to the committed 60. The BB-1 demo host sets 240 so repeated planning does not surface as `budget_exhausted`. |
| `AMR_ONEMAP_TOTAL_CALLS` | Optional positive integer ceiling for OneMap calls per provider instance lifetime. Defaults to the committed 1000 and resets on restart. The BB-1 demo host sets 5000. |

Account credentials are read only when a query needs a token. The server caches tokens
in memory until 60 seconds before their supplied expiry, capped at three days.
One active query owns authentication before mode fan-out, so refreshes cannot
race. Every refresh attempt starts a 60-second cooldown. A 401/403 clears the
cache and starts the same cooldown. Failed requests are not retried; an invalid
credential cannot cause an immediate login loop. Tokens and account passwords
never appear in route results. No account was created or authenticated for this
implementation. Supply a secure file only after the owner assigns it.

Access-token mode reads only its assigned private file, lazily once per provider
instance, and caches the supplied token in memory. It never calls the login
endpoint or falls back to account credentials or Google. Before each address or
route dispatch, including the second request in a pair and subsequent batches,
it checks the operator cutoff with a 60-second margin. Once that margin is reached,
it discards the cache and returns the existing `live_not_configured` reason
without another dispatch. Invalid/missing files also latch that reason until
restart. A provider 401/403 discards the token and latches `provider_error` until
restart, with no retry. Already dispatched requests may finish; subsequent
dispatches are blocked. Per-mode outcomes retain existing response structure,
including the aggregate `provider_error` when no route succeeds.

Token syntax and a configured cutoff do not verify provider validity. A token may
be revoked or expire earlier; provider rejection stops further use. No refresh
credentials are assumed. Filesystem changes alone do not rotate a cached token
or clear a failure. Suspend routing, privately replace the token and its operator
cutoff together, then restart all API instances. Run local format/configuration
checks before a separately authorized bounded provider check. If no replacement
is available, leave routing unavailable; never advance the cutoff for the same
expired token. Precise locations, credentials and provider bodies stay out of logs.

For a hosted secret mount, the infrastructure owner must verify the actual runtime
UID, file mode, regular-file status, link count and external resolved parent path.
The repository deployment template does not establish these properties. If the
mount is incompatible, provisioning must supply a server-owned private copy outside
the app tree, in a mode-700 directory; do not relax the reader or expose the token
in a client bundle. Secret provisioning, rotation and restart require their own
deployment authority.

### Opt-in hosted private copy

`pnpm api:start:onemap` runs `services/api/api/start-onemap.ts`. The default
`pnpm api:start` and `services/api/api/start.ts` are unchanged. This wrapper reads only
`/etc/secrets/amr-onemap-access-token.txt`; there is no CLI or environment override
for the mounted source. It accepts `AMR_ROUTES_PROVIDER=disabled` or `onemap`
and requires a syntactically valid explicit `AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT`
cutoff. An expired or within-60-second cutoff still permits API startup and health,
including disabled staging. The unchanged route adapter returns unavailable before
fetching, so token expiry cannot take unrelated API operations down on restart.
Missing/malformed cutoff or failed private-copy checks still fail startup.
Replace the token and cutoff together to restore routes; never extend an expired
token's cutoff. Leave `AMR_ONEMAP_ACCESS_TOKEN_FILE`,
`AMR_ONEMAP_CREDENTIALS_FILE` and the Google key unset. Synthetic provider mode
is incompatible with the wrapper. Normal account/Google startup continues to use
`pnpm api:start`.

Only the fixed `/etc/secrets/amr-onemap-access-token.txt` mount is resolved once
with `realpathSync` to support provider-managed secret indirection. Arbitrary
injected source paths retain no-follow behavior; there is no new CLI/environment
override. The resolved target is opened with `O_RDONLY|O_NOFOLLOW|O_NONBLOCK`
and must be readable, regular and bounded to 8194 bytes. Its mode/UID are not
assumed or changed. This trusts provider control of the mount and target ancestor
directories. A final-target symlink substitution is rejected; ancestor replacement
is not atomic, and provider rotation may yield a different validated snapshot.
No particular Render target layout or race-free ancestry is claimed. Resolution
failure is reported as `source_resolution` with sanitized errno, without a
resolved path or raw exception. There is no fallback or retry.

The wrapper validates single-token syntax and creates a unique
external directory under the resolved OS temporary directory. It verifies current
UID ownership and mode 0700, exclusive-creates a regular mode-0600 single-link
token file, bounds the copy and clears its temporary buffer. It rejects a temp
base inside the app tree. The generated path is assigned to the API process
environment before dynamically importing the existing `start.ts` in that same
process. No login, refresh, provider request or database operation occurs in the
copy helper. The existing API startup still performs its usual database readiness
query and host/port binding.

For a later authorized Render setup, the exact opt-in start command is:

```sh
API_HOST=0.0.0.0 API_PORT="$PORT" pnpm api:start:onemap
```

Stage with `AMR_ROUTES_PROVIDER=disabled`. The wrapper validates OneMap token
configuration separately but keeps the actual selected provider disabled. Its
`onemap_token_staged` log contains only generated path, runtime UID, numeric file
mode (384 means 0600), directory mode (448 means 0700), link count and selected
provider. It contains no token, hash, length or source exception. This event proves
copy checks, not API health or provider acceptance. Observe the subsequent
`api_started` event separately. Switching to `onemap` remains a separate authorized
activation; secret/settings saves may deploy, so root must approve staging order.

Preparation/import failures emit exactly one stderr JSON object with event
`onemap_startup_failed`, a fixed `stage`, and an allowlisted `errno`. Stages are
`config`, `temp_resolution`, `source_resolution`, `source_open`, `source_metadata`, `source_read`,
`source_format`, `source_close`, `private_dir`, `copy_open`, `copy_write`,
`copy_metadata`, `copy_close`, `staged_event`, `api_import`, and `cleanup`.
Errno is one of `ENOENT`, `EACCES`, `EPERM`, `ELOOP`, `ENOTDIR`, `EISDIR`, `EROFS`,
`ENOSPC`, `EMFILE`, `ENFILE`, `EEXIST`, `EIO`, `NONE` for validation rejection, or
`OTHER` for an unrecognized exception. A secondary cleanup/close failure adds only
`cleanupFailed: true`; it cannot replace the first failure's stage or errno.
No exception message, stack, cause, path, token, hash or environment is reflected.
An `api_import` failure occurs after copy staging; missing staging stdout alone
cannot identify a preparation failure. These diagnostics do not prove a hosted
cause until observed on the intended release.
SIGTERM/SIGINT before startup handoff synchronously clean the copy and terminate
with 143/130, preventing pending import work from resuming. After handoff, the
existing API handlers still close its server and database pool; process exit
removes only the generated token and its exact directory. Cleanup never recursively
deletes a directory or changes the mounted source. Unexpected extra files or failed
removal produces one fixed `cleanup` failure object. SIGKILL, host loss or an API shutdown that
never exits can leave the private ephemeral copy; guaranteed deletion is not claimed.

Focused lifecycle tests run the actual API start/listener with a synthetic database
module and no provider access. They establish local signal/host/port/same-process
compatibility only. Hosted mount metadata, real database startup and real routes
still require their separately authorized checks.

The same call/minute and call/provider-lifetime ceilings include OneMap
authentication and address requests. Each query conservatively reserves one auth
call, up to two address searches, and one call per selected mode, even if a token
is cached, token-file mode skips authentication, or both address strings match.
Both ceilings default to the committed 60/minute and 1000/lifetime values and
are configurable through `AMR_ONEMAP_WINDOW_CALLS` and `AMR_ONEMAP_TOTAL_CALLS`;
the BB-1 demo host sets 240 and 5000. These process-local ceilings reset on
restart; the independent Google budget is unchanged and is not used for OneMap. Identical address strings are resolved
once. Maximum fan-out remains two; a concurrent query returns `busy`. Every
response has the existing 128 KiB limit. No pagination or automatic retry occurs.

Coordinate inputs must lie inside the existing pinned Singapore land polygons.
Address search requests page 1 with coordinates/address details and accepts only
one match within those polygons. No match, ambiguity, malformed/error payloads
or out-of-coverage matches remain unavailable. The client can supply a more
specific address or coordinates; this PR adds no address-selection UI. The land
boundary is conservative and can exclude coastal/offshore routes. It is not an
authoritative OneMap coverage guarantee.

OneMap requests `drive`, `walk`, `cycle`, or `pt`. Public transport uses `TRANSIT`,
up to three itineraries, and the current Singapore date/time (`MM-DD-YYYY`,
`HH:mm:ss`). It does not promise bus-only and train-only alternatives. Each
returned itinerary retains actual ordered WALK/BUS/SUBWAY legs, fractional
metres and seconds. Total itinerary time includes waiting; waiting is not
fabricated as a travel leg or emissions. Unknown transit modes, contradictory
timestamps and malformed/missing leg geometry fail closed. Documented stop/shape
offsets or discontinuous leg polylines preserve validated leg metrics but return
`missing_geometry` and `geography_unverified` in existing evidence. Every leg
still passes Singapore containment. No connecting segment is invented, and such
an itinerary cannot produce an emissions recommendation or prepared journey
under the current contract. Supporting multipart geometry belongs to a future
coordinated route/journey/map change; the official transit sample exposes this
limitation.
Road modes use the provider's total distance/time and returned encoded polyline.
Every instruction must identify the requested mode at the documented instruction
mode position: `walking`, `driving` or `cycling`. Empty, missing, unknown or
contradictory instruction modes are unavailable. In particular, a walking response
to `cycle` is never relabelled as cycling. Mixed walking/cycling instructions
remain unavailable until their separate metrics can be represented honestly.
The published road example demonstrates walking; drive/cycle response vocabulary
still needs the authorized live check. Instruction prose is not an emissions input. No route is relabelled as a
cab or electric car, and OneMap does not supply the emissions calculation.

Geometry uses the documented polyline5 encoding. `google-polyline5` in existing
evidence names the encoding, not the data provider. Returned points are neither
invented nor simplified. Each response permits at most 32768 decoded geometry
coordinates and 2048 instructions; transit permits three itineraries, each with
at most 128 legs. Singapore MRT legs routinely exceed 4000 coordinates, so the
coordinate ceiling covers whole cross-island journeys rather than only short ones;
the earlier 2048-point limit silently rejected ordinary transit rows.
The existing complete Singapore segment
containment check also applies. Bad/excessive evidence rejects the mode response
instead of presenting a truncated route. Distances remain bounded to 20,000 km,
durations to seven days. The existing journey validator can impose tighter
snapshot bounds; unsupported snapshots remain unavailable.

Live source is `OneMap / Singapore Land Authority`; synthetic source explicitly
says it is a OneMap HTTP fixture. `fetchedAt`, source, legs and evidence retain
the existing query/journey shape. Emissions remain the existing indicative
Singapore factors, and fastest-plus-extra calculations are unchanged.

## OneMap sources and release gates

The implementation uses the official [routing documentation](https://www.onemap.gov.sg/apidocs/routing),
[authentication documentation](https://www.onemap.gov.sg/apidocs/authentication),
[address search documentation](https://www.onemap.gov.sg/apidocs/search) and
[documentation root](https://www.onemap.gov.sg/apidocs/), inspected 26 September
2026. Tests contain synthetic values in the documented response fields, not
captured personal trips or a claim that live schedules were checked.

### Minimal path to live routing

Choose one credential mode. If the owner supplies an access token, use
`AMR_ONEMAP_ACCESS_TOKEN_FILE` plus `AMR_ONEMAP_ACCESS_TOKEN_EXPIRES_AT`, leaving
`AMR_ONEMAP_CREDENTIALS_FILE` empty. Obtain an exact provider expiry or an
explicitly approved earlier operator cutoff; never infer a time or timezone from
a reported expiry date. Set `AMR_ROUTES_PROVIDER=onemap`, keep the official base
URL and synthetic mode off. Follow the replacement/restart procedure above.
An initial authorized coordinate-only comparison avoids address ambiguity and
requires one routing request per selected mode, with no login or search calls.
This does not establish address, cycling or transit compatibility.

For account credential mode, the account owner must [register for OneMap API access](https://www.onemap.gov.sg/apidocs/register)
and [confirm the account](https://www.onemap.gov.sg/apidocs/registerconfirm) using
the confirmation code sent by email, then set the account password. The
[authentication service](https://www.onemap.gov.sg/apidocs/authentication) accepts
that registered email/password at `POST /api/auth/post/getToken` and returns
`access_token` plus `expiry_timestamp`. This is a OneMap account, not a Google
project, Google key or billing setup.

The infrastructure owner then assigns an external file containing only those
`email` and `password` fields, owned by the server user with mode 600, and sets
`AMR_ROUTES_PROVIDER=onemap` and `AMR_ONEMAP_CREDENTIALS_FILE` to its absolute path.
Keep the official base URL and synthetic mode off. Do not put credentials in
source, chat, shell history or phone configuration. No account, file location or
credential was assigned or used in this task.

After explicit authorization, the live check must cover token exchange when using
account credentials (direct authorization when using a supplied token), one
unambiguous address, and drive/walk/cycle/transit responses, including mode fields,
units and actual geometry. Deployment and phone attribution belong to their
separate owners. Local fixtures cannot establish live availability.

The supported transit solution within the current contract is to accept only
provider-returned continuous leg geometry for journey selection. The official
transit API supplies `legGeometry` for each leg; its documented request options
do not promise a continuous replacement shape. The earlier fully expanded sample and the currently printed first itinerary
have stop/shape offsets or gaps. The current page abbreviates the remaining
itineraries, so they were not reconstructed or counted as fresh proof. Connecting them with straight lines,
relabelling a walking request, or silently snapping stops would invent evidence.
Supporting those disconnected itineraries needs a coordinated multipart geometry
contract across route, journey and phone owners. No such change is included here.

Review the [SLA API terms](https://www.onemap.gov.sg/legal/apitermsofservice.html)
and [Singapore Open Data Licence](https://www.onemap.gov.sg/legal/opendatalicence.html)
before use. Dataset reuse requires visible source acknowledgement and a licence
link; access is conditional and availability is not guaranteed. The separate
phone/map owner must display the source, access date and licence link before
live release. The server source field alone is not visible attribution proof.
Do not suggest SLA endorsement. Map tiles, map SDK/native display, account
provisioning, provider quota approval and live mode/address/geometry proof are
separate pending work. No paid service or deployment is enabled here.

## Preserved Google configuration

| Variable | Behavior |
| --- | --- |
| `AMR_GOOGLE_ROUTES_KEY` | Server-only existing Google credential. Absent means `live_not_configured`. Never use an `EXPO_PUBLIC_` variable. |
| `AMR_GOOGLE_ROUTES_ENDPOINT` | Defaults to `https://routes.googleapis.com/directions/v2:computeRoutes`. Live configuration accepts exactly that HTTPS endpoint, with no userinfo, query, fragment or redirect. |
| `AMR_ROUTES_TIMEOUT_MS` | Decimal integer 25 to 5000, default 3000, for the complete Google comparison including admission, both request batches, response bodies and geometry validation. |
| `AMR_ROUTES_SYNTHETIC` | Default false. True requires `NODE_ENV=test`, an explicit `http://127.0.0.1:<port>/directions/v2:computeRoutes` endpoint and no Google key. Sends only a fixed synthetic key and labels results as fixtures. |

Changing the endpoint is an explicit server configuration operation, never
client input. The loopback exception is test-only and cannot carry a real key.
The live transport rejects redirects, preventing credential forwarding to a
second host. Invalid configuration fails startup with a generic message.

For Google, one query requests each selected primary mode once, with at most two
requests in flight. A second concurrent query in that provider instance fails
`busy`. There are no automatic retries or alternative-route requests. The
60-mode-call/minute guard and six-query/principal/minute guard (at most 100
principal counters) remain process-local and reset on restart. The lifetime
allowance below is shared and does not reset. No Google route-result cache or
deduplication exists: repeated searches consume new reservations. Existing
prepared-journey snapshots are reused without another provider comparison.

### USD 1 lifetime application cutoff

Migration `0012_google_route_budget.sql` creates one independent
`app.google_route_budget` row with `used_attempts` between 0 and 200. The API
injects `createGoogleRouteBudget(pool)` only for live Google configuration.
No additional budget environment variable, periodic reset, refund or top-up
operation exists. Test-only loopback providers may use a local 200-attempt
allowance; that path cannot carry a real key and is not production durability.

Each comparison atomically increments the row by the number of selected modes
only if the total will remain at most 200. PostgreSQL commits with
`synchronous_commit=on` before any provider dispatch. A four-mode comparison
needs four remaining attempts; it cannot spend a partial reservation. All
processes and restarts must use the same database. Concurrent row updates
serialize at PostgreSQL. A committed reservation is never refunded, even if a
request fails, times out, the process crashes before sending, the second batch
misses its deadline, or the commit acknowledgement is lost. Retrying a search
requires a new reservation; no reservation can authorize a replay.

No injected store means `live_not_configured`. An absent row or exhausted
allowance returns `budget_exhausted`. Database errors or uncertain commits return
`provider_error` without dispatch. Admission uses the existing timeout and
returns `timeout` when it expires. Late database completion cannot dispatch.
Database lock and statement waits also have one-second limits; a reservation
that finishes after the caller's deadline may burn unused attempts. Provider
fetch and normalization share the remaining comparison deadline. No provider
error body, location, key or database error text enters diagnostics.

The runtime has no decrement, delete or seed path. Its required grants are
`SELECT` on `app.google_route_budget` and `UPDATE(used_attempts)` only. Withhold
INSERT, DELETE, TRUNCATE and DDL, and deny PUBLIC/anonymous/client access. This
trusts application code and the database operator: stolen database credentials,
operator resets or restoring an old database backup can violate the allowance.
After data loss/restore, keep the Google key disabled until prior attempts are
reconciled conservatively. Do not initialize another production database at zero
or roll back to an older binary with the Google key present.

### Pricing and request contract

Official documentation checked 27 September 2026 lists Compute Routes Essentials
at USD 5 per 1,000 requests. Two hundred reserved attempts therefore represent
USD 1 of list-price API usage, about 50 complete four-mode comparisons. The
allowance deliberately ignores free monthly usage and burns failed requests
even when Google would not bill them. It is not an account-wide billing cap,
tax/currency guarantee, billing alert or leaked-key guarantee. Other consumers,
keys and services are outside this app cutoff. Root owns billing/key activation.

The four modes are DRIVE, TRANSIT, WALK and BICYCLE. DRIVE is explicitly
TRAFFIC_UNAWARE. There are no intermediate waypoints, waypoint optimization,
location modifiers, toll computation, TWO_WHEELER, traffic-aware polylines,
Places requests or separate Geocoding API calls. Routes receives address or
coordinate waypoints directly. Route/step distance and duration, travel mode,
transit vehicle, leg endpoints, ordinary encoded route/step polylines and
HIGH_QUALITY geometry introduce none of the listed Pro/Enterprise triggers.
The exact mask/body are regression-tested. Recheck price and SKU before changing
those fields or enabling a changed provider contract; do not assume 200 remains
safe after a price increase.

Sources: [pricing](https://developers.google.com/maps/billing-and-pricing/pricing),
[SKU triggers](https://developers.google.com/maps/billing-and-pricing/sku-details),
[billing](https://developers.google.com/maps/documentation/routes/usage-and-billing),
[basic polylines](https://developers.google.com/maps/documentation/routes/traffic_on_polylines),
[transit routes](https://developers.google.com/maps/documentation/routes/transit-route).

### Migration and activation contract

Production is reported at migrations 0001 through 0010. AI migration 0011 is
merged but undeployed; its prior-liability prerequisite is not cleared. Migration
0012 is a separate Google allowance, not an extension of the AI budget. Leave
0011 bytes/checksum, AI store source and the existing deployment runner intact.
Do not assert zero prior AI spending or set its initialization acknowledgement.

Root's deployment owner must provide an independently reviewed schema-only path
through the existing runner that atomically keeps AI suspended and without
spending grants before applying 0012. Historical AI liability remains unknown;
AI_COST_DATABASE_URL stays absent and AI remains disabled. Schema deployment
does not authorize AI budget initialization or activation. Until that runner
path is reviewed, Google production migration and activation remain on hold.

For Google activation, root verifies no prior Google app attempts or pending
calls before the initial zero seed, applies the exact checksum and narrow grants,
deploys this admission code to every instance, and confirms the shared row before
adding the server-only key. Restrict the key to Routes API. A Render regional
egress CIDR restriction is supplementary and does not uniquely identify AMR;
the exact service ranges must be observed by the cloud owner. Keep old binaries
and other consumers from using the key. No cloud setting, key, live DDL or
provider request was used to implement these controls.

The exact field mask requests route distance/duration, ordered step
distance/duration/mode/transit vehicle, returned leg endpoints and route/step
polylines. `HIGH_QUALITY` requests usable geometry. A mode response is limited to
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

The R30-2 local regression accepts four modes, three routes per mode, a
2048-point shape and 128 steps per route; the accepted geometry ceiling is
covered separately by the route normalization tests. Its newly agreed target is
at most 50 ms maximum delay
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
`services/api/routes/data/singapore-regions.geojson.gz`. Compression preserves upstream
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
geography never receives those zeroes. Candidates whose factor applicability
is unverified are excluded from the comparison while retaining all route
availability and individually supported estimates; the time reference still
comes from every valid route. Only when no verified candidate or baseline
remains does the query withhold the recommendation. It never discards a faster
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
`pnpm exec jest apps/fan/src/features/routes --runInBand`, `pnpm check`,
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
