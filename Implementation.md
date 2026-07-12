# AssetFlow — Enterprise Asset & Resource Management System

> A centralized ERP platform for tracking, allocating, and maintaining physical assets and shared resources — built for the **Odoo Hiring Hackathon**.

---

## 1. Project Overview

AssetFlow digitizes how any organization (offices, schools, hospitals, factories, agencies) tracks, allocates, and maintains its physical assets and shared resources. It replaces spreadsheets and paper logs with structured asset lifecycles, centralized resource booking, and real-time visibility into *who holds what, where it is, and what condition it's in*.

The system deliberately **excludes** purchasing, invoicing, and accounting. Acquisition cost is stored for ranking/reporting only — never linked to financial logic.

**Core capabilities**

- Master data: departments, asset categories, employee directory
- Full asset lifecycle: `Available → Allocated → Reserved → Under Maintenance → Lost → Retired → Disposed` (with valid reverse transitions)
- Asset allocation with **double-allocation prevention** and a transfer-request workflow
- Time-slot booking of shared resources with **overlap prevention**
- Maintenance requests routed through an **approval workflow** before repair
- Structured **audit cycles** with assigned auditors and auto-generated discrepancy reports
- KPI dashboard, notifications, activity logs, and reports/analytics
- **Role-based access** with realistic account creation (no self-assigned admin)

**Roles:** `Admin`, `Asset Manager`, `Department Head`, `Employee`.
Signup only ever creates an **Employee**; elevated roles are assigned exclusively by an Admin from the Employee Directory.

---

## 2. Tech Stack (and why)

Every choice below is justified against the mentor's non-negotiable priorities: real relational DB, no BaaS, minimal third-party dependence, build-from-scratch, and heavily-weighted database design.

| Layer | Choice | Justification |
|---|---|---|
| **Database** | **PostgreSQL** | The single most important decision. Chosen over MySQL because AssetFlow's two hardest rules — *an asset can't be double-allocated* and *a resource can't be double-booked* — can be enforced **at the database level**, not just in app code. Postgres gives us: partial unique indexes (one active allocation per asset), `EXCLUDE USING gist` constraints over time ranges (overlap-free bookings), native `ENUM` types for lifecycle states, `CHECK` constraints, `JSONB` for category-specific fields, and transactional DDL. This is a defensible, from-scratch design that directly targets the "database design (weighted heavily)" score. |
| **Backend** | **Python + Flask + SQLAlchemy** | Lightweight, explicit, and enforces clean separation (routes → controllers → services → models). SQLAlchemy gives us a real, migration-driven schema (Alembic) instead of an opaque ORM-as-magic. No BaaS, no external platform dependency. *(The language layer is swappable if the team prefers Node/Express or Django — but the Postgres decision stays.)* |
| **Migrations** | **Alembic** | Version-controlled, reviewable schema changes. Every schema edit is a committed, revertable migration — good for Git-graded shared ownership. |
| **Frontend** | **React + TypeScript + Vite** | TypeScript catches contract mismatches at compile time (directly supports the "input validation / no silent failures" priority). Vite gives fast DX. A single shared component library + design tokens locks UI consistency early. |
| **Auth** | **Session or JWT, built in-house** | Password hashing with `bcrypt`/`argon2`, our own RBAC middleware. No third-party auth provider — we own and can explain the whole flow. |
| **File storage** | **Local disk (dev) / S3-compatible (optional)** | Asset photos/documents stored via our own upload endpoint with MIME/type validation. No hard third-party dependency for the demo. |
| **QR codes** | **Self-generated (`qrcode` lib)** | The only "smart" feature we add, and it earns its place: we generate a QR encoding the Asset Tag, printable on a label, scannable to open that asset. Built from scratch, genuinely useful, fully explainable — not trendy-tech-for-its-own-sake. **No AI/blockchain/chatbot is included** because none of them add real value to this problem. |

**Explicitly avoided:** Firebase, Supabase, MongoDB-as-BaaS, and any external API we'd depend on for core logic.

---

## 3. Architecture & Project Structure

Vertical, module-based separation of concerns. Each feature module has its own routes/controllers/services, all sharing common models, middleware, and utilities.

