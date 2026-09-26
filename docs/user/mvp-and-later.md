# MVP and planned additions

Presentation notes, updated 26 September 2026. This is a record of explicit
scope decisions, not a claim that every MVP feature is implemented or installed.
The [glossary](../../CONTEXT.md) defines product terms. Current user decisions
supersede older planning examples.

## Required before the final APK

- Explain what AMR Fan is, how fans earn and use points, and how to use Home,
  Travel, Rewards and Impact. Keep the explanation short and practical.
- Keep account creation and sign-in distinct. Both use email and password.
  The user explicitly removed MFA and email confirmation codes; new signup
  proceeds to the name step when the provider issues a session.
- Ask for a display name during onboarding. Do not add other personal details
  without a reason and a product decision.
- Define first-launch completion, entry into Home and later-launch behavior.
  The selected short walkthrough and name step are implemented locally.
  Completed setup restores the app without repeating the walkthrough; native
  acceptance of the current build remains pending.

## Explicitly planned for later

| Item | MVP choice | What would be needed later |
| --- | --- | --- |
| Profile picture | Name only. No photo field, upload or placeholder promise in onboarding. | Choose image storage, access, upload validation, replacement and deletion behavior. |

This list captures explicit deferrals available to this mobile task. Add future
"later" decisions here as they are agreed. Do not turn unresolved questions or
unfinished required work into a future-feature promise.

## Current blockers and open decisions

| Item | Current status | Presentation wording |
| --- | --- | --- |
| Password-only accounts | Confirmation UI removed. Infrastructure owner reports hosted auto-confirmation enabled; no existing account was changed. | Existing sign-in has prior Pixel proof. Latest live signup remains unverified without the user-selected account credentials. |
| Onboarding | Selected short walkthrough, name step and animated progress are implemented; current native acceptance is pending. | Onboarding is part of the MVP, not a later feature. |
| Photo-based awards | Latest user allows a 50-point no-location award and fan-entered endpoints for a bus photo. Immediate credit, top-up and daily-limit decisions remain pending with the owning work. | Do not promise automatic credit or publish unsettled rules. This is ongoing work, not an agreed deferral. |
| Real reward fulfilment | Real voucher inventory, merchandise fulfilment, tree allocation and driver outcomes need separate arrangements. Existing demonstrations are not proof of fulfilment. | Distinguish the app experience from fulfilled real-world rewards. |

## Onboarding content boundary

Explain the intended fan loop: choose Travel, compare routes and estimated
emissions, follow the selected journey, then check credited points in Home or
History. Use Rewards to see available options and their prices; use Impact to
read estimates and sourced team information. Do not promise a fixed award for
an unfinished journey, points for signing up, guaranteed driver access, planted
trees, live coverage or unimplemented photo controls.

Match final onboarding copy to the delivered journey/photo contracts before the
final APK. Current work in other threads does not prove a feature is in this
mobile build. Do not place unsettled point amounts in the introduction.

## Presentation check

Before presenting, label each item as implemented and verified, implemented but
unverified, blocked, open for decision, or deferred. Use actual installed-device
proof for the app demonstration. The final APK is on hold until the remaining
agreed changes, including onboarding, are ready.

Recorded by gpt-6-astra through Codex (T3 Code).
