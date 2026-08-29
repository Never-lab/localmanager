# Task 8 report

## Important findings fixes

- Locked `closeMonth` before advancing state or starting network work, so re-entrant calls are ignored until the whole close finishes.
- Remembered the run ID after a successful cloud save and wired “Riprendi partita” to `GET /api/saves/:runId`; the menu disables resume with an Italian hint when no local run ID is known.
- Rendered client-side SVG markers only over the static basemap, avoiding duplicate markers on server-rendered PNG maps.
- Revoked map blob URLs when replacing a map, returning to the menu, or resetting.
- Added web regressions for the close lock, cloud resume, stored run ID, resume availability, and map overlay mode.

## Verification

- `npm run test -w @localmanager/web` — 11 tests passed.
