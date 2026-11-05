# WasteOps

Private working application based on the WasteOps requirements and supplied visual reference. The Site retains its owner-only audience and ChatGPT authentication.

## Try the application

1. Select **Report an issue**, add a photo, confirm its map location, optionally add a note and submit. The server issues a saved reference and a private progress link.
2. Open **Incidents**, select the report and review its category. **Work** records the authorising customer or an explicitly named pilot simulation.
3. Assign a capable crew in **Work**. Open **Routes**, select that crew and approve the ordered stops. Route plans survive refresh; the crew workspace shows approved active stops.
4. Record travelling, arrival and work start in the job. Add an after photo in **Photos**, submit completion and accept or dispute it. Only accepted completion resolves the incident.
5. Use **Review queue** to link duplicate observations and reverse links. Original incidents and observations are retained. A source with authorised work cannot be merged.
6. **Analytics** uses incident records and accepted work events. CSV export respects the current list filters. **Settings** can hide the illustrative records.

## Run locally

Requirements: Node.js 22.13 or newer and pnpm 11.25.0.

```sh
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://127.0.0.1:5173`. The local preview uses the project's Cloudflare development simulator and test sign-in; it does not contact a real council. Stop it with `Ctrl+C`.

To check the source locally:

```sh
node node_modules/typescript/bin/tsc --noEmit
pnpm build
node scripts/test-operations.mjs
```

## Included

- Responsive resident homepage and four-step report form, GPS and manual address/pin placement, receipt and progress timeline.
- D1 records for observations, incidents, work orders, route plans, merges and audits; private R2 photo storage.
- Server-enforced account ownership on every record, operation and photo request, origin checks and upload/report rate limits.
- Dashboard, search/filter/sort, map, incident drawer, category review, still-there signal and CSV export.
- Explicit work authorisation, capability-checked crew assignment, controlled job transitions, after-photo requirement, supervisor acceptance and dispute handling.
- Durable supervisor-approved route plans, reordering/removal, date and crew selection, mobile crew workspace and external directions links.
- Reversible duplicate linking: observation provenance is stored, and linked reports remain accessible through their reporter's private status link.
- Analytics and workspace preferences. Example records, teams and imagery are labelled as illustrative.

## Operating boundaries

This is a usable owner-private MVP, not a public council service. Browser visitors authenticate through the Site platform. Separate contractor organisations, staff invitations/role management, public anonymous reporting, public image moderation/redaction, supported council integrations and external crew notification are not connected. Do not open the audience without implementing those access and data-publication boundaries.

Reports never commission paid removal or claim council delivery. A named authorisation in this workspace records a pilot decision; it does not create an external contract. Nearby suggestions use straight-line proximity, and map route lines are illustrative stop connections. Travel savings, drive times and capacity optimisation are not claimed. Pilot authority, shifts, real crew profiles and funding must come from the operating partner.

Resident photos are resized and stripped of camera metadata in the browser. Private upload endpoints enforce image signatures and size limits. Automated malware scanning, face/plate redaction and a governed retention/deletion process remain release work before external use. Accepted after-photo evidence is locked until the job is disputed.

## Verification

- Type check: `node node_modules/typescript/bin/tsc --noEmit`
- Isolated API integration suite: `node scripts/test-operations.mjs`
- Build with the Sites `build-site.mjs` helper.

The integration suite bundles the real API handlers into an isolated Cloudflare Worker with ephemeral D1/R2 and a test-only identity adapter. It verifies report persistence/idempotency, private media and cross-account isolation, origin rejection, job authorisation and capability checks, allowed transitions, route persistence and scope, completion evidence, acceptance/dispute, immutable accepted evidence and reversible observation merges. Test identity code is never imported into production.

The database schema and append-only Drizzle migrations are tracked. Hosting applies migrations before publishing the Worker. Local preview data is separate from hosted data.

## Architecture and assets

React/TypeScript through the supported Vinext/Cloudflare Worker runtime. D1 and R2 provide durable data and private objects. This keeps the hosted application self-contained; the earlier FastAPI/PostGIS proposal remains an alternative for a future independently hosted deployment.

MapLibre/OpenFreeMap is used when WebGL2 is available; OpenTopoMap provides an attributed raster fallback. `public/street-scene.png` is a generated illustrative autumn Ealing scene, not a real incident photograph. Demo incidents reuse that image and are labelled.
