# Aston Martin fan app design direction (draft)

Status: **design proposal for selection**, revised 25 September 2026. The three linked screens are static concepts. The Expo starter remains unchanged.

## Purpose

A fan travelling locally to or from a selected race needs to compare duration, estimated emissions and provisional points, choose a route, and know when points become earned. The first screen must make those comparisons readable outdoors on a phone. The wider app later includes challenges, rewards and individual tree requests under the [product specification](docs/fan-app-specification.md).

## Apple HIG review of the first draft

This review examined three static phone mockups and 13 color tokens against Apple's [iOS guidance](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios), [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), [color](https://developer.apple.com/design/human-interface-guidelines/color), [buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility). The checks below describe the draft before the corrections in this document. They are source and contrast checks, not native-device results.

| Dimension | Draft status | Sample and method | Evidence | Confidence and limit |
| --- | --- | --- | --- | --- |
| Text hierarchy | Needs correction | Three mockups; inspected CSS sizes and visible labels | Route details, eligibility, points and permission copy used 11 to 13 CSS px even though these facts affect the decision. Apple recommends 17 pt as the iOS default and asks custom fonts to support Dynamic Type. | High for draft CSS; CSS px and iOS pt are not interchangeable. Native rendering remains untested. |
| Color contrast | Needs correction | Thirteen tokens; calculated sRGB contrast for the soft muted text on canvas | `#767671` on `#121212` was 4.10:1, below Apple's stated 4.5:1 minimum. | High for the measured pair; other rendered pairings need device checks. |
| Navigation and safe areas | Incomplete | Three mockups; inspected header and phone frame | A fabricated 25 px system status row and no back path hid how the screen sits in the iOS navigation stack. | High for the static mockups; real Expo navigation and device insets are not built. |
| Action and recovery | Incomplete | Three start actions and four journey-state specimens; inspected copy and controls | The location requirement sat in tiny footer text. Tracking and evidence-gap examples named a next step without showing its control. | High for the static examples; live permissions and tracking remain untested. |
| Control accessibility | Unverified | Three mockups; inspected HTML structure | Route rows and buttons are static `div` specimens, so this artifact cannot prove native hit targets, selection announcements or press behavior. | High that proof is absent; no claim about future native controls. |

The correction is project guidance for this app, not a claim that every Apple recommendation must override the selected Aston Martin character. The [project HIG notes](docs/agents/apple-hig-findings.md) give source links and checks for future screens.

## Evidence and interpretation

