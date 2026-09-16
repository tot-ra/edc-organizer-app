// Bag interior: a translucent bag shell sized from its volume, section regions by placement,
// and items packed in rows and layers from the bottom up. Units are decimeters (1 unit = 10 cm),
// which makes liters map directly onto cubic units.
import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { BagDetail, BagKind, Item, SectionPlacement, SectionWithItems } from '../../../shared/edc.ts';
import { formatWeight } from '../../../shared/edc.ts';
import { BoxEdges, type Vec3 } from './models.tsx';
import { ItemMesh } from './ItemMesh.tsx';

const RATIO: Record<BagKind, Vec3> = {
  backpack: [1.3, 2, 0.7], pouch: [1.4, 1, 0.5], case: [1.6, 1.1, 0.5],
  box: [1.4, 1, 1], drawer: [1.6, 0.45, 1.2], bag: [1.5, 1, 0.8],
};

export function bagDims(kind: BagKind, volumeL: number): Vec3 {
  const r = RATIO[kind] ?? RATIO.bag;
  const s = Math.cbrt(Math.max(volumeL, 0.1) / (r[0] * r[1] * r[2]));
  return [r[0] * s, r[1] * s, r[2] * s];
}

interface Region { center: Vec3; size: Vec3 }

/** Sub-box of the bag for a section placement. Sections sharing a placement split it along x. */
function regionFor(placement: SectionPlacement, dims: Vec3, index: number, count: number, used: Set<SectionPlacement>): Region {
  const [W, H, D] = dims;
  const t = 0.22;
  const has = (p: SectionPlacement) => (used.has(p) ? t : 0.03);
  let r: Region;
  switch (placement) {
    case 'front': r = { center: [0, 0, D / 2 - (D * t) / 2], size: [W, H, D * t] }; break;
    case 'back': r = { center: [0, 0, -D / 2 + (D * t) / 2], size: [W, H, D * t] }; break;
    case 'left': r = { center: [-W / 2 + (W * t) / 2, 0, 0], size: [W * t, H, D] }; break;
    case 'right': r = { center: [W / 2 - (W * t) / 2, 0, 0], size: [W * t, H, D] }; break;
    case 'top': r = { center: [0, H / 2 - (H * t) / 2, 0], size: [W, H * t, D] }; break;
    case 'bottom': r = { center: [0, -H / 2 + (H * t) / 2, 0], size: [W, H * t, D] }; break;
    case 'inner': r = { center: [0, 0, 0], size: [W * 0.5, H * 0.5, D * 0.5] }; break;
    default: {
      const l = has('left'), rt = has('right'), tp = has('top'), bt = has('bottom'), fr = has('front'), bk = has('back');
      r = {
        center: [(W * (l - rt)) / 2, (H * (bt - tp)) / 2, (D * (bk - fr)) / 2],
        size: [W * (1 - l - rt), H * (1 - tp - bt), D * (1 - fr - bk)],
      };
    }
  }
  if (count > 1) {
    const w = r.size[0] / count;
    r = { center: [r.center[0] - r.size[0] / 2 + w * (index + 0.5), r.center[1], r.center[2]], size: [w, r.size[1], r.size[2]] };
  }
  return r;
}

interface PackedItem { item: Item; position: Vec3; size: Vec3; bounds: Vec3 }
type PlacementUpdate = Pick<Item, 'position_x_cm' | 'position_y_cm' | 'position_z_cm' | 'rotation_x_deg' | 'rotation_y_deg' | 'rotation_z_deg'>;

const radians = (degrees: number) => THREE.MathUtils.degToRad(degrees);
const roundMm = (centimeters: number) => Math.round(centimeters * 10) / 10;
const hasManualPosition = (item: Item) => item.position_x_cm != null && item.position_y_cm != null && item.position_z_cm != null;

/** Item geometry uses a stable laid-flat orientation before user rotations are applied. */
function baseSize(item: Item): Vec3 {
  const d = [item.length_cm, item.width_cm, item.height_cm].map((value) => value / 10).sort((a, b) => b - a);
  return [d[0], d[2], d[1]];
}

