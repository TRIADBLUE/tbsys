# CLAUDE.md — Console.Blue
# Last updated: 2026-04-22

---

## READ THE UNIVERSAL RULES FIRST

Before doing ANY work, read the TRIADBLUE universal rules at `~/.claude/CLAUDE.md`. If you are working remotely and need to fetch them:
```
curl -s "https://linkblue-githubproxy.up.railway.app/api/github/file?repo=.github&path=CLAUDE.md"
```
Those rules govern colors, fonts, naming, payments, and ecosystem standards. They are non-negotiable.

**This file is hand-edited, not auto-generated.** The previous version of this file was assembled by the Console.Blue Doc Planner. That assembly path must NOT be pushed to `main` anymore — this CLAUDE.md is now the source of truth, matching the businessblueprint.io process so every TRIADBLUE repo follows the same convention.

---

## PLATFORM IDENTITY

**Name:** Console.Blue
**Tagline:** Internal operations interface for the TRIADBLUE ecosystem
**Role:** Central ops panel — NOT customer-facing. Consoles are for EXECUTING, not viewing.
**Status:** 40% complete
**Stack:** React + TypeScript + Vite + Tailwind + shadcn/ui + Express + Drizzle ORM + PostgreSQL + Wouter
**Deployment:** Railway. Auto-deploys from `main` branch. Direct URL: `consoleblue-production.up.railway.app`. Replit is no longer serving anything — the old Replit deployment is dead.
**Database:** PostgreSQL 16 (Neon, connected from Railway). Sessions, caching, audit logs, and legacy binary assets all stored in DB — no Redis.
**Live URL:** https://console.blue (served via Railway; DNS at Porkbun)
**Repository:** TRIADBLUE/consoleblue (`main` branch is production; Railway auto-pulls on every push to `main`)
**Local path:** `/Users/deanlewis/consoleblue`

**Subdomain to shut down:** `consoleblue.triadblue.com` is a legacy deployment that still serves TRIADBLUE parent favicons. It must be decommissioned. Do NOT push changes to it.

**CDN:** `cdn.triadblue.com` — self-hosted on the Kamatera VPS at `147.185.239.66` (same server that runs builderblue2.com). Nginx serves `/var/www/cdn/brands/<brand-slug>/<asset>.png`. Let's Encrypt SSL via certbot. DNS A-record via Porkbun. All TRIADBLUE brand assets (favicons, lockups, og-images, Coach Blue variants) served from here.

---

## NAMING — CONSOLE vs PANEL vs DASHBOARD

Matches the global TRIADBLUE convention:
- **Dashboard** = customer-facing — for VIEWING
- **Panel** = admin-facing — for EXECUTING
- **Console** = internal ops — for EXECUTING

Console.Blue is a **console**. Every UI decision should assume the user is Dean or a TRIADBLUE operator, not a customer.

---

## ARCHITECTURE

### The Wagon-Wheel Model

Console.Blue is the HUB. Every other TRIADBLUE site is a spoke. One change in Console.Blue should propagate across the entire ecosystem — favicons, brand colors, shared docs, AI provider configs, link health, asset URLs. If a fact lives in more than one place, that is a bug.

### OGA — Online Global Assets (the heart of the wagon wheel)

**Files:**
- `server/routes/oga.ts` — all OGA endpoints (embed.js, config, admin CRUD)
- `server/db/seed-oga-assets.ts` — rewritten 2026-04-18 as the canonical CDN-URL seeder for all 7 TRIADBLUE brands
- `shared/schema.ts` lines 740–789 — `ogaSites` + `ogaAssets` tables
- `client/src/pages/OgaPage.tsx` — admin UI with canonical asset spec (dimensions + descriptions per slot)

**How it works (current state):**
1. Every TRIADBLUE site embeds one line in its `<head>`:
   ```html
   <script src="https://console.blue/api/oga/embed.js?key=%VITE_OGA_KEY_<BRAND>%" async></script>
   ```
   The `%VITE_...%` is Vite's build-time substitution. Each repo sets `VITE_OGA_KEY_<BRAND>` as a secret in its host (Replit Secrets / Railway variables / Platform Keys on Kamatera-hosted builderblue2).
