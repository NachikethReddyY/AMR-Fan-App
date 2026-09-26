# Journey award release evidence

This is the release procedure for the evidence-backed server path. No physical
calibration report or approved numerical factor release is shipped. Defaults
continue to retain calculations without issuing production journey points.
The [award rules](../features/05-points-and-history.md) remain unchanged.

## Evidence status, 26 September 2026

| Dimension | Status | Sample and method | Evidence and limits |
| --- | --- | --- | --- |
| Singapore factor values | Candidate values found | Primary SBF SEFR slide, CAG report | Passenger-kilometre values do not establish one-driver occupancy or compatible boundaries. |
| Single-driver baseline | Blocked | Reviewed car units in those two sources | Need conventional ICE vehicle-km factor or documented conversion to one occupant. |
| Physical calibration | Unverified | Zero real trips in supplied handoffs | Simulator UI/camera proof cannot establish GPS thresholds or distance validity. |
| Ready/no-credit policy | Synthetic tests | Retained release versus changed policy, factor, geography, mode and endpoints | Tests prove code decisions, not truth of external evidence. |
| Ledger integration | Passed with synthetic factors | 58 isolated PostgreSQL/HTTP tests | Public physical/provisional credit, replay, top-ups, photo deductions and ownership checked; no field or real-factor approval. |

Confidence is high for the inspected units and missing handoff evidence. The
research is a bounded source review, not an exhaustive search of all datasets.

## Exact factor gap and next source work

[SBF's April 2025 member orientation, PDF page 55](https://www.sbf.org.sg/docs/default-source/membership/members-orientation/member-orientation-slides-april-2025.pdf#page=55)
shows SEFR 2022 values in kg CO2-equivalent per passenger-km: ICE car 0.17,
hybrid 0.13, battery-electric car 0.06, public bus 0.07 and train 0.01.
The slide does not supply occupancy, calculation boundary or electricity details.
[SBF's registry launch](https://www.sbf.org.sg/newsroom/media/press-releases/detail/sbf-launches-singapore-emission-factors-registry-and-an-industry-led-resource-portal-to-accelerate-businesses-net-zero-transition)
identifies SEFR as Singapore-specific data developed with A*STAR. Direct registry
retrieval returned HTTP 403 on this review. The selected next source is the
underlying SEFR land-transport records and methodology, not its slide screenshot.

The existing [CAG FY2024/25 report](https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf)
remains an indicative planning source. A passenger factor cannot be relabelled
vehicle-km, nor can multiplying by guessed occupancy establish the single-driver
baseline. CAG's older vehicle-km table does not by itself establish compatible
fleet, period and boundary with newer passenger factors. No such mixture is released.

Obtain the primary source record for each selected mode, reference period,
Singapore scope, whether it includes combustion CH4/N2O and electricity generation,
upstream fuel/electricity coverage, vehicle/fuel mix, occupancy and conversion.
The factor review must reconcile a common use-phase CO2e boundary for the
conventional single-occupant car, bus, train and any enabled EV/cab factors.
Operational walk/cycle zero excludes food, manufacture and infrastructure; it
can join only a compatible use-phase comparison. Do not substitute a CO2-only
value for CO2e without a documented justification. Unknown modes remain unavailable.

Engineers can complete this source review with an accessible official registry
export or primary methodology; the user need not choose numerical factors.
The approved provisional policy below still requires this factor review. It does not require physical GPS calibration.

## CAG FY2023/24 alternative under technical review

[CAG FY2023/24, printed pages 88–90](https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024/rediscovering-the-magic-of-travel.pdf#page=90)
publishes a coherent surface-access table: privately owned car 0.1901
kgCO2e/vehicle-km, public bus 0.0441 and MRT 0.0578 kgCO2e/passenger-km.
For a one-occupant car comparison no occupancy conversion is required. The report
does not identify that car row as ICE-only or as a Singapore fleet average.
Its methodology states a CO2 focus despite the table's CO2e labels.

The three numbers match the CO2-only column in its cited
[US EPA June 2024 Table 10, PDF page 6](https://www.epa.gov/system/files/documents/2024-02/ghg-emission-factors-hub-2024.pdf#page=6):
0.306, 0.071 and 0.093 kg per vehicle/passenger-mile divided by 1.609344
and rounded to four decimals. EPA lists methane and nitrous oxide separately.
This numerical source match is an inference, since CAG does not map references
per row. It supports the CO2-focus caveat, not a claim of complete CO2e coverage.
Do not add EPA gases to CAG's values or mix them with newer SEFR passenger factors.

The later user question concerns an explicitly labelled estimated CO2 avoided
basis using the CAG surface-access values and neutral one-occupant car baseline,
with the published label and CO2-focus discrepancy disclosed. An accepted CO2
variant must retain its own unit/version; existing kgCO2e receipts cannot be relabelled. This is under independent
technical review. The current release schema's ICE and use-phase-CO2e assertions
must be revised before it could honestly represent that alternative. No dataset
is activated by this research note.

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
approved unique factors, exact unit conversion, single-occupant ICE baseline,
fingerprint and the factor review file bytes. No numerical approval is shipped.
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

## Runtime and retained contract

`JOURNEY_AWARD_RELEASE_FILE` points to a trusted, deployer-owned JSON file. Omit it
until the review is complete. Invalid configured files fail startup. There is no
HTTP enable flag or client-supplied approval. The file contains:

- `policy`: exact versioned evidence thresholds, calibrated per-mode plausibility
  bounds and `calibration: physical_validated`.
- `factors`: sourced factors in the existing schema, explicitly reviewed and
  normalized to kg CO2e/passenger-km.
- `release`: version, assessment engine, canonical policy/factor SHA-256 hashes,
  geography dataset version, supported modes and distance methods, factor review and both platform
  report references/digests. Factor review includes source values/units and
  occupancy. The car baseline must be documented kg CO2e/vehicle-km for one occupant.
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