/** Axis-aligned bounds of a box after arbitrary Euler rotation. */
function rotatedBounds(size: Vec3, item: Item): Vec3 {
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    radians(item.rotation_x_deg), radians(item.rotation_y_deg), radians(item.rotation_z_deg), 'XYZ',
  ));
  const e = matrix.elements;
  return [
    Math.abs(e[0]) * size[0] + Math.abs(e[4]) * size[1] + Math.abs(e[8]) * size[2],
    Math.abs(e[1]) * size[0] + Math.abs(e[5]) * size[1] + Math.abs(e[9]) * size[2],
    Math.abs(e[2]) * size[0] + Math.abs(e[6]) * size[1] + Math.abs(e[10]) * size[2],
  ];
}

function clampPosition(position: Vec3, bounds: Vec3, region: Region): Vec3 {
  const half = bounds.map((value) => value / 2) as Vec3;
  return position.map((value, axis) => {
    const min = region.center[axis] - region.size[axis] / 2 + half[axis];
    const max = region.center[axis] + region.size[axis] / 2 - half[axis];
    return min > max ? region.center[axis] : THREE.MathUtils.clamp(value, min, max);
  }) as Vec3;
}

/**
 * Shelf-pack automatic items across x, then z, then start a new vertical layer. This is deliberately
 * deterministic and bottom-up. If a section is overstuffed, binary-search one uniform visual scale.
 */
export function packItems(items: Item[], region: Region): PackedItem[] {
  const gap = Math.min(...region.size) * 0.025;
  const automatic = items.filter((item) => !hasManualPosition(item)).map((item) => {
    const size = baseSize(item);
    return { item, size, bounds: rotatedBounds(size, item) };
  }).sort((a, b) => b.bounds[0] * b.bounds[2] - a.bounds[0] * a.bounds[2]);

  const attempt = (scale: number): PackedItem[] | null => {
    const [RW, RH, RD] = region.size;
    const minX = region.center[0] - RW / 2 + gap;
    const minY = region.center[1] - RH / 2 + gap;
    const minZ = region.center[2] - RD / 2 + gap;
    const maxX = region.center[0] + RW / 2 - gap;
    const maxY = region.center[1] + RH / 2 - gap;
    const maxZ = region.center[2] + RD / 2 - gap;
    let x = minX, y = minY, z = minZ, rowDepth = 0, layerHeight = 0;
    const result: PackedItem[] = [];
    for (const entry of automatic) {
      const size = entry.size.map((value) => value * scale) as Vec3;
      const bounds = entry.bounds.map((value) => value * scale) as Vec3;
      if (x + bounds[0] > maxX && x > minX) {
        x = minX; z += rowDepth + gap; rowDepth = 0;
      }
      if (z + bounds[2] > maxZ && z > minZ) {
        x = minX; z = minZ; y += layerHeight + gap; rowDepth = 0; layerHeight = 0;
      }
      if (x + bounds[0] > maxX || z + bounds[2] > maxZ || y + bounds[1] > maxY) return null;
      result.push({ entry: undefined, item: entry.item, size, bounds, position: [x + bounds[0] / 2, y + bounds[1] / 2, z + bounds[2] / 2] } as PackedItem & { entry?: never });
      x += bounds[0] + gap;
      rowDepth = Math.max(rowDepth, bounds[2]);
      layerHeight = Math.max(layerHeight, bounds[1]);
    }
    return result;
  };

  let packed = attempt(1);
  if (!packed && automatic.length) {
    let low = 0.02, high = 1;
    for (let i = 0; i < 18; i += 1) {
      const mid = (low + high) / 2;
      if (attempt(mid)) low = mid; else high = mid;
    }
    packed = attempt(low);
  }

  const manual = items.filter(hasManualPosition).map((item): PackedItem => {
    const size = baseSize(item);
    const bounds = rotatedBounds(size, item);
    const desired: Vec3 = [
      region.center[0] + item.position_x_cm! / 10,
      region.center[1] + item.position_y_cm! / 10,
      region.center[2] + item.position_z_cm! / 10,
    ];
    return { item, size, bounds, position: clampPosition(desired, bounds, region) };
  });
  return [...(packed ?? []), ...manual];
}

interface Selection { item: Item; position: Vec3; size: Vec3; bounds: Vec3; region: Region }

