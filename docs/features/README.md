# Feature specification

The accepted product is split into the 13 features below. These documents own the detailed behavior and acceptance cases; the [main specification](../fan-app-specification.md) owns scope and source precedence. [CONTEXT.md](../../CONTEXT.md) owns terminology.

Status checked 26 September 2026: the repository has implemented backend slices and a native candidate, not only an Expo starter. Accounts, accounting, rewards, submissions, reports and journey server code have scoped evidence. Full native journey verification, production journey credit, personal/community impact, photo activities and hosted AI/report processing remain incomplete. Requirements below are not a claim that every end-to-end flow passes.

## Features

| ID  | Feature                                                 | Fan or admin outcome                                                                        |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| F01 | [Accounts and demo mode](01-accounts-and-demo.md)       | Sign in, resume progress and use a separate persistent demo profile.                        |
| F02 | [Route planning](02-route-planning.md)                  | Compare Singapore routes and balance time and emissions within the extra-time limit.       |
| F03 | [Emissions estimates](03-emissions-estimates.md)        | Compare route emissions against one person driving between the same places.                 |
| F04 | [Real journey tracking](04-journey-tracking.md)         | Record and assess actual travel, including background and locked-phone use.                 |
| F05 | [Points, Rewards and History](05-points-and-history.md) | Earn, receive and spend points with consistent records and no duplicate credits or charges. |
| F06 | [Fan submissions and voting](06-fan-submissions.md)     | Submit questions or activities and spend points toward one shared selection.                |
| F07 | [Tree dedications](07-tree-dedications.md)              | Redeem programme participation under the account name.                                      |
| F08 | [Exclusive content](08-exclusive-content.md)            | Unlock content once and retain access.                                                      |
| F09 | [Merchandise discounts](09-merchandise-discounts.md)    | Redeem admin-priced discount offers.                                                        |
| F10 | [Impact dashboard](10-impact-dashboard.md)              | See personal/community lifetime estimates and separate official team figures.               |
| F11 | [Report upload and review](11-report-ingestion.md)      | Extract report-supported details and approve them before publication in the app.            |
| F12 | [Admin web dashboard](12-admin-dashboard.md)            | Operate rewards, points, submissions, reports, factors and demo reset with assigned roles.  |
| F13 | [Photo activity evidence](13-activity-evidence.md) | Capture and assess sustainable activities with duplicate-safe points and transient photos. |

## How the features fit

- Accounts provide identity and ownership to all personal state.
- Route planning uses emissions estimates. Real journey assessment supplies the result that points and impact use.
- Points and rewards share one backend module for authorized, consistent balance/History/outcome changes. Feature documents do not imply one service or package per feature.
- Reward spending can be delivered using admin-granted points before real journey awards are ready.
- Admin controls ship with the fan flow they operate. The complete admin dashboard does not block every feature.
- Report review supplies approved official figures independently of app travel estimates.

## Implementation tracker

[GitHub tracker #3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3) groups 19 implementation issues with native parent and blocking links. Each issue includes its own acceptance criteria, prerequisites and worktree handoff notes.

The initial independent tasks are [account sign-in #4](https://github.com/NachikethReddyY/AMR-Fan-App/issues/4) and [Singapore route comparison #6](https://github.com/NachikethReddyY/AMR-Fan-App/issues/6). Use one issue per worktree and integrate prerequisites before starting a blocked issue. Coordinate shared navigation, points interfaces, dependencies and lockfile edits between worktrees. No worktrees or application changes were created by the documentation/tracker task.

## Remaining implementation work

These items do not block the feature breakdown. Resolve them before implementing their affected behavior; they are not silently approved defaults.

| Affected features        | Work or decision still needed                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and admin       | Supabase email/password auth and Render Free backend are selected; complete integrated native signup/signin and assigned-admin acceptance. |
| Routes and estimates     | Configure Google Routes access, validate factor applicability and integrate Jev preference ranking within the hard time limit. |
| Real journeys and points | Measure endpoint/route quality thresholds, interruption/offline handling and seven-day trace cleanup; verify both physical platforms. Only upward late-evidence top-ups are agreed. |
| AI and reports           | Confirm the integration contract, permitted source report, supported formats, field schema, upload limits and extraction provider.                                                  |
| Rewards and screens      | Select detailed presentation, content and demonstration offers. Actual merchant/tree/driver fulfilment remains later work.                                                          |

The final interview confirmed the single-driver baseline, fastest-route time reference, difference-only late-GPS top-ups and personal/community lifetime totals. No further product question is required to organize the accepted scope. Future implementation may expose a new decision; ask then rather than inventing it.

## Verification and status

Each feature has observable acceptance cases. They are requirements for future implementation, not claims of tests already passing. The split retains all 69 cases from the previous active specification and adds cases for the newly confirmed rules and previously implicit reward protections.

Photo activity assessment with a short description entered current scope on 26 September 2026; see F13 for the accepted rules and unimplemented boundaries. Video/audio, campaigns, leaderboards and a chatbot/voice assistant remain future proposals. Historical race-only travel restrictions do not apply to ordinary travel.