```
assetflow/
├── backend/
│   ├── app/
│   │   ├── __init__.py            # app factory, extension init
│   │   ├── config.py              # env-based config (Dev/Test/Prod)
│   │   ├── extensions.py          # db, migrate, bcrypt, etc.
│   │   ├── models/                # SQLAlchemy models (one file per domain)
│   │   ├── routes/                # thin HTTP layer (blueprints)
│   │   ├── controllers/           # request parsing + response shaping
│   │   ├── services/              # business logic (the real work)
│   │   ├── schemas/               # request/response validation (marshmallow/pydantic)
│   │   ├── middleware/            # auth, RBAC, error handler, request logging
│   │   └── utils/                 # helpers (asset tag gen, qr, notifications)
│   ├── migrations/                # Alembic
│   ├── tests/
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                   # typed API client (one file per module)
│   │   ├── components/            # shared design-system components
│   │   ├── pages/                 # one folder per screen/module
│   │   ├── hooks/
│   │   ├── context/               # auth/session context
│   │   ├── theme/                 # design tokens: colors, spacing, type
│   │   └── router.tsx             # routes + role guards
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── ERD.png / ERD.md
│   └── API.md
└── README.md
```

**Layering rule (enforced in review):** routes never touch the DB directly; controllers never contain business logic; services never parse HTTP. Anyone reviewing a PR checks that a change lives in the correct layer.

**Standard API response envelope** (consistent across every endpoint):

```json
{ "success": true,  "data": { ... }, "message": "..." }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "fields": { "email": "Invalid email format" } } }
```

---

## 4. Data Model (locked in Phase 1)

Core entities and the relationships everything else depends on:

- **departments** — `name`, `head_employee_id → employees`, `parent_department_id → departments` (hierarchy), `status`
- **asset_categories** — `name`, `custom_fields (JSONB)` (e.g. warranty period for Electronics), `status`
- **employees** *(also the user/account table)* — `name`, `email (unique)`, `password_hash`, `department_id`, `role (enum: admin|asset_manager|department_head|employee)`, `status`
- **assets** — `asset_tag (unique, auto AF-0001)`, `name`, `category_id`, `serial_number`, `acquisition_date`, `acquisition_cost (numeric)`, `condition`, `location`, `is_bookable`, `status (enum: available|allocated|reserved|under_maintenance|lost|retired|disposed)`
- **asset_documents** — `asset_id`, `file_path`, `type` (photo/doc)
- **allocations** — `asset_id`, `holder_employee_id`/`holder_department_id`, `allocated_by`, `expected_return_date`, `actual_return_date`, `checkin_condition_notes`, `status (active|returned|overdue)`
- **transfer_requests** — `asset_id`, `from_employee_id`, `to_employee_id`, `requested_by`, `approver_id`, `status (requested|approved|rejected|completed)`
- **bookings** — `resource_asset_id`, `booked_by`, `start_time`, `end_time`, `status (upcoming|ongoing|completed|cancelled)`
- **maintenance_requests** — `asset_id`, `raised_by`, `description`, `priority`, `photo`, `approver_id`, `technician_id`, `status (pending|approved|rejected|technician_assigned|in_progress|resolved)`
- **audit_cycles** — `name`, `scope_department_id`/`location`, `start_date`, `end_date`, `status (open|closed)`, `created_by`
- **audit_assignments** — `audit_cycle_id`, `auditor_employee_id`
- **audit_items** — `audit_cycle_id`, `asset_id`, `result (pending|verified|missing|damaged)`, `notes`
- **notifications** — `recipient_id`, `type`, `message`, `is_read`, `related_entity`
- **activity_logs** — `actor_id`, `action`, `entity_type`, `entity_id`, `metadata (JSONB)`, `created_at`

**Two DB-level integrity showpieces (call these out in the demo):**

1. **No double-allocation** — partial unique index:
   ```sql
   CREATE UNIQUE INDEX one_active_allocation_per_asset
     ON allocations (asset_id) WHERE status = 'active';
   ```