function SectionRegion({ section, region, hovered, selectedId, bagOffsetY, onHover, onSelect, onDragging, onCommit }: {
  section: SectionWithItems; region: Region; hovered: number | null; selectedId: number | null; bagOffsetY: number;
  onHover: (id: number | null) => void; onSelect: (selection: Selection) => void; onDragging: (dragging: boolean) => void;
  onCommit: (item: Item, update: PlacementUpdate) => void;
}) {
  const packed = useMemo(() => packItems(section.items, region), [section.items, region]);
  const [active, setActive] = useState(false);
  const drag = useRef<null | { pointerId: number; item: PackedItem; offset: THREE.Vector3; position: Vec3 }>(null);
  const [, render] = useState(0);

  const startDrag = (event: ThreeEvent<PointerEvent>, packedItem: PackedItem) => {
    const planeY = bagOffsetY + packedItem.position[1];
    const hit = new THREE.Vector3();
    if (!event.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), hit)) return;
    (event.nativeEvent.target as Element | null)?.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, item: packedItem, offset: hit.sub(new THREE.Vector3(packedItem.position[0], planeY, packedItem.position[2])), position: [...packedItem.position] };
    onSelect({ ...packedItem, region });
    onDragging(true);
    document.body.style.cursor = 'grabbing';
  };

  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const planeY = bagOffsetY + current.item.position[1];
    const hit = new THREE.Vector3();
    if (!event.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), hit)) return;
    const desired: Vec3 = [hit.x - current.offset.x, current.item.position[1], hit.z - current.offset.z];
    current.position = clampPosition(desired, current.item.bounds, region);
    render((value) => value + 1);
  };

  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    (event.nativeEvent.target as Element | null)?.releasePointerCapture(event.pointerId);
    drag.current = null;
    onDragging(false);
    document.body.style.cursor = '';
    const position = current.position;
    onSelect({ ...current.item, position, region });
    onCommit(current.item.item, {
      position_x_cm: roundMm((position[0] - region.center[0]) * 10),
      position_y_cm: roundMm((position[1] - region.center[1]) * 10),
      position_z_cm: roundMm((position[2] - region.center[2]) * 10),
      rotation_x_deg: current.item.item.rotation_x_deg,
      rotation_y_deg: current.item.item.rotation_y_deg,
      rotation_z_deg: current.item.item.rotation_z_deg,
    });
  };

  return (
    <group>
      <mesh position={region.center} onPointerOver={(e) => { e.stopPropagation(); setActive(true); }} onPointerOut={() => setActive(false)}>
        <boxGeometry args={region.size} />
        <meshStandardMaterial color="#7c8cff" transparent opacity={active ? 0.14 : 0.05} depthWrite={false} />
      </mesh>
      <BoxEdges position={region.center} size={region.size} color="#7c8cff" opacity={active ? 0.8 : 0.35} />
      {active && (
        <Html position={[region.center[0], region.center[1] + region.size[1] / 2, region.center[2] + region.size[2] / 2]} zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
          <div className="scene-label"><b>{section.name}</b><span className="muted">{section.items.length} · {formatWeight(section.weight_g)}</span></div>
        </Html>
      )}
      {packed.map((packedItem) => {
        const { item, size, bounds } = packedItem;
        const position = drag.current?.item.item.id === item.id ? drag.current.position : packedItem.position;
        return (
          <group key={item.id} position={position} rotation={[radians(item.rotation_x_deg), radians(item.rotation_y_deg), radians(item.rotation_z_deg)]}>
            <ItemMesh
              shape={item.shape} size={size} color={item.color} highlight={hovered === item.id || selectedId === item.id}
              onClick={() => onSelect({ ...packedItem, position, region })}
              onPointerDown={(event) => startDrag(event as ThreeEvent<PointerEvent>, { ...packedItem, position })}
              onPointerMove={(event) => moveDrag(event as ThreeEvent<PointerEvent>)}
              onPointerUp={(event) => endDrag(event as ThreeEvent<PointerEvent>)}
              onPointerOver={() => { onHover(item.id); document.body.style.cursor = 'grab'; }}
              onPointerOut={() => { onHover(null); if (!drag.current) document.body.style.cursor = ''; }}
            />
            {hovered === item.id && (
              <Html position={[0, bounds[1] / 2, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <div className="scene-label"><b>{item.name}</b><span className="muted">{formatWeight(item.weight_g)}</span></div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function BagScene({ bag, onEditItem, onUpdateItem }: {
  bag: BagDetail;
  onEditItem: (id: number) => void;
  onUpdateItem: (id: number, update: Partial<Item>) => Promise<unknown>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, Partial<Item>>>({});
  const dims = useMemo(() => bagDims(bag.kind, bag.volume_l), [bag.kind, bag.volume_l]);
  const effectiveSections = useMemo(() => bag.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item, ...overrides[item.id] })),
  })), [bag.sections, overrides]);

  const regions = useMemo(() => {
    const byPlacement = new Map<SectionPlacement, SectionWithItems[]>();
    for (const section of effectiveSections) byPlacement.set(section.placement, [...(byPlacement.get(section.placement) ?? []), section]);
    const used = new Set(byPlacement.keys());
    return effectiveSections.map((section) => {
      const group = byPlacement.get(section.placement)!;
      return { section, region: regionFor(section.placement, dims, group.indexOf(section), group.length, used) };
    });
  }, [effectiveSections, dims]);

  const commit = (item: Item, update: PlacementUpdate) => {
    setOverrides((current) => ({ ...current, [item.id]: { ...current[item.id], ...update } }));
    void onUpdateItem(item.id, update);
  };

  const rotate = (axis: 'x' | 'y' | 'z') => {
    if (!selected) return;
    const item = { ...selected.item, ...overrides[selected.item.id] };
    const key = `rotation_${axis}_deg` as const;
    const rotated = { ...item, [key]: ((item[key] ?? 0) + 90) % 360 };
    const bounds = rotatedBounds(selected.size, rotated);
    const position = clampPosition(selected.position, bounds, selected.region);
    const update: PlacementUpdate = {
      position_x_cm: roundMm((position[0] - selected.region.center[0]) * 10),
      position_y_cm: roundMm((position[1] - selected.region.center[1]) * 10),
      position_z_cm: roundMm((position[2] - selected.region.center[2]) * 10),
      rotation_x_deg: rotated.rotation_x_deg,
      rotation_y_deg: rotated.rotation_y_deg,
      rotation_z_deg: rotated.rotation_z_deg,
    };
    setSelected({ ...selected, item: rotated, position, bounds });
    commit(item, update);
  };

  const resetAutomatic = () => {
    if (!selected) return;
    const update: PlacementUpdate = {
      position_x_cm: null, position_y_cm: null, position_z_cm: null,
      rotation_x_deg: 0, rotation_y_deg: 0, rotation_z_deg: 0,
    };
    commit(selected.item, update);
    setSelected(null);
  };

  const [W, H, D] = dims;
  const dist = Math.max(W, H, D) * 2.4;
  return (
    <div className="scene">
      <Canvas key={bag.id} shadows camera={{ position: [dist * 0.7, dist * 0.55, dist * 0.8], fov: 38 }} dpr={[1, 2]}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 5]} intensity={1.3} castShadow />
        <directionalLight position={[-4, 3, -4]} intensity={0.35} />
        <Suspense fallback={null}>
          <group position={[0, H / 2, 0]}>
            <mesh><boxGeometry args={dims} /><meshStandardMaterial color={bag.color} transparent opacity={0.12} depthWrite={false} roughness={0.7} /></mesh>
            <BoxEdges position={[0, 0, 0]} size={dims} color={bag.color} opacity={0.8} />
            {regions.map(({ section, region }) => (
              <SectionRegion
                key={section.id} section={section} region={region} hovered={hovered} selectedId={selected?.item.id ?? null} bagOffsetY={H / 2}
                onHover={setHovered} onSelect={setSelected} onDragging={setDragging} onCommit={commit}
              />
            ))}
          </group>
          <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={dist} blur={2} far={H} />
        </Suspense>
        <gridHelper args={[dist, 10, '#2a3040', '#1d2230']} />
        <OrbitControls target={[0, H / 2, 0]} enabled={!dragging} enablePan={false} minDistance={dist * 0.4} maxDistance={dist * 3} makeDefault />
      </Canvas>
      {selected && (
        <div className="scene-controls" role="toolbar" aria-label={`Transform ${selected.item.name}`}>
          <b>{selected.item.name}</b>
          <button className="btn sm" onClick={() => rotate('x')} title="Rotate 90° around X">X +90°</button>
          <button className="btn sm" onClick={() => rotate('y')} title="Rotate 90° around Y">Y +90°</button>
          <button className="btn sm" onClick={() => rotate('z')} title="Rotate 90° around Z">Z +90°</button>
          <button className="btn sm" onClick={resetAutomatic}>Auto</button>
          <button className="btn sm" onClick={() => onEditItem(selected.item.id)}>Edit</button>
        </div>
      )}
      <div className="scene-hint">{W.toFixed(1)} × {H.toFixed(1)} × {D.toFixed(1)} dm · drag an item to move · select for rotation</div>
    </div>
  );
}
