# Emissions estimates

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

Fans see comparable estimated emissions and estimated savings for real route candidates, with a disclosed comparison baseline.

## Accepted behavior

- The confirmed baseline is one person driving a conventional car between the same starting point and destination. Calculate that driving route; do not assume a public-transport route has the same distance.
- Calculate journey emissions from route-leg distances and sourced, versioned country/mode factors with compatible units. Sum the applicable legs and compare the result with the baseline.
- Show the baseline beside "estimated CO2e avoided". These are estimates, not measured savings, verified carbon offsets or proof of a causal reduction. "CO2 cost" means emissions here, not ticket fare.
- Start with Singapore-specific inputs for bus, train, car, electric car and cab, retaining supported walking/cycling. Record geography, mode, unit, source, reference/effective period, method, assumptions and demo/approved status.
- Missing factors make the estimate unavailable unless a separate disclosed fallback has been approved. Never invent a zero or a model-generated factor.
- Retain the factor and earning-rule versions selected at Start journey. Active journeys finish using those versions; later admin edits apply to new journeys and do not recalculate historical awards.
- Deterministic code owns emissions and accountable totals. AI may extract candidates for review or explain the calculated results; it cannot decide emissions, eligibility, points or balances.
- Keep planned route estimates, simulated journeys and completed real travel distinct.

## Depends on

Normalized route candidates from [route planning](02-route-planning.md). [Points and History](05-points-and-history.md) applies earning rules to the assessed estimate; this feature does not mutate balances.

## Before implementation

Research and verify numerical Singapore factors, passenger/vehicle units, fuel and occupancy assumptions, electricity treatment and compatible CO2/CO2e coverage. No numerical factor is approved by this document. Define calculation precision, display rounding and whole-point rounding before the first calculated award. The baseline itself is settled.

The existing [feasibility research](../research/spec-feasibility.md) records methodology and its limits. Choosing a dataset is implementation research, not a request for the user to supply facts.

## Acceptance cases

| Scenario                                                                        | Expected observation                                                                                                  |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Fan compares routes in a supported country                                      | Bus, train, car, electric car and cab estimates use that country's applicable data where those options are available. |
| A country's mode factor is missing                                              | The corresponding estimate is unavailable or uses a separately approved, disclosed fallback. Zero is not invented.    |
| Admin changes an emissions factor while a journey is active                     | Complete the active journey using the factor version retained at Start journey.                                       |
| Sourced arithmetic fixture has a 5 kg single-driver baseline and a 2 kg journey | Show 3 kg estimated CO2e avoided and disclose the same-endpoint baseline; this is a fixture, not a real route claim.  |

## Server calculation candidate

The server reuses the exact reviewed PR26 calculation modules and tests, including
finite aggregate checks. Factor IDs, source URLs, periods, passenger-kilometre
units and assumptions remain in the result. CAG FY2024/25 car/bus/MRT factors
are indicative demo estimates, not approved real-journey award factors. The
walking/cycling factors cover operational travel only. Cab/EV factors remain
unselected. The [server source record](../operations/routes.md) pins module
lineage and the official planning-area dataset used for conservative Singapore
applicability. Unsupported geography or transit factor categories remain
unavailable even when a route can be shown.

The fastest valid available route sets the time reference. Exact seconds and
unrounded emissions determine eligibility. Equal emissions use shorter duration,
then stable route ID. The conventional-car baseline uses its own summed leg
distance for the same requested endpoints. Missing geography or a baseline
withholds the recommendation without changing route availability. No AI, points
rounding, persistence or journey award is introduced by this candidate.

The [production release procedure](../operations/journey-award-release.md) records
primary SEFR source candidates, the unresolved single-driver/boundary gap and the
server-only factor evidence contract. No numerical dataset has been promoted by
this change; published defaults remain indicative.

Reviewed factors can be configured independently of physical award release. Impact
uses actual full-assessed distance estimates; provisional points use a distinct
retained planned estimate. Neither is measured carbon or verified avoided emissions.

## Accepted CO2 factor variant, 26 September 2026

The user accepted CAG FY2023/24 published surface-access factors for clearly
labelled CO2 estimates and provisional points: .1901 car vehicle-km, .0441 bus
passenger-km and .0578 MRT passenger-km, with a neutral single-occupant car baseline.
This version supersedes the ICE/CO2e requirement only for this explicit variant.
It makes no ICE-specific, Singapore fleet-average, lifecycle or all-GHG claim.
The source's original CO2e labels remain discrepant provenance; the application
uses CO2 with the disclosed CO2-focus limitation. Walking/cycling zero is only
motorized operational energy, excluding food, manufacture and infrastructure.
Legacy CO2e records retain their units. See the [release contract](../operations/journey-award-release.md)
for exact gas/unit fields, retained evidence and the physical validation boundary.
