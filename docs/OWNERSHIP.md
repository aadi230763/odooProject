# Module Ownership Map

Work is split so every member's commit history clusters around an area they
can speak to in depth during the demo. Adjust owners to your actual team.

| Owner | Primary area | Phases |
|---|---|---|
| Member A | Database schema, migrations, Organization Setup | 1, 4 |
| Member B | Auth + RBAC, Allocation / Transfer, Security hardening | 2, 6, 12 |
| Member C | Frontend architecture / design system, Dashboard | 3, 10 |
| Member D | Assets / Lifecycle, Booking, Maintenance, Audit | 5, 7, 8, 9 |

**Cross-cutting phases (0, 11, 13) are shared** by the whole team.

Everyone reviews PRs **outside** their own area so knowledge spreads and no
single module has a bus factor of one.

## Demo Talking Points (per owner)

Each owner should be able to explain, on the spot:
- **A** — the schema and the two DB-level integrity constraints (partial
  unique index for allocations; `EXCLUDE`/`btree_gist` for bookings), and
  *why PostgreSQL*.
- **B** — how RBAC is enforced (role derived from session/token) and how the
  transfer approval workflow prevents double-allocation.
- **C** — the design-token system and how the dashboard KPIs are computed live.
- **D** — the asset state machine and how maintenance/audit transitions drive
  asset status changes.
