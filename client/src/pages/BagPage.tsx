import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor,
  closestCorners, getFirstCollision, pointerWithin, rectIntersection, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatVolume, formatWeight, itemVolumeL, type Bag, type Item, type Section } from '../../../shared/edc.ts';
import { useApi, useBag, useItems, useLocations } from '../api.ts';
import { FillBar, Icon, Stat, confirmDelete } from '../ui.tsx';
import { BagForm, ItemForm, SectionForm } from '../forms.tsx';
import { BagScene } from '../three/BagScene.tsx';

const UNASSIGNED = 'unassigned';
type ContainerId = string; // `s<sectionId>` or UNASSIGNED
const sectionKey = (id: number): ContainerId => `s${id}`;
const parseContainer = (key: ContainerId): number | null => (key === UNASSIGNED ? null : Number(key.slice(1)));

function ItemChip({ item, onEdit, overlay }: { item: Item; onEdit?: () => void; overlay?: boolean }) {
  return (
    <div className={`chip${overlay ? ' overlay' : ''}`}>
      <span className="dot" style={{ background: item.color }} />
      <span>{item.name}</span>
      <span className="w mono">{formatWeight(item.weight_g)}</span>
      {onEdit && (
        <button className="btn ghost icon sm edit" onPointerDown={(e) => e.stopPropagation()} onClick={onEdit} aria-label="Edit item">
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
  );
}

function SortableChip({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={isDragging ? 'dragging' : undefined} {...attributes} {...listeners}>
      <ItemChip item={item} onEdit={onEdit} />
    </div>
  );
}

function Container({ id, title, meta, items, onEditItem, actions }: {
  id: ContainerId; title: string; meta?: string; items: Item[]; onEditItem: (item: Item) => void; actions?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`section${isOver ? ' over' : ''}`}>
      <div className="section-head">
        <span className="name">{title}</span>
        {meta && <span className="muted small">{meta}</span>}
        <span className="spacer" />
        {actions}
      </div>
      <SortableContext id={id} items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <div className="chips">
          {items.map((item) => <SortableChip key={item.id} item={item} onEdit={() => onEditItem(item)} />)}
          {items.length === 0 && <span className="muted small" style={{ alignSelf: 'center' }}>Drop items here</span>}
        </div>
      </SortableContext>
    </div>
  );
}

export default function BagPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: bag, isLoading, error } = useBag(id);
  const { data: allItems } = useItems();
  const { data: locations } = useLocations();
  const api = useApi();

  const [modal, setModal] = useState<null | { type: 'bag'; bag: Bag } | { type: 'section'; section?: Section } | { type: 'item'; item?: Item; sectionId?: number | null }>(null);

  // Local mirror of item placement so drag-and-drop feels instant; re-synced whenever the server data changes.
  const [containers, setContainers] = useState<Record<ContainerId, number[]>>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const containersRef = useRef(containers);
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const itemsById = useMemo(() => {
    const m = new Map<number, Item>();
    bag?.sections.forEach((s) => s.items.forEach((i) => m.set(i.id, i)));
    allItems?.forEach((i) => { if (i.section_id == null) m.set(i.id, i); });
    return m;
  }, [bag, allItems]);

  useEffect(() => {
    if (!bag) return;
    const next: Record<ContainerId, number[]> = {};
    bag.sections.forEach((s) => { next[sectionKey(s.id)] = s.items.map((i) => i.id); });
    next[UNASSIGNED] = (allItems ?? []).filter((i) => i.section_id == null).map((i) => i.id);
    containersRef.current = next;
    setContainers(next);
  }, [bag, allItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findContainer = useCallback((id: UniqueIdentifier | undefined, lists = containersRef.current): ContainerId | undefined => {
    if (id == null) return undefined;
    if (typeof id === 'string' && id in lists) return id;
    return Object.keys(lists).find((k) => lists[k].includes(Number(id)));
  }, []);

  // closestCorners alone cannot target a newly created empty section: its box is large, so
  // distance-to-corner loses to nearby chips in a filled section. Prefer pointer-within.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const lists = containersRef.current;
    const pointer = pointerWithin(args);
    const hits = pointer.length > 0 ? pointer : rectIntersection(args);
    let overId = getFirstCollision(hits, 'id');
    if (overId != null) {
      if (typeof overId === 'string' && overId in lists && lists[overId].length > 0) {
        const inner = closestCorners({
          ...args,
          droppableContainers: args.droppableContainers.filter((c) => lists[overId as ContainerId].includes(Number(c.id))),
        });
        if (inner[0]) overId = inner[0].id;
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));

  // Moving across containers happens live during the drag (standard multi-container pattern),
  // reordering inside a container is resolved on drop.
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const from = findContainer(active.id);
    const to = findContainer(over.id);
    if (!from || !to || from === to) return;
    setContainers((prev) => {
      const fromItems = prev[from].filter((i) => i !== Number(active.id));
      const toItems = [...prev[to]];
      const overIndex = toItems.indexOf(Number(over.id));
      const insertAt = overIndex >= 0 ? overIndex : toItems.length;
      toItems.splice(insertAt, 0, Number(active.id));
      const next = { ...prev, [from]: fromItems, [to]: toItems };
      containersRef.current = next;
      return next;
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    const current = containersRef.current;
    const from = findContainer(active.id, current);
    const to = findContainer(over?.id, current) ?? from;
    lastOverId.current = null;
    if (!from || !to) return;
    const itemId = Number(active.id);
    let list = [...(current[to] ?? [])];
    if (!list.includes(itemId)) {
      // Collision said "this container" but onDragOver never ran (empty droppable).
      list.push(itemId);
      const next = { ...current, [from]: current[from].filter((i) => i !== itemId), [to]: list };
      containersRef.current = next;
      setContainers(next);
    } else if (over && to === from && over.id !== active.id) {
      const overIndex = list.indexOf(Number(over.id));
      if (overIndex >= 0) {
        list = arrayMove(list, list.indexOf(itemId), overIndex);
        const next = { ...current, [to]: list };
        containersRef.current = next;
        setContainers(next);
      }
    }
    const index = list.indexOf(itemId);
    if (index < 0) return;
    const original = itemsById.get(itemId);
    const targetSection = parseContainer(to);
    // Skip the round trip when nothing actually changed.
    if (original && original.section_id === targetSection && original.sort_order === index) return;
    await api.moveItem.mutateAsync([itemId, targetSection, index]);
  };

  if (isLoading) return <div className="empty">Loading…</div>;
  if (error || !bag) return <div className="empty error">Bag not found. <Link to="/">Back</Link></div>;

  const items = (key: ContainerId): Item[] => (containers[key] ?? []).map((i) => itemsById.get(i)).filter((i): i is Item => !!i);
  const activeItem = activeId != null ? itemsById.get(activeId) : undefined;

  return (
    <div className="stack">
      <div className="row wrap">
        <Link to={`/?loc=${bag.location_id}`} className="btn ghost icon" aria-label="Back"><Icon name="back" /></Link>
        <span className="dot" style={{ background: bag.color, width: 14, height: 14 }} />
        <h1>{bag.name}</h1>
        <button className="btn ghost icon sm" onClick={() => setModal({ type: 'bag', bag })} aria-label="Edit bag"><Icon name="edit" size={16} /></button>
        <button
          className="btn ghost icon sm"
          onClick={async () => {
            if (confirmDelete(`bag "${bag.name}" (items become unassigned)`)) {
              await api.deleteBag.mutateAsync([bag.id]);
              navigate(`/?loc=${bag.location_id}`);
            }
          }}
          aria-label="Delete bag"
        >
          <Icon name="trash" size={16} />
        </button>
        <span className="badge">{bag.kind}</span>
        <span className="badge"><Icon name={bag.location.kind} size={12} /> {bag.location.name} · {bag.slot}</span>
      </div>

      <div className="card">
        <div className="stats">
          <Stat value={formatWeight(bag.stats.total_weight_g)} label="total weight" />
          <Stat value={formatWeight(bag.stats.items_weight_g)} label="items" />
          <Stat value={formatWeight(bag.empty_weight_g)} label="empty bag" />
          <Stat value={String(bag.stats.item_count)} label="item count" />
          <Stat value={`${formatVolume(bag.stats.used_volume_l)} / ${formatVolume(bag.volume_l)}`} label={`${bag.stats.fill_pct}% of volume`} />
        </div>
        <div style={{ marginTop: 10 }}><FillBar pct={bag.stats.fill_pct} /></div>
      </div>

      <div className="bag-layout">
        <BagScene
          bag={bag}
          onEditItem={(itemId) => { const it = itemsById.get(itemId); if (it) setModal({ type: 'item', item: it }); }}
          onUpdateItem={(itemId, update) => api.updateItem.mutateAsync([itemId, update])}
        />

        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => { setActiveId(null); lastOverId.current = null; }}>
          <div className="sections">
            <div className="row between">
              <h3>Sections</h3>
              <div className="row">
                <button className="btn sm" onClick={() => setModal({ type: 'item', sectionId: bag.sections[0]?.id ?? null })}><Icon name="plus" size={14} />Item</button>
                <button className="btn sm" onClick={() => setModal({ type: 'section' })}><Icon name="plus" size={14} />Section</button>
              </div>
            </div>
            {bag.sections.map((s) => {
              const list = items(sectionKey(s.id));
              const vol = list.reduce((a, i) => a + itemVolumeL(i), 0);
              const w = list.reduce((a, i) => a + i.weight_g, 0);
              return (
                <Container
                  key={s.id}
                  id={sectionKey(s.id)}
                  title={s.name}
                  meta={`${s.placement} · ${formatWeight(w)} · ${formatVolume(vol)}${s.volume_l ? ` / ${formatVolume(s.volume_l)}` : ''}`}
                  items={list}
                  onEditItem={(item) => setModal({ type: 'item', item })}
                  actions={<button className="btn ghost icon sm" onClick={() => setModal({ type: 'section', section: s })} aria-label="Edit section"><Icon name="edit" size={14} /></button>}
                />
              );
            })}
            <h3 style={{ marginTop: 8 }}>Unassigned items</h3>
            <Container id={UNASSIGNED} title="Not in any bag" items={items(UNASSIGNED)} onEditItem={(item) => setModal({ type: 'item', item })} />
          </div>
          <DragOverlay>{activeItem ? <ItemChip item={activeItem} overlay /> : null}</DragOverlay>
        </DndContext>
      </div>

      {modal?.type === 'bag' && locations && (
        <BagForm bag={modal.bag} locations={locations} onClose={() => setModal(null)} onDeleted={() => navigate('/')} />
      )}
      {modal?.type === 'section' && <SectionForm section={modal.section} bagId={bag.id} onClose={() => setModal(null)} />}
      {modal?.type === 'item' && locations && (
        <ItemForm item={modal.item} locations={locations} defaultSectionId={modal.sectionId} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
