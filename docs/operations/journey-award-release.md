# Journey award release evidence

The bundled `cag-surface-access-co2-v1` factor configuration supports clearly
labelled CO2 estimates and provisional points for applicable Singapore routes.
Physical award readiness still defaults to unavailable: no physical calibration
report is shipped. The [award rules](../features/05-points-and-history.md) retain
50 points/kg, cap 2,000, no daily cap, fallback and difference-only top-ups.

## Evidence status, 26 September 2026

| Dimension | Status | Sample and method | Evidence and limits |
| --- | --- | --- | --- |
| Published factor dataset | Accepted technical basis | Three CAG FY2023/24 rows, EPA Table 10 comparison | CO2-only interpretation; original CO2e labels retained as discrepant provenance. |
| Car baseline | Neutral single occupant | .1901 kg per vehicle-km, one occupant | No ICE-specific, Singapore fleet-average or lifecycle claim. |
| Physical calibration | Unverified | Zero real trips in supplied handoffs | Simulator UI/camera proof cannot establish GPS thresholds or distance validity. |
| Policy and unit boundaries | Focused tests | Explicit CO2 plus unchanged legacy CO2e, changed factors/units/endpoints | Synthetic journeys prove code decisions, not real travel or calibration. |
| Ledger integration | Prior slice passed with synthetic factors | 49 isolated PostgreSQL/HTTP tests plus 9 photo tests | New CO2 dataset/composition needs the scheduled affected database proof. |

The exact dataset and source limitations are retained in
[the factor evidence note](../../server/awards/factors/cag-surface-access-co2-v1.md)
and [configuration](../../server/awards/factors/cag-surface-access-co2-v1.json).
CAG publishes .1901 car per vehicle-km, .0441 bus and .0578 MRT per passenger-km.
These values numerically match EPA's CO2 column after mile-to-kilometre conversion.
CAG's table says CO2e while its methodology focuses on CO2. The application uses
explicit CO2, excludes separately reported CH4/N2O and does not add a conversion.
The match is a numeric inference, not a CAG row-level source mapping.

`published_surface_access` and `single_occupant_car` identify this accepted scope.
Legacy `use_phase_co2e` / `single_occupant_ice` releases retain their old meaning.
The earlier SEFR/CAG2024/25 passenger factors are not mixed into this dataset.
The exact unresolved physical boundary is validation of the retained phone
assessment thresholds and distance methods on real trips. Full greenhouse-gas,
ICE-specific and Singapore fleet-average estimates are outside this release;
those would need different, independently compatible factor evidence.

## Physical field protocol

Use consenting testers and actual iOS and Android phones with the release app
build. Start with the existing candidate thresholds, explicitly unvalidated.
Do not tune them merely to make one trip pass. For each mode proposed for release:

1. Record device/OS/build, policy hash, route provider/version, test time and the
   independent reference used for distance, duration and actual travel mode.
   Use ordinary Singapore routes, including short trips, turns and poor reception.
2. Travel once with another app open and once with the phone locked. Compare
   actual start/arrival and elapsed time with acquired samples and server receipt.
   Measure distance error and missing intervals against the independent reference.
3. Exercise endpoint/accuracy/corridor boundaries, reverse/off-route travel,
   stationary jitter and mode-inconsistent speeds. Record false acceptance and
   false rejection, sample counts and observed error ranges. Choose and document
   acceptance tolerances before accepting results; this procedure invents none.
4. Remove middle samples in a controlled replay of the same captured journey.
   Both recorded endpoints permit only the accepted min(50, expected) fallback.
   Removing either endpoint must give no fallback. Later authentic evidence adds
   only an upward difference. Replays add nothing and lower totals never claw back.
5. Deny/revoke permissions, Stop, go offline, restart and deliver delayed evidence.
   Verify collection stops, original acquisition times survive, duplicate uploads
   do not duplicate credit, and private data expires under the retention policy.
6. For multimodal release, independently record transitions and reference distances
   per leg. Require complete supported attribution, not a few matched sample pairs.
   GPS consistency must never be described as proof of bus/train use.

Produce one concise JSON report per physical platform matching
`physicalReportSchema` in `server/awards/readiness.ts`. Include observations,
counts, failed cases, corrective actions and accepted limits in `findings`.
The reviewer must accept the observations for the exact policy, distance method
and every released mode. No new raw-report format is required beyond this small
binding record and its findings. A
simulator report, missing platform or unsupported mode cannot replace field proof.
Keep raw tracks private and transient; retained reports contain no coordinates,
addresses, account IDs or tokens. Reviewers must inspect the underlying evidence;
a SHA-256 hash establishes content identity, not scientific validity.

## Provisional policy and factor-only configuration

The user approved provisional points from the retained planned route estimate
when recorded start and arrival checks pass. This is `planned-endpoints-v1`,
retained at Start as `awardPolicy: {kind: provisional, version: planned-endpoints-v1}`.
It keeps 50 points/kg, the 2,000-point journey cap, no daily cap and the
min(50, expected) missing-middle fallback. Contradictory evidence, absent endpoints,
unknown factors or applicability do not earn points. Photo preliminary credit and
previous journey credit reduce any later award to its positive difference.

