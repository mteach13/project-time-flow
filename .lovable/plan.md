# Time Tracking App for Design Agency — MVP Plan

## Planning approach
For MVP, **replace the spreadsheet entirely**. Simpler than syncing with Google Sheets (which needs OAuth, sheet-shape assumptions, conflict handling). The in-app planner becomes the single source of truth feeding the timer, reporting, and exports. Sheets sync can come later.

## Core features

### 1. Auth & roles
- Email/password + Google sign-in (Lovable Cloud)
- Two roles: **admin** and **member**, stored in a separate `user_roles` table
- Admins manage projects, clients, users, planning, exports, and imports
- Members log time on projects assigned to them

### 2. Clients & projects
- Admin CRUD for clients and projects (name, client, status, optional hourly budget)
- Assign members to projects so they appear in each member's timer dropdown

### 3. CSV import (seed data)
- Admin "Import" screen with two upload slots: **Clients CSV** and **Projects CSV**
- Drag-and-drop a CSV → app auto-detects columns and shows a **column-mapping step** (e.g., map "Customer Name" → `client.name`, "Job" → `project.name`)
- Supports common shapes from QuickBooks/Harvest/Toggl/etc. exports — mapping handles the differences
- Preview table of the first ~20 rows with detected mappings before commit
- On import: dedupe by name (case-insensitive), create missing clients first, then projects linked to them
- Result summary: created / skipped / errors, with downloadable error log
- Re-runnable: importing again updates existing records by name match instead of duplicating
- Optional third import: **Team members CSV** (name + email) to bulk-invite users

### 4. Monday planning board
- Weekly grid: rows = team members, columns = projects, cells = estimated hours that week
- Admin fills in during Monday meeting; members see their own row read-only
- Week selector (defaults to current week, Mon–Sun)
- Totals per person and per project in the margins
- "Copy from last week" shortcut

### 5. Time tracking
- **Live timer**: pick project + optional note, start/stop, running timer pinned in header
- **Manual entry**: weekly timesheet grid + an "add entry" form for date/duration/note
- One entry = project + member + date + minutes + note
- Members edit/delete own entries; admins edit anyone's

### 6. Dashboards
- **Member view**: this week's planned vs. actual hours per project, running timer, recent entries
- **Admin view**: all members' planned vs. actual for the week, per-project totals, over/under indicators

### 7. QuickBooks Desktop export
- Export screen: pick date range (default last week) + optional project/client filter
- Two download buttons:
  - **CSV** — one row per project per member with total hours
  - **IIF** — QB Desktop timer activity import format (`TIMERHDR` / `TIMEACT`)
- Preview table before download

## Screens
1. Login / signup
2. Dashboard (role-aware)
3. Timer + my time entries
4. Weekly timesheet (manual grid)
5. Planning board (admin edit, member read)
6. Clients & projects (admin)
7. Team / users & roles (admin)
8. **Import** (admin)
9. Exports (admin)

## Data model (high level)
- `profiles` (id → auth.users, full_name)
- `user_roles` (user_id, role) — separate table per security best practice
- `clients` (id, name)
- `projects` (id, client_id, name, status, hourly_budget)
- `project_members` (project_id, user_id)
- `time_entries` (id, user_id, project_id, started_at, ended_at, minutes, note, source)
- `plan_entries` (id, week_start_date, user_id, project_id, estimated_hours)

RLS: members see/modify their own entries and read assigned projects; admins see everything.

## Technical notes
- Lovable Cloud (Supabase) for auth, DB, RLS
- CSV parsed client-side (PapaParse) — no server needed for import
- Running timer state persisted in DB so it survives refresh and follows the user across devices
- IIF export generated client-side as plain text
- Week boundaries: Monday 00:00 → Sunday 23:59, default America/New_York (confirm during build)

## Out of scope for MVP
- Two-way Google Sheets sync
- Direct QuickBooks Online API integration
- Importing historical time entries (only clients/projects/people are seeded)
- Invoicing, billing rates, approvals
- Client read-only access