2. **No overlapping bookings** — GiST exclusion constraint (requires `btree_gist`):
   ```sql
   ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
     EXCLUDE USING gist (
       resource_asset_id WITH =,
       tsrange(start_time, end_time) WITH &&
     ) WHERE (status <> 'cancelled');
   ```

App-level checks still exist (for friendly error messages), but the database is the final line of defense — so a race condition can never corrupt state.

---

## 5. Cross-Cutting Rules (apply in *every* phase)

These are **not** deferred to the hardening phases. Every feature phase's Definition of Done must satisfy them; Phases 12 & 13 are a final systematic sweep, not the first time we think about them.

- **Input validation everywhere** — every user-facing input validated server-side (and client-side for UX). Invalid email → explicit field error, never a crash or silent failure. Consistent error envelope.
- **RBAC on every endpoint** — no endpoint trusts the client's claimed role; role is derived from the session/token.
- **Env-based config** — zero hardcoded secrets/URLs. `.env.example` committed; real `.env` git-ignored.
- **Real error handling** — try/except at service boundaries, correct HTTP status codes, central error middleware, no swallowed exceptions.
- **Activity logging** — every state-changing action writes an `activity_logs` row.

---

## 6. Phase-by-Phase Roadmap

> **How to use this:** Each phase is self-contained and ends with a **Validation Checklist**. Do not start phase N+1 until every box in phase N is checked. Dependencies are stated explicitly. `[MVP]` = must ship; `[Stretch]` = trim first if time runs short.

---

### Phase 0 — Foundations & Git Workflow `[MVP]`

**Goal:** A clean, shared repository with a branching + review discipline that produces *visible, distributed* commit history from day one. (This is graded — set it up before any feature work.)

**Tasks**
- Create the mono-repo with the structure in §3; add `backend/` and `frontend/` scaffolds that boot ("hello world" API + blank React app).
- Set up `.env.example` files for both; add `.gitignore` (venv, node_modules, `.env`, build artifacts).
- Define and document the **branching strategy**: `main` (protected, always deployable) → `develop` (integration) → `feature/<module>-<short-desc>` per person.
- Adopt **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Add a **PR template** (what/why, screenshots, checklist) and require ≥1 review approval; no direct pushes to `main`/`develop`.
- Add linters/formatters (backend: `black` + `flake8`; frontend: ESLint + Prettier) and a minimal CI check that runs them.
- Publish a **module ownership map** (see §7) so every member's commits cluster around an area they can speak to.

**Deliverables**
- Bootable repo, protected branches, PR template, commit convention doc, CI lint check, ownership map.

**Validation Checklist**
- [ ] `main` and `develop` both exist; direct push to them is blocked.
- [ ] Backend and frontend both start locally from a fresh clone using only `.env.example` as a guide.
- [ ] A test PR from a `feature/*` branch requires an approval before merge.
- [ ] Linters run in CI and fail on a deliberately bad commit.
- [ ] Every team member has made at least one commit.

---

### Phase 1 — Database Design & Schema `[MVP]`

**Goal:** Lock the entire relational model — the foundation everything else builds on. This is the heaviest-weighted area; get it right before writing feature code.

**Depends on:** Phase 0.

**Tasks**
- Produce an **ERD** (in `docs/`) covering all entities in §4 and their relationships.
- Define all tables as SQLAlchemy models with proper types: `Numeric` for cost, native `ENUM` for every status/role, real FK columns, `NOT NULL` where appropriate, timestamps on every table.
- Add the two integrity constraints (partial unique index for allocations; `EXCLUDE`/`btree_gist` for bookings) and a sequence-backed auto Asset Tag (`AF-0001`).
- Add `CHECK` constraints (e.g. `end_time > start_time` on bookings).
- Write the initial **Alembic migration** and a **seed script** with realistic demo data (departments, categories, ~1 admin + several employees, a batch of assets across states).
- Document the schema and every enum in `docs/ERD.md`.

**Deliverables**
- ERD, complete migration, seed script, schema docs.

