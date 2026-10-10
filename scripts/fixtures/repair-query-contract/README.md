# Order query contract fixture

queryOrders(rows, tenantId, options) returns { items, total }. Only the caller's tenant is visible. keyword, when non-empty, is a case-sensitive substring match on name. Filters apply before pagination. total is the number of all matching rows before pagination. offset and limit are non-negative integers; limit=0 yields an empty page but retains total. The input array is not mutated.

This is an isolated in-memory module with no database or network. Run node --test test/query.test.js (and any newly added test/*.test.js). Existing expectations reflect the approved contract, not a proposed change. No dependency installation is needed.
