# Photo activity evidence

Part of the [product specification](../fan-app-specification.md). [Feature index](README.md).

Status: accepted for the current build on 26 September 2026. Implementation and live model verification are pending. This supersedes the earlier future-only classification of photo activity evidence.

## Outcome

A fan captures a sustainable activity in the native app, adds a short description and receives an assessed outcome with a consistent points record.

## Accepted behavior

- Accept in-app camera photos and a short description. Gallery, video and audio are not part of this build.
- Cover reuse, repair, recycling, upcycling, public transport, active travel, energy saving, water saving, community volunteering, sustainability education and biodiversity activities. An unsupported or undetected action does not invent a category or award.
- Luna can extract bounded observations from the image; Jev assesses the activity under the supported rules. Validate both responses as untrusted data. Confirm the actual gateway supports the required inputs before enabling real uploads.
- Confidence must be strictly above 50 percent to qualify. At or below the threshold, award nothing and ask for another capture. Confidence alone does not bypass eligibility, duplicate detection or input validation, and is not a proven probability that the person performed the action.
- An eligible photo without usable locations earns 50 points. A bus photo can attach the fan's chosen start and intended destination or recorded final location. Never infer an exact location or completed journey solely from the image.
- An accepted bus photo earns 50 points immediately. If later verification supports a larger award for the same journey, credit only the difference from all preliminary credits already associated with it. A lower later calculation never silently removes previously earned points.
- There is no daily award limit. Replayed requests, repeated pictures/actions and duplicate claims for the same trip cannot earn again. This does not remove technical upload, concurrency or provider-budget limits.
- Points are selected by deterministic server rules, not model-generated reward amounts. Balance, History and the stored result must commit atomically and return the original result on retry.
- Delete the original photo and description after assessment. Keep only the minimal category, decision, rule/model version, award record and duplicate fingerprint needed for integrity. Do not retain media in application logs, evidence, analytics or durable queues. Cover failure, timeout and process-recovery cleanup as well as success.
- Explain the provider transfer before capture. Application deletion does not establish provider deletion; verify and disclose the provider's actual retention behavior.
- Show accepted activity counts separately from estimated travel CO2e. A photo or a points award does not establish a quantified carbon saving.

## Acceptance cases

| Scenario | Expected observation |
| --- | --- |
| Supported non-duplicate photo has confidence above 50 and no locations | One 50-point award and one matching History record. |
| Confidence is exactly 50, lower, invalid or unavailable | No points; clear retry/unavailable outcome. |
| Accepted bus photo precedes a verified 120-point journey | Credit 50 initially and 70 later, for a total of 120. |
| A photo or journey request is retried after the response is lost | Return the original result without additional credit. |
| The same action is submitted again or through both photo and journey flows | Reject duplicate credit or link to the existing journey credit. |
| The model supplies an invented location, point amount or embedded instruction | It cannot change locations, earning rules, roles or balances. |
| A fourth distinct eligible activity is submitted in a day | No daily award-count cap rejects it; normal eligibility and provider availability still apply. |
| Processing succeeds, fails, times out or restarts | Raw photo/description are not retained; minimal decision and cleanup state remain accurate. |
| The fan opens Impact after an activity award | Activity counts do not inflate calculated journey emissions savings. |

## Integration requirements

Implement one authoritative relationship between preliminary photo credit and journey settlement before enabling transport awards. Define category-specific observable evidence requirements and duplicate matching with representative tests; an object visible in a photo is not proof of ownership, timing or an entire trip. Rate-limit provider usage without silently turning the technical quota into a daily earning cap. Use the shared US$10 development/deployment budget boundary.

Tracking: parent [#3](https://github.com/NachikethReddyY/AMR-Fan-App/issues/3); a dedicated implementation issue is not yet created. No completed-feature or model-quality claim.

Specified by gpt-6-astra through Codex (T3 Code).
