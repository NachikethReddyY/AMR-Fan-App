# Personal, community and team impact

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: contribution read API and phone bindings implemented locally. Synthetic database tests prove the read model; real populated travel and native rendering remain unverified.

## Outcome

Impact shows the fan's lifetime estimated savings, all fans' combined lifetime estimated savings, and official team figures separately.

## Accepted behavior

- Personal and community travel totals use qualifying real journeys over recorded lifetime activity and the confirmed single-occupant car baseline. Show them as estimated CO2 avoided, with the calculation method and period.
- Keep real activity, labelled demo examples and official team results distinguishable. Simulated travel, fallback points without sufficient evidence, admin point grants and reward spending do not establish real avoided emissions. Do not convert points or tree dedications into extra savings.
- Include an eligible journey once. Later accepted location evidence updates the same journey's contribution; its point top-up is not a second journey. Keep insufficient-evidence journeys separate until they qualify for the real-journey total.
- Official team metrics come only from approved sourced records. Preserve source document/evidence location, unit, reporting period, method, result/target/cumulative/estimate meaning, reviewer and approval time.
- Official figures retain their own report periods; do not combine them with lifetime app estimates. Pending or rejected extraction never appears as an official fact.
- If report extraction fails, keep previously approved records visible. A seeded personal example does not claim inclusion in the team's annual report.

## Depends on

[Journey tracking](04-journey-tracking.md), [emissions estimates](03-emissions-estimates.md), and [report ingestion](11-report-ingestion.md) for official figures. The app totals and official-report views can be delivered separately.

## Before implementation

Agree the metric layout using report-supported fields and the accepted visual direction. Define supported metric categories and compatible aggregate units with the first report. The personal/community scope and lifetime period are settled; report gaps remain visible rather than invented.

## Acceptance cases

| Scenario                                                                    | Expected observation                                                                                                |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Team updates populated dashboard records                                    | Dashboard displays the applicable stored records after authorized admin edits.                                      |
| A fan sees a personal travel estimate beside a team ESG figure              | Labels preserve the distinction between personal demo activity and team-reported outcomes.                          |
| Fan A has qualifying journeys estimated at 2 and 3 kg saved; fan B has 4 kg | Show 5 kg personal lifetime savings for A and 9 kg community lifetime savings, with official team figures separate. |
| A qualifying journey request is replayed or receives a points top-up        | Include its assessed emissions contribution once in the lifetime total; do not add points as emissions.             |
| Demo activity, admin points or an unverified fallback exists                | Keep demonstration or insufficient-evidence activity separate; it cannot inflate real-journey lifetime savings.     |

## Contribution read model

The phone reads `GET /v1/profiles/:profileId/impact` with its account session.
Personal totals require ownership even for an admin. Community results contain
aggregate totals and emissions-factor references, without account names, profile
IDs, journey IDs, locations or timestamps. Official team figures retain their
separate approved-report endpoint and reporting periods.

The lifetime read uses the latest retained award assessment for each finished
real-profile journey in one database snapshot. An assessment replay or later
points top-up never adds another journey. The receipt must match the current
journey assessment version and revision in that snapshot. Newer evidence leaves
the journey excluded as `assessment_pending` until settlement replaces its
receipt; this GET never settles it. Savings come from the receipt's exact
CO2 calculation, never from points, reward purchases, photo activity or tree
participation. Fixture journeys and demo profiles cannot establish real travel.

The response distinguishes no qualifying activity (`empty`), blocked evidence or
calculation (`unavailable` with reasons), and a qualifying estimate (`available`
with an exact decimal in kg CO2). Zero appears only for a qualifying zero-saving
journey. A partial available total discloses how many recorded journeys remain
excluded for insufficient evidence or unavailable calculation data. Network and
authorization errors never become zero. Factor source URLs, versions, reference
periods, methods and assumptions accompany available totals.

Display eligibility is a server-owned policy independent of points credit. The
accepted policy allows clearly labelled estimates before real-world calibration
when the retained receipt has a full assessed calculation, explicit CO2 measurement
and approved factors for every used mode. Fallback planned-route estimates never count. The response
discloses unvalidated estimates per receipt; it does not claim verified savings,
physical validation or automatic points. A stricter readiness policy remains a
separately tested server option, not an HTTP input. The accepted CAG dataset and
factor-release configuration belong to the journey owner. Deployment activation
is explicit and waits for compatible clients. Synthetic configured-policy totals
prove the read model, not physical travel.

Home and Impact preserve the accepted layout and expose loading, sign-in, empty,
unavailable and populated states. Impact permits refresh and shows the
single-driver same-endpoint baseline, lifetime period and source disclosure.
Rendered native behavior remains unverified until coordinated device proof.

The read fails closed after 10,000 finished live records or a five-second scan
budget. Each fetch uses the remaining database statement timeout. This limit
returns an error, never a truncated lifetime total; larger deployments need a
separately reviewed persisted aggregate. Evidence-rejected finished journeys
remain unavailable and count among excluded records beside a partial estimate.

## CO2 receipt compatibility

The accepted display is "Estimated CO2 avoided" with `unit: kgCO2`. Only the
versioned `cag-surface-access-co2-v1` measurement participates. A missing
measurement remains legacy CO2e and is excluded as `incompatible_measurement`;
its stored receipt is neither changed nor relabelled. Mixed records produce only
the compatible CO2 total and count incompatible records among exclusions.

`decision.full.calculation` is assessed. A provisional receipt can contribute
only its nonnull `assessedCalculation` under the same evidence and factor rules;
its planned `calculation` and points never contribute. Provisional or unavailable
production credit remains `unvalidated_estimate`; only a ready physical release
uses `reviewed_release`. Display does not award points or require a physical release.

Retained factor fingerprints bind the factor review. Source disclosure includes
release version, factor value, interpreted unit, original published unit and
occupancy. The CAG values are .1901 kg CO2/vehicle-km for a neutral one-occupant
car, .0441 kg CO2/passenger-km for bus, and .0578 for MRT. Their published CO2e
labels remain visible as discrepant provenance. Scope is published surface access,
not an ICE-specific, Singapore fleet-average, all-greenhouse-gas or lifecycle claim.
Official team report units and approval rules remain independent.
