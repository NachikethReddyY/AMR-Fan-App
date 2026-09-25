# Team discussion HTML verification

Checked 25 September 2026. Artifact: `docs/fan-app-team-brief.html`.

## Observed results

- Local `curl --fail --silent --show-error` read succeeded and returned exactly the file's bytes: 39,033 bytes, below the 512 KB limit. SHA-256 prefix: `281022d3016c2859`.
- Python HTML parsing confirmed matching title and H1, 12 unique IDs, six major sections, three native disclosures, one valid internal jump link, and 26 HTTPS source links with `target="_blank"` and `rel="noopener noreferrer"`.
- Seventeen focused content assertions passed: non-refundable submission fee including rejection; fee excluded from rank; 10-point contribution minimum; top-three approval/ranking; backlog without refunds; daily outbound/return allowance; 50 points/kg and 2,000-point cap; race-local window; start and completion requirement; native background tracking; discount range; admin tree price; account-name assignment; planting reassignment; disclosed planting demonstration; Convex direction; explicitly open interview decisions.
- Source inspection confirmed one inline stylesheet, no scripts or external assets, no forms/frames/objects, no inline event handlers, no local filesystem paths or storage/network code, and no duplicate IDs.
- CSS source includes 16px minimum mobile gutters, a 43px maximum document heading, visible section separators, neutral borders on open and closed disclosures, visible keyboard focus, stacked mobile flows, and wrapping source URLs.
- Content review keeps the tentative driving baseline, rounding, rejected-submission editing/resubmission fees, overnight journey attribution, challenge cutoff/tie rules, tree privacy/reassignment exceptions, and commercial arrangements open. No free resubmission or real reward fulfilment was assumed.
- The glossary and working Markdown plan record the latest fee and daily-limit decisions. Existing screen-direction mockups were left unchanged.

## Limits

- Rendered appearance, actual responsive layout, link/disclosure interaction, and assistive-technology behavior remain unverified. No browser testing was requested or performed for this artifact.
- External link targets were carried from the prior documentation/research work; this check validates markup, not current remote availability.
- Acceptance examples describe future app behavior, not executed app tests. No Maps, Convex, native-device, live reward, or planting integration is verified by this task.
- This task performed local document edits only. It did not commit, push, deploy, or publish. A concurrent workspace commit advanced HEAD during the task; it was not created by this agent and was left untouched.

The local HTML deliverable is complete. Remaining product decisions are intentionally preserved for team discussion; the broader interview and app build are not marked complete.

## Follow-up: callouts for doubts and discussions

The updated artifact adds 35 labelled callouts: 15 open questions, nine discussion proposals, seven items needing verification, and four evidence limits. All six team agenda items and 34 specific uncertainty/proposal passages are covered, including doubts embedded in tables and supporting notes.

A before/after HTML parse confirmed that all original wording, heading and section order, source links, and existing IDs are preserved. Only callout labels were added to the text. Main width and the existing split layout rules remain unchanged. Balanced markup, local `curl` readability, link attributes, and the size limit passed. Current size: 43,149 bytes; SHA-256: `98f8cb7751950eab43ec1780671cda024bb09d7afd30babedbd7c98a6caa6c4e`.

Yellow callouts identify open questions and verification limits; cyan callouts identify proposals for discussion. Both use visible text labels. Rendered appearance and browser interaction remain unverified. No publication was performed.
