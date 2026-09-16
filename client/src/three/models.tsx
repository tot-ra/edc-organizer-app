// Procedural "hosts" (person, car, RV, house) plus named bag-anchor slots. Units are meters.
// No external assets: the app stays fully offline and loads instantly on mobile.
import { useMemo } from 'react';
import * as THREE from 'three';
import type { LocationKind } from '../../../shared/edc.ts';
import { Person } from './Person.tsx';

export { Person };

export type Vec3 = [number, number, number];

export const SLOT_POSITIONS: Record<LocationKind, Record<string, Vec3>> = {
  person: {
    chest: [0, 1.28, 0.2],
    'belt-left': [-0.26, 0.98, 0.06],
    'belt-right': [0.26, 0.98, 0.06],
    back: [0, 1.22, -0.28],
    'pocket-left': [-0.15, 0.78, 0.13],
    'pocket-right': [0.15, 0.78, 0.13],
    hand: [0.42, 0.72, 0.12],
    default: [0.5, 0.4, 0.4],
  },
  car: {
    trunk: [-1.55, 0.72, 0],
    glovebox: [0.75, 0.82, 0.45],
    'door-left': [0.2, 0.62, 0.95],
    'door-right': [0.2, 0.62, -0.95],
    'seat-back': [-0.35, 0.9, 0],
    'under-seat': [0.15, 0.42, 0.4],
    default: [-0.5, 0.5, 0],
  },
  rv: {
    cabinet: [0.4, 1.95, 0.95],
    'under-bed': [-2.1, 0.75, 0],
    bathroom: [-0.6, 1.2, -0.85],
    kitchen: [0.9, 1.1, -0.9],
    garage: [-2.7, 0.5, 0.95],
    cab: [2.5, 1.15, 0],
    default: [0, 1, 0],
  },
  house: {
    hallway: [0, 0.6, 2.0],
    closet: [-2.4, 1.6, 1.4],
    garage: [2.4, 0.5, 0.6],
    kitchen: [-2.0, 1.0, -1.6],
    bedroom: [2.1, 0.7, -1.8],
    office: [0.4, 1.0, -0.6],
    default: [0, 0.5, 0],
  },
};

export const CAMERA: Record<LocationKind, { position: Vec3; target: Vec3 }> = {
  person: { position: [1.25, 1.38, 1.75], target: [0, 1.15, 0] },
  car: { position: [4.5, 2.8, 5.5], target: [0, 0.6, 0] },
  rv: { position: [7, 4, 8], target: [0, 1.2, 0] },
  house: { position: [8, 5.5, 9], target: [0, 1.4, 0] },
};

const SHELL = '#6f7a90';
const GLASS = '#9fc4ff';

/** Translucent "x-ray" material so bags placed inside a vehicle or building stay visible. */
function Shell({ color = SHELL, opacity = 0.28 }: { color?: string; opacity?: number }) {
  return <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.6} metalness={0.1} depthWrite={false} />;
}

/** Outline of a box; geometry is memoized because EdgesGeometry is comparatively expensive to build. */
export function BoxEdges({ position, size, color = '#aab4cc', opacity = 0.5 }: { position: Vec3; size: Vec3; color?: string; opacity?: number }) {
  const geom = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size[0], size[1], size[2]]);
  return (
    <lineSegments position={position} geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

function Wheel({ position, r = 0.32 }: { position: Vec3; r?: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[r, r, 0.22, 20]} />
      <meshStandardMaterial color="#1b1d24" roughness={0.9} />
    </mesh>
  );
}

