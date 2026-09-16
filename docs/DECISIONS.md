# Decisions

Date: 2026-09-16. Initial build. The framework question was asked but not answered in time
(question tool timed out), so the recommended option was taken and everything below is
open for revision.

| # | Decision | Why |
|---|----------|-----|
| 1 | React 19 + react-three-fiber (pinned React ~19.2) | Most mature three.js bindings and helper ecosystem (drei), dnd-kit, TanStack Query. fiber 9.7 peer range excludes React 19.3, hence the pin. |
| 2 | Vite 8 | Requested. Rolldown-based, so `manualChunks` must be a function. |
| 3 | Server runs TypeScript natively on Node 24 (`node src/index.ts`) | Zero build step and no tsx/ts-node. Requires erasable-only syntax (`erasableSyntaxOnly`), explicit `.ts` import extensions, and `shared/package.json` with `"type": "module"`. |
| 4 | SQLite via built-in `node:sqlite` | No native compile (better-sqlite3 lags new Node majors). All SQL lives in `server/src/repo.ts`; migrating to Postgres means rewriting that one file. |
| 5 | `shared/edc.ts` imported by relative path from both client and server | Keeps types and calculations (item volume, bag stats, formatting) in one place without a build/publish step for a shared package. |
| 6 | Procedural 3D models for person / car / RV / house and for items | Fully offline, instant load on mobile, no asset pipeline. The person is a higher-detail figure (lathe torso, painted skin, 3D face, clothes) still built from primitives; vehicles/house stay x-ray shells. Bags attach to named slots per location kind; bag size = cube root of volume; item meshes are generated from their dimensions and shape. |
| 7 | Vehicles and house are rendered as translucent "x-ray" shells | Bags placed inside must stay visible and tappable. |
| 8 | Bag interior = translucent box sized from volume with per-kind proportions; sections = sub-regions by placement; automatic items are packed in rows and vertical layers from the section bottom, while manual section-local positions and 90-degree axis rotations are persisted | Keeps the default view deterministic while allowing direct manipulation without mixing bag-world and section-local coordinates. |
| 9 | Items exist once and live in at most one section (`section_id` nullable) | Matches physical reality (one knife is in one pocket). Unassigned items form a tray on every bag page. |
| 10 | Weight/volume stats computed on the server per request | Data is small; guarantees consistency between overview, bag page and catalog. All mutations invalidate all queries. |
| 11 | Lists use CSS glyphs, only forms and scenes use WebGL | Browsers cap WebGL contexts (~16); one canvas per row would break the catalog. |
| 12 | Units: g, mm in item forms (stored as decimal cm for backward compatibility), L. Item volume = bounding box with shape factors (cylinder pi/4, sphere pi/6, wire storage envelope 0.35) | Millimeter input gives practical measurement accuracy without a destructive database conversion. |
| 13 | Plain CSS with variables, dark theme, bottom nav on phones | Keeps dependencies small; layout collapses to one column under 900px. |

## Not done yet / ideas

- Multiple quantities of the same item (currently one row per physical item).
- Photos/thumbnails and GLTF models for items; the `ItemMesh` component is the single place to swap.
- Auth and multi-user; data export/import.
