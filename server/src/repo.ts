// Thin repository layer over SQLite. All SQL lives here so a future move to Postgres
// only touches this file (and db.ts).
import type { DatabaseSync } from 'node:sqlite';
import type {
  Bag, BagDetail, BagWithStats, Item, ItemWithPlacement, Location, LocationWithBags, Section, SectionWithItems,
} from '../../shared/edc.ts';
import { computeBagStats, itemVolumeL } from '../../shared/edc.ts';

type Row = Record<string, unknown>;
const cast = <T>(r: unknown): T => r as T;

export class Repo {
  private db: DatabaseSync;
  // Explicit field instead of a parameter property: Node's native type stripping only allows erasable syntax.
  constructor(db: DatabaseSync) {
    this.db = db;
  }

  // ---- locations ----
  listLocations(): Location[] {
    return cast<Location[]>(this.db.prepare('SELECT * FROM locations ORDER BY sort_order, id').all());
  }
  getLocation(id: number): Location | undefined {
    return cast<Location | undefined>(this.db.prepare('SELECT * FROM locations WHERE id = ?').get(id));
  }
  createLocation(data: Omit<Location, 'id'>): Location {
    const r = this.db.prepare('INSERT INTO locations (name, kind, sort_order) VALUES (?, ?, ?)')
      .run(data.name, data.kind, data.sort_order);
    return this.getLocation(Number(r.lastInsertRowid))!;
  }
  updateLocation(id: number, data: Partial<Omit<Location, 'id'>>): Location | undefined {
    this.patch('locations', id, data);
    return this.getLocation(id);
  }
  deleteLocation(id: number): boolean {
    return this.db.prepare('DELETE FROM locations WHERE id = ?').run(id).changes > 0;
  }

  listLocationsWithBags(): LocationWithBags[] {
    const bags = this.listBagsWithStats();
    return this.listLocations().map((loc) => {
      const own = bags.filter((b) => b.location_id === loc.id);
      return { ...loc, bags: own, total_weight_g: own.reduce((s, b) => s + b.stats.total_weight_g, 0) };
    });
  }

