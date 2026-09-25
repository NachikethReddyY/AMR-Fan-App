# Native location tracking

The accepted product uses the Expo/React Native phone app and checks real journeys, including background and locked-phone travel. The [journey feature](../features/04-journey-tracking.md) owns the requirements. No tracking implementation or physical-device proof exists yet.

## Platform findings

- Browser geolocation can watch positions with permission, but the standard delivers updates only while the document is fully active and visible. A sampling interval does not guarantee a continuous trace while the screen is locked. [W3C Geolocation](https://www.w3.org/TR/geolocation/)
- Expo Location can register background updates through TaskManager. Foreground watches alone do not satisfy background tracking. Required permissions and native configuration differ by platform; iOS background testing needs a development build. [Expo SDK 57 Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/), [TaskManager](https://docs.expo.dev/versions/v57.0.0/sdk/task-manager/)
- Terminating the app can stop updates; Android behavior after removal from recents varies by device. Permission denial and operating-system interruption must remain explicit outcomes. [Expo background-location limits](https://docs.expo.dev/versions/v57.0.0/sdk/location/#background-location)

The native app is the user's accepted platform. These findings support its feasibility; they do not establish verified journey behavior. Research checked the linked platform documentation on 25 September 2026.

## Required proof

On physical iOS and Android devices, start a journey with consent, travel a known route while locked or using another app, and inspect timestamped samples and arrival evidence. Check denied background permission, disabled location, offline periods, interruption, termination and Stop tracking. Measure actual sample gaps instead of assuming the configured interval was delivered.

Retain private paths and the journey's evidence status. Missing samples cannot become verified travel just because points were awarded. Emulator playback and an Expo Go launch do not satisfy the physical background-travel acceptance case.
