// Small presentational building blocks shared by all pages.
import { useEffect, type ReactNode } from 'react';
import type { Item, LocationKind } from '../../shared/edc.ts';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <b className="mono">{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** Fill bar that turns amber above 85% and red when over capacity. */
export function FillBar({ pct }: { pct: number }) {
  const cls = pct > 100 ? 'over' : pct > 85 ? 'warn' : '';
  return <div className="bar"><i className={cls} style={{ width: `${Math.min(100, pct)}%` }} /></div>;
}

const ICONS: Record<string, ReactNode> = {
  x: <path d="M18 6 6 18M6 6l12 12" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  trash: <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />,
  back: <path d="m15 18-6-6 6-6" />,
  person: <><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" /></>,
  car: <><path d="M5 17h14M3 12l2-5h14l2 5v5H3z" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /></>,
  rv: <><path d="M2 16V7h13l5 4h2v5H2z" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M5 10h5" /></>,
  house: <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>,
  bag: <><path d="M6 8h12l1 12H5z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  items: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

export const KIND_LABEL: Record<LocationKind, string> = { person: 'On me', car: 'Car', rv: 'RV', house: 'House' };

export function confirmDelete(what: string): boolean {
  return window.confirm(`Delete ${what}? This cannot be undone.`);
}

export const num = (v: string, fallback = 0): number => {
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Cheap 2D glyph of an item (shape + color) for lists. A WebGL canvas per row would exhaust the
 * browser's WebGL context limit (~16), so lists use CSS and only forms/scenes render real 3D.
 */
export function ItemGlyph({ item }: { item: Pick<Item, 'shape' | 'color' | 'length_cm' | 'width_cm'> }) {
  const ratio = Math.max(0.35, Math.min(1, item.width_cm / Math.max(item.length_cm, 0.1)));
  const radius = item.shape === 'sphere' ? '50%' : item.shape === 'cylinder' ? '999px' : item.shape === 'wire' ? '50% 20% 50% 20%' : item.shape === 'flat' ? '3px' : '6px';
  return (
    <div className="item-thumb row" style={{ justifyContent: 'center' }}>
      <div style={{ width: 24, height: Math.max(8, 24 * ratio), borderRadius: radius, background: item.color, boxShadow: 'inset -3px -3px 6px rgba(0,0,0,0.35), inset 2px 2px 4px rgba(255,255,255,0.25)' }} />
    </div>
  );
}
