import { Router } from 'express';
import { z } from 'zod';
import type { Repo } from './repo.ts';
import { BAG_KINDS, ITEM_SHAPES, LOCATION_KINDS, SECTION_PLACEMENTS } from '../../shared/edc.ts';

const idParam = z.coerce.number().int().positive();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

const locationSchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(LOCATION_KINDS as [string, ...string[]]),
  sort_order: z.number().int().default(0),
});
const bagSchema = z.object({
  location_id: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  kind: z.enum(BAG_KINDS as [string, ...string[]]),
  slot: z.string().trim().min(1).max(40).default('default'),
  volume_l: z.number().min(0).default(1),
  empty_weight_g: z.number().min(0).default(0),
  color: color.default('#7c8cff'),
  notes: z.string().max(2000).default(''),
  sort_order: z.number().int().default(0),
});
const sectionSchema = z.object({
  bag_id: z.number().int().positive(),
  name: z.string().trim().min(1).max(80),
  placement: z.enum(SECTION_PLACEMENTS as [string, ...string[]]).default('main'),
  volume_l: z.number().min(0).nullable().default(null),
  sort_order: z.number().int().default(0),
});
const itemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).default('misc'),
  weight_g: z.number().min(0).default(0),
  length_cm: z.number().positive().default(1),
  width_cm: z.number().positive().default(1),
  height_cm: z.number().positive().default(1),
  shape: z.enum(ITEM_SHAPES as [string, ...string[]]).default('box'),
  color: color.default('#cfd3dc'),
  notes: z.string().max(2000).default(''),
  section_id: z.number().int().positive().nullable().default(null),
  sort_order: z.number().int().default(0),
  position_x_cm: z.number().nullable().default(null),
  position_y_cm: z.number().nullable().default(null),
  position_z_cm: z.number().nullable().default(null),
  rotation_x_deg: z.number().default(0),
  rotation_y_deg: z.number().default(0),
  rotation_z_deg: z.number().default(0),
});
const moveSchema = z.object({
  section_id: z.number().int().positive().nullable(),
  index: z.number().int().min(0).default(0),
});

export function buildRouter(repo: Repo): Router {
  const r = Router();

  // Generic CRUD wiring keeps the four resources consistent (same validation + status codes).
  type Crud<T> = {
    schema: z.ZodType<T, z.ZodTypeDef, unknown>;
    list: () => unknown[];
    get: (id: number) => unknown;
    create: (d: T) => unknown;
    update: (id: number, d: Partial<T>) => unknown;
    remove: (id: number) => boolean;
  };
  const crud = <T>(path: string, c: Crud<T>) => {
    r.get(path, (_req, res) => res.json(c.list()));
    r.get(`${path}/:id`, (req, res) => {
      const row = c.get(idParam.parse(req.params.id));
      row ? res.json(row) : res.status(404).json({ error: 'not found' });
    });
    r.post(path, (req, res) => res.status(201).json(c.create(c.schema.parse(req.body))));
    r.put(`${path}/:id`, (req, res) => {
      const id = idParam.parse(req.params.id);
      const partial = (c.schema as unknown as z.AnyZodObject).partial().parse(req.body) as Partial<T>;
      const row = c.update(id, partial);
      row ? res.json(row) : res.status(404).json({ error: 'not found' });
    });
    r.delete(`${path}/:id`, (req, res) => {
      c.remove(idParam.parse(req.params.id)) ? res.status(204).end() : res.status(404).json({ error: 'not found' });
    });
  };

  crud('/locations', {
    schema: locationSchema,
    list: () => repo.listLocationsWithBags(),
    get: (id) => repo.getLocation(id),
    create: (d) => repo.createLocation(d as never),
    update: (id, d) => repo.updateLocation(id, d as never),
    remove: (id) => repo.deleteLocation(id),
  });
  crud('/bags', {
    schema: bagSchema,
    list: () => repo.listBagsWithStats(),
    get: (id) => repo.getBagDetail(id),
    create: (d) => repo.createBag(d as never),
    update: (id, d) => repo.updateBag(id, d as never),
    remove: (id) => repo.deleteBag(id),
  });
  crud('/sections', {
    schema: sectionSchema,
    list: () => repo.listSections(),
    get: (id) => repo.getSection(id),
    create: (d) => repo.createSection(d as never),
    update: (id, d) => repo.updateSection(id, d as never),
    remove: (id) => repo.deleteSection(id),
  });
  crud('/items', {
    schema: itemSchema,
    list: () => repo.listItemsWithPlacement(),
    get: (id) => repo.getItem(id),
    create: (d) => repo.createItem(d as never),
    update: (id, d) => repo.updateItem(id, d as never),
    remove: (id) => repo.deleteItem(id),
  });

  r.post('/items/:id/move', (req, res) => {
    const { section_id, index } = moveSchema.parse(req.body);
    const row = repo.moveItem(idParam.parse(req.params.id), section_id, index);
    row ? res.json(row) : res.status(404).json({ error: 'not found' });
  });

  return r;
}