`JOURNEY_FACTOR_RELEASE_FILE` is a trusted local JSON configuration independent
of physical calibration. It contains `factors`, `release` and `evidenceFile`.
`release` contains `version`, `factorFingerprint`, `geographyVersion` and
`factorEvidence` with the same units, boundary, baseline, compatibility and
reference/digest fields as a physical release. The shared validator checks
approved unique factors, exact unit conversion, the declared single-occupant
baseline, gas basis, fingerprint and the factor review file bytes. With no explicit
configuration, the server loads the bundled CAG CO2 factor release. A configured
physical release supplies its own factors; an explicit factor file overrides the
bundled default and must match any configured physical release.
If both files are configured, their factor datasets must match. Physical release
selects the physical variant; otherwise retained reviewed factors select provisional.

`decision.provisional.calculation` is explicitly the planned award estimate.
`decision.provisional.assessedCalculation` is nullable and contains a separate
actual full-assessed estimate only when complete assessed evidence is available.
`decision.full` continues to mean actual assessed distances. Impact may consume
that separate assessed calculation under its approved-factor rules, never the
planned calculation or kilograms inferred from points. Provisional points are
excluded from verified impact. Receipts/history label provisional points and
make no physical calibration, mode verification or measured-carbon claim.
`productionCredit: {kind: provisional, policyVersion: planned-endpoints-v1,
factorReleaseVersion: ...}` and `creditContext: provisional` expose this status.

Route estimates are `{kind: estimated_co2, gas: CO2, unit: kgCO2, kg, factorIds}`.
Recommendations use `recommended_co2`, the same `gas`/`unit`, `avoidedKg`, and
CO2 `estimate`/`baseline` objects. `calculationStatus` remains `indicative_demo`
or `approved`. Legacy `estimated`/`recommended` and `kgCo2e`/`avoidedKgCo2e`
are unchanged. New factors use `gas: CO2`, `unit: kgCO2/passenger-km` and
`kgPerPassengerKm`; legacy factors keep `kgCo2ePerPassengerKm`.

Receipt calculations retain decimal `baselineKg`, `journeyKg` and `savingsKg`.
CO2 calculations add `measurement: {version: cag-surface-access-co2-v1,
gas: CO2, unit: kgCO2}`. Absence means the legacy CO2e contract. Consumers must
branch on the retained measurement and must not sum CO2 and CO2e together.
No old receipt is rewritten or relabelled. Display “Estimated CO2 avoided” for
this new basis with the published-factor caveat; never claim measured savings.

## Runtime and retained contract

`JOURNEY_AWARD_RELEASE_FILE` points to a trusted, deployer-owned JSON file. Omit it
until the review is complete. Invalid configured files fail startup. There is no
HTTP enable flag or client-supplied approval. The file contains:

- `policy`: exact versioned evidence thresholds, calibrated per-mode plausibility
  bounds and `calibration: physical_validated`.
- `factors`: sourced factors in the existing schema, explicitly reviewed and
  normalized to their explicit CO2 or legacy CO2e passenger-km basis.
- `release`: version, assessment engine, canonical policy/factor SHA-256 hashes,
  geography dataset version, supported modes and distance methods, factor review and both platform
  report references/digests. Factor review includes source values/units and
  occupancy. The car baseline must be documented vehicle-km for one occupant in the declared gas basis.
- `evidenceFiles`: local paths for the factor review and physical iOS/Android
  JSON reports. Files are bounded to 1 MiB and their bytes must match the digests.

`fingerprint` canonicalizes object keys and hashes the exact validated content.
Changing thresholds, supported methods or factor content requires a new reviewed
release. The loader validates shape, units, coverage and content bindings. It
cannot decide whether a reviewer told the truth about a field observation.
Release file write access is therefore trusted deployment authority.

Route planning uses the configured reviewed factors from its existing single server
response. Start input remains `requestId` and `captureSessionId`. Start retains
`awardPolicy`, `awardRelease`, `basis.factorRelease`, policy, factor and earning versions. A plan prepared under different factors
cannot become ready through a newer release with mismatching hashes. Active and
historical journeys are never promoted by later deployment configuration.
Legacy records with no release retain their exact unavailable readiness result.

Each receipt retains optional `awardPolicy` and `awardRelease`. Besides the provisional
variant above, `result.productionCredit` is either
`unavailable` with reasons or `ready` with `version: journey-award-readiness-v1`
and `releaseVersion`. Ready additionally requires live provenance, applicable
Singapore geography, exact retained policy/factors, supported modes and eligible
calculation. `outcome.creditContext` is `production`, `production_unavailable`
or `synthetic_test`, plus the explicit `provisional` variant. Ready and provisional
receipts can credit through the public service under their retained policy. Physical report hashes do not make GPS a verified-mode sensor.

Impact's separately approved estimate policy can use recorded full journeys with
approved factors before physical calibration. It does not require points readiness
and must label these as estimates, not verified savings. A fallback's planned
expected calculation cannot become assessed savings. A later full receipt replaces
that journey's contribution; it is not added to a fallback/top-up sum. Points,
manual adjustments and preliminary photo credit are not carbon measurements.

Written by gpt-6-astra through Codex (T3 Code).
