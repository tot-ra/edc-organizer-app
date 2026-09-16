import type { Repo } from './repo.ts';

/** Populates an empty database with a realistic starter kit so the UI is not blank on first run. */
export function seedIfEmpty(repo: Repo): void {
  if (repo.countLocations() > 0) return;

  const me = repo.createLocation({ name: 'Me', kind: 'person', sort_order: 0 });
  const car = repo.createLocation({ name: 'Car', kind: 'car', sort_order: 1 });
  const rv = repo.createLocation({ name: 'RV', kind: 'rv', sort_order: 2 });
  const house = repo.createLocation({ name: 'Home', kind: 'house', sort_order: 3 });

  const pocket = repo.createBag({
    location_id: me.id, name: 'Pocket organizer', kind: 'pouch', slot: 'pocket-right',
    volume_l: 0.4, empty_weight_g: 45, color: '#e8a33d', notes: '', sort_order: 0,
  });
  const belt = repo.createBag({
    location_id: me.id, name: 'Belt pouch', kind: 'pouch', slot: 'belt-left',
    volume_l: 0.8, empty_weight_g: 90, color: '#5fb3a1', notes: '', sort_order: 1,
  });
  const pack = repo.createBag({
    location_id: me.id, name: 'Daypack', kind: 'backpack', slot: 'back',
    volume_l: 20, empty_weight_g: 850, color: '#4f7cff', notes: '', sort_order: 2,
  });
  const trunk = repo.createBag({
    location_id: car.id, name: 'Trunk kit', kind: 'box', slot: 'trunk',
    volume_l: 30, empty_weight_g: 1200, color: '#c25e5e', notes: '', sort_order: 0,
  });
  const glove = repo.createBag({
    location_id: car.id, name: 'Glovebox pouch', kind: 'pouch', slot: 'glovebox',
    volume_l: 1.5, empty_weight_g: 120, color: '#9b7bd6', notes: '', sort_order: 1,
  });
  const rvTools = repo.createBag({
    location_id: rv.id, name: 'Tool case', kind: 'case', slot: 'garage',
    volume_l: 25, empty_weight_g: 2100, color: '#d6a25a', notes: '', sort_order: 0,
  });
  const hallway = repo.createBag({
    location_id: house.id, name: 'Hallway drawer', kind: 'drawer', slot: 'hallway',
    volume_l: 12, empty_weight_g: 0, color: '#8fa3b8', notes: '', sort_order: 0,
  });

  // Extra sections for the backpack and the trunk kit.
  const packMain = repo.getBagDetail(pack.id)!.sections[0];
  const packFront = repo.createSection({ bag_id: pack.id, name: 'Front pocket', placement: 'front', volume_l: 2, sort_order: 1 });
  const packSide = repo.createSection({ bag_id: pack.id, name: 'Side pocket', placement: 'left', volume_l: 1, sort_order: 2 });
  const trunkMain = repo.getBagDetail(trunk.id)!.sections[0];
  const trunkLid = repo.createSection({ bag_id: trunk.id, name: 'Lid', placement: 'top', volume_l: 3, sort_order: 1 });
  const pocketMain = repo.getBagDetail(pocket.id)!.sections[0];
  const beltMain = repo.getBagDetail(belt.id)!.sections[0];
  const gloveMain = repo.getBagDetail(glove.id)!.sections[0];
  const rvMain = repo.getBagDetail(rvTools.id)!.sections[0];
  const hallMain = repo.getBagDetail(hallway.id)!.sections[0];

  const items: Array<[string, string, number, number, number, number, string, string, number | null]> = [
    // name, category, weight_g, L, W, H, shape, color, section
    ['Folding knife', 'tools', 85, 10, 2.5, 1.2, 'box', '#9aa5b1', pocketMain.id],
    ['Keys', 'everyday', 60, 7, 3, 1.5, 'box', '#d4af37', pocketMain.id],
    ['Mini flashlight', 'light', 40, 8, 1.8, 1.8, 'cylinder', '#333a45', pocketMain.id],
    ['Multitool', 'tools', 230, 11, 4, 2, 'box', '#7d8794', beltMain.id],
    ['Screwdriver', 'tools', 70, 15, 2.5, 2.5, 'cylinder', '#e06c3c', beltMain.id],
    ['Tissues', 'hygiene', 25, 10, 5, 2, 'flat', '#f2f2f2', beltMain.id],
    ['Power bank', 'electronics', 210, 10, 6, 1.5, 'box', '#2f3742', packMain.id],
    ['Water bottle', 'hydration', 120, 22, 7, 7, 'cylinder', '#3a9ad9', packSide.id],
    ['First aid kit', 'medical', 180, 14, 10, 4, 'box', '#d64545', packFront.id],
    ['Notebook', 'office', 150, 21, 14, 1.2, 'flat', '#efe6c8', packMain.id],
    ['Rain jacket', 'clothing', 260, 25, 15, 8, 'box', '#4a6b3a', packMain.id],
    ['Jump starter', 'car', 900, 20, 9, 4, 'box', '#1f1f1f', trunkMain.id],
    ['Tow strap', 'car', 1100, 30, 12, 12, 'cylinder', '#e0b400', trunkMain.id],
    ['Work gloves', 'car', 120, 25, 12, 3, 'flat', '#8b5a2b', trunkLid.id],
    ['Registration docs', 'documents', 40, 22, 11, 0.5, 'flat', '#ffffff', gloveMain.id],
    ['Tire pressure gauge', 'car', 35, 12, 2, 2, 'cylinder', '#b0b0b0', gloveMain.id],
    ['Socket set', 'tools', 1800, 30, 20, 6, 'box', '#c0392b', rvMain.id],
    ['Duct tape', 'tools', 250, 10, 10, 5, 'cylinder', '#7a7a7a', rvMain.id],
    ['Headlamp', 'light', 90, 6, 4, 4, 'box', '#2c3e50', rvMain.id],
    ['Spare keys', 'everyday', 50, 6, 3, 1, 'box', '#d4af37', hallMain.id],
    ['Umbrella', 'everyday', 320, 28, 5, 5, 'cylinder', '#1c1c1c', hallMain.id],
    ['Sunglasses', 'everyday', 30, 15, 5, 4, 'box', '#111111', null],
  ];
  items.forEach(([name, category, weight_g, length_cm, width_cm, height_cm, shape, color, section_id], i) =>
    repo.createItem({
      name, category, weight_g, length_cm, width_cm, height_cm,
      shape: shape as never, color, notes: '', section_id, sort_order: i,
      position_x_cm: null, position_y_cm: null, position_z_cm: null,
      rotation_x_deg: 0, rotation_y_deg: 0, rotation_z_deg: 0,
    }),
  );
}
