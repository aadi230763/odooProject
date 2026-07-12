# Pull Request

## What
<!-- A concise summary of what this PR does. -->

## Why
<!-- The motivation / which phase task or checklist item this addresses. -->

## Screenshots / Evidence
<!-- UI screenshots, API responses, or test output where relevant. -->

## Self-Check
- [ ] Change lives in the **correct architectural layer** (routes → controllers → services → models).
- [ ] All user input is **validated server-side**; errors use the standard envelope.
- [ ] Every privileged endpoint enforces **RBAC** (role from session/token, not the body).
- [ ] No hardcoded secrets/URLs — config comes from env.
- [ ] State-changing actions write an **activity-log** row.
- [ ] Linters/formatters pass (`black`+`flake8` / ESLint+Prettier).
- [ ] Tests added or updated where meaningful.
- [ ] Commits follow **Conventional Commits**.

## Reviewer Checklist
- [ ] ≥1 approval given.
- [ ] Confirmed the change is in the right layer.
- [ ] Verified the relevant phase Validation Checklist items still hold.
