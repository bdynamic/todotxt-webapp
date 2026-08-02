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

## Unrelated deploy bug surfaced while testing this feature

Deployment host runs the container as `user: dockeruser` (non-root, custom compose not in this repo). The Dockerfile never created that account, so the rebuild triggered by this feature failed at container start ("unable to find user dockeruser: no matching entries in passwd file") — old container/image kept running, which is why the footer stayed blank and `/version.json` 404'd (old image had neither). Fixed by adding `RUN adduser -D -u 1000 -h /home/dockeruser dockeruser` + `chown -R` to the Dockerfile. Also dropped the hardcoded `ENV TODO_CONFIG_DIR=/root/.config/todotxt-git` (contradicted the `~/.config/todotxt-git` default documented in `CLAUDE.md` and would have pointed config/SSH-key storage at `/root` — unwritable and wrong — regardless of which user actually ran the container); `lib/git-backend.js` already derives the correct path from `$HOME`.

Switching the container to run as `dockeruser` (uid 1000, matching this host's default user convention) then hit `node:20-alpine`'s built-in `node` user already sitting on uid 1000 — fixed by deleting that account before creating `dockeruser` at the same uid.

Once the container actually ran as uid 1000, the bind-mounted `TODO_DATA_DIR` (`/tmp/tododata`, host dir previously written by a root-run container) surfaced two more errors: git's "detected dubious ownership" guard (fixed programmatically - `git-backend.js` now runs `git config --global --add safe.directory <TODO_DATA_DIR>` on startup) and a real `EACCES` on writing `todo.txt` (host-side permission problem, not fixable from the image - requires `chown -R 1000:1000` on the host's bind-mounted data/config directories).

## Rollback point

Work done starting from commit `958cc68605074c0eee2dbd490e7fef534abf241e` (2026-08-02 08:49:07 +0000), clean tree, 1 commit ahead of `origin/master`. Revert to this commit to undo the version-footer feature.
