# Route planning and recommendations

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan chooses a start and destination and compares routes that balance travel time and estimated emissions within their extra-time limit.

## Accepted behavior

- Support Singapore first, including ordinary destinations and race destinations. Ordinary journeys need no race selection or race-weekend window.
- Use OneMap for the first live Singapore build, including address search and walking, cycling, driving and public-transport routes. Keep Google integration disabled unless separately authorized with verified billing controls. Explicitly labelled fixtures remain available for tests. A model cannot invent routes.
- Normalize legs, mode, distance, duration and availability. Compare bus, train, conventional car, electric car and cab where available; retain walking/cycling where supported. Keep driving available even when it earns no sustainability points.
- Compare route duration and the estimates from [emissions estimates](03-emissions-estimates.md). Make missing routes or factors visible; do not turn unknown data into zero emissions.
- The extra-time reference is the fastest available candidate. Add the fan's allowed extra minutes to that duration. Recommendations must stay inside that limit.
- Example: fastest route 30 minutes plus 10 allowed minutes means candidates must take no more than 40 minutes. A cleaner 45-minute route cannot be recommended under that setting.
- Jev may rank a substantially faster route above a slightly cleaner route, showing the calculated time, emissions and potential points trade-off. Walking or cycling may suit short trips; public transport may suit longer trips. The model ranks actual candidates, not invented routes.
- Code owns emissions, points estimates and the time limit. A ranking score is not a measured probability of successful travel. Explanations must agree with the supplied values. If Jev is unavailable or returns an invalid candidate, use the lowest-emission eligible route with deterministic ties and disclose the fallback.

## Depends on

The route-provider contract and [emissions estimates](03-emissions-estimates.md). Compare route durations first; add the emissions recommendation when compatible factors are available.

## Before implementation

Verify provider access, Singapore mode coverage and units. Define how to break equal-emissions ties and how to present missing estimates without silently changing the confirmed time limit. Agree the AI input/output contract and accepted route-screen design.

## Acceptance cases

| Scenario                                                                               | Expected observation                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Fan enters an ordinary non-race destination                                            | Route planning accepts it within supported coverage.                                                                    |
| Fan changes acceptable extra travel time                                               | Recommendations remain within the chosen tolerance and show their calculated trade-offs. |
| Fastest route is 30 minutes and tolerance is 10; candidates take 35, 40 and 45 minutes | Rank eligible candidates taking 35 or 40 minutes; never recommend the 45-minute candidate under that setting. |
| A faster eligible route earns slightly fewer estimated points | Jev may rank it first with an explanation of the actual time and points difference. |
| Jev supplies an unknown route, altered numbers or no valid answer | Reject that output and use the deterministic eligible-route fallback. |

## Server provider candidate

The independent server candidate accepts ordinary address or global-coordinate
queries for Google DRIVE, TRANSIT, WALK and BICYCLE. Actual returned steps define
bus/train modes; a preference does not guarantee either. Cab and electric-car
availability are not invented from DRIVE. Missing credentials, mode coverage,
geometry and factors remain explicit unavailable outcomes. See [server route
operations](../operations/routes.md) for authentication, strict schema, spend
bounds, returned journey evidence and exact reviewed pure-module lineage.

The provider and calculation proof uses labelled synthetic upstream HTTP data.
Live Google coverage and the held phone UI's platform/accessibility acceptance
remain pending. No journey, points or issue-completion claim follows from this
server candidate.
