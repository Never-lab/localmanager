# Task 8 report — apps/web desk UI + map panel

## Implemented

- Added the Vite/React/TypeScript web workspace with Zustand game state.
- Added Italian `auth`, `menu`, `setup`, `game`, and `gameover` screens.
- Built a map-dominant municipal desk layout with budget, reputation, staff,
  projects, province funding, press, opposition, and council log controls.
- Added disabled-control explanations and the educational disclaimer.
- Added guest SVG map overlays over a committed static basemap.
- Added authenticated save, map-job enqueue, and PNG polling flow.
- Made the simulation's comune seed imports browser-compatible.
- Added store and UI behavior tests.

## Verification

- `npm test -w @localmanager/web`
- `npm run build -w @localmanager/web` (includes `tsc -b`)
- `npm test -w @localmanager/sim`

Browser verification was attempted, but Playwright could not launch because
Chrome is not installed in the environment.
