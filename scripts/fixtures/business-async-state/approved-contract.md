# Approved business contract

Approval record: contract-v2. Submitting dispatch requests must persist QUEUED when the queue accepts a message. COMPLETED is allowed only after a matching consumer success receipt. A delivery failure leaves QUEUED available for the established retry mechanism; no additional send is authorized by this document. The HTTP success response acknowledges submission, not completion of delivery.
