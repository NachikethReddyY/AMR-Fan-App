# Specification clarity review

Date: 25 September 2026. Outcome: the product direction is clear; the specification is not ready for end-to-end implementation without further decisions. Account setup and independent data research can be scoped separately.

## Current review: zero-start persistent demo profiles

The latest three answers settle starting balances, demo identity and preserved reset records. They replace earlier seeded-balance examples. Ordinary rewards rules are clear enough for scoped implementation planning. Reset execution and module responsibility are confirmed; the full product remains dependent on deferred calculation/ESG decisions.

| Dimension | Status | Sample and counting method | Evidence, confidence and limits |
| --- | --- | --- | --- |
| Feature scope | Recorded | 18 current inventory rows | Current specification and interview; high confidence in recorded intent. |
| Acceptance examples | Written, not executed | 51 rows counted in the current table | Includes zero-start, return-visit and retained-rights cases; runtime behavior unverified. |
| Latest decisions | Recorded | All 3 answers checked across spec, plan, glossary and module discussion | High confidence; the following consolidated answer confirms zero-reset arithmetic and unfinished-operation behavior. |
| Reset policy | Confirmed | 4 scenarios below | Identity/retention settled; execution policy accepted. |
| Module design | Responsibility confirmed | 1 selected future module; 4 ordinary interface responsibilities plus reset | Starter code provides no implemented domain behavior to deepen or test. |
| Deferred decisions | Explicit | Calculation policy and ESG totals | User-deferred, not reopened. |

Sources and tools: local Markdown, the prior bounded runtime inspection and primary-source Convex research. Verification checks document agreement, examples and links; it does not establish application correctness.

| Scenario | Current contract |
| --- | --- |
| New real account or demo profile | Starts at 0; illustrative data creates no spendable points. |
| Returning signed-in demo user on another device | Resumes the same profile and balance without starter credit. |
| Demo earns/receives 1,000, buys content for 400, contributes 300, then resets | Content, submissions, History, 300 votes and selections survive. Append -300 and leave 0. |
| Reset overlaps an unfinished journey or purchase | Preserve committed outcomes; cancel unfinished journeys, reconfirm purchases and reject late pre-reset writes. |

The proposed points/rewards module keeps balance, History, reward outcomes and reset consistent through one authenticated interface. This gives accounting rules locality and gives fan/admin callers leverage. No separate wallet per screen, generic adapter or new package is justified by the starter. Future tests must cross this interface and observe balances, rights and shared rankings together.

A reset generation is one possible implementation detail described in the research note. It does not replace a product decision or prove concurrent requests are safe. All reset tests remain to be implemented.

The user accepted the consolidated zero-balance reset, unfinished-operation behavior and module responsibility. This closes the points/rewards interview; it does not approve implementation or the deferred calculation/ESG policies. Earlier review sections below are historical and superseded wherever they refer to seeded starting balances, anonymous sessions or unanswered questions now settled.

## Historical review: rewards and seeded reset

Rechecked all five rewards answers and the reset follow-up against the specification and module discussion. History, repeated purchases, shared rankings, disabled offers and correction records are now settled. Shared-ranking reset retains contributions and restores only unspent starting points, without replenishing starting points already contributed. Personal balances/history remain independent; ranking effects are intentionally shared.

Confidence is high for the recorded decisions; application behavior remains unverified. The remaining gaps are demo-session lifetime/retention, in-flight reset details and final interface confirmation. Journey calculations and ESG totals are explicitly deferred. Earlier findings below are dated review history, not a request to reopen settled choices.

## Historical review: points and rewards selected

Scope: rechecked the latest three product answers and architecture selection against the active specification, plan and glossary. This status supersedes older findings below; confidence is high for recorded intent, with application behavior still unverified.

| Dimension | Current status | Evidence and limit |
| --- | --- | --- |
| Calculation policy | Explicitly deferred | User says TBD, review later. No recommendation promoted to agreement. |
| Pending reward prices | Resolved | Changed price must be displayed and reconfirmed; completed purchase prices stay unchanged. |
| Selected challenges | Resolved | Contributions and reselection freeze until admin performance or backlog release. |
| Architecture direction | Selected | Points and rewards module; proposed discussion in [module design](points-rewards-design.md), no implementation approval. |
| Remaining rewards clarity | Partial | Five independent questions cover History, repeats, ranking isolation, disabled offers and corrections. |
| Full-build readiness | Not complete | Deferred calculation/ESG work and remaining rewards/session policies are explicit. |

The established primary-source research remains applicable. No new factor dataset is assumed. The prior code inventory remains unchanged, so no new scan or refactor recommendation is needed. The original temporary HTML report is a historical review snapshot.

## Follow-up status after the six answers

