# Workflow evaluation fixtures

These directories contain intentionally incomplete or faulty implementations used as inputs for skill evaluations. They are not product modules, and their tests do not all pass before the evaluated agent performs its task. Do not fix them during ordinary repository cleanup.

- review-preview: Java review aggregation, with a real off-by-one and an unrelated false-positive claim.
- review-state-consumers: Node.js review input; its three tests pass while a new status has an incomplete label consumer and one test bypasses the target function. change.patch is the supplied diff already present in the current source.
- repair-query-contract: Node.js repair input; four of six contract tests initially fail. The original test/query.test.js is protected by the host contract; add another regression test only when useful.
- business-async-state: Synthetic business contract, implementation and event evidence disagree about when completion is allowed.
- report-ownership: Node.js loop input for the independent-recheck case; getReport skips the documented ownership check and its passing tests miss cross-user reads.
- verification-evidence: Passing price tests share a wrong implementation constant; Java stub/SQL and synthetic browser records test evidence boundaries, including a valid local-only draft.

For a live evaluation, copy one directory to an empty temporary directory outside this repository, initialize Git there with a local test identity, and commit only that fixture as the baseline. Pass the temporary directory to scripts/run-host-evals.js through --workspace; the standard runner uses a separate clone and never modifies the supplied source workspace. Do not stage or commit the user's working tree to prepare a fixture.

See docs/research/2026-10-10-more-examples.md for case IDs, source references and measured results. The failing fixture tests are intentional input evidence; node scripts/check-all.js validates the skill collection independently.
