# Real journey tracking

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior. A local server lifecycle and prototype evidence
assessment are implemented; authenticated HTTP registration and native collection
remain pending. Physical-platform acceptance below has not been executed.

The [server journey procedure](../operations/journeys.md) records persisted
ownership, retry, evidence, retention and test interfaces. Its versioned
prototype rules can return positive or negative assessments independently of
their explicit unvalidated calibration and fixture/live provenance. They do not
grant awards or establish physically verified travel.

## Outcome

A fan starts a real journey, travels with the phone locked or another app open, and receives an assessed journey outcome at arrival.

## Accepted behavior

- Native location collection and physical iOS/Android proof are required in the POC. Foreground-only tracking or simulated playback cannot satisfy this requirement.
- Explain location collection, obtain scoped consent, provide Start journey and Stop tracking controls, and collect location only during an active journey.
- Assess route adherence, recorded start/arrival, distance, duration and reported-mode plausibility. GPS alone cannot prove bus or train use.
- Preserve sparse collection, private paths, data minimization and a deletion policy. The earlier seven-day raw-trace retention direction remains; define and verify its cleanup timing and coverage before using real traces.
- Missing evidence remains explicit. The fallback and later-evidence rules are owned by [points and History](05-points-and-history.md). A fallback award cannot mark the journey verified.
- Later evidence must belong to the same journey. An accepted reassessment can support the agreed difference-only top-up while retaining the original fallback record.
- Preserve the journey's starting rule/factor versions. A changing provisional estimate affects that journey's estimate, not previously earned points.

## Depends on

[Accounts](01-accounts-and-demo.md), a selected route and the factor/version record. The first tracking slice can record an outcome before automatic awards are connected.

## Before implementation

The local server prototype uses explicitly unvalidated manager-approved candidates:
50 m maximum accuracy uncertainty, 100 m endpoint containment and route corridor,
30 s endpoint freshness and a 120 s continuity gap. It requires server-acknowledged
Start and retains original acquisition/finish times for offline delivery. Precise
data expires no later than seven days after acquisition; retries do not extend it.
These are configurable retained rules, not physical calibration results. The
operations procedure states current interruption and cleanup coverage/limits.

Measure platform behavior before accepting these thresholds for actual travel.
Test permission denial, background travel, locked phones, missing samples and
stopping collection on both physical platforms. Native queues, backup cleanup
and numerical mode-plausibility calibration remain pending. Later #9 owns award
authority and acceptance of rule versions; #8 does not calculate or grant points.

## Acceptance cases

| Scenario                                                                                  | Expected observation                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fan starts a real journey, travels with the phone locked or another app open, and arrives | Location evidence supports assessment and a recorded journey outcome on each supported physical platform. A simulated replay cannot satisfy this check. |
| Start or arrival was not recorded                                                         | Do not grant the GPS fallback; the accepted prerequisite is missing.                                                                                    |
| The fan stops tracking or denies required permission                                      | Stop or do not begin collection; retain a truthful incomplete/insufficient-evidence outcome and apply the documented award eligibility rules.           |