Scope: rechecked all six answers against the updated spec, plan, glossary and decision record. The table below supersedes the original findings where noted. High confidence in the document changes; no application behavior was tested.

| Dimension | Current status | Sample, evidence and limits |
| --- | --- | --- |
| Journey rule versions | Resolved | Q1; start versions retained, new journeys use updates, historical awards unchanged. |
| Demo ownership and real-account rewards | Resolved product direction | Q2–Q3; independent demo progress and admin-granted real-account spending. Anonymous session lifetime and in-flight reset handling remain open. |
| Tree participation | Resolved demo scope | Q4; account name/admin price, no quotes or country reassignment. Real allocation remains later work. |
| Challenge selection and resubmission | Resolved rules with one remaining exception | Q5–Q6; explicit admin close, positive totals, up to three, approval-time ties, paid resubmission. Already-selected challenge handling remains open. |
| Acceptance formatting | Repaired | All 33 current written acceptance cases now form one table. These are specification cases, not executed tests. |
| Calculation and dashboard metrics | Still open | Calculation policy awaits confirmation; factor data remains incomplete; dashboard totals remain user-deferred. |
| Architecture exploration | Awaiting selection | Three speculative module candidates; no interface or code refactor approved. |

The spec, plan, glossary and decision record were updated for the six answers. Historical sections were preserved unchanged. The temporary HTML report remains a snapshot of the original review, not this follow-up status.

## Original review scorecard

Method: qualitative status, not a percentage or ranking. Inspected all 18 current feature-inventory entries, all 23 written acceptance examples, all 32 glossary terms, all 12 current work packages and the labelled historical sections. Compared these with the user's recorded answers. Allowed sources: named local documents and code, plus official primary sources for feasibility. No hidden benchmark or public-answer evaluation is involved.

| Dimension | Status | Sample and counting method | Evidence | Confidence and limits |
| --- | --- | --- | --- | --- |
| Product scope | Clear | All 18 current inventory entries | [Spec](fan-app-specification.md), current inventory | High for recorded intent; current means before the historical marker. |
| Current source of truth | Partial | 2 active documents, each with a superseded body | Spec historical section starts at line 122; plan at line 54 | High. Precedence is explicit, but repeated old mandatory wording increases handoff risk. |
| Earning/calculation contract | Blocked | 1 earning flow; 2 initial numeric settings | Spec points rules and calculation recommendation | High. AI role, baseline, compatible factor units and precise rounding are not finalized. |
| Stateful transitions | Partial | All 5 reward types plus journey/admin flows | Spec rewards/admin sections; current interview | High. Rates and fees exist; several lifecycle transitions remain undefined. |
| Observable acceptance | Partial | 23 written cases counted as table rows, including 5 detached rows | Spec lines 81–106 | High for text inspection. Cases are not executed tests; 5 rows follow a blank line without a new table header. |
| Domain terminology | Partial | All 32 bold glossary terms | [Glossary](../CONTEXT.md) | High. Resolved definitions coexist with historical proposals and configuration rules. |
| Delivery plan | Partial | All 12 ordered work packages | [Plan](poc-plan.md), current work table | High. Real-account work is bundled behind route implementation, although account decisions can proceed independently. |
| Implementation architecture | Insufficient evidence for refactor | 2 runtime source files; reserved backend directory | `index.ts`, `src/App.tsx`, `convex/README.md` | High for absence of product implementation; no deployed system inspected. |

## Original findings before the follow-up

### 1. The active documents contain two generations of requirements

The explicit precedence note prevents a literal contradiction, but most of the specification still describes the old race-only build, background tracking and newly planted tree requests. An implementer must repeatedly decide which old rules survive. The current rewards section itself still carries older challenge rules forward pending reconciliation.

Recommended correction after interview: keep the active spec and plan current-only; retain old material in a clearly named archive and link to it. This review does not move or delete that history.

### 2. AI calculation is a proposal, not a decision

The latest user asked what approach is best. The recommendation is deterministic emissions/points calculations with AI explanations, but this has not been accepted. The car baseline, factor dataset, per-passenger units, CO2 versus CO2e, rounding and time-tolerance reference must be explicit before anyone can implement a stable award.

The initial rate is 50 points/kg and the initial cap is 2,000 points/journey; both are admin-configurable. No daily trip-count limit is confirmed. Do not reopen race restrictions or silently introduce a daily cap.

### 3. Admin configuration needs effective-time rules

Consider a journey started at 50 points/kg while an admin changes the rate to 25. Both answers are plausible unless the spec states which version governs completion. Preserve past awards and record the basis used. Recommended product policy, still awaiting agreement: keep the rule/factor version at Start journey; apply updates to new journeys.

