# PAINAWA Resort & Stay

A Next.js 16 / React 19 resort booking site using TypeScript, Tailwind CSS, PostgreSQL and Drizzle ORM. The guest booking flow and protected staff dashboard use the **same persistent database**. The public site requests reservations; it does not collect or verify payments.

## Deploy: new database (recommended)

**Requirements:** Node.js 22 (see `.nvmrc`), a persistent PostgreSQL database reachable from both your deployment environment and migration terminal, and HTTPS for the public website. This app requires a Node.js runtime; **do not deploy it as a static export**. A Supabase, Neon, Railway or Render PostgreSQL connection string works. Managed databases often require `?sslmode=require`. Use a **server-only table-owning PostgreSQL role** for `DATABASE_URL` (e.g. the database owner from your provider); anonymous/authenticated browser roles are intentionally denied by RLS. Never expose this URL to client code. Do not use `127.0.0.1` or a sandbox `.env` URL in a remote deployment.

1. Provision PostgreSQL. Set **`DATABASE_URL`** as a *server-side* secret in your hosting platform. Use the same database for the public site, staff portal and migration commands. Start from `.env.example` only for local development; never commit a real `.env` file.
2. In a trusted terminal/CI job that can reach that database, with the **target database's** `DATABASE_URL` exported, run:

   ```bash
   npm ci
   npx drizzle-kit migrate
   node scripts/rotate-admin.mjs owner@yourdomain.com
   node scripts/check-deployment.mjs
   ```

   Save the owner password printed **once** by the rotation command. Only its bcrypt hash is saved in PostgreSQL. **Do not run `rotate-admin.mjs` on every deployment**: it changes the password and revokes existing sessions. Drizzle migrations are versioned in `drizzle/` and safe to re-run. Migration commands need the `drizzle-kit` development dependency, so install with `npm ci`, not `npm ci --omit=dev`, in that step.
3. Deploy the repo with the host's Next.js preset. Use `npm run build` as the build command. On a traditional Node host, use `npm run start` as the start command and `/api/health` as the health-check path; Vercel manages startup automatically. Set `DATABASE_URL` for the runtime environment as well as the migration environment.
4. Visit `https://YOUR_DOMAIN/api/health`. It should return HTTP 200 with `{"ok":true,"status":"ready"}`. Then load `/` to seed illustrative rooms and photos and sign into `/admin` with the owner credentials. Create a test reservation on the public site and check that it appears as **Pending** on the staff dashboard.

**Vercel:** Import the repository as a Next.js project, select Node.js 22, and set `DATABASE_URL` in Production (and Preview if desired). Initialize the external database and create the owner in a trusted terminal or CI job *before* visiting the deployment. Commit **both** `package.json` and `package-lock.json`. The included `vercel.json` preserves the Next.js framework preset, installs exactly from the lockfile with `npm ci --include=dev`, and runs the normal production build with an unsupported npm cache variable removed. Vercel's filesystem is ephemeral: reservations and staff accounts must live in managed PostgreSQL, **not** an in-memory or local database.

**Render/Railway/other Node hosts:** Provide Node.js 22 and the same managed `DATABASE_URL`. Run `npx drizzle-kit migrate` as a pre-deploy/release step after installing dependencies, build with `npm run build`, start with `npm run start`, and set the health path to `/api/health`. If your database is private to the host, perform migrations and initial owner creation using that host's one-off shell/CI environment. Do not run migrations from each web request.

### Already have bookings in a database created with `drizzle-kit push`?

**Back up that database first.** The versioned initial migration creates tables and must **not** be run directly on an existing unbaselined schema. Point `DATABASE_URL` to that database and use this one-time path:

```bash
npm ci
node scripts/baseline-existing-db.mjs --confirm-baseline
npx drizzle-kit migrate                    # Applies the RLS security migration
npx drizzle-kit push                       # Verify this reports "No changes detected"
node scripts/check-deployment.mjs
```

The baseline command verifies the original tables, columns, constraints and indexes before recording the initial migration; it does not edit bookings or staff records. If it fails, **stop and investigate** rather than forcing a baseline or accepting destructive schema changes. Drizzle's second migration enables default-deny row-level security on all ten tables. On an existing database that already has a migration journal, skip the baseline and just run `npx drizzle-kit migrate`. If you move to a *different* database, existing reservations and owner accounts do not transfer automatically: migrate/restore the data separately, or point the deployed app at the original persistent database.

### Troubleshooting a deployment

