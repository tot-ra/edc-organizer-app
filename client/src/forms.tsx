// Create/edit forms for all entities. Each form owns its local draft state and calls the API on submit.
import { useEffect, useState, type FormEvent } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  BAG_KINDS, ITEM_SHAPES, LOCATION_KINDS, LOCATION_SLOTS, SECTION_PLACEMENTS, itemVolumeL, formatVolume,
  type Bag, type Item, type Location, type LocationKind, type LocationWithBags, type Section,
} from '../../shared/edc.ts';
import { useApi, useBag, type BagInput, type ItemInput, type LocationInput, type SectionInput } from './api.ts';
import { Field, Modal, confirmDelete, num, KIND_LABEL } from './ui.tsx';
import { ItemMesh } from './three/ItemMesh.tsx';

function useSubmit<T>(fn: (d: T) => Promise<unknown>, onDone: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent, data: T) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await fn(data); onDone(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return { submit, error, busy };
}

const PALETTE = ['#7c8cff', '#5fb3a1', '#e8a33d', '#c25e5e', '#9b7bd6', '#4f7cff', '#d6a25a', '#8fa3b8', '#3a9ad9', '#e06c3c'];
const randomColor = () => PALETTE[Math.floor(Math.random() * PALETTE.length)];

// ---------- Location ----------
export function LocationForm({ location, onClose }: { location?: Location; onClose: () => void }) {
  const api = useApi();
  const [d, setD] = useState<LocationInput>(location ?? { name: '', kind: 'person', sort_order: 99 });
  const { submit, error, busy } = useSubmit<LocationInput>(
    (data) => (location ? api.updateLocation.mutateAsync([location.id, data]) : api.createLocation.mutateAsync([data])),
    onClose,
  );
  return (
    <Modal title={location ? 'Edit location' : 'New location'} onClose={onClose}>
      <form onSubmit={(e) => submit(e, d)} className="form-grid">
        <Field label="Name" full><input className="input" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Type" full>
          <select className="input" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as LocationKind })}>
            {LOCATION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </Field>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          {location && (
            <button type="button" className="btn danger" onClick={async () => { if (confirmDelete(`"${location.name}" with all its bags`)) { await api.deleteLocation.mutateAsync([location.id]); onClose(); } }}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !d.name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Bag ----------
export function BagForm({ bag, locations, defaultLocationId, onClose, onDeleted }: {
  bag?: Bag; locations: LocationWithBags[]; defaultLocationId?: number; onClose: () => void; onDeleted?: () => void;
}) {
  const api = useApi();
  const firstLoc = locations.find((l) => l.id === defaultLocationId) ?? locations[0];
  const [d, setD] = useState<BagInput>(
    bag ?? {
      location_id: firstLoc?.id ?? 0, name: '', kind: 'pouch', slot: LOCATION_SLOTS[firstLoc?.kind ?? 'person'][0],
      volume_l: 1, empty_weight_g: 100, color: randomColor(), notes: '', sort_order: 99,
    },
  );
  const loc = locations.find((l) => l.id === d.location_id);
  const slots = LOCATION_SLOTS[loc?.kind ?? 'person'];
  const { submit, error, busy } = useSubmit<BagInput>(
    (data) => (bag ? api.updateBag.mutateAsync([bag.id, data]) : api.createBag.mutateAsync([data])),
    onClose,
  );
  return (
    <Modal title={bag ? 'Edit bag' : 'New bag'} onClose={onClose}>
      <form onSubmit={(e) => submit(e, d)} className="form-grid">
        <Field label="Name" full><input className="input" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Type">
          <select className="input" value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as Bag['kind'] })}>
            {BAG_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Color"><input type="color" className="input" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} /></Field>
        <Field label="Location">
          <select className="input" value={d.location_id} onChange={(e) => {
            const l = locations.find((x) => x.id === Number(e.target.value));
            setD({ ...d, location_id: Number(e.target.value), slot: LOCATION_SLOTS[l?.kind ?? 'person'][0] });
          }}>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({KIND_LABEL[l.kind]})</option>)}
          </select>
        </Field>
        <Field label="Slot (where on the model)">
          <select className="input" value={d.slot} onChange={(e) => setD({ ...d, slot: e.target.value })}>
            {slots.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Volume, L"><input className="input" inputMode="decimal" value={d.volume_l} onChange={(e) => setD({ ...d, volume_l: num(e.target.value) })} /></Field>
        <Field label="Empty weight, g"><input className="input" inputMode="decimal" value={d.empty_weight_g} onChange={(e) => setD({ ...d, empty_weight_g: num(e.target.value) })} /></Field>
        <Field label="Notes" full><textarea className="input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          {bag && (
            <button type="button" className="btn danger" onClick={async () => {
              if (confirmDelete(`bag "${bag.name}" (items become unassigned)`)) { await api.deleteBag.mutateAsync([bag.id]); onClose(); onDeleted?.(); }
            }}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !d.name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Section ----------
export function SectionForm({ section, bagId, onClose }: { section?: Section; bagId: number; onClose: () => void }) {
  const api = useApi();
  const [d, setD] = useState<SectionInput>(section ?? { bag_id: bagId, name: '', placement: 'front', volume_l: null, sort_order: 99 });
  const { submit, error, busy } = useSubmit<SectionInput>(
    (data) => (section ? api.updateSection.mutateAsync([section.id, data]) : api.createSection.mutateAsync([data])),
    onClose,
  );
  return (
    <Modal title={section ? 'Edit section' : 'New section'} onClose={onClose}>
      <form onSubmit={(e) => submit(e, d)} className="form-grid">
        <Field label="Name" full><input className="input" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Placement in bag">
          <select className="input" value={d.placement} onChange={(e) => setD({ ...d, placement: e.target.value as Section['placement'] })}>
            {SECTION_PLACEMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Capacity, L (optional)">
          <input className="input" inputMode="decimal" value={d.volume_l ?? ''} placeholder="-" onChange={(e) => setD({ ...d, volume_l: e.target.value.trim() === '' ? null : num(e.target.value) })} />
        </Field>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          {section && (
            <button type="button" className="btn danger" onClick={async () => {
              if (confirmDelete(`section "${section.name}" (items become unassigned)`)) { await api.deleteSection.mutateAsync([section.id]); onClose(); }
            }}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !d.name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Item ----------
/** Live 3D prototype of the item being edited; the same generator is used inside bag scenes. */
export function ItemPreview({ item, interactive = true }: { item: Pick<Item, 'shape' | 'length_cm' | 'width_cm' | 'height_cm' | 'color'>; interactive?: boolean }) {
  const d = [item.length_cm, item.width_cm, item.height_cm].map((v) => Math.max(v, 0.1)).sort((a, b) => b - a);
  const norm = 1.6 / d[0];
  const size: [number, number, number] = [d[0] * norm, d[2] * norm, d[1] * norm];
  return (
    <Canvas camera={{ position: [1.6, 1.3, 1.9], fov: 35 }} dpr={[1, 2]} frameloop={interactive ? 'always' : 'demand'}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <group rotation={[0, 0.4, 0]}>
        <ItemMesh shape={item.shape} size={size} color={item.color} />
      </group>
      {interactive && <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={2} />}
    </Canvas>
  );
}

export function ItemForm({ item, locations, defaultSectionId, onClose }: {
  item?: Item; locations: LocationWithBags[]; defaultSectionId?: number | null; onClose: () => void;
}) {
  const api = useApi();
  const [d, setD] = useState<ItemInput>(
    item ?? {
      name: '', category: 'misc', weight_g: 50, length_cm: 10, width_cm: 5, height_cm: 2, shape: 'box',
      color: '#cfd3dc', notes: '', section_id: defaultSectionId ?? null, sort_order: 999,
      position_x_cm: null, position_y_cm: null, position_z_cm: null,
      rotation_x_deg: 0, rotation_y_deg: 0, rotation_z_deg: 0,
    },
  );
  const [bagId, setBagId] = useState<number | ''>('');
  const bags = locations.flatMap((l) => l.bags.map((b) => ({ ...b, locName: l.name })));
  // Sections of the selected bag are loaded lazily through the bag detail endpoint.
  const { submit, error, busy } = useSubmit<ItemInput>(
    (data) => (item ? api.updateItem.mutateAsync([item.id, data]) : api.createItem.mutateAsync([data])),
    onClose,
  );
  return (
    <Modal title={item ? 'Edit item' : 'New item'} onClose={onClose}>
      <form onSubmit={(e) => submit(e, d)} className="form-grid">
        <div className="preview full"><ItemPreview item={d} /></div>
        <Field label="Name" full><input className="input" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></Field>
        <Field label="Category"><input className="input" list="categories" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} /></Field>
        <datalist id="categories">
          {['tools', 'everyday', 'light', 'electronics', 'hygiene', 'medical', 'documents', 'clothing', 'hydration', 'car', 'office', 'misc'].map((c) => <option key={c} value={c} />)}
        </datalist>
        <Field label="Weight, g"><input className="input" inputMode="decimal" value={d.weight_g} onChange={(e) => setD({ ...d, weight_g: num(e.target.value) })} /></Field>
        <div className="form-grid three full">
          <Field label="Length, mm"><input type="number" min="1" step="1" className="input" inputMode="numeric" value={Math.round(d.length_cm * 10)} onChange={(e) => setD({ ...d, length_cm: num(e.target.value, 10) / 10 })} /></Field>
          <Field label="Width, mm"><input type="number" min="1" step="1" className="input" inputMode="numeric" value={Math.round(d.width_cm * 10)} onChange={(e) => setD({ ...d, width_cm: num(e.target.value, 10) / 10 })} /></Field>
          <Field label="Height, mm"><input type="number" min="1" step="1" className="input" inputMode="numeric" value={Math.round(d.height_cm * 10)} onChange={(e) => setD({ ...d, height_cm: num(e.target.value, 10) / 10 })} /></Field>
        </div>
        <Field label="Shape">
          <select className="input" value={d.shape} onChange={(e) => setD({ ...d, shape: e.target.value as Item['shape'] })}>
            {ITEM_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Color"><input type="color" className="input" value={d.color} onChange={(e) => setD({ ...d, color: e.target.value })} /></Field>
        <div className="full small muted">Takes about {formatVolume(itemVolumeL(d))}</div>
        <Field label="Put into bag" full>
          <div className="row">
            <select className="input" value={bagId} onChange={(e) => { setBagId(e.target.value === '' ? '' : Number(e.target.value)); }}>
              <option value="">{d.section_id == null ? 'Unassigned' : 'Keep current section'}</option>
              {bags.map((b) => <option key={b.id} value={b.id}>{b.locName} / {b.name}</option>)}
            </select>
            {bagId !== '' && <SectionPicker bagId={bagId} value={d.section_id} onChange={(sid) => setD({ ...d, section_id: sid })} />}
            {d.section_id != null && bagId === '' && (
              <button type="button" className="btn sm" onClick={() => setD({ ...d, section_id: null })}>Unassign</button>
            )}
          </div>
        </Field>
        <Field label="Notes" full><textarea className="input" rows={2} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} /></Field>
        {error && <div className="error full">{error}</div>}
        <div className="modal-actions full">
          {item && (
            <button type="button" className="btn danger" onClick={async () => {
              if (confirmDelete(`item "${item.name}"`)) { await api.deleteItem.mutateAsync([item.id]); onClose(); }
            }}>Delete</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy || !d.name.trim()}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function SectionPicker({ bagId, value, onChange }: { bagId: number; value: number | null; onChange: (id: number | null) => void }) {
  const { data } = useBag(bagId);
  const sections = data?.sections ?? [];
  const valid = sections.some((s) => s.id === value);
  // Auto-select the first section of the chosen bag so "Save" always lands the item somewhere.
  useEffect(() => {
    if (sections.length && !valid) onChange(sections[0].id);
  }, [sections, valid, onChange]);
  return (
    <select className="input" value={valid ? value! : ''} onChange={(e) => onChange(Number(e.target.value))}>
      {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );
}
