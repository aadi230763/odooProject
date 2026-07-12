# Contributing to AssetFlow

Shared, distributed ownership is graded — so our Git discipline matters as
much as the code. Follow these rules on every change.

## Branching Strategy

```
main      ← protected, always deployable. Only phase-gate merges from develop.
 └─ develop   ← integration branch. All feature work merges here first.
     └─ feature/<module>-<short-desc>   ← one branch per person, per task.
```

- **`main`** — protected. No direct pushes. Receives `develop` only at phase
  gates that pass their Validation Checklist.
- **`develop`** — protected. No direct pushes. All features merge here via PR.
- **`feature/*`** — your working branches. Examples:
  - `feature/auth-login`
  - `feature/assets-registration`
  - `feature/db-schema`

## Commit Convention — Conventional Commits

Format: `<type>(<optional scope>): <description>`

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `chore` | Tooling, deps, config (no product code) |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or fixing tests |

Examples:
```
feat(auth): add signup endpoint that only creates employees
fix(bookings): reject overlapping slots at the service layer
docs(readme): document fresh-clone setup steps
```

Keep commits small, scoped, and meaningful — **not** one giant "final commit."

## Pull Requests

- Every change goes through a PR into `develop` (never a direct push).
- Fill out the PR template (what/why, screenshots, self-check).
- **At least 1 approval is required** before merge.
- The reviewer confirms the change sits in the **correct architectural layer**
  (routes never touch the DB; controllers hold no business logic; services
  never parse HTTP).
- **Squash-merge** feature branches for a clean history.
- Review PRs outside your own area so knowledge spreads across the team.

## Architectural Layering Rule (checked in review)

```
routes (HTTP)  →  controllers (parse/shape)  →  services (business logic)  →  models (DB)
```

A change must live in the correct layer. This is a standing review checklist item.

## Definition of Done (global)

Code is modular and in the right layer, commented where non-obvious,
validated, error-handled, env-configured, reviewed, and merged via PR — and
the phase's checklist is fully green before the next phase begins.
