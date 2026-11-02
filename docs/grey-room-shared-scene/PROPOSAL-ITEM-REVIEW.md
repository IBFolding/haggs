# Choose individual proposal additions

Scene proposal review now offers one checkbox for each proposed person and prop. The visual preview and explicit Apply action use the same selection. Existing names are marked as already in the scene and cannot be replaced through this review. Group toggles preserve individual exclusions; reviewing a new reply starts with all proposed additions selected again.

This lets users resolve a figure-capacity limit by choosing specific people, without editing JSON or rejecting the whole group. Empty selections add nothing. Omitted selections preserve the prior all-items behavior for existing callers. Duplicate and out-of-range selections cannot add extra items.

The controls retain 44-pixel touch rows, accessible labels and wrapped long names. No model calls, provider configuration, project schema changes or migrations are involved. Automatic proposal generation remains disabled until separately approved rollout and live validation.

Focused tests cover selected preview/apply candidates, existing-data preservation, capacity resolution, duplicates, empty selections and group exclusions. Full-suite/build/browser results are recorded in the local release evidence.
