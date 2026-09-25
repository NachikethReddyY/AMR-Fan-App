# Personal, community and team impact

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted product behavior; implementation pending. Acceptance cases below are requirements, not executed tests.

## Outcome

Impact shows the fan's lifetime estimated savings, all fans' combined lifetime estimated savings, and official team figures separately.

## Accepted behavior

- Personal and community travel totals use qualifying real journeys over recorded lifetime activity and the confirmed single-driver baseline. Show them as estimated CO2e savings, with the calculation method and period.
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
