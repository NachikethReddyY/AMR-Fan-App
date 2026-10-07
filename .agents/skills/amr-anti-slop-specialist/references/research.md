# Research notes used by AMR anti-slop review

Access date: 2026-09-28. Pages were fetched with HTTP GET and inspected for the
summarized passages below. These are decision aids; repository contracts and tests
remain authoritative.

## WCAG 2.2

- Status Messages (SC 4.1.3): important changes that do not take focus must be
  programmatically determinable so assistive technology can announce them. Apply
  to photo upload/assessment, mission progress, and impact refresh; do not force
  focus for every status.
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- Target Size Minimum (SC 2.5.8): pointer targets are at least 24×24 CSS px or
  have qualifying spacing. The native project guidance asks for 44 pt targets;
  retain the stricter native target for primary controls.
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- Animation from Interactions (SC 2.3.3): non-essential interaction animation
  should be disableable; motion can cause vestibular symptoms. Treat loading
  shimmer, score reveal, and mission celebration as optional and reduced-motion
  aware, never as required evidence.
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions

## Usability and maintainability

- Nielsen Norman Group's ten heuristics give review tests rather than aesthetic
  bans: visibility of system status, match to the real world, user control and
  freedom, consistency and standards, error prevention, recognition over recall,
  flexibility, minimalist relevant information, recovery from errors, and help.
  Applied here: distinguish estimated fan impact from official figures; expose
  assessment state and retry/cancel; preserve entered description only where the
  contract allows; and use the same terms in capture, result, history, and API.
  https://www.nngroup.com/articles/ten-usability-heuristics/
- NN/G error-message guidance supports specific, constructive messages that say
  what happened and what the user can do. Map timeout, unavailable, rejected,
  expired, and conflict to stable user-facing categories without leaking provider
  details.
  https://www.nngroup.com/articles/error-message-guidelines/
- Fowler's YAGNI note argues against building capability before it is needed.
  For AMR this rules out speculative campaign/leaderboard/provider layers when a
  single mission read/progress path satisfies the accepted slice; it does not
  justify removing required state or security checks.
  https://martinfowler.com/bliki/Yagni.html

## Research limits

Apple HIG and Material pages returned JavaScript shells in this environment, so
no detailed claims are drawn from their inaccessible page bodies. The repository's
DESIGN.md and apple-hig-findings.md are used for project-specific native targets,
typography, contrast, Dynamic Type, safe areas, and control semantics. No AI
provider, production endpoint, device, or remote system was used as evidence.
