## ADDED Requirements

### Requirement: Animations respect reduced motion
#### Scenario: User has `prefers-reduced-motion: reduce`
- **WHEN** skeletons, loaders, transitions, or shimmer effects render
- **THEN** they disable or minimize animations (no shimmer/pulse) while keeping content visible.

### Requirement: Consistent loading/transition styles
#### Scenario: Showing page-level loading states or transitions
- **WHEN** page loaders or transitions are displayed
- **THEN** they use shared utility styles/tokens (timing, easing, shadow/blur) defined once and reused, avoiding per-page bespoke animation values.
