# Security policy

Security work is proportional to exposure and impact. The app is currently an
Expo starter with no live backend. Supported security maintenance covers the
current main branch; no released service or supported release series exists yet.

Before changing auth, data access, uploads, AI, paid integrations or CI, read
[security requirements](docs/internals/security.md). For checks and DAST, use
[security testing](docs/operations/security-testing.md).

## Reporting a vulnerability

Do not put credentials, private user data or an exploitable security report in
a public issue, discussion or PR. Use GitHub's private vulnerability reporting
if the repository's Security tab offers it. Otherwise ask the repository owner
through an existing private channel for a reporting route. No dedicated security
email address or response-time promise has been established.

Provide the affected version, minimal reproduction with synthetic data, impact,
and any proposed fix. Share only what is needed. Do not test another person's
account, a provider endpoint or a live deployment without explicit authorization.

For a confirmed leak, revoke/rotate the credential first, then assess access and
repair the cause. Deleting a file does not revoke a secret. Keep sensitive incident
evidence outside the repository and limit access.

Written by gpt-6-astra through Codex (T3 Code).
