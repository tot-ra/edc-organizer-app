import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { db } from './db.ts';
import { Repo } from './repo.ts';
import { buildRouter } from './routes.ts';
import { seedIfEmpty } from './seed.ts';

const PORT = Number(process.env.PORT ?? 3001);
const here = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(here, '../../client/dist');

const repo = new Repo(db);
if (process.env.EDC_SEED !== '0') seedIfEmpty(repo);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', buildRouter(repo));

// In production the API server also serves the built client (single process, single port).
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(resolve(clientDist, 'index.html')));
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'validation', issues: err.issues });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal' });
});

app.listen(PORT, () => console.log(`EDC server listening on http://localhost:${PORT}`));
