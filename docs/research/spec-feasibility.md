# Specification feasibility research

Research date: 2026-09-25. Scope: Singapore emissions inputs and Convex transaction/authorization constraints for the revised prototype. This is a bounded primary-source review, not an approved factor dataset, implementation, or independent emissions audit. Allowed sources were official LTA, EMA, NEA and Convex documentation; searches located sources and supplied no independent evidence.

## Evidence status

| Dimension | Status | Sample and counting method | Confidence and limits |
| --- | --- | --- | --- |
| Singapore transport factors | Partial | Five official publications/pages inspected: LTA rail article, LTA FY2024 report, LTA fuel guidance, EMA electricity statistics and NEA vehicle-scheme announcement. Checked units, period and applicability. | High confidence in quoted units; insufficient evidence for a compatible bus/rail/conventional-car/EV/cab factor set. No factor approved for app use. |
| Transaction guarantees | Verified platform capability | Three Convex pages: mutations, OCC and actions. Checked transaction scope, concurrency and external-call constraints. | High confidence in documented capability; no app implementation tested. |
| Authorization and demo isolation | Capability verified; app policy unresolved | Two Convex pages: authentication in functions and internal functions. Checked identity access and caller restrictions. | High confidence in documented mechanisms; they do not define this app's roles or demo ownership. |

## Singapore emissions inputs

