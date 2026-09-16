// Shared domain types and pure calculations used by both server and client.
// Kept framework-free so it can be imported natively by Node (type stripping) and by Vite.

export type LocationKind = 'person' | 'car' | 'rv' | 'house';
export type BagKind = 'pouch' | 'backpack' | 'case' | 'box' | 'drawer' | 'bag';
export type SectionPlacement = 'main' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'inner';
export type ItemShape = 'box' | 'cylinder' | 'sphere' | 'flat' | 'wire';

export const LOCATION_KINDS: LocationKind[] = ['person', 'car', 'rv', 'house'];
export const BAG_KINDS: BagKind[] = ['pouch', 'backpack', 'case', 'box', 'drawer', 'bag'];
export const SECTION_PLACEMENTS: SectionPlacement[] = ['main', 'front', 'back', 'left', 'right', 'top', 'bottom', 'inner'];
export const ITEM_SHAPES: ItemShape[] = ['box', 'cylinder', 'sphere', 'flat', 'wire'];

// Slots are named anchor points on the procedural 3D models. Each location kind has its own set.
export const LOCATION_SLOTS: Record<LocationKind, string[]> = {
  person: ['chest', 'belt-left', 'belt-right', 'back', 'pocket-left', 'pocket-right', 'hand'],
  car: ['trunk', 'glovebox', 'door-left', 'door-right', 'seat-back', 'under-seat'],
  rv: ['cabinet', 'under-bed', 'bathroom', 'kitchen', 'garage', 'cab'],
  house: ['hallway', 'closet', 'garage', 'kitchen', 'bedroom', 'office'],
};

export interface Location {
  id: number;
  name: string;
  kind: LocationKind;
  sort_order: number;
}

export interface Bag {
  id: number;
  location_id: number;
  name: string;
  kind: BagKind;
  slot: string;
  volume_l: number;
  empty_weight_g: number;
  color: string;
  notes: string;
  sort_order: number;
}

export interface Section {
  id: number;
  bag_id: number;
  name: string;
  placement: SectionPlacement;
  volume_l: number | null;
  sort_order: number;
}

export interface Item {
  id: number;
  name: string;
  category: string;
  weight_g: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  shape: ItemShape;
  color: string;
  notes: string;
  section_id: number | null;
  sort_order: number;
  // Section-local offsets in centimeters. Null means the item follows automatic packing.
  position_x_cm: number | null;
  position_y_cm: number | null;
  position_z_cm: number | null;
  rotation_x_deg: number;
  rotation_y_deg: number;
  rotation_z_deg: number;
}

export interface BagStats {
  item_count: number;
  items_weight_g: number;
  total_weight_g: number;
  used_volume_l: number;
  fill_pct: number;
}

export interface BagWithStats extends Bag {
  stats: BagStats;
}

export interface SectionWithItems extends Section {
  items: Item[];
  used_volume_l: number;
  weight_g: number;
}

export interface BagDetail extends BagWithStats {
  location: Location;
  sections: SectionWithItems[];
}

export interface LocationWithBags extends Location {
  bags: BagWithStats[];
  total_weight_g: number;
}

// Item placement info for the catalog view (where the item currently lives).
export interface ItemWithPlacement extends Item {
  section_name: string | null;
  bag_id: number | null;
  bag_name: string | null;
  location_id: number | null;
  location_name: string | null;
  location_kind: LocationKind | null;
}

/** Bounding-box volume of an item in liters (1 L = 1000 cm3). Shapes shrink the box volume. */
export function itemVolumeL(item: Pick<Item, 'length_cm' | 'width_cm' | 'height_cm' | 'shape'>): number {
  const box = (item.length_cm * item.width_cm * item.height_cm) / 1000;
  switch (item.shape) {
    case 'cylinder':
      return box * (Math.PI / 4);
    case 'sphere':
      return box * (Math.PI / 6);
    case 'wire':
      // length x width x height is the cable's coiled storage envelope, not the solid cable volume.
      return box * 0.35;
    default:
      return box;
  }
}

export function computeBagStats(bag: Pick<Bag, 'volume_l' | 'empty_weight_g'>, items: Item[]): BagStats {
  const items_weight_g = items.reduce((s, i) => s + i.weight_g, 0);
  const used_volume_l = items.reduce((s, i) => s + itemVolumeL(i), 0);
  return {
    item_count: items.length,
    items_weight_g,
    total_weight_g: bag.empty_weight_g + items_weight_g,
    used_volume_l,
    fill_pct: bag.volume_l > 0 ? Math.round((used_volume_l / bag.volume_l) * 100) : 0,
  };
}

export function formatWeight(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(g >= 10000 ? 1 : 2)} kg`;
  return `${Math.round(g)} g`;
}

export function formatVolume(l: number): string {
  if (l < 0.1) return `${Math.round(l * 1000)} ml`;
  if (l < 1) return `${(l * 1000).toFixed(0)} ml`;
  return `${l.toFixed(l >= 10 ? 0 : 1)} L`;
}
