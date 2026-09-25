# PWA foreground location versus Expo background tracking

Status: research for the attached technical-spec reconciliation, 25 September 2026. This note assesses tracking capability only. It does not select the product's POC scope or claim that route verification is implemented.

## Capability and limits

| Option | Documented capability | Limit for journey verification |
| --- | --- | --- |
| PWA in a mobile browser | The Geolocation API can request a position or watch changes with user permission in a secure context. [W3C Geolocation](https://www.w3.org/TR/geolocation/), [MDN `watchPosition`](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) | The W3C algorithm delivers watched position updates only to fully active, visible documents; hidden-page updates are dropped. The browser can also rate-limit updates and decides what counts as significant movement. A PWA therefore supports an explicitly foreground journey demonstration, but its browser API does not establish a continuous trace after the screen locks or the page is backgrounded. [W3C Geolocation](https://www.w3.org/TR/geolocation/) |
| Expo native iOS/Android build | `expo-location` can register a `TaskManager` task through `startLocationUpdatesAsync` to receive location updates while the app is in the background. `watchPositionAsync` supplies foreground updates only. [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [Expo SDK 57 TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/) | Native background updates require foreground and background permissions, an iOS `location` background mode or Android permissions/service configuration, and a development build for iOS testing. Expo documents that updates stop when the user terminates the app; Android behavior after removal from recents varies by device. Permission denial and OS limits remain normal outcomes. [Expo SDK 57 Location: background location](https://docs.expo.dev/versions/v57.0.0/sdk/location/#background-location) |

The attached draft's proposed 30–60 second browser sampling is a **starting interval**, not a delivery guarantee. The W3C API reports changes at an implementation-defined rate. Foreground sampling cannot prove the path travelled while the page was hidden. The draft correctly labels the PWA choice as a deployment recommendation and acknowledges its background limitation; it cannot simultaneously use that choice as proof of a locked-phone journey. [W3C Geolocation](https://www.w3.org/TR/geolocation/)

## Decision for the current reconciliation

The repository is an Expo SDK 57 phone app, and its existing specification defers real background tracking and device validation. If the hackathon acceptance case remains a labelled simulated journey, keep that scope and do not infer real journey verification from the demo. If the acceptance case changes to actual movement with the phone locked, prefer the existing Expo native path over a PWA for the tracker, then budget a development build and physical-device tests on both platforms. This is an inference from the documented capabilities, not a completed implementation or product decision. [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [W3C Geolocation](https://www.w3.org/TR/geolocation/)

## Device tests needed before a verification claim

1. On physical iOS and Android devices, start a journey only after explicit action, grant the requested foreground and background permissions, lock the screen, travel a known route, unlock, and inspect timestamped samples and arrival evidence. Repeat with background permission denied and with location services off.
2. Compare the intended sample interval with actual gaps while foregrounded, locked, interrupted by another app, offline, and after the OS stops or the user terminates the app. Do not treat an emulator replay or an Expo Go session as proof of background behavior. [Expo SDK 57 Location: background methods](https://docs.expo.dev/versions/v57.0.0/sdk/location/#background-location-methods), [Expo SDK 57 TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)
3. If a PWA is chosen, test the same route in the specific iOS/Android browsers and installed PWA modes, with the page visible, backgrounded, and screen locked. Verify what the product does when location samples are missing; such gaps must not automatically become a verified journey. [W3C Geolocation](https://www.w3.org/TR/geolocation/)

No device test was run for this research note.
