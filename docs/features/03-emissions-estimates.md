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

## Issue #7 implementation choice and source boundary

The route comparison uses indicative factors from [Changi Airport Group's FY2024/25 annual report, annex on GHG quantification, printed page 86](https://www.changiairport.com/content/dam/changiairport/common/pdf/publications/2024-25/cag-ar-2024-25-beyond-boundaries-transforming-tomorrow-oct.pdf). Its Singapore surface-access table lists conventional combustion car at 0.1700, public bus at 0.0700 and MRT at 0.0100 kg CO2e per passenger-km. The report lists ACI ACERT 7.0, the Singapore Emission Factors Registry and UK DESNZ 2024 among its sources. It does not identify which source supplies each surface-access number or state each occupancy assumption. These are disclosed, versioned **indicative demo estimates**, not approved factors for real journey awards or official team figures. They apply only to Singapore routes in this implementation.

Each leg uses its own distance in metres, converted to passenger-kilometres, multiplied by its mode factor. Provider route totals can differ from summed steps, so calculation uses summed leg distances while time limits use the normalized route duration. Walking and cycling have zero *operational travel* emissions in the [LTA Land Transport Master Plan 2013 comparison, figure 9](https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/master-plans/pdf/LTMP2013Report.pdf); this excludes food, vehicle manufacture and infrastructure. An electric-car or cab leg has no selected compatible factor here, so its route remains selectable but its emissions estimate is unavailable. Unknown factors never become zero. The driving comparison uses the fastest valid conventional-car candidate's **own** summed leg distance for the same requested endpoints and one traveller. If no such driving route or factor is available, avoided emissions and the recommendation are unavailable.

The calculation retains unrounded kg CO2e and the factor IDs used for each leg. The Travel view shows two decimal places for kilograms and rounds seconds to whole minutes for labels; time-limit checks use exact seconds. The fastest valid available route sets the time reference even if its emissions factor is missing. A candidate qualifies at or below fastest duration plus the fan's whole extra minutes. Among candidates with complete estimates, lowest unrounded emissions wins; equal emissions use shorter duration, then stable route ID. If none qualifies with a complete estimate, the view says so while preserving route availability. The deterministic text uses only calculated values. The UI makes no points or journey award claim, and no AI service is called.