2. `GET /api/oga/embed.js?key=...` returns a small JS bundle that fetches `GET /api/oga/config?key=...`, strips existing `<link rel="icon">`/apple-touch/manifest tags, and injects the OGA ones. The embed script was extended 2026-04-18 to ALSO manage `document.title`, `<meta property="og:title">`, `<meta property="og:site_name">`, `<meta property="twitter:title">`, `<meta property="twitter:image">`, `<meta name="msapplication-TileColor">`, and `<meta name="msapplication-TileImage">`.
3. Asset types are canonical kebab-case keys. Currently supported:
   - **Brand Identity:** `logo-full-mark`, `logo-image`, `logo-text`, `ai-assistant-image`, `ai-assistant-name`, `brand-url`, `ecosystem-lockup` (TRIADBLUE only — gated via `onlyForDomain` filter)
   - **Browser Icons:** `logo-image-16px`, `logo-image-32px`, `logo-image-48px`, `logo-image-180px`, `logo-image-192px`, `logo-image-512px`, `logo-image-icon`, `logo-image-avatar`, `theme-color`
   - **Header & Navigation:** `header-logo`, `header-logo-dark`
   - **Login & Auth:** `login-logo`, `login-background`, `login-accent-color`
   - **Social & SEO:** `og-image`, `twitter-image`, `site-name`
   The embed script converts kebab-case to camelCase at apply time.
4. Subdomains inherit from their parent domain unless `emancipated = true`. `extractRootDomain()` handles the split.
5. Client-side cache: sessionStorage, 5-minute TTL. Server cache headers: 5 min on `/config`, 1 hour on `/embed.js`.
6. **Current storage (mixed state — transitional):**
   - **NEW entries** in `oga_assets.value` store CDN URLs (e.g. `https://cdn.triadblue.com/brands/swipesblue/logo-image.png`) seeded by the rewritten `seed-oga-assets.ts`.
   - **LEGACY entries** in `oga_assets.value` still store ConsoleBlue Postgres-blob URLs (`https://console.blue/api/assets/file/<id>`). The `assets` table (bytea) is still live because the OGA admin upload handler (`POST /api/assets/upload`) writes there. The embed script consumes whatever URL is returned, so both forms work, but architectural cleanup is pending.

**Valid `ogaSite.status` values:** `active`, `disabled`, `pending`. Only `active` returns config.

### ⚠ KNOWN ARCHITECTURAL DEBT — OGA upload handler (2026-04-22)

The OGA admin UI's drag-drop upload currently writes to Postgres `assets` table, NOT to `cdn.triadblue.com`. When a user uploads an image via `/oga`, the handler (`server/routes/assets.ts` line 111, `POST /api/assets/upload`) stores the bytes as `bytea` and returns `/api/assets/file/<id>`. This predates the CDN and was not updated when `cdn.triadblue.com` went live on 2026-04-18.

**The correct target architecture:** upload handler should SCP the file to `/var/www/cdn/brands/<slug>/<canonical-filename>.png` on the CDN server (`147.185.239.66`) and return the `cdn.triadblue.com` URL. Requires SSH key provisioning from the ConsoleBlue deployment to the CDN server. Estimated work: ~2 hours. Rule set by Dean 2026-04-22: **the OGA interface must manage uploads end-to-end without needing AI or shell scripts to complete the flow.**

### Brand asset canonical source

Only files in `/Users/Shared/global assets/logo images and texts/<brand-folder>/` on Dean's Mac are authoritative brand assets. Never source from repo `attached_assets/`, old uploads, or memory. Always `ls` the folder and diff against the CDN before uploading. See `~/.claude/projects/-Users-deanlewis-consoleblue/memory/feedback_brand_assets_source.md`.

### Single-app Express + Vite SSR

`dev`: `tsx server/index.ts` (Vite in middleware mode).
`build`: `vite build` then `esbuild server/index.ts --bundle --platform=node --format=esm --packages=external`.
`start`: `NODE_ENV=production node dist/index.js`.

Public static dir: `dist/public`. Port: 5000.

### Authentication

