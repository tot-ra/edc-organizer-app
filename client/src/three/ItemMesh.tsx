// Procedural 3D prototype of an item, generated on the fly from its dimensions and shape.
// Dimensions are given in the unit of the parent scene (the caller scales cm into scene units).
import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { ItemShape } from '../../../shared/edc.ts';

export interface ItemMeshProps {
  shape: ItemShape;
  size: [number, number, number]; // [length(x), height(y), width(z)] in scene units
  color: string;
  highlight?: boolean;
  onClick?: () => void;
  onPointerDown?: (event: unknown) => void;
  onPointerMove?: (event: unknown) => void;
  onPointerUp?: (event: unknown) => void;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
}

type WireEvents = {
  onClick?: (event: { stopPropagation: () => void }) => void;
  onPointerDown?: (event: { stopPropagation: () => void }) => void;
  onPointerMove?: (event: { stopPropagation: () => void }) => void;
  onPointerUp?: (event: { stopPropagation: () => void }) => void;
  onPointerOver?: (event: { stopPropagation: () => void }) => void;
  onPointerOut?: () => void;
};

function WireMesh({ size, color, highlight, ...handlers }: { size: [number, number, number]; color: string; highlight?: boolean } & WireEvents) {
  const [l, h, w] = size;
  const geometry = useMemo(() => {
    // A relaxed S-curve reads as a flexible cable while remaining inside its storage envelope.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-l * 0.45, 0, -w * 0.25),
      new THREE.Vector3(-l * 0.2, h * 0.08, w * 0.28),
      new THREE.Vector3(l * 0.15, -h * 0.08, -w * 0.28),
      new THREE.Vector3(l * 0.45, 0, w * 0.25),
    ]);
    return new THREE.TubeGeometry(curve, 40, Math.max(0.008, Math.min(h, w) * 0.12), 8, false);
  }, [l, h, w]);
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.65}
      metalness={0.05}
      emissive={highlight ? '#7c8cff' : '#000000'}
      emissiveIntensity={highlight ? 0.5 : 0}
    />
  );
  const connector: [number, number, number] = [Math.max(l * 0.1, 0.04), Math.max(h * 0.5, 0.03), Math.max(w * 0.28, 0.03)];
  return (
    <group {...handlers}>
      <mesh geometry={geometry} castShadow>{material}</mesh>
      <mesh position={[-l * 0.47, 0, -w * 0.27]} castShadow>
        <boxGeometry args={connector} />{material}
      </mesh>
      <mesh position={[l * 0.47, 0, w * 0.27]} castShadow>
        <cylinderGeometry args={[connector[1] * 0.45, connector[1] * 0.45, connector[0], 12]} />
        {material}
      </mesh>
    </group>
  );
}

export function ItemMesh({ shape, size, color, highlight, onClick, onPointerDown, onPointerMove, onPointerUp, onPointerOver, onPointerOut }: ItemMeshProps) {
  const [l, h, w] = size;
  const material = (
    <meshStandardMaterial
      color={color}
      roughness={0.55}
      metalness={0.15}
      emissive={highlight ? '#7c8cff' : '#000000'}
      emissiveIntensity={highlight ? 0.5 : 0}
    />
  );
  const events = {
    onClick: onClick && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick(); }),
    onPointerDown: onPointerDown && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); onPointerDown(e); }),
    onPointerMove: onPointerMove && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); onPointerMove(e); }),
    onPointerUp: onPointerUp && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); onPointerUp(e); }),
    onPointerOver: onPointerOver && ((e: { stopPropagation: () => void }) => { e.stopPropagation(); onPointerOver(); }),
    onPointerOut,
  };

  switch (shape) {
    case 'wire':
      return <WireMesh size={size} color={color} highlight={highlight} {...events} />;
    case 'cylinder':
      // Cylinder lies along its length (x axis); radius from the smaller of width/height.
      return (
        <mesh rotation={[0, 0, Math.PI / 2]} castShadow {...events}>
          <cylinderGeometry args={[Math.min(w, h) / 2, Math.min(w, h) / 2, l, 24]} />
          {material}
        </mesh>
      );
    case 'sphere':
      return (
        <mesh scale={[l, h, w]} castShadow {...events}>
          <sphereGeometry args={[0.5, 24, 18]} />
          {material}
        </mesh>
      );
    case 'flat':
      return (
        <mesh castShadow {...events}>
          <boxGeometry args={[l, h, w]} />
          {material}
        </mesh>
      );
    default:
      return (
        <RoundedBox args={[l, h, w]} radius={Math.min(l, h, w) * 0.18} smoothness={3} castShadow {...events}>
          {material}
        </RoundedBox>
      );
  }
}
