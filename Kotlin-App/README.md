# AMR Fan App Kotlin port

This is the native Android replacement for the removed Flutter port. It follows
the Swift-to-Kotlin plan with Kotlin DSL Gradle, Jetpack Compose, typed domain
models, Ktor boundaries, PKCE helpers, encrypted session storage, DataStore
preferences, RSS parsing, bounded JPEG preparation and the native fan flow.

Run `./gradlew :app:assembleDebug :app:test`. The Travel screen uses a text route
planner until an Android Google Maps key is configured. Live Entra callback and
provider-backed photo verification require their external registrations.