**Validation Checklist**
- [ ] `alembic upgrade head` builds the full schema from scratch on an empty DB.
- [ ] Seed script populates a demo-ready dataset without errors.
- [ ] Inserting a second `active` allocation for one asset is **rejected by the DB**.
- [ ] Inserting an overlapping (non-cancelled) booking for one resource is **rejected by the DB**.
- [ ] Asset Tags auto-generate sequentially (`AF-0001`, `AF-0002`, …).
- [ ] ERD in `docs/` matches the actual migrated schema.

---

### Phase 2 — Backend Architecture & Auth Spine `[MVP]`

**Goal:** A layered, secure backend skeleton with working authentication and role-based access — the spine every feature module plugs into.

**Depends on:** Phases 0–1.

**Tasks**
- Wire the app factory, config classes (Dev/Test/Prod), DB session, and extension init.
- Implement **central error-handling middleware** and the standard response envelope (§3).
- Implement **auth**: signup (creates `employee` role *only*), login (email + password, hashed), session/token validation, logout, forgot-password stub.
- Implement **RBAC middleware/decorator** (`@require_role(...)`) resolving role from the session/token, never the request body.
- Implement **activity-log** writer utility and a request logger.
- Add a health-check endpoint and one protected sample endpoint to prove RBAC works.

**Deliverables**
- Bootable secured backend, auth endpoints, RBAC decorator, error middleware, logging.

**Validation Checklist**
- [ ] Signup can only create an Employee — role cannot be set via the request.
- [ ] Login returns a valid session/token; passwords are stored hashed (verified in DB).
- [ ] A protected endpoint returns `401` when unauthenticated and `403` for the wrong role.
- [ ] An unhandled error returns a clean JSON error envelope with the right status code — never a stack trace.
- [ ] Every auth action writes an activity-log row.

---

### Phase 3 — Frontend Architecture & Design System `[MVP]`

**Goal:** Lock UI consistency early. A scaffolded React app with a shared component library, design tokens, routing, auth guards, and the app shell — so every later feature slice looks and behaves consistently.

**Depends on:** Phase 2 (for auth flow).

**Tasks**
- Define **design tokens**: a single color palette, typography scale, spacing system, and shared primitives (Button, Input, Select, Modal, Table, Card, Badge, Toast). Consistent, documented, reused everywhere.
- Build the **app shell**: sidebar/nav, top bar, responsive layout, role-aware menu.
- Set up routing with **role-based route guards** and a typed **API client** wrapping the response envelope + error handling.
- Implement the **auth pages** (login, signup, forgot-password) against Phase 2 endpoints, with client-side validation and clear inline errors.
- Add a global toast/notification system for success/error feedback.

**Deliverables**
- Themed component library, app shell, routing + guards, typed API client, working auth screens.

**Validation Checklist**
- [ ] Login/signup work end-to-end against the real backend; invalid email shows an explicit inline error.
- [ ] Unauthorized routes redirect to login; role-restricted nav items hide for wrong roles.
- [ ] All components pull from the shared theme — no ad-hoc colors/spacing.
- [ ] Layout is responsive (usable on a laptop and a narrow window).
- [ ] Every API error surfaces as a readable toast/inline message, never a blank screen.

---

### Phase 4 — Organization Setup (Master Data) `[MVP]`

**Goal:** The Admin-only master data — departments, asset categories, employee directory, and role promotion — that all other modules depend on. (Screen 3.)

**Depends on:** Phases 1–3.

**Tasks**
- **Departments tab:** create/edit/deactivate; assign Department Head, optional parent department (hierarchy), Active/Inactive status.
- **Asset Categories tab:** create/edit; optional category-specific fields (e.g. warranty period) stored in `custom_fields`.
- **Employee Directory tab:** list/search employees; Admin **promotes** an Employee to Department Head or Asset Manager here — the *only* place roles are assigned; toggle Active/Inactive.
- Enforce Admin-only access on all three tabs (backend RBAC + hidden UI).

**Deliverables**
- Three-tab Organization Setup screen, full CRUD APIs, role-promotion flow.

**Validation Checklist**
- [ ] Non-admins cannot reach these screens or endpoints (403).
- [ ] A promoted employee's new role takes effect on next request (menu + permissions change).
- [ ] Category-specific fields save and reload correctly.
- [ ] Deactivating a department/employee is reflected everywhere it's referenced.
- [ ] All inputs validated (e.g. duplicate department name / invalid email rejected with clear messages).

