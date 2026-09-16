// Overview scene: the host model (person / car / RV / house) with every bag rendered at its slot.
// Bag size is derived from its volume (cube root) so a 30 L trunk box visibly dwarfs a 0.4 L pouch.
import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { BagWithStats, LocationKind } from '../../../shared/edc.ts';
import { formatWeight } from '../../../shared/edc.ts';
import { CAMERA, HostModel, SLOT_POSITIONS, type Vec3 } from './models.tsx';

/** Local studio IBL so MeshPhysicalMaterial on the person reads as skin/cloth without fetching an HDR. */
function StudioEnv({ intensity = 0.4 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

function bagSize(volumeL: number, kind: LocationKind): number {
  const edge = Math.cbrt(volumeL / 1000); // liters -> m^3 -> edge of equivalent cube
  const min = kind === 'person' ? 0.09 : 0.18; // floor so tiny pouches remain visible / tappable
  return Math.max(min, edge);
}

function BagMesh({ bag, position, size, onClick }: { bag: BagWithStats; position: Vec3; size: number; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <group position={position}>
      <RoundedBox
        args={[size * 1.1, size * 0.9, size * 0.7]}
        radius={size * 0.12}
        smoothness={3}
        castShadow
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}
      >
        <meshStandardMaterial color={bag.color} roughness={0.5} emissive={hover ? bag.color : '#000'} emissiveIntensity={hover ? 0.35 : 0} />
      </RoundedBox>
      <Html position={[0, size * 0.55, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="scene-label">
          <b>{bag.name}</b>
          <span className="muted">{formatWeight(bag.stats.total_weight_g)} · {bag.stats.fill_pct}%</span>
        </div>
      </Html>
    </group>
  );
}

export function LocationScene({ kind, bags, onSelectBag }: { kind: LocationKind; bags: BagWithStats[]; onSelectBag: (id: number) => void }) {
  // Bags sharing a slot are stacked upward so none of them is hidden.
  const placed = useMemo(() => {
    const perSlot = new Map<string, number>();
    return bags.map((bag) => {
      const slots = SLOT_POSITIONS[kind];
      const base = slots[bag.slot] ?? slots.default;
      const n = perSlot.get(bag.slot) ?? 0;
      perSlot.set(bag.slot, n + 1);
      const size = bagSize(bag.volume_l, kind);
      const position: Vec3 = [base[0], base[1] + n * size * 1.0, base[2]];
      return { bag, position, size };
    });
  }, [bags, kind]);

  const cam = CAMERA[kind];
  return (
    <div className="scene">
      {/* key forces a remount so the camera resets when switching locations */}
      <Canvas
        key={kind}
        shadows
        camera={{ position: cam.position, fov: 40 }}
        dpr={[1, 2]}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.08 }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFShadowMap; }}
      >
        <color attach="background" args={['#0d0f15']} />
        <hemisphereLight args={['#d7e2f5', '#1a1c24', 0.5]} />
        <ambientLight intensity={kind === 'person' ? 0.16 : 0.32} />
        <directionalLight position={[4.5, 8, 3.5]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-3.5, 3.5, -4]} intensity={0.35} color="#9eb4d4" />
        <Suspense fallback={null}>
          {kind === 'person' && <StudioEnv intensity={0.5} />}
          <HostModel kind={kind} />
          {placed.map(({ bag, position, size }) => (
            <BagMesh key={bag.id} bag={bag} position={position} size={size} onClick={() => onSelectBag(bag.id)} />
          ))}
          <ContactShadows position={[0, 0.001, 0]} opacity={0.5} scale={kind === 'person' ? 4 : 16} blur={2.2} far={4} />
        </Suspense>
        <gridHelper args={[kind === 'person' ? 4 : 16, kind === 'person' ? 8 : 16, '#2a3040', '#1d2230']} position={[0, 0, 0]} />
        <OrbitControls target={cam.target} enablePan={false} minDistance={1} maxDistance={30} maxPolarAngle={Math.PI / 2.05} makeDefault />
      </Canvas>
      <div className="scene-hint">drag to rotate · pinch/scroll to zoom · tap a bag to open</div>
    </div>
  );
}
