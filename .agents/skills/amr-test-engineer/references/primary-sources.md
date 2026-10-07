# Primary testing sources

These references anchor the decisions in `SKILL.md`; consult the relevant section rather than copying generic tutorials.

- Node.js test runner: https://nodejs.org/api/test.html — built-in subtests, concurrency controls, hooks and assertions; use the repository's `node --test` scripts and serialize database tests where shared fixtures require it.
- node-postgres transactions: https://node-postgres.com/features/transactions — transactions must use one checked-out client from `BEGIN` through `COMMIT`/`ROLLBACK`; this is why concurrency and rollback tests use a real PostgreSQL connection.
- Testing Library guiding principles: https://testing-library.com/docs/guiding-principles/ — tests should resemble user interaction and avoid implementation details; query accessible roles/labels/statuses.
- OWASP API Security Top 10 (2023): https://owasp.org/API-Security/editions/2023/en/0x11-t10/ — API tests should cover broken object/function authorization, unrestricted resource consumption, unsafe consumption and improper inventory; map these to owner/admin scope, limits, provider failures and endpoint contract tests.
