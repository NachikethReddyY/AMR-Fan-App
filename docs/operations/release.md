# Delivery and release

No production environment, release credentials or persistent dev service is
configured. Do not infer a destination or deploy as part of verification.
Read [Contributing](../CONTRIBUTING.md) for commits and PRs.

For explicitly authorized delivery:

1. Check scope, accepted behavior, local proof, `bug.md` and the owning issue.
   Run `pnpm check` and relevant security/runtime checks before pushing.
2. Review the exact diff, preserve unrelated files and exclude plans/raw evidence.
   Confirm all required project skills and adapter links are included.
3. For a public release, confirm visibility, rights to included code/assets and
   absence of secrets/private identifiers. Aston Martin names, logos, photos and
   ESG reports are third-party material; do not imply ownership or endorsement.
4. Before deployment, confirm environment, provider accounts, spend limits,
   migrations, backup/restore needs, observability and a concrete rollback.
   For state changes, test rollback/recovery without erasing valid transactions.
5. Execute only authorized actions. Monitor checks on the latest revision and
   verify the delivered behavior. Report committed, pushed, merged or deployed
   only when observed.
6. Update the owning issue, roadmap and work record with the observed result and
   remaining risk. A merge does not prove a deployment.

Written by gpt-6-astra through Codex (T3 Code).
