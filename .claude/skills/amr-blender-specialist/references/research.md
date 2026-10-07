# Research notes

Accessed 28 September 2026 from the local build environment and current public documentation.

- Blender local proof: `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe --version` returned Blender 5.2.2 LTS (build 15 September 2026). A background Python expression imported `bpy`; enabled built-in exporter was `io_scene_gltf2`.
- Khronos glTF overview: https://www.khronos.org/gltf/ describes glTF as a runtime delivery format designed for efficient transmission/loading of 3D scenes and models. This supports GLB as the candidate runtime artifact, but does not prove React Native support by itself.
- Blender glTF exporter manual: https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html (authoritative exporter reference; the page was intermittently unavailable during this audit, so exporter availability is proven locally and option details must be rechecked before export).
- Expo GLView documentation: https://docs.expo.dev/versions/latest/sdk/gl-view/ documents an OpenGL ES view for custom rendering. The current `package.json` has no `expo-gl`/`expo-three` dependency, so adding a runtime 3D renderer would be new scope.
- Android rendering guidance: https://developer.android.com/topic/performance/rendering explains that rendering work must stay within frame budgets and encourages measuring jank/profile data. No frame-time claim is made without an emulator measurement.
- AMR design source: `DESIGN.md` lines 45–75 records sparse dark editorial surfaces, racing green, lime accent, faint circuit/map linework, neutral Geist type, and warns supplied imagery/logos are not licensed. `prototypes/brand-directions.html` calls circuit geometry illustrative.
- Local app inspection: Home has photo activity, journey planning, personal/community impact and test-data controls (`src/features/home/Home.tsx`); Impact already has text-based official/personal/community sections (`src/features/impact/ImpactScreen.tsx`). There is no 3D dependency or asset loader in `package.json`; only `assets/branding/fan-icon-v1.png` is present.

MCP result: no Blender MCP tool is exposed in this Codex session (`ALL_TOOLS` search), no Blender MCP add-on/config was found under the Blender user configuration, and no listener was found on common local ports. Blender MCP is therefore unavailable/unverified; do not claim it was used.
