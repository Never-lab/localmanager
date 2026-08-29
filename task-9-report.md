# Task 9 report

- Added production static-file serving from `WEB_DIST` or the built
  `apps/web/dist` directory, with SPA fallback for non-API GET routes.
- Added API regression coverage for assets, SPA routes, and unknown API routes.
- Expanded root and CI tests to run sim, API, and web suites.
- Documented Railway's shared → sim → web → API build and API start behavior.
- Verification: `npm test` passed 48 tests; `npm run build` passed and generated
  `apps/web/dist`.