---

### Phase 5 — Asset Registration, Lifecycle & Directory `[MVP]`

**Goal:** Register assets, browse/search/track them, and view per-asset history. (Screen 4.)

**Depends on:** Phase 4 (categories, departments).

**Tasks**
- **Register asset:** name, category, auto Asset Tag, serial number, acquisition date, cost, condition, location, photo/documents upload (with MIME/type validation), `shared/bookable` flag.
- Generate a scannable **QR code** per asset (encodes the tag/lookup URL).
- **Search/filter** by tag, serial, QR, category, status, department, location.
- Display the **lifecycle status** per asset and implement a **state-transition service** enforcing only valid transitions (e.g. `Available ↔ Under Maintenance`, `Allocated → Available`).
- **Per-asset history** view (allocation + maintenance history — populated as later phases land).

**Deliverables**
- Asset registration + directory screens, upload handling, QR generation, state-machine service, search/filter API.

**Validation Checklist**
- [ ] New asset enters as `Available` with a correct auto tag.
- [ ] Invalid uploads (wrong MIME/oversize) are rejected with a clear message.
- [ ] Search/filter returns correct results across each criterion.
- [ ] An invalid state transition is rejected by the service, not silently allowed.
- [ ] QR code renders and resolves to the correct asset.

---

### Phase 6 — Allocation, Transfer & Return `[MVP]`

**Goal:** Manage who holds what, with hard conflict rules and an approval-based transfer flow. (Screen 5.)

**Depends on:** Phase 5.

**Tasks**
- **Allocate** an asset to an employee/department with optional Expected Return Date → status `Allocated`.
- **Conflict rule:** allocating an already-held asset is blocked; UI shows the current holder and offers a **Transfer Request** instead. (Backed by the Phase 1 partial unique index.)
- **Transfer workflow:** `Requested → Approved (Asset Manager/Dept Head) → Re-allocated`, with allocation history updated automatically.
- **Return flow:** mark returned, capture condition check-in notes → status back to `Available`.
- **Overdue detection:** allocations past Expected Return Date auto-flagged (scheduled check) and feed Dashboard + Notifications.

**Deliverables**
- Allocation/transfer/return screens + APIs, overdue flagging job, history updates.

**Validation Checklist**
- [ ] Allocating a held asset is blocked and offers a transfer request (shows current holder).
- [ ] A transfer only re-allocates after approval by an authorized role.
- [ ] Return reverts status to `Available` and records check-in notes.
- [ ] An overdue allocation is flagged automatically and appears in notifications.
- [ ] Allocation history is accurate after each transfer/return.

---

### Phase 7 — Resource Booking `[MVP]`

**Goal:** Overlap-free, time-slot booking of shared/bookable resources. (Screen 6.)

**Depends on:** Phase 5 (`is_bookable` assets).

**Tasks**
- **Calendar view** of a resource's existing bookings.
- **Overlap validation:** reject overlapping slots (`9:30–10:30` vs existing `9:00–10:00` → rejected; `10:00–11:00` → allowed). Backed by the Phase 1 `EXCLUDE` constraint plus a friendly app-level pre-check.
- **Booking status** lifecycle: `Upcoming → Ongoing → Completed`, plus `Cancelled`.
- **Cancel/reschedule**; reminder notification before the slot starts.

**Deliverables**
- Booking calendar + form, overlap-safe booking API, status transitions, reminders.

**Validation Checklist**
- [ ] Overlapping booking is rejected with a clear reason; adjacent slot is accepted.
- [ ] Only `is_bookable` assets can be booked.
- [ ] Status transitions correctly over time / on cancel.
- [ ] Reminder notification fires before the slot.
- [ ] `end_time > start_time` enforced (bad ranges rejected).

---

### Phase 8 — Maintenance Workflow `[MVP]`

**Goal:** Route repairs through approval before any status change or work. (Screen 7.)

**Depends on:** Phase 5.

