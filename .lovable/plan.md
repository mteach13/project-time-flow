## Goal
Replace the QuickBooks export with a CSV export formatted for Zoho Books' standard Timesheet import.

## Scope
Single file: `src/pages/Export.tsx`. No schema changes, no backend, no new dependencies.

## Changes

### 1. Page copy
- Title: "Export to Zoho Books"
- Subhead: "Pick a date range and download a CSV formatted for Zoho Books Timesheet import."
- Replace the QuickBooks Desktop IIF instructions card with a Zoho Books import instructions card (Time Tracking → Timesheets → Import Time Entries).

### 2. CSV format
Switch from the current summary CSV (one row per project/member/total) to a **per-entry** CSV matching Zoho Books' Timesheet import columns:

```
Project Name, User Email, Log Date, Log Hours, Notes, Billable Status
```

- `Log Date` formatted as `yyyy-MM-dd`
- `Log Hours` as decimal hours (e.g. `1.50`), from `minutes / 60`
- `User Email` pulled from `profiles.email` (already queried on the page — just need to include it in the join)
- `Billable Status` defaults to `Billable` for every row (simplest sensible default; can be made configurable later)
- Standard CSV quoting/escaping (already handled by existing `toCSV` helper, generalized)

### 3. Preview table
Update the preview to show per-entry rows (Date, Project, Member, Hours, Note) instead of the current rolled-up summary, so what the user sees matches what gets exported. Keep the "X entries · Yh total" footer.

### 4. Remove
- `toIIF` function
- "Download IIF" button
- IIF instructions card

### 5. Filename
`zoho-timesheet-{from}-to-{to}.csv`

## Out of scope
- Live API sync (deferred to a future Option B)
- Mapping local clients/projects to Zoho IDs
- Tracking sync state on `time_entries`