Session-based via `connect-pg-simple`. Passwords hashed with bcrypt. Password reset via Resend email + `passwordResetTokens` table. All mutation routes require `createAuthMiddleware(db)`. Admin OGA endpoints sit behind the same middleware; public OGA (`/config`, `/embed.js`) does not.

### Key Files

- `server/routes.ts` — route registration
- `server/routes/oga.ts` — OGA endpoints (536 lines)
- `server/routes/projects.ts` — project CRUD
- `server/routes/tasks.ts` — task board
- `server/routes/github.ts` — cached GitHub API proxy
- `server/routes/chat.ts` — multi-provider AI chat
- `server/routes/assets.ts` — binary asset upload/fetch
- `server/services/cache.service.ts` — PostgreSQL TTL cache
- `server/services/sync.service.ts` — background GitHub sync
- `server/services/audit.service.ts` — writes to `auditLog` on every mutation
- `server/services/ai/providers/` — anthropic, openai, google, kimi, deepseek, groq
- `server/db/seed.ts` — base seed
- `server/db/seed-oga-assets.ts` — OGA asset seed (must be run AFTER `ogaSites` rows exist)
- `shared/schema.ts` — 23 Drizzle tables
- `shared/validators.ts` — Zod request schemas
- `client/src/App.tsx` — Wouter router
- `client/src/pages/OgaPage.tsx` — admin UI for managing OGA sites and assets
- `client/index.html` — Console.Blue's own favicons + OGA embed script
- `.replit` — Replit deploy config (autoscale)

### Database Tables (23)

Project management: `projects`, `projectSettings`, `projectDocs`, `sharedDocs`.
Auth: `adminUsers`, `adminSessions`, `passwordResetTokens`.
Tasks: `tasks`, `taskNotes`, `taskHighlights`.
Site planner: `sitePlans`, `sitePages`, `siteConnections`.
Notifications: `notifications`, `notificationPreferences`.
Caching/audit: `githubSyncCache`, `auditLog`, `docPushLog`.
AI chat: `chatThreads`, `chatMessages`, `aiProviderConfigs`.
Assets: `assets` (bytea binary storage).
Monitoring: `linkChecks`.
OGA: `ogaSites`, `ogaAssets`.

### Payment Rules

Same as the rest of the ecosystem: all payment processing goes through swipesblue.com only. The words "Stripe" and "NMI" must never appear in this codebase. Console.Blue does not currently process payments — if that changes, it goes through SwipesBlue.

---

## BRAND — CONSOLE.BLUE SPECIFIC

- App accent color in global rules: **#FF44CC** (the `/ post` color is currently listed as Console.Blue's primary — verify with Dean before using in new UI).
- Archivo Semi Expanded for display type. Inter for body (already loaded in `client/index.html`).
- Triad Black `#09080E`, Triad White `#E9ECF0`, Triad Gray `#808080`.
- Pure Blue `#0000FF` is NEVER used in UI — logo images only. The current `<meta name="theme-color" content="#0000FF" />` in `client/index.html` is legacy and should be moved to OGA-managed `theme-color` once Console.Blue itself is fully OGA-driven.
- Casing: **Console.Blue** as shown (dot separator, both words capped). In code/slugs: `consoleblue`.

---

## DEPLOYMENT & GIT WORKFLOW

- Current workflow: commits land on `main`, Railway auto-deploys.
- No staging branch exists yet. Before any destructive or high-risk change, create one.
- Historical note: pre-2026-04-21 git history contains "Published your App" auto-commits from the old Replit workflow. Treat those as deploy markers, not meaningful changes.
- `dist/` should be gitignored (verify before committing).
- NEVER tell Dean to pull until code has been pushed to origin.

---

## COMPLETED SYSTEMS