export function Car() {
  return (
    <group>
      {/* lower body */}
      <mesh position={[0, 0.55, 0]}><boxGeometry args={[4.2, 0.5, 1.8]} /><Shell /></mesh>
      {/* cabin */}
      <mesh position={[-0.2, 1.05, 0]}><boxGeometry args={[2.2, 0.55, 1.6]} /><Shell color={GLASS} opacity={0.2} /></mesh>
      {/* floor plate gives a sense of the interior */}
      <mesh position={[0, 0.32, 0]} receiveShadow><boxGeometry args={[4.0, 0.04, 1.7]} /><meshStandardMaterial color="#2c3140" /></mesh>
      {/* seats */}
      {[[0.35, 0.45], [0.35, -0.45], [-0.55, 0]].map(([x, z], i) => (
        <group key={i} position={[x, 0.5, z]}>
          <mesh position={[0, 0.12, 0]}><boxGeometry args={[0.5, 0.12, i === 2 ? 1.3 : 0.5]} /><meshStandardMaterial color="#3c4354" /></mesh>
          <mesh position={[-0.22, 0.4, 0]}><boxGeometry args={[0.08, 0.5, i === 2 ? 1.3 : 0.5]} /><meshStandardMaterial color="#3c4354" /></mesh>
        </group>
      ))}
      <Wheel position={[1.35, 0.32, 0.9]} /><Wheel position={[1.35, 0.32, -0.9]} />
      <Wheel position={[-1.35, 0.32, 0.9]} /><Wheel position={[-1.35, 0.32, -0.9]} />
      <BoxEdges position={[0, 0.55, 0]} size={[4.2, 0.5, 1.8]} />
    </group>
  );
}

export function Rv() {
  return (
    <group>
      <mesh position={[-0.6, 1.55, 0]}><boxGeometry args={[5.0, 2.3, 2.4]} /><Shell /></mesh>
      <BoxEdges position={[-0.6, 1.55, 0]} size={[5.0, 2.3, 2.4]} />
      {/* cab */}
      <mesh position={[2.5, 0.95, 0]}><boxGeometry args={[1.4, 1.1, 2.2]} /><Shell color={GLASS} opacity={0.22} /></mesh>
      <mesh position={[-0.6, 0.42, 0]} receiveShadow><boxGeometry args={[5.0, 0.04, 2.3]} /><meshStandardMaterial color="#2c3140" /></mesh>
      {/* bed at the back, kitchen counter on the right */}
      <mesh position={[-2.1, 0.7, 0]}><boxGeometry args={[1.3, 0.5, 2.0]} /><meshStandardMaterial color="#4a5266" /></mesh>
      <mesh position={[0.9, 0.85, -0.95]}><boxGeometry args={[1.6, 0.85, 0.5]} /><meshStandardMaterial color="#4a5266" /></mesh>
      <Wheel position={[1.6, 0.42, 1.15]} r={0.42} /><Wheel position={[1.6, 0.42, -1.15]} r={0.42} />
      <Wheel position={[-1.8, 0.42, 1.15]} r={0.42} /><Wheel position={[-1.8, 0.42, -1.15]} r={0.42} />
    </group>
  );
}

export function House() {
  return (
    <group>
      <mesh position={[0, 1.5, 0]}><boxGeometry args={[6, 3, 5]} /><Shell color="#8d95a8" opacity={0.18} /></mesh>
      <BoxEdges position={[0, 1.5, 0]} size={[6, 3, 5]} />
      {/* roof: 4-sided pyramid */}
      <mesh position={[0, 3.75, 0]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[4.2, 1.5, 4]} /><Shell color="#7a4f3a" opacity={0.35} /></mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow><boxGeometry args={[6, 0.04, 5]} /><meshStandardMaterial color="#2c3140" /></mesh>
      {/* interior walls, low so bags remain visible */}
      <mesh position={[-1.2, 0.6, 0.3]}><boxGeometry args={[0.08, 1.2, 4]} /><meshStandardMaterial color="#4a5266" /></mesh>
      <mesh position={[1.6, 0.6, -1.0]}><boxGeometry args={[3, 1.2, 0.08]} /><meshStandardMaterial color="#4a5266" /></mesh>
      {/* door */}
      <mesh position={[0, 0.55, 2.52]}><boxGeometry args={[0.9, 1.1, 0.06]} /><meshStandardMaterial color="#7a4f3a" /></mesh>
    </group>
  );
}

export function HostModel({ kind }: { kind: LocationKind }) {
  switch (kind) {
    case 'person': return <Person />;
    case 'car': return <Car />;
    case 'rv': return <Rv />;
    case 'house': return <House />;
  }
}
