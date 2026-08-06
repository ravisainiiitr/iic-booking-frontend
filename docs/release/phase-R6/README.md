# Phase R.6 — Frontend pointer

**Primary docs:** `iic-booking-backend-deploy/docs/release/phase-R6/`

## UI status

| Feature | Status | Path |
|---------|--------|------|
| RA inventory (read-only) + queue | Implemented | `src/pages/RemoteAnalysis.tsx` |
| Analysis Workspace software **selection** | R6 enhancement | `src/pages/AnalysisWorkspace.tsx` |
| Auto PC (user never picks) | Implemented | Workspace / Launch — no PC picker |
| Catalog / Eq↔Software SPA CRUD | Deferred (Django Admin) | Note in `EquipmentForm.tsx` |
| License SPA CRUD | Deferred | Licensed column read-only only |

## Branch

`feature/r6-remote-analysis-software-centric` — Workspace passes `mapping_id` / `catalog_id` / `software_slug` to `analyzeBookingData`.
