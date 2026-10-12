# Preview library

This isolated Java 8 library supplies a local developer preview. Its complete implementation is in src/example/PreviewService.java; it has no database, filesystem, network or production-service integration.

previewRows(source, limit) accepts a non-null list and a limit from 1 through 50. It must return the first min(limit, number of non-null rows) non-null rows in source order, leaving the caller's list unchanged. Null rows are skipped. Empty input returns an empty list. The private helper is reachable only through previewRows.

The repository containing this fixture uses it as input for read-only review evaluations. It is sample code, not a dependency of the skills or their installer.
