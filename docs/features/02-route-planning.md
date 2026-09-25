# Route planning and recommendations

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

A fan chooses a start and destination, compares available routes and finds the lowest-emission route within their extra-time limit.

## Accepted behavior

- Support Singapore first, including ordinary destinations and race destinations. Ordinary journeys need no race selection or race-weekend window.
- Obtain candidates from the intended Google Maps integration or explicitly labelled demo fixtures. A model cannot invent routes.
- Normalize legs, mode, distance, duration and availability. Compare bus, train, conventional car, electric car and cab where available; retain walking/cycling where supported. Keep driving available even when it earns no sustainability points.
- Compare route duration and the estimates from [emissions estimates](03-emissions-estimates.md). Make missing routes or factors visible; do not turn unknown data into zero emissions.
- The extra-time reference is the fastest available candidate. Add the fan's allowed extra minutes to that duration, then recommend the route with the lowest estimated emissions among candidates inside the limit.
- Example: fastest route 30 minutes plus 10 allowed minutes means candidates must take no more than 40 minutes. A cleaner 45-minute route cannot be recommended under that setting.
- AI may rank or explain calculated candidates within this policy. It cannot override the time limit or approved emissions calculation. Use calculated values and reason codes in explanations, with a deterministic fallback when the model is unavailable.

## Depends on

The route-provider contract and [emissions estimates](03-emissions-estimates.md). Compare route durations first; add the emissions recommendation when compatible factors are available.

## Before implementation

Verify provider access, Singapore mode coverage and units. Define how to break equal-emissions ties and how to present missing estimates without silently changing the confirmed time limit. Agree the AI input/output contract and accepted route-screen design.

## Acceptance cases

| Scenario                                                                               | Expected observation                                                                                                    |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Fan enters an ordinary non-race destination                                            | Route planning accepts it within supported coverage.                                                                    |
| Fan changes acceptable extra travel time                                               | Recommendation remains within the chosen tolerance and minimizes estimated emissions among qualifying candidates.       |
| Fastest route is 30 minutes and tolerance is 10; candidates take 35, 40 and 45 minutes | Recommend the lowest-emission eligible candidate taking 35 or 40 minutes; the 45-minute candidate is outside the limit. |