- [Aston Martin F1](https://www.astonmartinf1.com/) uses sparse navigation, large editorial type over darkened imagery, racing green, a sharp lime accent, and faint circuit/map linework. The attached Baku City Circuit reference shows fine, low-contrast street lines behind copy and a slightly brighter double-line track, not an isolated cartoon loop. Its [live stylesheet](https://assets.astonmartinf1.com/public/dist/base.b0ac78f629cbe646c0b5.css) names `AstonMartinSans`, `AstonMartinFlare` and `#CEDC00`.
- [Aston Martin road cars](https://www.astonmartin.com/en) uses a restrained dark frame, strong vehicle imagery, generous display type and fairly square, direct actions.
- The two sites are visual references. These token names and surface values are **app proposals**, not claimed official brand specifications. The user supplied `#121212` and `#04524B`. Exact licensed logo and image files have not been supplied.

## Color tokens

Keep the surrounding [prototype document](prototypes/brand-directions.html) on the neutral black/gray HTML-communicator palette. **Only the app mockups and token specimens use the colors below.** Green is one brand fill, used for the race header or primary action; ordinary app areas remain neutral. Lime is a small F1 accent, not a second family of backgrounds.

| Token | Value | Role and pairing |
| --- | --- | --- |
| `primary` | `#04524B` | AM green for primary action and occasional race identity; white ink on fill. |
| `primary-active` | `#03423D` | Pressed primary button only. |
| `primary-disabled` | `#3A3A3A` | Unavailable primary button with readable light gray label. It is neutral, not another green. |
| `accent` | `#CEDC00` | F1 lime for a thin selection line, small status mark or focus ring. Never long text or a full panel. |
| `canvas` | `#121212` | App base. |
| `surface-soft` | `#191919` | Quiet grouped content and headers. |
| `surface-card` | `#222222` | Selectable route or reward item when a separate surface is needed. |
| `surface-elevated` | `#2B2B2B` | Menus, dialogs and temporary overlays only. |
| `hairline` | `#3D3D3D` | One-pixel rules and control boundaries. |
| `ink` | `#F5F5F3` | Strong headings and key values. |
| `ink-body` | `#E0E0DC` | Body text and controls. |
| `ink-muted` | `#A9A9A3` | Secondary information. |
| `ink-muted-soft` | `#8B8B85` | Nonessential metadata. This reaches 5.47:1 against `canvas`; use stronger ink for important instructions and live values. |

The bright statistic specimen uses AM green text on an off-white neutral inset (`ink`) to keep the requested brand-colored stat readable. In normal dark route rows, key numbers use `ink`; do not put dark green text directly on `canvas`. The corrected muted-soft and canvas pair measures 5.47:1; primary ink on primary green measures 8.31:1. Check rendered contrast in each supported appearance and at increased contrast before implementation. Semantic warning/error colors are **unresolved**, since the current prototype does not show those states.

The mockups specify a dark appearance only. Whether the released app also supports a light appearance is an open product decision. Define and test its color roles before claiming support; do not invert these hex values mechanically. [Apple dark mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode)

## Typography

The F1 site's CSS names AstonMartinFlare and AstonMartinSans, but those fonts are unavailable for this project. **Use [Geist](https://github.com/vercel/geist-font) for the entire app** and Geist Mono for code. Geist is available on this machine and is licensed under SIL OFL 1.1. The app deliberately borrows the sites' scale and restraint rather than claiming to reproduce their proprietary typography.

| Role | Family | Size / line height | Weight | Use |
| --- | --- | --- | --- | --- |
| `display-xl` | Geist | 40 / 44 | 500 | Rare race feature on a spacious screen. |
| `display-lg` | Geist | 32 / 36 | 500 | Race title on phone. |
| `display-md` | Geist | 28 / 32 | 500 | Compact race title. |
| `display-sm` | Geist | 24 / 28 | 500 | Small display setting. |
| `title-xl` | Geist | 24 / 30 | 600 | Large section heading. |
| `title-lg` | Geist | 22 / 28 | 600 | Main section title. |
| `title-md` | Geist | 20 / 26 | 600 | Group title. |
| `title-sm` | Geist | 17 / 22 | 600 | Route or card title. |
| `stat-display` | Geist | 32 / 36 | 600 | Hero statistic, AM green on a light neutral inset. Tabular numerals. |
| `body-md` | Geist | 17 / 25 | 400 | Instructions and route detail. |
| `body-caption` | Geist | 14 / 20 | 400 | Short supporting data, not essential action text. |
| `code` | Geist Mono | 13 / 18 | 400 | IDs and diagnostics only; not normal UI prose. |
| `button` | Geist | 17 / 22 | 600 | Action label. |

These are baseline design values, not fixed output sizes. Implement Dynamic Type scaling and Bold Text support for Geist in the native app. Allow wrapping and localization, especially in the mode, time, emissions and points comparison. The fixed-height phone frames are presentation only. Keep numbers tabular and avoid repeated uppercase labels. Test the largest accessibility text size on a small iPhone before accepting a compact row. Apple's [typography guidance](https://developer.apple.com/design/human-interface-guidelines/typography) lists 17 pt as the iOS default and asks apps using custom fonts to support accessibility settings.

## Shape, layout and depth

Use square corners (`0–2 px`) on app buttons, rows and panels. The phone silhouette in the comparison is a presentation frame, not a component token. Prefer flat neutral surfaces, proximity and a single hairline over rounded nested cards. Only a temporary menu/dialog uses `surface-elevated`; do not imply every route floats above the canvas.

Keep 16–20 px phone gutters, 8–12 px within a data group and 24–32 px between sections. A selected route gets a text check and a lime 3 px edge. Other choices remain fully legible and selectable. Each route choice needs a full-row touch target of at least 44 × 44 pt on iOS, an accessible name that includes its values, and an announced selected or unavailable state. The static HTML only sketches these controls. A fixed Start journey action may remain visible while content scrolls, but the native version must use measured safe-area insets and leave the last route reachable above it. The operating system owns the status bar; the mockup's blank top strip marks its space rather than drawing fake system indicators. Use a standard back action in the native navigation stack. [Apple layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

A circuit may appear only as a faint, noninteractive background watermark in the race area. Match the reference's fine city-street network and double-line circuit treatment; do not imply that the sketch is a navigable map. Put copy on a calm, opaque enough portion of the background. Hide decorative drawing from assistive technology.

## State rules shown in the prototype

| Element | State | Visible treatment and meaning |
| --- | --- | --- |
| Primary action | Default | AM green fill, white `button` text. |
| Primary action | Pressed | `primary-active` fill, same label; no size jump. |
| Primary action | Disabled | Neutral `primary-disabled` fill and explicit reason such as “Select a route first.” |
| Primary action | Keyboard focus | Lime 2 px outer focus ring, distinct from selected state. |
| Route | Default | Neutral row with mode, duration, emissions and provisional points. |
| Route | Selected | Neutral/card row, lime left edge and “Selected” text/check. |
| Route | Unavailable | Muted row with “Unavailable” and reason; no action affordance or invented estimate. |
| Journey | Planning | “Estimate only”; no points in spendable balance. |
| Journey | Tracking | “Recording journey”; provide stop and recovery, never imply earned points. |
| Journey | Evidence gap | Name the gap and recovery; no automatic award. |
| Journey | Credited | Show final estimated reduction and awarded points with time; preserve the earlier balance history. |

For location refusal, provide manual origin entry where routes can be obtained. On a small phone, the route list scrolls under the main action. The static specimens demonstrate wording and visual hierarchy; functional tracking, permissions, calculations and persistence still need implementation and native-device tests.

Request location when the selected action needs it and explain what recording will use it for. Route planning can use a manually chosen origin if available; denial must leave that path open. Add visible loading, unavailable data, denied permission and tracking recovery states before implementation. Keep the same terms from button to result and put recovery controls beside the affected task. [Apple privacy](https://developer.apple.com/design/human-interface-guidelines/privacy), [Apple loading](https://developer.apple.com/design/human-interface-guidelines/loading), [Apple writing](https://developer.apple.com/design/human-interface-guidelines/writing)

## Compare the three layouts

[Open the revised phone concepts and state specimens](prototypes/brand-directions.html). All route data, balances and circuit geometry are illustrative. The three concepts hold content and selected route constant.

| Option | Layout decision | Check before selection |
| --- | --- | --- |
| A: Race editorial | Short green race header with faint circuit; route list below | Does the race identity leave enough room to compare routes? |
| B: Trackside utility | Compact identity and immediate neutral comparison list | Is the race context still recognisable? |
| C: Grand touring | Focused selected-route statistic on a light inset; alternatives below | Does the featured route keep alternatives equally understandable? |

Choose A, B, C or a specific combination before implementing a final UI. Licensed imagery and logo placement remain unresolved. The older [layout proposals](.scratch/fan-app-design/screen-directions.html) are prior exploration, not the selected system.
