import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatVolume, formatWeight, type Bag, type Location } from '../../../shared/edc.ts';
import { useApi, useLocations } from '../api.ts';
import { FillBar, Icon, KIND_LABEL, Stat, confirmDelete } from '../ui.tsx';
import { BagForm, LocationForm } from '../forms.tsx';
import { LocationScene } from '../three/LocationScene.tsx';

export default function OverviewPage() {
  const { data: locations, isLoading, error } = useLocations();
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [modal, setModal] = useState<null | { type: 'bag'; bag?: Bag } | { type: 'location'; location?: Location }>(null);

  const selectedId = Number(params.get('loc')) || locations?.[0]?.id;
  const loc = useMemo(() => locations?.find((l) => l.id === selectedId) ?? locations?.[0], [locations, selectedId]);
  const grandTotal = useMemo(() => (locations ?? []).reduce((s, l) => s + l.total_weight_g, 0), [locations]);

  if (isLoading) return <div className="empty">Loading…</div>;
  if (error || !locations) return <div className="empty error">Failed to load: {(error as Error)?.message}</div>;

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="tabs">
          {locations.map((l) => (
            <button key={l.id} className={`tab${l.id === loc?.id ? ' active' : ''}`} onClick={() => setParams({ loc: String(l.id) })}>
              <Icon name={l.kind} size={16} />{l.name}
              <span className="badge">{formatWeight(l.total_weight_g)}</span>
            </button>
          ))}
          <button className="tab" onClick={() => setModal({ type: 'location' })} title="Add location"><Icon name="plus" size={16} /></button>
        </div>
        <span className="muted small">Everything: <b className="mono">{formatWeight(grandTotal)}</b></span>
      </div>

      {loc && (
        <>
          <LocationScene kind={loc.kind} bags={loc.bags} onSelectBag={(id) => navigate(`/bags/${id}`)} />

          <div className="row between wrap" style={{ marginTop: 6 }}>
            <div className="row">
              <h1>{loc.name}</h1>
              <span className="badge">{KIND_LABEL[loc.kind]}</span>
              <button className="btn ghost icon sm" onClick={() => setModal({ type: 'location', location: loc })} aria-label="Edit location"><Icon name="edit" size={16} /></button>
            </div>
            <div className="stats">
              <Stat value={formatWeight(loc.total_weight_g)} label="total weight" />
              <Stat value={String(loc.bags.reduce((s, b) => s + b.stats.item_count, 0))} label="items" />
              <Stat value={formatVolume(loc.bags.reduce((s, b) => s + b.volume_l, 0))} label="capacity" />
            </div>
          </div>

          <div className="grid">
            {loc.bags.map((bag) => (
              <div key={bag.id} className="card clickable" onClick={() => navigate(`/bags/${bag.id}`)}>
                <div className="row between">
                  <div className="row wrap">
                    <span className="dot" style={{ background: bag.color }} />
                    <b>{bag.name}</b>
                    <span className="badge">{bag.kind} · {bag.slot}</span>
                  </div>
                  <div className="row" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn ghost icon sm"
                      onClick={() => setModal({ type: 'bag', bag })}
                      aria-label="Edit bag"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      className="btn ghost icon sm"
                      onClick={async () => {
                        if (confirmDelete(`bag "${bag.name}" (items become unassigned)`)) {
                          await api.deleteBag.mutateAsync([bag.id]);
                        }
                      }}
                      aria-label="Delete bag"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                <div className="stats" style={{ margin: '12px 0 10px' }}>
                  <Stat value={formatWeight(bag.stats.total_weight_g)} label={`total (${formatWeight(bag.empty_weight_g)} empty)`} />
                  <Stat value={String(bag.stats.item_count)} label="items" />
                  <Stat value={`${formatVolume(bag.stats.used_volume_l)} / ${formatVolume(bag.volume_l)}`} label={`${bag.stats.fill_pct}% full`} />
                </div>
                <FillBar pct={bag.stats.fill_pct} />
              </div>
            ))}
            <button className="card clickable row" style={{ justifyContent: 'center', minHeight: 120, color: 'var(--muted)' }} onClick={() => setModal({ type: 'bag' })}>
              <Icon name="plus" /> Add bag to {loc.name}
            </button>
          </div>
        </>
      )}

      {modal?.type === 'bag' && <BagForm bag={modal.bag} locations={locations} defaultLocationId={loc?.id} onClose={() => setModal(null)} />}
      {modal?.type === 'location' && <LocationForm location={modal.location} onClose={() => setModal(null)} />}
    </div>
  );
}