  // ---- bags ----
  listBags(): Bag[] {
    return cast<Bag[]>(this.db.prepare('SELECT * FROM bags ORDER BY sort_order, id').all());
  }
  getBag(id: number): Bag | undefined {
    return cast<Bag | undefined>(this.db.prepare('SELECT * FROM bags WHERE id = ?').get(id));
  }
  createBag(data: Omit<Bag, 'id'>): Bag {
    const r = this.db.prepare(
      `INSERT INTO bags (location_id, name, kind, slot, volume_l, empty_weight_g, color, notes, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(data.location_id, data.name, data.kind, data.slot, data.volume_l, data.empty_weight_g, data.color, data.notes, data.sort_order);
    const id = Number(r.lastInsertRowid);
    // Every bag starts with a main section so items can be dropped in right away.
    this.createSection({ bag_id: id, name: 'Main', placement: 'main', volume_l: null, sort_order: 0 });
    return this.getBag(id)!;
  }
  updateBag(id: number, data: Partial<Omit<Bag, 'id'>>): Bag | undefined {
    this.patch('bags', id, data);
    return this.getBag(id);
  }
  deleteBag(id: number): boolean {
    return this.db.prepare('DELETE FROM bags WHERE id = ?').run(id).changes > 0;
  }

  listBagsWithStats(): BagWithStats[] {
    const items = this.listItems();
    const sections = this.listSections();
    const sectionBag = new Map(sections.map((s) => [s.id, s.bag_id]));
    const byBag = new Map<number, Item[]>();
    for (const it of items) {
      const bagId = it.section_id == null ? undefined : sectionBag.get(it.section_id);
      if (bagId == null) continue;
      if (!byBag.has(bagId)) byBag.set(bagId, []);
      byBag.get(bagId)!.push(it);
    }
    return this.listBags().map((b) => ({ ...b, stats: computeBagStats(b, byBag.get(b.id) ?? []) }));
  }

  getBagDetail(id: number): BagDetail | undefined {
    const bag = this.getBag(id);
    if (!bag) return undefined;
    const location = this.getLocation(bag.location_id)!;
    const sections = cast<Section[]>(
      this.db.prepare('SELECT * FROM sections WHERE bag_id = ? ORDER BY sort_order, id').all(id),
    );
    const items = cast<Item[]>(
      this.db.prepare(
        `SELECT i.* FROM items i JOIN sections s ON s.id = i.section_id WHERE s.bag_id = ? ORDER BY i.sort_order, i.id`,
      ).all(id),
    );
    const withItems: SectionWithItems[] = sections.map((s) => {
      const own = items.filter((i) => i.section_id === s.id);
      return {
        ...s,
        items: own,
        used_volume_l: own.reduce((a, i) => a + itemVolumeL(i), 0),
        weight_g: own.reduce((a, i) => a + i.weight_g, 0),
      };
    });
    return { ...bag, location, stats: computeBagStats(bag, items), sections: withItems };
  }

  // ---- sections ----
  listSections(): Section[] {
    return cast<Section[]>(this.db.prepare('SELECT * FROM sections ORDER BY sort_order, id').all());
  }
  getSection(id: number): Section | undefined {
    return cast<Section | undefined>(this.db.prepare('SELECT * FROM sections WHERE id = ?').get(id));
  }
  createSection(data: Omit<Section, 'id'>): Section {
    const r = this.db.prepare(
      'INSERT INTO sections (bag_id, name, placement, volume_l, sort_order) VALUES (?, ?, ?, ?, ?)',
    ).run(data.bag_id, data.name, data.placement, data.volume_l, data.sort_order);
    return this.getSection(Number(r.lastInsertRowid))!;
  }
  updateSection(id: number, data: Partial<Omit<Section, 'id'>>): Section | undefined {
    this.patch('sections', id, data);
    return this.getSection(id);
  }
  deleteSection(id: number): boolean {
    return this.db.prepare('DELETE FROM sections WHERE id = ?').run(id).changes > 0;
  }

  // ---- items ----
  listItems(): Item[] {
    return cast<Item[]>(this.db.prepare('SELECT * FROM items ORDER BY sort_order, id').all());
  }
  listItemsWithPlacement(): ItemWithPlacement[] {
    return cast<ItemWithPlacement[]>(
      this.db.prepare(
        `SELECT i.*, s.name AS section_name, b.id AS bag_id, b.name AS bag_name,
                l.id AS location_id, l.name AS location_name, l.kind AS location_kind
         FROM items i
         LEFT JOIN sections s ON s.id = i.section_id
         LEFT JOIN bags b ON b.id = s.bag_id
         LEFT JOIN locations l ON l.id = b.location_id
         ORDER BY i.name COLLATE NOCASE`,
      ).all(),
    );
  }
  getItem(id: number): Item | undefined {
    return cast<Item | undefined>(this.db.prepare('SELECT * FROM items WHERE id = ?').get(id));
  }
  createItem(data: Omit<Item, 'id'>): Item {
    const r = this.db.prepare(
      `INSERT INTO items (
         name, category, weight_g, length_cm, width_cm, height_cm, shape, color, notes, section_id, sort_order,
         position_x_cm, position_y_cm, position_z_cm, rotation_x_deg, rotation_y_deg, rotation_z_deg
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.name, data.category, data.weight_g, data.length_cm, data.width_cm, data.height_cm,
      data.shape, data.color, data.notes, data.section_id, data.sort_order,
      data.position_x_cm, data.position_y_cm, data.position_z_cm,
      data.rotation_x_deg, data.rotation_y_deg, data.rotation_z_deg,
    );
    return this.getItem(Number(r.lastInsertRowid))!;
  }
  updateItem(id: number, data: Partial<Omit<Item, 'id'>>): Item | undefined {
    this.patch('items', id, data);
    return this.getItem(id);
  }
  deleteItem(id: number): boolean {
    return this.db.prepare('DELETE FROM items WHERE id = ?').run(id).changes > 0;
  }

  /**
   * Move an item into a section (or null = unassigned) at a given index and
   * renumber sort_order of both the source and target sections so ordering stays dense.
   */
  moveItem(itemId: number, sectionId: number | null, index: number): Item | undefined {
    const item = this.getItem(itemId);
    if (!item) return undefined;
    const from = item.section_id;
    const siblings = (sid: number | null): Item[] =>
      cast<Item[]>(
        sid == null
          ? this.db.prepare('SELECT * FROM items WHERE section_id IS NULL ORDER BY sort_order, id').all()
          : this.db.prepare('SELECT * FROM items WHERE section_id = ? ORDER BY sort_order, id').all(sid),
      );
    const setOrder = this.db.prepare('UPDATE items SET section_id = ?, sort_order = ? WHERE id = ?');

    this.db.exec('BEGIN');
    try {
      const target = siblings(sectionId).filter((i) => i.id !== itemId);
      const clamped = Math.max(0, Math.min(index, target.length));
      target.splice(clamped, 0, item);
      target.forEach((i, idx) => {
        // A section move changes the local coordinate system, so stale manual placement must not follow it.
        setOrder.run(sectionId, idx, i.id);
        if (i.id === itemId && from !== sectionId) {
          this.db.prepare(
            `UPDATE items SET position_x_cm = NULL, position_y_cm = NULL, position_z_cm = NULL,
             rotation_x_deg = 0, rotation_y_deg = 0, rotation_z_deg = 0 WHERE id = ?`,
          ).run(i.id);
        }
      });
      if (from !== sectionId) {
        siblings(from).filter((i) => i.id !== itemId).forEach((i, idx) => setOrder.run(from, idx, i.id));
      }
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return this.getItem(itemId);
  }

  // ---- helpers ----
  private patch(table: string, id: number, data: Row): void {
    const keys = Object.keys(data).filter((k) => data[k] !== undefined);
    if (keys.length === 0) return;
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    this.db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...keys.map((k) => data[k] as never), id);
  }

  countLocations(): number {
    return Number(cast<{ n: number }>(this.db.prepare('SELECT COUNT(*) AS n FROM locations').get()).n);
  }
}
