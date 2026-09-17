# EDC Organizer

Everyday-carry organizer: bags and containers grouped by where they live (on you, in the car,
in the RV, at home), sections inside bags, and items with weight and dimensions. Shows total and
per-item weight, bag volume usage, drag-and-drop placement of items into sections, and a 3D view
of bags on a person / car / RV / house plus a 3D look inside each bag.

<img width="1057" height="723" alt="Screenshot 2026-09-17 at 20 41 14" src="https://github.com/user-attachments/assets/f9e3d546-7673-4d96-98b6-a2d00ff66bf5" />


## Stack

- Client: Vite 8 + React 19 + TypeScript, three.js via react-three-fiber/drei, dnd-kit, TanStack Query, react-router.
- Server: Node 24 (native TypeScript, no build step) + Express 5 + zod, SQLite via built-in `node:sqlite`.
- `shared/edc.ts`: domain types and pure calculations (volume, stats, formatting) used by both sides.

## Run

```bash
npm install
npm run dev        # server on :3001, client on :5173 (proxied /api), LAN-exposed for phones
```

Production (one process, one port):

```bash
npm run build      # typecheck + vite build -> client/dist
npm start          # node server/src/index.ts, serves API and client/dist on :3001
```

Environment: `PORT` (default 3001), `EDC_DB_PATH` (default `data/edc.db`), `EDC_SEED=0` to skip
demo data on an empty database.

## Data model

```
locations (person | car | rv | house)
  └─ bags (pouch | backpack | case | box | drawer | bag; slot on the 3D model; volume_l; empty_weight_g)
       └─ sections (placement: main | front | back | left | right | top | bottom | inner; optional volume_l)
            └─ items (weight_g; length/width/height cm; shape box | cylinder | sphere | flat; sort_order)
```

Items with `section_id = NULL` are "unassigned" and can be dragged into any bag. Deleting a bag or
section unassigns its items rather than deleting them.

Units: grams, centimeters, liters. Item volume = bounding box (cylinders x pi/4, spheres x pi/6).

## API

`/api/locations`, `/api/bags`, `/api/sections`, `/api/items` - standard `GET`, `GET /:id`,
`POST`, `PUT /:id`, `DELETE /:id`. `GET /api/locations` embeds bags with stats, `GET /api/bags/:id`
returns sections with items, `GET /api/items` includes placement (section/bag/location).
`POST /api/items/:id/move { section_id | null, index }` moves and reorders.

## Layout

```
shared/edc.ts          types + calculations
server/src/db.ts       schema + connection
server/src/repo.ts     all SQL (swap this file to migrate off SQLite)
server/src/routes.ts   validation + REST wiring
server/src/seed.ts     demo data
client/src/api.ts      fetch + query hooks
client/src/pages/      Overview (3D host + bag cards), Bag (3D interior + DnD sections), Items (catalog)
client/src/three/      procedural models, slots, item meshes, scenes
client/src/forms.tsx   create/edit dialogs (item dialog has a live 3D preview)
```

See `docs/DECISIONS.md` for the reasoning behind the main choices.