- **`148 packages are looking for funding`** is npm information, not an error or a failed install.
- **`install-scripts ... not yet covered by allowScripts`** means the deploy's npm version wants explicit approval for dependency postinstall scripts. This repository now has npm-generated, version-pinned `allowScripts` approvals for its locked `esbuild` versions and `unrs-resolver`. With npm 12, `npm ci --include=dev` installs the reviewed versions and `npm install-scripts ls` should report no pending scripts. If a host reports *different* transitive versions, commit the current `package-lock.json`, use `npm ci` rather than `npm install`, and redeploy without an old dependency cache; don't blindly approve unknown packages.
- **`Unknown env config "cache-dir"`** comes from a hosting environment variable such as `npm_config_cache_dir` / `NPM_CONFIG_CACHE_DIR`, not from this project's `.npmrc` or Next.js. The `vercel.json` commands remove it before invoking npm. On another host, remove that variable in the host settings or use npm's supported `npm_config_cache` setting instead. The warning alone does not fail a build.
- **`Detected Next.js version` / `Running "npm run build"`** is normal startup output. If the build actually exits nonzero, the actionable error appears *after* these lines. Locally reproduce the deploy install with `npm ci --include=dev` followed by `npm run build`. The application also needs a server-side managed `DATABASE_URL` and migrated schema at runtime; `/api/health` shows whether booking is ready.
- A Next.js page previously showed **“This page couldn’t load”** with an error digest when PostgreSQL was not configured, reachable, or migrated. The public page now renders a clearly labeled **illustrative preview** instead, and `/admin` shows setup guidance. **Bookings, availability checks, and guest lookups are paused**, not silently stored, until `/api/health` returns HTTP 200 `ready`. A 200 page response alone does **not** mean booking is enabled.
- Check `https://YOUR_DOMAIN/api/health` first. The `status` field below identifies the next step; server logs contain a safe error code if a database query fails. Never paste your full connection string into a public issue or support message.
- `/api/health` returns `configuration_missing` (503): set `DATABASE_URL` in the server/runtime environment, not `NEXT_PUBLIC_DATABASE_URL`.
- `database_unavailable` (503): check the managed hostname, credentials, network allowlist, SSL setting and connection limits. This app uses a small shared connection pool; migration tools may need a direct/session-capable URL while the runtime can use a provider's pooler.
- `schema_pending` (503): run **both** versioned migrations for a fresh database, or baseline an existing one and apply its remaining migrations. Readiness requires all ten tables and default-deny RLS; the app deliberately does not auto-create tables on a live request.
- No staff sign-in: run `node scripts/rotate-admin.mjs` *once* against the **same** target database. A staff account is stored in PostgreSQL, not in a build artifact. A new hostname may require a fresh sign-in, but it will not erase the account.
- Missing reservations: confirm both the public site and staff dashboard use the **same** `DATABASE_URL`. Use the guest's reference to search the live Reservations tab and check the Pending filter. Demo mode displays **fictional data only** and cannot see actual guests.
- The app can build **without** `DATABASE_URL`, but the site will not accept bookings until the runtime has a working database and applied schema. Run `node scripts/check-deployment.mjs` to check schema and staff-account readiness without printing secrets.

## Local development

Set `DATABASE_URL` in a local `.env` file, then run `npm ci`, `npx drizzle-kit migrate` for an empty database, `node scripts/rotate-admin.mjs owner@example.com`, and `npm run dev`. Open `/` and `/admin`. `npm run lint`, `npx next typegen`, `npm exec tsc -- --noEmit`, and `npm run build` verify code. Drizzle CLI uses `drizzle.config.ts`, which reads `DATABASE_URL`; the project no longer contains a hardcoded database URL. Environment-based `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (or the older `ADMIN_PASSWORD`) are also supported as a one-time bootstrap on first valid sign-in, but a database-backed owner is recommended.

## Database and booking details

Schema: `src/db/schema.ts`. Versioned migrations: `drizzle/` (initial tables, then an RLS security migration). Tables: `accommodations`, `room_inventory`, `reservations`, `guests`, `payments`, `availability_blocks`, `gallery_images`, `admin_users`, `admin_sessions` and `admin_login_attempts`. All ten tables have RLS enabled with **no browser access policies**. On Supabase this denies direct `anon`/`authenticated` PostgREST access to guest data and staff password hashes; the app uses the private table-owning PostgreSQL connection server-side. Initial accommodation and gallery content is seeded on the first site request after migration.

Dates are stored as PostgreSQL `date` values (`YYYY-MM-DD`) on the resort's Asia/Manila calendar. Checkout is exclusive for overlaps. The server validates dates (1–30 nights), occupancy and contact information. Booking assignment uses a PostgreSQL advisory-locked transaction to avoid double booking; Pending, Confirmed and Checked In reservations hold inventory. The server calculates rate × nights + a 5% service fee − a 10% room-cost discount for stays of five or more nights. Guests can check status with reservation reference and email.

Staff sessions are revocable, hashed in PostgreSQL and expire after eight hours. Normal authentication uses secure HTTP-only cookies; embedded previews have a tab-scoped fallback when cookies are blocked. Admin reads and writes require a valid active staff session. Authentication writes reject cross-site origins and login attempts are rate-limited. The dashboard can change reservation statuses, rates, inventory availability, gallery visibility and manually verified payment status.

**No online payment processing is integrated.** GCash, bank transfer and pay-at-property are preferences only. Every payment starts `Unverified`; staff must verify any transfer independently. Refunds are handled manually. Displayed policy: check-in from 2 PM, check-out by 12 PM, cancellation requests at least seven days before arrival may be free; confirm real property terms before public launch. Resort address, contact email, testimonials and stock photos are illustrative placeholders and must be replaced before marketing the site as a real property. Add email notifications and stronger distributed abuse protections for large public deployments.
