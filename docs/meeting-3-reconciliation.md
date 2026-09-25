# Meeting 3: corrected direction and scope decisions

Status: current specification, plan and glossary reflect the interview decisions. Points/rewards responsibility and reset policy have consolidated confirmation. Calculation policy and ESG totals remain deferred. Entries below are chronological; the latest answers supersede earlier assumptions.

## Source and precedence

Source: `meet 3.pdf`, AMF1 Team meeting, 25 September 2026, 2:00 PM, 17 pages. Pages 1–3 contain a summary; pages 3–17 contain the transcript. The transcript has transcription errors, especially names and model names. All pages were read as extracted text; pages 1, 2, 9, 13, 14 and 15 were also visually inspected.

The user supplied this meeting as a correction to the existing specification. Clear changes below supersede the old document's description of the meeting direction. Conflicts about prototype depth and previously agreed rules require the user's answers before becoming build requirements. Silence in the meeting does not establish that an older feature was cancelled.

## Corrected idea

An Aston Martin fan app uses sustainable actions and fan rewards to increase interest and participation in ESG. Fans choose a start and destination, compare practical routes by travel time and estimated emissions, and see a recommendation that considers both. Race weekends are a useful example, not the only journey purpose. An ESG dashboard connects the team's reported work with the fan's own activity and contribution record.

The prototype includes a populated demo account showing points, all reward types and ESG activity. Interactive demo transactions and real-user accounts are confirmed in the second round.

## First interview answers

These direct user answers supersede pending treatments in the original comparison below.

| Decision | Confirmed answer | Remaining detail |
| --- | --- | --- |
| Demo account | Populate demo data to show the discussed features. | Interactive updates versus prepared records; real-user account scope. |
| Rewards | Tree redemption, driver questions, exclusive content, challenges and store belong in Rewards, with Redemption and History tabs. | Prices and dependent fulfilment/content rules. |
| Admin | Add a web admin dashboard. | Exact management powers and roles. |
| Journey proof | Clearly labelled simulation now; real background tracking later. | Simulation progression and interaction depth. |
| Trees | Participation in an existing programme, with demonstration status until actual allocation is arranged. | Dedication, allocation and old reassignment policy. |
| Recommendation | Fan chooses acceptable extra travel time; recommend lowest emissions within it. | Reference duration and precise selection/error policy. |
| Mode estimates | Calculate bus, train, car, electric-car and cab emissions for the relevant country. | Countries, factors, units and assumptions. |
| ESG data | Use the database the team will populate. | Exact metrics and provenance/demo labels. |

## Second interview answers

- Q1: interactive demo and real-user accounts are both required. Demo journeys, spending, History and applicable dashboard records must update.
- Q2: user specifies points and challenges administration. Existing reward pricing and confirmed question review remain included. Exact manual balance/rule controls and ESG/factor/reset controls need clarification; “etc” is not a complete permissions specification.
- Q3: Singapore first. Use Singapore mode factors; prepare country-specific records for later coverage without claiming other countries are supported.
- Q4: retain 50 points per estimated kg reduction and the 2,000-point journey cap. The answer does not specify the everyday daily limit.
- Q5: accept question submission for admin review, status in History and no guaranteed driver answer. Price/refund handling remains open.
- Q6: user requests total savings and will return with more dashboard detail. The total's population, period and definition remain explicitly deferred.

## Third interview answers

- Q7: only the demo account earns simulated journey points; real accounts remain in scope.
- Q8: “yes all” confirms reward prices/content, earning-rule changes, reason-recorded manual point additions/removals, question/challenge management, ESG figures, transport emission factors and demo reset. This supersedes the recommendation to keep earning rules fixed.
- Q9: earning applies to journeys across the country, not only races. This confirms geographic/purpose scope but does not expressly choose a daily trip-count limit.
- Q10: user asks “let ai calculate?” The AI role and baseline remain to be decided. Supplied factors/distances plus code-verified calculations are proposed, not accepted.
- Q11: accept admin-set question/content prices, non-refundable submitted-question fees even if rejected/unanswered, and persistent account access to redeemed content.

Follow-up: the user explicitly chose no daily trip-count limit and requested the best approach to AI calculations. The recommendation is code-calculated emissions/points with AI explaining route trade-offs; that division and the car baseline await agreement. Rule-change timing, dependent reward exceptions and final consolidated confirmation remain outstanding. Dashboard metric details remain user-deferred.


## Clarity-review follow-up: confirmed decisions

These answers supersede earlier open entries in this record.

1. Keep the earning-rule and emissions-factor versions selected at Start journey. New journeys use changed settings; completed awards do not change.
2. Each demo user/session receives separate seeded progress. Spending or resetting one demo does not affect another demo or any real account.
3. Real accounts may spend explicitly admin-granted points, with demonstration fulfilment for vouchers, tree participation and driver outcomes. No automatic starter points.
4. Tree participation is recorded under the account name at an admin-set price. No quote or country reassignment in the demo.
5. An admin explicitly closes a session and selects up to three approved unfinished challenges with positive contributions. Rank by contributed points, then earliest approval. Unselected challenges retain points for later sessions without refunds.
6. Rejected challenge resubmission creates a new submission and costs another 500 points, shown before confirmation. Preserve the original rejection and charge.