**Tasks**
- **Raise request:** select asset, describe issue, set priority, attach photo.
- **Workflow:** `Pending → Approved/Rejected (Asset Manager) → Technician Assigned → In Progress → Resolved`.
- Asset status auto-updates to `Under Maintenance` **on approval** and back to `Available` **on resolution** (via the state-machine service).
- Maintenance history retained per asset.

**Deliverables**
- Maintenance request screen, approval workflow API, auto status sync, history.

**Validation Checklist**
- [ ] A raised request does **not** change asset status until approved.
- [ ] On approval, asset flips to `Under Maintenance`; on resolution, back to `Available`.
- [ ] Only an Asset Manager can approve/reject.
- [ ] Rejected requests leave asset status untouched.
- [ ] Maintenance history shows on the asset's detail page.

---

### Phase 9 — Audit Cycles `[MVP]`

**Goal:** Structured verification cycles with assigned auditors and auto-generated discrepancy reports. (Screen 8.)

**Depends on:** Phase 5.

**Tasks**
- **Create an Audit Cycle:** scope (department/location) + date range.
- **Assign** one or more auditors.
- Auditors mark each in-scope asset: `Verified / Missing / Damaged`.
- **Auto-generate a discrepancy report** for flagged items.
- **Close cycle:** locks it and updates affected asset statuses (e.g. confirmed-missing → `Lost`).
- Audit history retained per cycle.

**Deliverables**
- Audit cycle creation/assignment/verification screens, discrepancy report, close-and-lock logic.

**Validation Checklist**
- [ ] Only assigned auditors can mark assets in a cycle.
- [ ] Discrepancy report lists exactly the flagged (Missing/Damaged) items.
- [ ] Closing a cycle locks it (no further edits) and updates statuses (missing → `Lost`).
- [ ] Audit history is retained and viewable per cycle.
- [ ] Scope filtering (dept/location/date) selects the right assets.

---

### Phase 10 — Dashboard, Notifications & Activity Logs `[MVP]`

**Goal:** Real-time operational snapshot per role, plus the notification and audit-log surfaces. (Screens 2 & 10.)

**Depends on:** Phases 4–9 (data to aggregate/notify on).

**Tasks**
- **KPI cards:** Assets Available, Allocated, Maintenance Today, Active Bookings, Pending Transfers, Upcoming Returns — computed live from the DB.
- **Overdue returns** highlighted separately from upcoming.
- **Quick actions:** Register Asset, Book Resource, Raise Maintenance.
- **Notifications feed:** Asset Assigned, Maintenance Approved/Rejected, Booking Confirmed/Cancelled/Reminder, Transfer Approved, Overdue Return, Audit Discrepancy — with read/unread.
- **Activity log** view (who did what, when), role-scoped.

**Deliverables**
- Role-aware dashboard, notification center, activity-log viewer.

**Validation Checklist**
- [ ] Every KPI reflects live DB state (change data → number updates).
- [ ] Overdue returns are visually distinct from upcoming.
- [ ] Each workflow event from Phases 6–9 produces the correct notification.
- [ ] Activity log records state-changing actions with actor + timestamp.
- [ ] Dashboard content differs appropriately by role.

---

### Phase 11 — Validation & Error-Handling Hardening `[MVP]`

**Goal:** A systematic sweep confirming *every* input fails gracefully and *every* error is handled — closing gaps left across earlier phases. (Not the first time we do validation; the final audit of it.)

**Depends on:** Phases 4–10.

**Tasks**
- Audit every endpoint for server-side validation and consistent error envelopes.
- Test boundary/edge cases: empty fields, wrong types, oversized uploads, invalid dates, out-of-range enums, malformed IDs.
- Confirm every form gives clear inline feedback and no silent failures.
- Verify all failure paths return correct HTTP status codes.
- Add a shared error-boundary on the frontend so no crash shows a blank screen.

**Deliverables**
- Validation-audit checklist (filled), fixes for every gap, frontend error boundary.

**Validation Checklist**
- [ ] Submitting each form with invalid data yields a clear, specific message.
- [ ] No endpoint returns a 500 for predictable bad input.
- [ ] Oversized/wrong-type uploads are rejected cleanly.
- [ ] A forced runtime error renders a graceful fallback, not a blank page.
- [ ] Error responses are consistent in shape across the whole API.

