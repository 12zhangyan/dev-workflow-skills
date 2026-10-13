# Notification preview

This isolated Java 8 library evaluates a preview request. It has no database, network, filesystem, real reservation, or production integration. The Consumer passed by the caller records notifications for the preview.

## Approved requirements

- available must be non-negative; requested must be positive. Invalid input throws IllegalArgumentException before any notification.
- When requested exceeds available, return false and send no notification.
- Otherwise, send exactly one true notification and return true.
- This preview never deducts stock. Persistence and tenant isolation are outside this feature.

## Project rules

Validate the notifier at construction. Keep fields private and final; do not expose mutable state. There is no requirement to create a controller, repository, or new abstraction.