A separate operational case is a pending purchase when the price changes. The historical spec proposes preserving the accepted price, but the active reward contract should state the intended refresh/confirmation behaviour explicitly.

### 4. Demo isolation is only partly specified

Only the demo account earns simulated journey points and demo reset must preserve real-user data. Those are clear invariants. It is not yet clear whether the demo identity is shared among visitors or each visitor receives independent seeded progress. This changes reset behaviour, authentication and whether two visitors can spend the same balance.

Real accounts cannot earn travel points in this prototype. Admin adjustments are allowed, but the real account's redemption/fulfilment experience needs explicit confirmation. Do not invent sign-up points to fill this gap.

### 5. Reward exceptions still affect implementation

The five reward types are settled. Driver-question fees are non-refundable even after rejection or no answer; exclusive content stays unlocked. Remaining decisions include challenge resubmission, session cutoff and ties, zero-vote candidates, repeat selection, tree dedication/reassignment under the revised participation model, and unavailable reward content.

These are product decisions. A generic status field would hide them rather than resolve them.

### 6. Dashboard totals are intentionally deferred

The user will return with dashboard detail. “Total savings” does not yet identify whose journeys, which period, which baseline, or whether demo records are included. Preserve this as a named blocker for dashboard acceptance, not a blocker for all work. Team report figures and personal/demo activity remain separate.

### 7. Acceptance proof needs formatting and coverage repair

Five acceptance rows, starting with real-account simulated completion, are detached from the preceding table. Repairing the blank line is straightforward, but this check-only task leaves the spec unchanged.

Missing concrete cases include rule edits during an active journey, simultaneous spending, reset during an active demo, rejected challenge resubmission and missing Singapore mode data. Write these once product policies settle. Current cases and the historical 32 scenarios are not evidence of executed tests.

### 8. The glossary mixes definitions with pending policy

`Points` includes configurable numeric settings; `Tree dedication` and `Planting reassignment` describe proposals; `Race destination` still refers to an unresolved race arrival. Retain useful concepts, but move unresolved decisions and historical rules out of the glossary when the interview settles their disposition. Domain definitions should identify concepts; the spec should own changing values and lifecycle policy.

### 9. No existing code supports a deepening claim

The current implementation is an Expo starter. There is no journey, points, rewards, identity or ESG implementation to delete, merge or deepen. A module deletion test cannot establish depth for code that does not exist. No new package, adapter or repository structure is justified solely by the planned feature list.

## Architecture discussion candidates

All are future design candidates, not refactors. No interfaces are proposed in this review.

1. **Points and rewards module: speculative, suggested first discussion.** A future module can keep eligibility, duplicate-operation protection, balance changes, reward records and admin adjustments together. Locality would prevent the fan app and admin web experience from duplicating those rules. Tests should exercise the same interface as callers. Actual implementation and the deletion test remain future work.
2. **Journey assessment module: speculative, after calculation agreement.** Keep factor selection, compatible units, baseline calculation, time tolerance and rule versions together. AI explanations consume established results. A seam is justified only where concrete adapters actually vary; no generic provider framework is proposed now.
3. **Demo state module: speculative until the identity choice.** Seed/reset behaviour must preserve real-user state and interact coherently with ongoing work. Whether this needs its own module depends on the shared-versus-independent demo decision. Avoid introducing an adapter for a hypothetical second implementation.

## Current interview and stopping point

Independent questions sent in this round: rule-version timing; shared versus independent demo progress; real-account reward fulfilment; minimal tree participation versus inherited extras; challenge selection rules; rejected challenge resubmission.

Calculation policy and factor feasibility are separate from those decisions. Exact dashboard metrics remain user-deferred. The architecture skill requires choosing a candidate before interface exploration. The grilling skill requires consolidated confirmation before the interview is complete.

## Proof and limitations

Parent checked the cited local documents directly. A read-only architecture agent inspected the runtime files and configuration; a separate research agent owns [primary-source feasibility research](research/spec-feasibility.md). The parent read its complete findings: official sources do not yet establish a compatible five-mode Singapore factor set. Convex documents atomic/serializable mutations, while replay identity, roles and reset ownership remain application rules. See the note for ten primary-source citations and limits. No source code, specification requirements or glossary definitions changed in this review. No tests were run because there is no relevant product implementation to exercise.

No `.evidence/` files, staging, commits, tracker writes or publication are part of this review. A temporary HTML report accompanies these findings; opening it is not proof that every CDN-loaded diagram rendered successfully.

Temporary report created and opened locally: `architecture-review-20260925-160230.html` in the OS temporary directory. File readability and structural content were checked; visual layout and CDN-loaded diagrams remain unverified. No code refactor candidates were established.
