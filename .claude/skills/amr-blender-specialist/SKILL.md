---
name: amr-blender-specialist
description: Research-led Blender and lightweight 3D asset direction for the Aston Martin F1 fan React Native app. Use when evaluating, creating, optimizing, licensing, or integrating Blender assets; do not use as permission to expand product scope or claim Blender MCP access.
---

# AMR Blender/3D specialist

Use Blender for a small number of purposeful, branded visual assets that improve fan comprehension or motivation. This skill does not authorize product-code edits, brand/logo reproduction, external publishing, provider activation, or scope expansion.

## Evidence and discovery

- Inspect the current repository, `AGENTS.md`, `DESIGN.md`, active plan and installed package list before proposing an asset.
- Cite current authoritative sources for Blender version/export behavior, glTF, Expo rendering APIs, Android performance, brand references and licenses. Record access date and separate local observations from source claims.
- Verify Blender through `blender.exe --version` and a background Python smoke command. Treat a Blender MCP server as available only when an exposed callable tool or a verified local endpoint responds; never infer it from Blender installation. If absent, use deterministic Blender CLI/Python scripts and report the limitation.

## Asset gate

For every proposed asset state: user problem solved, exact placement, fallback, licensing/provenance, target file format, triangle/material/texture budgets, loading behavior and proof. Prefer 2D or vector when the same result is clearer. No 3D asset is justified by decoration alone.

- Use glTF/GLB for runtime delivery where a 3D asset is accepted; keep one material when practical, baked/embedded textures, no animation unless required.
- Mobile default budget: <=10k triangles for a hero prop, <=2k for an icon-sized prop, <=1 1024px texture (prefer 512px), <=1 draw call where practical; measure actual file size and frame time on Android before acceptance.
- Export with transforms applied, clean names, consistent origin, scale and normals. Remove hidden cameras/lights, unused materials and orphan data. Test loading failure and a static fallback.
- Keep assets brand-safe: use the approved palette and abstract track/circuit forms. Do not recreate proprietary car models, team logos, sponsor marks, driver likenesses or scraped imagery without documented permission/licence.

## React Native boundary

Keep asset loading lazy and bounded; never block the activity submit or impact data on a 3D scene. Provide an accessible text/card equivalent and respect reduced-motion/system animation settings. Android emulator proof must report device/API, build, steps and artifact; screenshots do not prove memory, frame time, or native-device parity.

## Overnight scope

The preferred overnight deliverable is one optional static GLB or pre-rendered transparent PNG used as a hero/empty-state accent, with a tested text fallback. Defer interactive WebGL, AR, continuous animation, custom shader pipelines, remote asset CDN, full car/track models and any Blender MCP setup unless separately verified and approved.

Written by gpt-6-astra through Codex (T3 Code).

## Mandatory rendered visual proof

Before recommending any produced Blender asset for integration, actually render and open its image or inspect its viewport. Compare the observed output with its intended AMR F1 fan use, approved palette, content hierarchy, accessibility and static/text fallback. Record the concrete observed result, defects or limitations, and the exact artifact path. A successful export, script run, or source inspection alone does not satisfy this gate. Do not create assets before the build scope is approved.
