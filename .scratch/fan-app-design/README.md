# Fan app design comparison

Local static mockups for choosing a UI direction before Expo components are built.

- Primary user: a fan planning and completing local travel to or from a race, then using earned points for challenges and discounts.
- Target: iOS and Android, handheld touch, readable while travelling; background journey recording is required.
- Three options hold the same route, challenge, store content and phone width constant. They vary information layout: route list first, map first, or compact comparison first.
- Visual proposals: near-black surfaces, white primary text, gray support text, restrained blue selection/action color, system sans-serif. No invented team logo, imagery, decorative labels, gradients, or animation.
- Controls inside phone mockups are static representations. The comparison is not a working app.
- Route durations, distances, emissions, challenge totals, and account balance are illustrative. Store prices and the carbon/points methodology are deliberately unset. Sample vouchers imply no actual merchant offer.
- Confirmed challenge cost: 500 points to submit; contributions of at least 10 points after admin approval.

Acceptance for this artifact: three distinct route compositions; the same representative content in all three; emissions remain prominent; static challenge creation/contribution and discount-store views use confirmed rules; one local HTML file without external assets; responsive source rules with at least 16px outer gutters.

## Verification

- Local file readable through `curl`; retrieved bytes match the source.
- HTML parser check: three directions, nine phone views, unique IDs, three valid internal navigation anchors, no external assets, and file size below 512 KB.
- All three challenge views show the confirmed 500-point submission fee and 10-point minimum contribution. Store prices remain unset.
- Rendered appearance and browser interaction remain unverified: collaborative preview lost its automation host; the fallback computer-use browser inventory was empty.
- User design selection is pending. No Expo UI components have been created.