---

### Phase 12 — Security & Performance Hardening `[MVP]`

**Goal:** Close security holes and tune performance before the demo — deliberately a dedicated phase, not an afterthought.

**Depends on:** all prior phases.

**Tasks**
- **Security:** re-audit RBAC on every endpoint; confirm password hashing; add rate limiting on auth; confirm parameterized queries (no injection); sanitize any rendered user input (no XSS); set secure headers; verify no secrets in the repo/logs; enforce CSRF protection where relevant.
- **Performance:** add indexes on frequent filter/FK columns; eliminate N+1 queries (eager-load where needed); paginate large lists; profile the heaviest dashboard/report queries.
- Confirm env-based config is used everywhere (no hardcoded URLs/keys).

**Deliverables**
- Security checklist (filled), performance notes, added indexes, pagination.

**Validation Checklist**
- [ ] Every privileged action is re-tested for correct role enforcement.
- [ ] Auth endpoints are rate-limited; brute-force is impractical.
- [ ] A known injection/XSS attempt is neutralized.
- [ ] List endpoints paginate; no obvious N+1 remains on key screens.
- [ ] Grep confirms zero hardcoded secrets/URLs.

---

### Phase 13 — Presentation Prep & Shared Ownership `[MVP]`

**Goal:** A rehearsed demo where **each member owns and can explain a distinct part of the system** in depth.

**Depends on:** all prior phases.

**Tasks**
- Load a polished **demo seed dataset** covering every workflow (an allocation, a blocked double-allocation, an overlapping booking rejection, a maintenance approval, a closed audit with a discrepancy).
- Write a **demo script / happy path** that touches every graded area, especially the two DB-level integrity showpieces.
- Assign **ownership** (see §7) so every member presents at least one module and can answer "why/how" — including *why Postgres*, *how the EXCLUDE constraint works*, *how RBAC is enforced*.
- Prepare answers on architecture, DB design, and the one "smart" feature (QR).
- Full rehearsal + timing; verify a clean run from a fresh clone + seed.

**Deliverables**
- Demo dataset, demo script, per-member ownership + talking points, rehearsal complete.

**Validation Checklist**
- [ ] A fresh clone → migrate → seed → run produces the full demo with no manual fixes.
- [ ] Every member can independently demo and explain their module.
- [ ] The double-allocation and overlap-rejection cases both demo cleanly.
- [ ] Someone can explain the schema and the two DB constraints on the spot.
- [ ] The full run fits the time slot.

---

## 7. Team Collaboration

**Shared ownership** is graded, so work is split so that every member's commit history clusters around an area they can speak to in depth. A suggested split (adjust to team size):

| Owner | Primary area |
|---|---|
| Member A | Database schema, migrations, Org Setup (Phases 1, 4) |
| Member B | Auth + RBAC, Allocation/Transfer, Security hardening (Phases 2, 6, 12) |
| Member C | Frontend architecture/design system, Dashboard (Phases 3, 10) |
| Member D | Assets/Lifecycle, Booking, Maintenance, Audit (Phases 5, 7, 8, 9) |

Cross-cutting phases (0, 11, 13) are shared. Everyone reviews PRs outside their own area so knowledge spreads.

**Git workflow**

- **Branches:** `main` (protected, deployable) ← `develop` (integration) ← `feature/<module>-<desc>`. No direct commits to `main`/`develop`.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`), scoped and meaningful — not one giant "final commit."
- **Pull requests:** every change via PR into `develop`; PR template (what/why + screenshots + self-check); **≥1 approval required**; reviewer confirms the change sits in the correct architectural layer.
- **Merge strategy:** squash-merge feature branches for a clean history; `develop → main` only at phase gates that pass their checklist.
- **Cadence:** small, frequent PRs so every member has continuous, visible contribution across the timeline.

**Definition of Done (global):** code is modular and in the right layer, commented where non-obvious, validated, error-handled, env-configured, reviewed, merged via PR — and the phase's checklist is fully green before the next phase begins.