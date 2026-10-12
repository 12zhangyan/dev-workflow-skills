# Order status review fixture

This dependency-free local module accepts the newly approved PARTIAL status through submit(). statusLabel() must display PARTIAL as Partial. DRAFT and READY keep their existing display labels. exportCompleted() intentionally exports COMPLETED orders only; PARTIAL is not eligible for this export.

Review the supplied change.patch against the full current source and tests. The patch is a supplied review artifact; the fixture Git snapshot already contains that change, so a clean workspace is expected. Source and tests are complete; there is no hidden service, database, or dependency.

Focused verification: node --test test/submit.test.js test/export.test.js. A green result only proves the assertions that actually run.
