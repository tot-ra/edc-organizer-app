import { useMemo, useState } from 'react';
import { formatVolume, formatWeight, itemVolumeL, type Item, type ItemWithPlacement } from '../../../shared/edc.ts';
import { useItems, useLocations } from '../api.ts';
import { Icon, ItemGlyph } from '../ui.tsx';
import { ItemForm } from '../forms.tsx';

type SortKey = 'name' | 'weight' | 'volume' | 'place';

export default function ItemsPage() {
  const { data: items, isLoading } = useItems();
  const { data: locations } = useLocations();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [modal, setModal] = useState<null | { item?: Item }>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = (items ?? []).filter((i) =>
      (!onlyUnassigned || i.section_id == null) &&
      (!needle || i.name.toLowerCase().includes(needle) || i.category.toLowerCase().includes(needle) || (i.bag_name ?? '').toLowerCase().includes(needle)),
    );
    const cmp: Record<SortKey, (a: ItemWithPlacement, b: ItemWithPlacement) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      weight: (a, b) => b.weight_g - a.weight_g,
      volume: (a, b) => itemVolumeL(b) - itemVolumeL(a),
      place: (a, b) => (a.location_name ?? 'zzz').localeCompare(b.location_name ?? 'zzz') || (a.bag_name ?? '').localeCompare(b.bag_name ?? ''),
    };
    return filtered.sort(cmp[sort]);
  }, [items, q, sort, onlyUnassigned]);

  const totalWeight = list.reduce((s, i) => s + i.weight_g, 0);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h1>Items</h1>
        <button className="btn primary" onClick={() => setModal({})}><Icon name="plus" size={16} />New item</button>
      </div>
      <div className="items-toolbar">
        <input className="input" placeholder="Search items, categories, bags…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Sort: name</option>
          <option value="weight">Sort: heaviest</option>
          <option value="volume">Sort: bulkiest</option>
          <option value="place">Sort: location</option>
        </select>
        <button className={`btn${onlyUnassigned ? ' primary' : ''}`} onClick={() => setOnlyUnassigned((v) => !v)}>Unassigned</button>
      </div>
      <div className="muted small" style={{ marginBottom: 10 }}>
        {list.length} items · {formatWeight(totalWeight)} · {formatVolume(list.reduce((s, i) => s + itemVolumeL(i), 0))}
      </div>

      {isLoading && <div className="empty">Loading…</div>}
      {!isLoading && list.length === 0 && <div className="empty">No items yet. Create your first one.</div>}

      <div className="stack" style={{ gap: 8 }}>
        {list.map((i) => (
          <div key={i.id} className="item-row" onClick={() => setModal({ item: i })}>
            <ItemGlyph item={i} />
            <div>
              <div className="item-name">{i.name}</div>
              <div className="item-meta">
                <span>{i.category}</span>
                <span>{i.length_cm}×{i.width_cm}×{i.height_cm} cm</span>
                {i.bag_name ? (
                  <span><Icon name={i.location_kind ?? 'bag'} size={12} /> {i.location_name} / {i.bag_name} / {i.section_name}</span>
                ) : (
                  <span style={{ color: 'var(--warn)' }}>unassigned</span>
                )}
              </div>
            </div>
            <div className="item-nums mono">
              <b>{formatWeight(i.weight_g)}</b>
              <span className="muted">{formatVolume(itemVolumeL(i))}</span>
            </div>
          </div>
        ))}
      </div>

      {modal && locations && <ItemForm item={modal.item} locations={locations} onClose={() => setModal(null)} />}
    </div>
  );
}
