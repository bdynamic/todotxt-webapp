# Version Footer

## Requirements

- Bottom of page, light gray text.
- Shows git commit hash + build date/time of running version.
- Must work in Docker container, even though container has no `.git` (no runtime git dependency).
- Must also work when run directly via `node node-server.js` from source.

## Design

- Build time: Dockerfile stage `gitinfo` copies `.git`, runs `git log -1` to produce `/version.json` (`commit`, `shortCommit`, `date`), copied into final image as `/app/version.json`. Final image never contains `.git`.
- Runtime: `lib/app-version.js` reads `version.json` once at server startup; if missing (direct `node` run from source), falls back to running `git` against the repo directly.
- API: `GET /api/version` returns `{ commit, shortCommit, date }`.
- Frontend: `assets/js/version-footer.js` fetches `/api/version`, fills `#appVersionFooter` (`index.html`, styled in `assets/css/todo.css`).

## Gotcha found during implementation

`.dockerignore` was listed in `.gitignore` (never tracked), same as `docker-compose.yml`. Unlike `docker-compose.yml` (has a tracked `_sample` counterpart for host-specific values), `.dockerignore` has no such counterpart and no host-specific content — its exclusion looked like a copy-paste leftover, not intentional. Removed from `.gitignore` and un-`.git/`-excluded it, so the fix (needed for the `gitinfo` build stage to see `.git`) actually reaches other deployments via `update.sh`'s `git pull`. If this was intentional for some other reason, revert `.gitignore` and re-add `.git/` to `.dockerignore` — but then the version footer will only ever show `unknown` in Docker deployments.

## Rollback point

Work done starting from commit `958cc68605074c0eee2dbd490e7fef534abf241e` (2026-08-02 08:49:07 +0000), clean tree, 1 commit ahead of `origin/master`. Revert to this commit to undo the version-footer feature.