- Core project management CRUD with filtering, reordering, color picker ✓
- Admin auth: login, sessions, password reset, account locking ✓
- GitHub API proxy with PostgreSQL cache layer (configurable TTL per endpoint) ✓
- Task management with Kanban board, notes, code highlights, hierarchical parent tasks ✓
- Site planner with drag-and-drop diagram editor (`@dnd-kit`) ✓
- Multi-provider AI chat: Anthropic, OpenAI, Google, Kimi, Deepseek, Groq, Replit, Claude Code ✓
- Doc system: shared docs + per-project docs + Doc Planner assembly + push to GitHub repo ✓
- Asset manager: binary storage in PostgreSQL `assets` table ✓
- Audit logging on every mutation with before/after snapshots ✓
- Notifications with per-user preferences ✓
- Link health monitor (`linkChecks`) ✓
- OGA system — schema, admin CRUD, embed script, config endpoint, seed script for all 7 TRIADBLUE brands ✓
- Security hardening: global auth enforcement, cleaned logs, working password change (commit fb4cef2) ✓
- Asset storage migration — filesystem → database (commit 483bc19) ✓ [superseded by CDN migration below]
- **CDN infrastructure** — `cdn.triadblue.com` live on Kamatera server with nginx + Let's Encrypt, folder structure `/brands/<slug>/` populated for all 8 brands including CoachBlue's own folder (commits `eed66a0`, various upload scripts) ✓
- **OGA asset seeding to CDN URLs** — `seed-oga-assets.ts` rewritten to insert `https://cdn.triadblue.com/...` into `oga_assets.value` for all 7 brands × 19 asset types each. Duplicate `TRIADBLUE.COM` (id=5) orphan row deleted ✓
- **Extended OGA embed.js** — now overrides `document.title`, og:title/twitter:title/twitter:image, og:site_name, msapplication-TileColor/TileImage in addition to favicons and theme-color ✓
- **OGA admin UI canonical asset spec** — every slot in `/oga` shows dimensions, purpose, CDN filename in label/info (commit `d00f6a1`) ✓
- **AI Assistant brand slots** — `ai-assistant-image` and `ai-assistant-name` added under Brand Identity so each brand's Coach/Assistant/Instructor persona is OGA-managed (commits `87618c5`, `8e3d177`) ✓
- **TRIADBLUE-only Ecosystem Lockup slot** — `ecosystem-lockup` gated via `onlyForDomain` filter so only triadblue.com sees it (commit `8e3d177`) ✓
- **Public asset file route** — `/api/assets/file/:id` exposed publicly so OGA can serve legacy blob URLs to anonymous visitors across the ecosystem (commit `fa5b754`, PR #2) ✓
- **Platform OGA embed wiring** — every spoke site's `index.html` now uses `%VITE_OGA_KEY_<BRAND>%` Vite substitution syntax pulling from host-level secrets (hostsblue + scansblue templates fixed 2026-04-18; commits `0567cb1` in hostsblue, `3bdad73` in scansblue; builderblue2 switched from hardcoded to Vite substitution, commit `e377659` in builderblue2) ✓
- **ConsoleBlue migrated from Replit → Railway** (2026-04-21). Railway auto-deploys from `main`. `VITE_OGA_KEY_CONSOLEBLUE` carried over; OGA end-to-end verified on `consoleblue-production.up.railway.app`. DNS cutover still pending ✓
- **Brand asset canonical source rule** — feedback memory saved: only `/Users/Shared/global assets/logo images and texts/<brand>/` is authoritative; always diff folder vs CDN before any upload ✓

## PENDING

- **🔴 OGA upload handler targets Postgres, not CDN** (architectural debt called out 2026-04-22). `POST /api/assets/upload` stores uploaded bytes in the `assets` table and returns `/api/assets/file/<id>`, so drag-drop through the admin UI bypasses `cdn.triadblue.com`. Must rewrite handler to SCP uploaded file to `/var/www/cdn/brands/<slug>/<canonical-filename>.png` on the CDN server and return the `cdn.triadblue.com` URL. Requires provisioning SSH key from ConsoleBlue's Railway deployment to the CDN server. Estimated ~2 hours. **Rule from Dean:** the OGA interface must manage uploads end-to-end without AI or shell scripts.
- **🔴 swipesblue `index.html` hardcodes old og:image / twitter:image paths** (`/images/less_fees_more_revenue.jpg`). Messaging-app scrapers read static HTML and don't execute JS, so the OGA runtime overlay is invisible to them. Needs template edit to point at the CDN URL + rebuild + redeploy. Same issue likely affects bb.io, hostsblue, scansblue, triadblue, builderblue2 — ecosystem-wide audit.
- **🔴 Platform header logos are bundled from repo `attached_assets/`, not the CDN**. bb.io's Header.tsx, swipesblue's Logo.tsx, etc. import local PNGs. OGA doesn't touch `<img>` tags. Needs a `brand-assets.ts` module per platform repo that exports CDN URLs, plus refactoring every `<img>` to use it. Scope: ~14 files in bb.io alone, similar per site.
- **SHUTDOWN: consoleblue.triadblue.com** — legacy subdomain. Must be decommissioned. Deployment source TBD (likely a separate deployment no one remembers provisioning).
- **Doc Planner auto-push to CLAUDE.md** — previously overwrote this file with assembled content. Disable or redirect that flow so hand-edited CLAUDE.md is authoritative.
- **Staging environment** — no staging branch or environment exists. Every change goes straight to main → Railway auto-deploy.
- **OGA asset type registry** — kebab-case → camelCase conversion is implicit in `oga.ts`. Should be a shared enum in `shared/schema.ts` so client and server agree on valid keys.
- **OGA health endpoint** — `/api/oga/health?key=...` that returns `{ ok: true, site: "console.blue", assetCount: 12 }` to make debugging easier.
- **Legacy `oga_assets` rows cleanup** — some sites still have pre-CDN rows with `favicon16`, `favicon32` etc. asset types pointing at Postgres blob URLs. New canonical types (`logo-image-16px` etc.) were added alongside; old ones are dead weight in the config response. Migration script to delete deprecated types.
- **Seed script improvements** — `seed-oga-assets.ts` currently O(n²) (refetches all assets per asset). Fine for now, but note it.
- **OGE / OGS (Online Global Environment / Secrets)** — architecture designed 2026-04-19 but not built. Three-table pattern mirroring OGA: OGE for non-secret runtime config (URLs, feature flags), OGS for secrets (encrypted at rest, role-gated admin). Each platform bootstraps with `OGA_KEY`, `OGE_KEY`, `OGS_KEY` + host-assigned `PORT` — every other env var flows from ConsoleBlue. Deferred until after CDN/brand work stabilizes.
- **Designed og-images for every brand** — only swipesblue has a purpose-built 1200×630 og-image. Every other brand's social preview currently falls back to `logo-lockup.png` which has transparency + wrong aspect ratio. Creative work outside this repo; files to land in `/Users/Shared/global assets/logo images and texts/<brand>/<brand>-og-image.png`.

---

## CURRENT STATE CHANGELOG

| Date | Changes |
|------|---------|
| 2026-04-22 | **OGA admin UI asset spec completed end-to-end. Architectural debt in upload handler documented for fix.** (1) `OgaPage.tsx` `ASSET_GROUPS` updated with canonical dimensions, CDN filename convention, and purpose per slot (commit `d00f6a1`). (2) Added `ai-assistant-image` + `ai-assistant-name` slots under Brand Identity so each brand's Coach/Assistant persona is OGA-managed (commits `87618c5`, `8e3d177`). (3) Added TRIADBLUE-only `ecosystem-lockup` slot gated via new `onlyForDomain` filter on `AssetTypeConfig` (commit `8e3d177`). (4) All 8 brand CDN folders drift-checked against the canonical shared folder and resynced: `businessblueprint/logo-image.png`, `coachblue/logo-image.png`, `swipesblue/logo-image.png`, `swipesblue/logo-lockup.png` re-uploaded to match `/Users/Shared/global assets/logo images and texts/` as of today. (5) **KNOWN ISSUE documented in this file (Architecture → Known Architectural Debt):** the OGA admin upload writes to Postgres `assets` table instead of the CDN — Dean's rule is that the interface must manage uploads end-to-end without AI or scripts; rewriting the handler to SCP to `cdn.triadblue.com` is next priority. (6) Feedback memory saved: brand assets MUST be sourced only from `/Users/Shared/global assets/logo images and texts/<brand>/`, never from repo `attached_assets/`. |
| 2026-04-21 | ConsoleBlue migrated from Replit autoscale to Railway. `VITE_OGA_KEY_CONSOLEBLUE` secret carried over to Railway variables. Production URL `consoleblue-production.up.railway.app` serving correctly with OGA key flowing through at build time. DNS for `console.blue` not yet cut over (Porkbun still points at Replit). Swipesblue deployed multiple times with correct `VITE_OGA_KEY_SWIPESBLUE`. Hostsblue + scansblue `index.html` templates fixed — switched from literal `OGA_KEY_HOSTSBLUE` / `OGA_KEY_SCANSBLUE` placeholders to proper `%VITE_OGA_KEY_<BRAND>%` substitution syntax (commits `0567cb1` hostsblue, `3bdad73` scansblue). Stale hardcoded swipesblue key issue diagnosed — Replit secret value was older than DB (DB key had been regenerated between builds). |
| 2026-04-20 | Builderblue2 OGA wiring switched from hardcoded key to `%VITE_OGA_KEY_BUILDERBLUE2%` substitution (commit `e377659` in builderblue2 repo). Kamatera redeploy sequence confirmed: `git pull && npm run build && pm2 restart builderblue2`. Live HTML verified serving real key. |
| 2026-04-19 | **OGE / OGS architecture designed** (three-system hub extending OGA pattern). OGA = brand assets, OGE = non-secret runtime config, OGS = encrypted secrets. Each TRIADBLUE platform bootstraps with `OGA_KEY` + `OGE_KEY` + `OGS_KEY` + host-assigned `PORT` — every other env var flows from ConsoleBlue DB. Not yet implemented; scheduled after CDN work stabilizes. OGS deliberately separate from OGE for role-gated access (owner-only reveal, audit per read, distinct encryption at rest) — mapping payment rule: SwipesBlue API keys must be isolable from engineers working on feature flags or URLs. |
| 2026-04-18 | **CDN `cdn.triadblue.com` brought online and OGA migrated to CDN URLs.** (1) DNS A-record added in Porkbun pointing at `147.185.239.66` (the Kamatera VPS that runs builderblue2.com). (2) Nginx `sites-available/cdn-triadblue` created with `Access-Control-Allow-Origin: *` and 1-day `Cache-Control`. (3) Let's Encrypt SSL cert via certbot. (4) `/var/www/cdn/brands/` directory structure created for all 8 brands (businessblueprint, swipesblue, hostsblue, scansblue, triadblue, consoleblue, builderblue2, coachblue, linkblue placeholder). (5) 16 brand files uploaded via `rsync` from `/Users/Shared/global assets/logo images and texts/` (script at `~/upload-brand-assets.sh`). (6) Follow-on upload for ecosystem lockup + bb.io-specific icons (business-iq-scanner, digital-iq-assessment) + CoachBlue's own folder with 5 size variants (`~/upload-brand-assets-extra.sh`). (7) `server/db/seed-oga-assets.ts` rewritten from the earlier GitHub-raw-URL version to insert `cdn.triadblue.com/brands/<slug>/<asset>.png` URLs into `oga_assets.value` for all 7 brands × 19 asset types each. Binary payload now ZERO bytes — no more Postgres blob inserts on re-seed. (8) OGA embed script extended to also manage `document.title`, og:title, og:site_name, twitter:title, twitter:image, msapplication-TileColor, msapplication-TileImage (commit `eed66a0`). (9) Orphaned duplicate `TRIADBLUE.COM` (id=5) `oga_sites` row deleted from prod DB. |
| 2026-04-11 | CLAUDE.md rewritten in businessblueprint.io format. Replaces Doc-Planner-generated version. Documents OGA system as the wagon-wheel hub. Catalogs known browser-icon failures across the ecosystem. |

**AGENTS: Update this section on every commit. Your work is not done until this changelog reflects it.**
**AGENTS: Do not re-enable the Doc Planner auto-push to this file. If you do, Dean will lose his hand edits.**
**AGENTS: Brand assets are sourced exclusively from `/Users/Shared/global assets/logo images and texts/<brand>/` — never from repo `attached_assets/`, old uploads, or cached memory. Always diff the shared folder against the CDN before uploading anything.**