The remaining questions cover the full calculation policy, changed-price confirmation, already-selected challenges and the user's architecture candidate choice. Anonymous demo-session persistence, reset during in-flight work and data retention still need disposition before dependent implementation. Dashboard metrics remain deferred by the user. No consolidated interview sign-off has occurred.

## Latest review decisions

- Journey calculation policy is TBD and explicitly deferred for later review. Do not treat the recommended calculation/AI split as accepted or re-ask it in the current points/rewards round.
- Changed reward prices require display of the new price and fresh purchase confirmation. Completed redemptions retain their original price.
- Selected challenges are frozen for contributions and excluded from further selection until marked performed or released to the backlog. Performed challenges remain excluded.
- Points and rewards is the chosen future module to explore. No code change, refactor or particular interface is approved by the selection.

## Points and rewards answers

- History shows every point change, reason and resulting balance, plus reward statuses.
- Repeat tree participations, store vouchers and separate paid questions are allowed. Retries never charge twice; unlocked content is not charged again.
- Demo and real accounts share challenge rankings. This explicitly overrides the proposed ranking separation, while personal balances/history remain independent.
- Disabled offers reject new purchases without charge; prior rights and History remain.
- Corrections append reason-recorded adjustments; preserve original transactions and rewards, and never make a balance negative.

The user accepted the recommended reset policy: preserve shared contribution records and restore only unspent starting points. Reset cannot replenish starting points already contributed; it must not remove or duplicate votes or change existing selections. Session lifetime and in-flight reset details remain open.

## Original feature inventory and source comparison

Historical comparison before the first answers. The table above and revised specification give current status.

| Feature or requirement | Meeting evidence | Current document difference | Treatment pending interview |
| --- | --- | --- | --- |
| Start and destination input for ordinary journeys | pp. 1, 9, 13 | First journey requires a selected race and current-location start | Correct product direction; agree supported coverage separately. |
| Route recommendation balancing emissions and duration | pp. 1–2, 8–10, 13 | Comparison highlights lowest emissions but does not specify a balanced recommendation | Required direction; recommendation policy and user preferences remain open. |
| Team ESG overview | pp. 2, 8, 14 | Missing from the core specification | Required prototype area. Agree data and metrics. |
| Personal contribution dashboard | pp. 2, 8, 14 | No corresponding dashboard feature | Required prototype area. Distinguish estimates, participation and fulfilled contributions. |
| Travel points and balance | pp. 2, 13 | Detailed rules already exist | Concept retained; interactive prototype depth and previous numeric rules need confirmation. |
| Exclusive off-season content | pp. 2, 13 | Outside the old initial scope | Record in full product inventory; decide prototype versus later work. |
| Opportunity to submit a driver question | pp. 2, 13 | Old scope implements driver/team challenges with paid voting | These are different rewards. Do not silently rename challenges to questions. |
| Tree participation at a high point threshold | pp. 2, 13–14 | Old scope buys an unfulfilled planting request, with reassignment | Meeting allows attribution within an existing programme without additional trees. Resolve meaning before rewriting the glossary. |
| Image, text, video and voice evidence scored by AI | pp. 2, 14–15 | Not an implemented core feature | Explicitly slides-only; no prototype implementation requirement. |
| Regional campaigns and regional/individual leaderboards | pp. 2, 14 | Outside old first build | Explicitly future/slides-only. |
| Points/navigation chatbot and voice interface | pp. 7, 12 | Not in core scope | Brainstorm only, absent from final build statement. |
| Existing AI APIs instead of custom model training | pp. 2, 4–5, 15–16 | No separate route-AI handoff | Record no-training direction; obtain exact provider/model identifiers from the AI team before integration. |
| Public government dataset for the prototype | pp. 1, 3–4 | Carbon factors unresolved | Dataset discovery and fitness checks remain work to do. The meeting does not establish a usable dataset. |
| Possible ML extraction of team ESG reports | p. 14 | Missing | Proposed mechanism, not a settled requirement for a live ingestion pipeline. |
| Visual quality and Aston Martin colours | pp. 1, 9–10 | Existing designs predate this correction | Preserve existing design work; scope approval and subsequent design selection precede UI edits. |
| Privacy/data-processing documentation | pp. 1, 15 | Prior seven-day trace rule exists | Inventory actual data collected, processed, retained and discarded after prototype depth is settled. |
| Merchandise discounts, challenge voting and backlog | Not reaffirmed in the final concept on pp. 13–14 | Prominent first-build requirements | Retain as earlier decisions awaiting disposition; omission is not cancellation. |
| Background tracking, email accounts and cross-device sync | Not settled by this meeting | Mandatory in prior spec | Resolve whether these remain prototype requirements. |

## Original first-round conflicts

