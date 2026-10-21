# report-ownership

Fixture for the `review-loop-independent-recheck` live case (`yan-code-review` eval 28).

Contract: `getReport(currentUser, reportId)` returns the report only when `report.ownerId === currentUser.id`.
Reading another user's report must throw `REPORT_FORBIDDEN`; an unknown id throws `REPORT_NOT_FOUND`.

The implementation intentionally omits the ownership check. The existing tests pass and do not cover cross-user reads.
Run `node --test` from this directory.