LTA's 26 August 2022 MRT article gives an approximate 13 g CO2/km train figure and compares it with car travel. The article does not supply the occupancy, reference year or detailed calculation method required to promote that number into the app's approved passenger-distance factor. Its wording is CO2, not CO2e. [LTA MRT article](https://www.lta.gov.sg/content/ltagov/en/who_we_are/statistics_and_publications/Connect/greenmrtstations.html).

LTA's 2024/25 report covers FY2024 and was published on 12 December 2025. Its public-transport section gives sector context and operational targets, rather than a complete compatible table for the five requested travel modes. This review inspected the report text, especially printed pages 25–26; it did not derive passenger factors from aggregate totals. [LTA report, pp. 5 and 25–26](https://www.lta.gov.sg/content/dam/ltagov/who_we_are/statistics_and_publications/report/pdf/LTA_SR2425.pdf#page=25).

EMA reports an average grid factor of 0.402 kg CO2/kWh for 2024, defined per unit of net electricity generation. This is an electricity-generation input, not a per-kilometre or per-passenger EV factor. [EMA Singapore Energy Statistics, chapter 2](https://www.ema.gov.sg/resources/singapore-energy-statistics/chapter2).

NEA's 8 September 2025 announcement specifies 0.4 g CO2/Wh for electric and plug-in hybrid cars under the Vehicular Emissions Scheme through 31 December 2027. That scheme-specific value is distinct from EMA's annual grid value. The announcement's 1.5 multiplier for taxis concerns the vehicle scheme; it is not evidence for multiplying journey emissions by 1.5. [NEA/LTA vehicle-scheme announcement](https://www.nea.gov.sg/media/news/news/index/extension-of-vehicular-emissions-scheme-%28ves%29-and-ev-early-adoption-incentive-%28eeai%29-to-support-vehicle-electrification).

LTA's fuel guidance points to model-specific fuel-economy and CO2 information. It does not establish one fleet-average conventional-car or cab factor for the app. [LTA fuel guidance](https://onemotoring.lta.gov.sg/content/onemotoring/home/owning/ongoing-car-costs/fuel.html).

### Recommendation, not an approved calculation policy

Use repeatable code for arithmetic and points. AI can explain calculated comparisons. Require every usable factor to declare geography, transport mode/fuel, value, unit, source, reference period, occupancy assumptions and emissions coverage. Do not rename CO2 evidence as CO2e or combine unlike measurements without a documented conversion method. These recommendations follow from the different units and purposes of the sources above.

Before selecting numbers, establish:

- Bus and rail passenger-distance factors with compatible coverage and current enough reference periods.
- Whether conventional car means petrol, diesel, a named reference model or a justified fleet average, and the assumed occupancy.
- EV energy consumption per distance, occupancy, electricity-factor year and treatment of charging losses.
- Cab vehicle/fuel assumptions, paying passenger count and whether empty travel is allocated.
- Whether all comparisons cover operational emissions only or a wider lifecycle. The cited sources do not establish a consistent lifecycle set.

These are data and methodology tasks. A user can choose the comparison policy, but should not have to invent the missing scientific inputs. A one-person conventional-car baseline remains a product recommendation; it is not mandated by these sources. Until the dataset is approved, label prepared comparisons as demo estimates and make unavailable estimates explicit.

## Convex constraints

Convex mutations read a consistent database view and commit their writes together; an error rolls back the writes. Mutations must be deterministic and cannot call third-party systems. External routing or AI calls therefore belong outside the committing mutation. Mutation read/write limits also mean an unbounded reset cannot be assumed to fit in one transaction. [Convex mutations](https://docs.convex.dev/functions/mutation-functions).

Convex provides serializable transactions and retries conflicting deterministic transactions. This supports a balance check and deduction in the same mutation. It does not remove the need to define which journey or redemption a request represents. [Convex OCC and atomicity](https://docs.convex.dev/database/advanced/occ).

Actions can have external effects and are not automatically retried on failure. An action that fails after an external request leaves the caller responsible for deciding whether retrying is safe. [Convex actions, error handling](https://docs.convex.dev/functions/actions#error-handling).

Functions can read authenticated identity through `ctx.auth.getUserIdentity()`; unauthenticated calls can return no identity. The application must use that identity to enforce its own ownership and admin rules. [Convex authentication in functions](https://docs.convex.dev/auth/functions-auth).

Internal functions are unavailable directly to ordinary Convex clients, while ordinary public functions are client-callable. Internal functions can still be invoked from the Convex Dashboard or CLI; the restriction is not a substitute for correct invariants or controlled operator access. [Convex internal functions](https://docs.convex.dev/functions/internal-functions).

### Recommended acceptance rules, not implemented guarantees

These proposed rules apply the documented transaction and identity capabilities:

- One-time journey credit: check authenticated owner, demo eligibility and persisted journey-credit status, then write the award, balance and History record in one transaction. Retrying the same journey returns its existing outcome.
- Reward spending: persist a stable operation identifier and original outcome, check balance and current eligibility, then deduct points and record redemption/unlock together. A second intentional purchase must differ from a retry.
- Administrative adjustments: require an admin identity, a reason and the non-negative balance invariant in the committing mutation.
- Demo reset: scope every changed record to the approved demo owner or dataset. Keep shared reward definitions, real-user balances, History and unlocks outside the reset. Define how reset handles in-flight demo requests before implementing it.
- Rule and factor edits: retain the version used for a credited journey. Decide separately when a new version applies to a journey already in progress.

The platform sources support feasibility, not proof of these app rules. Focused implementation checks must attempt concurrent spends, duplicate completion, another user's IDs, fan-originated admin calls, and a reset racing with demo completion.

## Decisions identified at the original research date

Subsequent user answers retain Start journey rule/factor versions; the latest correction sets all initial balances to 0 and chooses one persistent demo profile per signed-in user. The complete calculation policy is explicitly deferred for later review. In-flight reset handling remains open; consult the current specification for governing decisions. The original questions below are preserved as research history.

1. Approve the code/AI division and reference journey. Factor selection remains research work.
2. Define when admin rule/factor changes take effect for an in-progress journey.
3. Define whether the demo account is shared by presenters or isolated per session, and what happens to in-flight operations during reset.

No complete Singapore factor set was established in this bounded review. No Convex deployment, authentication setup, transaction behavior or demo reset was executed. The documents can state these as implementation acceptance conditions, but cannot claim they already work.

## Points and rewards testing follow-up

Checked 2026-09-25 against official Convex testing documentation only. Earlier findings above remain unchanged.

| Dimension | Status | Sample and evidence | Confidence and limits |
| --- | --- | --- | --- |
| Function-level test approach | Documented | Two pages inspected: testing overview and `convex-test`, including authentication and limitations. | High confidence in documented use; no project tests executed. |
| Real-backend setup | Partially verified | Overview confirms this option; its dedicated local-backend link returned HTTP 503. | Detailed setup unverified in this follow-up. |
| Concurrent spend, replay and reset | Unverified | Zero implementation scenarios executed. | A test plan cannot establish application correctness. |

`convex-test` runs the project's Convex function logic against a mock backend. Supply the project schema and function modules, invoke registered functions through `t.mutation` and `t.query`, and use `withIdentity` to exercise different callers. This can test the actual points/rewards module through its interface, rather than duplicating the calculation in a test. Direct database writes through `t.run` are suitable for fixtures, but do not exercise the application's write rules. The mock does not enforce backend size/time limits and its runtime differs from Convex's real runtime. [Convex test documentation](https://docs.convex.dev/testing/convex-test).

Convex separately documents testing backend logic on a real local backend. Recommend supplementing function-level tests with that option for transaction behavior; this follow-up did not verify the setup procedure or execute it. [Convex testing overview](https://docs.convex.dev/testing/overview).

Proposed acceptance checks, not completed tests:

- Submit two distinct purchases that together exceed the starting balance. Check successful redemptions, balance and History together, including under concurrent requests on the real backend.
- Retry the same journey credit or redemption identifier. Check that its original outcome is returned and no second award, deduction or unlock appears.
- Race demo reset against credit and redemption. Check the agreed reset outcome and that real-user balances, History and unlocks remain unchanged.
- Repeat protected operations as an unauthenticated caller, another fan and an authorized admin.

Passing a mock test would establish only the scenarios that test actually exercises. It would not prove real transaction scheduling, deployed identity configuration, recovery after a lost response, or every reset interleaving. The reset policy and replay identity must first be specified so these checks have an agreed pass condition.

## Reset concurrency follow-up

Checked 2026-09-25. Evidence: four official pages rechecked; documented guarantees verified, zero reset scenarios executed. Earlier open-decision lists are historical; the current specification governs confirmed reset policy.

Convex provides serializable transactions and retries conflicts. This does not determine which competing user intent should win. [OCC and atomicity](https://docs.convex.dev/database/advanced/occ). React/Rust mutation queues preserve client ordering; the documentation does not establish one global button-click order across independent clients. [Mutations](https://docs.convex.dev/functions/mutation-functions).

Transaction limits include 16 MiB read, 16 MiB written and 16,000 written documents per mutation. An ever-growing demo history cannot safely require deletion in one reset transaction. [Limits](https://docs.convex.dev/production/state/limits#transactions). Cursor pagination reads incremental pages and supports read bounds; separate page calls do not create one atomic reset. [Pagination](https://docs.convex.dev/database/pagination).

Proposed implementation pattern for the agreed stale-operation policy: keep a reset generation on the demo owner record. Every demo write reads it in its committing mutation and validates the request's expected generation. Reset advances the generation and records the agreed restored balance atomically. A conflicting write is retried against the updated generation; the application then applies its agreed stale-request rule. Generation checks must cover awards, purchases, adjustments and reset itself, including reset retries.

Keep shared contributions, selections, purchased rights, submissions, all point History and required replay outcomes outside disposable generation records. The latest zero-start decision removes the need for spent-starter-point accounting. Scope any later cleanup to explicitly resettable records from older generations, with bounded batches. This pattern separates immediate logical reset from physical cleanup; it does not decide retention, content access or stale-request behavior. Those rules and the complete read/write checks still require implementation tests. No generation design is approved by this research.

Latest product disposition: preserved rewards/History and signed-in demo identity are now settled. The user has now confirmed reset-to-zero and rejection of unfinished pre-reset writes, with completed outcomes retained. The generation mechanism remains an implementation proposal. Earlier open-question lists are research history, not current blockers.