The first answers resolve feature placement, simulated journey proof, tree meaning, recommendation direction and dashboard data source. Transaction depth and dependent rules remain open. These original questions are retained as provenance.

1. **Prototype boundary:** the summary on p. 2 includes points and rewards; p. 14 says only the route optimizer and dashboard are being built. Establish which reward interactions must work in the demo and where older challenges/store features belong.
2. **Journey proof:** a visual prototype is discussed on pp. 4 and 9–10, while the prior plan requires physical-device background tracking. Set the required completion evidence for this version.
3. **Tree meaning:** a newly fulfilled planting request and attribution to an existing programme are different promises. Resolve which record a fan redeems and what the dashboard may claim.
4. **Route trade-off:** no maximum delay, preference mechanism or scoring policy is agreed. A slower lowest-emission route may differ from the recommended route.
5. **Dashboard data:** the meeting suggests report ingestion and individual contribution reporting, but does not specify a working ingestion service or formal inclusion of app records in the team's published report.

Dependent decisions follow these answers: everyday reward eligibility and limits, point prices, supported geography, journey validation exceptions, reward fulfilment, account/data retention, dashboard metric definitions, and the app/AI integration contract. The second round reconfirms 50 points/kg and the 2,000-point journey cap for ordinary travel. The later follow-up explicitly removes the daily trip-count limit.

## Work plan to finalize after the interview

- [x] Read the meeting and compare the existing specification, plan and glossary.
- [ ] Resolve the five scope conflicts above and their dependent decisions.
- [x] Revise `fan-app-specification.md` with the corrected idea, feature status and acceptance examples for confirmed decisions; final decisions remain open.
- [x] Revise `poc-plan.md` into ordered work packages, dependencies, recorded owners and required evidence; final decisions remain open.
- [x] Update `CONTEXT.md` for resolved definitions. No ADR is needed for these product-scope clarifications.
- [ ] Define the route service handoff with the AI team: inputs, candidate routes, source-backed duration/emissions, recommendation output, errors and fallback behaviour.
- [ ] Select and validate the prototype transport/emissions dataset; document units, coverage, dates and missing values.
- [ ] Specify team ESG metrics, report provenance/year and personal-activity metrics; distinguish demo data from actual records.
- [ ] Specify the approved points/rewards loop and its examples without inheriting race-only restrictions by accident.
- [ ] Record data-processing responsibilities and policy inputs consistent with the approved prototype.
- [ ] Reconcile the complete specification and plan; obtain shared-understanding confirmation.

These are planning tasks and future work definitions. This request does not authorize app implementation, messages to teammates, changes to GitHub Issues or publication.

## Team handoffs recorded in the meeting

- Nachiketh: app development lead.
- Kong and another member: AI pipeline and route optimization. The second person's identity is unclear in the transcript; no assignment is invented here.
- Dilla: link between app development and slides/ideation.
- Brianna/Sachita: privacy and data-processing policy, with the exact assignment to be confirmed by the team.
- Existing design is to be shared with Kong; this document records the task without sending anything.
- A technical specification handoff by the 27th is mentioned on pp. 1 and 17. This is a meeting action, not an inferred app-delivery deadline.

Model names, prices and credit balances in the meeting are unverified discussion details, not infrastructure availability or current pricing guarantees. Production access to Aston Martin data is a proposal, not an established integration.

## Verification and limits

The comparison uses the attachment and local repository documents only. No new web research or external tracker writes were needed for this source-reconciliation step. The Expo starter exists in `src/App.tsx`; the old specification's claim that no Expo app exists is stale. Product workflows are not established by that starter.

Failure criterion: the existing specification does not represent the supplied meeting's journey boundary or required dashboard. This is a project product correction. No reusable agent-guidance change is needed.

The specification, glossary and plan now reflect the first two interview rounds and retain open decisions explicitly. The existing HTML brief and UI prototypes represent the earlier direction and are not evidence that the revised scope is agreed.

## Zero-start and persistent-demo correction

The latest answers supersede earlier seeded-balance and per-session assumptions: everyone starts with 0 points; reset preserves rewards and History; and each signed-in user has one persistent demo profile reused across visits and devices. The accepted preservation option includes purchased content, challenge submissions and all point History while restarting simulated journeys/dashboard examples. Shared votes and selections remain preserved.

Starter-point source ordering and restoration are no longer applicable. Proposed interpretation for final confirmation: reset clears the remaining demo balance to 0 with an appended reset entry; completed outcomes survive, while unfinished pre-reset operations cannot modify reset state. This interpretation is distinguished from the user's explicit answers. Journey calculation policy and ESG totals remain deferred.

## Consolidated points/rewards confirmation

The user accepted one backend module for balances, reward outcomes, History and reset. Reset clears remaining demo points to 0; preserves rewards, History, submissions, shared votes and selections; cancels unfinished simulated journeys; and requires fresh confirmation for unfinished purchases. Completed outcomes remain recorded and retries never charge again. This confirms the reset interpretation proposed above and closes the selected-module interview. Calculation policy and ESG totals remain deferred; no app implementation is authorized.
