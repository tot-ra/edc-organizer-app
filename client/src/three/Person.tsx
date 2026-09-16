// Higher-detail procedural person. Still generated at runtime (no GLTF) so the app stays
// offline, but reads as a human host for EDC bags instead of a capsule mannequin.
import { useEffect, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { Vec3 } from './models.tsx';

const Y_UP = new THREE.Vector3(0, 1, 0);

function hash2(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v00 = hash2(x0, y0);
  const v10 = hash2(x0 + 1, y0);
  const v01 = hash2(x0, y0 + 1);
  const v11 = hash2(x0 + 1, y0 + 1);
  return v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) + v01 * (1 - sx) * sy + v11 * sx * sy;
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function fbm(x: number, y: number): number {
  return valueNoise(x, y) * 0.55 + valueNoise(x * 2.1, y * 2.1) * 0.3 + valueNoise(x * 4.3, y * 4.3) * 0.15;
}

/** Skin + hairline only. Eyes/nose/mouth are 3D meshes so they stay aligned in profile. */
function drawFaceAlbedo(ctx: CanvasRenderingContext2D, size: number) {
  const skin: [number, number, number] = [226, 184, 150];
  const skinDeep: [number, number, number] = [196, 138, 110];
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = fbm(u * 8, v * 8);
      const du = u - 0.5;
      const cheek = Math.exp(-((Math.abs(du) - 0.09) ** 2) * 220) * Math.exp(-((v - 0.52) ** 2) * 70);
      const rgb = mixRgb(skin, skinDeep, n * 0.35 + cheek * 0.2);
      const i = (y * size + x) * 4;
      d[i] = rgb[0] + cheek * 22;
      d[i + 1] = rgb[1] - cheek * 6;
      d[i + 2] = rgb[2] - cheek * 4;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.fillStyle = '#2a1c14';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(size, 0);
  ctx.lineTo(size, size * 0.2);
  ctx.bezierCurveTo(size * 0.85, size * 0.3, size * 0.68, size * 0.2, size * 0.5, size * 0.22);
  ctx.bezierCurveTo(size * 0.32, size * 0.2, size * 0.15, size * 0.3, 0, size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0, size * 0.18, size * 0.14, size * 0.3);
  ctx.fillRect(size * 0.86, size * 0.18, size * 0.14, size * 0.3);
}

function canvasTexture(draw: (ctx: CanvasRenderingContext2D, size: number) => void, size: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function noiseAlbedo(rgb: [number, number, number], size = 128, scale = 6, amp = 16): THREE.CanvasTexture {
  return canvasTexture((ctx, s) => {
    const img = ctx.createImageData(s, s);
    const d = img.data;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = (fbm((x / s) * scale, (y / s) * scale) - 0.5) * amp;
        const i = (y * s + x) * 4;
        d[i] = Math.min(255, Math.max(0, rgb[0] + n));
        d[i + 1] = Math.min(255, Math.max(0, rgb[1] + n * 0.9));
        d[i + 2] = Math.min(255, Math.max(0, rgb[2] + n * 0.75));
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, size);
}

function Bone({
  a, b, radius, material,
}: { a: Vec3; b: Vec3; radius: number; material: THREE.Material }) {
  const { pos, quat, cyl } = useMemo(() => {
    const A = new THREE.Vector3(...a);
    const B = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(B, A);
    const dist = dir.length();
    const quat = new THREE.Quaternion().setFromUnitVectors(Y_UP, dir.normalize());
    const pos = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
    return { pos: pos.toArray() as Vec3, quat, cyl: Math.max(dist - radius * 0.35, 0.02) };
  }, [a[0], a[1], a[2], b[0], b[1], b[2], radius]);
  return (
    <mesh position={pos} quaternion={quat} material={material} castShadow receiveShadow>
      <capsuleGeometry args={[radius, cyl, 6, 16]} />
    </mesh>
  );
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function Joint({ p, r, material }: { p: Vec3; r: number; material: THREE.Material }) {
  return (
    <mesh position={p} material={material} castShadow>
      <sphereGeometry args={[r, 16, 12]} />
    </mesh>
  );
}

function Hand({ at, side }: { at: Vec3; side: 1 | -1 }) {
  // Palm faces slightly inward; fingers curl toward -Y so a bag at the wrist reads as "held".
  return (
    <group position={at} rotation={[0.15, side * 0.35, side * 0.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.055, 0.085, 0.024]} />
        <meshPhysicalMaterial color="#d9b08a" roughness={0.52} />
      </mesh>
      {[-0.02, -0.007, 0.007, 0.02].map((x, i) => (
        <mesh key={i} position={[x, -0.065, 0.002]} rotation={[0.35, 0, 0]} castShadow>
          <capsuleGeometry args={[0.007, 0.038 - i * 0.002, 4, 8]} />
          <meshPhysicalMaterial color="#d9b08a" roughness={0.52} />
        </mesh>
      ))}
      <mesh position={[side * 0.028, -0.01, 0.01]} rotation={[0.6, 0, -side * 0.9]} castShadow>
        <capsuleGeometry args={[0.008, 0.032, 4, 8]} />
        <meshPhysicalMaterial color="#d9b08a" roughness={0.52} />
      </mesh>
    </group>
  );
}

export function Person() {
  const maps = useMemo(() => ({
    face: canvasTexture(drawFaceAlbedo, 512),
    skin: noiseAlbedo([218, 168, 132], 128, 5, 14),
    shirt: noiseAlbedo([58, 68, 86], 128, 4, 8),
    pants: noiseAlbedo([36, 40, 50], 128, 4, 7),
  }), []);

  const mats = useMemo(() => ({
    face: new THREE.MeshPhysicalMaterial({
      map: maps.face,
      roughness: 0.48,
      metalness: 0,
      sheen: 0.4,
      sheenColor: new THREE.Color('#c47a6a'),
      sheenRoughness: 0.55,
      clearcoat: 0.08,
      clearcoatRoughness: 0.6,
    }),
    skin: new THREE.MeshPhysicalMaterial({
      map: maps.skin,
      roughness: 0.5,
      metalness: 0,
      sheen: 0.32,
      sheenColor: new THREE.Color('#c47a6a'),
      sheenRoughness: 0.6,
    }),
    shirt: new THREE.MeshPhysicalMaterial({
      map: maps.shirt,
      roughness: 0.82,
      metalness: 0,
      sheen: 0.18,
      sheenColor: new THREE.Color('#8a93a6'),
      sheenRoughness: 0.85,
    }),
    pants: new THREE.MeshPhysicalMaterial({
      map: maps.pants,
      roughness: 0.88,
      metalness: 0,
      sheen: 0.08,
    }),
    hair: new THREE.MeshPhysicalMaterial({
      color: '#241910',
      roughness: 0.72,
      sheen: 0.25,
      sheenColor: new THREE.Color('#5a4030'),
    }),
    belt: new THREE.MeshStandardMaterial({ color: '#1c1814', roughness: 0.7 }),
    buckle: new THREE.MeshStandardMaterial({ color: '#c5b48a', metalness: 0.7, roughness: 0.35 }),
    shoe: new THREE.MeshStandardMaterial({ color: '#1a1c22', roughness: 0.55 }),
    sole: new THREE.MeshStandardMaterial({ color: '#6a5344', roughness: 0.8 }),
    watch: new THREE.MeshStandardMaterial({ color: '#1a1c20', roughness: 0.45, metalness: 0.4 }),
    watchFace: new THREE.MeshStandardMaterial({ color: '#d5d8e0', metalness: 0.75, roughness: 0.22 }),
  }), [maps]);

  useEffect(() => () => {
    for (const m of Object.values(mats)) m.dispose();
    for (const t of Object.values(maps)) t.dispose();
  }, [mats, maps]);

  const headGeom = useMemo(() => new THREE.SphereGeometry(0.105, 48, 32), []);

  const shirtGeom = useMemo(() => {
    // Hem at world y=0.90, neck hole at y=1.42 so the collar does not swallow the head.
    const pts = [
      new THREE.Vector2(0.16, 0.00),
      new THREE.Vector2(0.175, 0.04),
      new THREE.Vector2(0.158, 0.14),
      new THREE.Vector2(0.168, 0.26),
      new THREE.Vector2(0.198, 0.38),
      new THREE.Vector2(0.188, 0.46),
      new THREE.Vector2(0.125, 0.51),
      new THREE.Vector2(0.068, 0.54),
    ];
    const g = new THREE.LatheGeometry(pts, 32);
    g.computeVertexNormals();
    return g;
  }, []);

  const hipsGeom = useMemo(() => {
    const pts = [
      new THREE.Vector2(0.145, 0.00),
      new THREE.Vector2(0.185, 0.05),
      new THREE.Vector2(0.195, 0.12),
      new THREE.Vector2(0.175, 0.20),
    ];
    const g = new THREE.LatheGeometry(pts, 28);
    g.computeVertexNormals();
    return g;
  }, []);

  useEffect(() => () => {
    headGeom.dispose();
    shirtGeom.dispose();
    hipsGeom.dispose();
  }, [headGeom, shirtGeom, hipsGeom]);

  // Joints chosen so bags at SLOT_POSITIONS.person sit on the surface, not inside the mesh.
  const L = -1 as const;
  const R = 1 as const;
  const sh = (s: 1 | -1): Vec3 => [s * 0.205, 1.385, 0.01];
  const elbow = (s: 1 | -1): Vec3 => s === 1 ? [0.33, 1.08, 0.07] : [-0.245, 1.10, 0.03];
  const wrist = (s: 1 | -1): Vec3 => s === 1 ? [0.40, 0.80, 0.11] : [-0.265, 0.82, 0.05];
  const hip = (s: 1 | -1): Vec3 => [s * 0.09, 0.90, 0];
  const knee = (s: 1 | -1): Vec3 => [s * 0.095, 0.50, 0.025];
  const ankle = (s: 1 | -1): Vec3 => [s * 0.09, 0.09, 0.01];

  return (
    <group>
      {/* Head */}
      <group position={[0, 1.605, 0.02]}>
        {/* Sphere UV center is on -Z; yaw 180 so the painted face looks toward the camera / bags. */}
        <mesh geometry={headGeom} rotation={[0, Math.PI, 0]} material={mats.face} scale={[1.02, 1.22, 1.0]} castShadow receiveShadow />
        <mesh position={[0, -0.082, 0.028]} scale={[0.62, 0.42, 0.55]} material={mats.skin} castShadow>
          <sphereGeometry args={[0.09, 24, 16]} />
        </mesh>
        {([L, R] as const).map((s) => (
          <mesh key={`ear-${s}`} position={[s * 0.105, -0.01, -0.005]} rotation={[0.15, s * 0.25, s * 0.15]} scale={[0.38, 0.72, 0.52]} material={mats.skin} castShadow>
            <sphereGeometry args={[0.045, 12, 10]} />
          </mesh>
        ))}
        {([L, R] as const).map((s) => (
          <group key={`eye-${s}`} position={[s * 0.026, 0.012, 0.086]}>
            <mesh castShadow>
              <sphereGeometry args={[0.011, 12, 10]} />
              <meshStandardMaterial color="#f3efe6" roughness={0.35} />
            </mesh>
            <mesh position={[0, 0, 0.0065]}>
              <sphereGeometry args={[0.0062, 10, 8]} />
              <meshStandardMaterial color="#4e6750" roughness={0.4} />
            </mesh>
            <mesh position={[0, 0, 0.01]}>
              <sphereGeometry args={[0.0032, 8, 6]} />
              <meshStandardMaterial color="#1a140f" />
            </mesh>
            <mesh position={[s * 0.001, 0.016, 0.002]} rotation={[0, 0, s * -0.12]}>
              <boxGeometry args={[0.022, 0.004, 0.007]} />
              <meshStandardMaterial color="#3a2a20" />
            </mesh>
          </group>
        ))}
        <mesh position={[0, -0.01, 0.102]} rotation={[0.45, 0, 0]} material={mats.skin} castShadow>
          <coneGeometry args={[0.013, 0.038, 8]} />
        </mesh>
        <mesh position={[0, -0.028, 0.112]} material={mats.skin} castShadow>
          <sphereGeometry args={[0.012, 10, 8]} />
        </mesh>
        <mesh position={[0, -0.052, 0.09]} rotation={[0.25, 0, 0]} scale={[1, 0.45, 1]}>
          <torusGeometry args={[0.015, 0.0035, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#a05c58" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.05, -0.012]} scale={[1.16, 0.56, 1.06]} material={mats.hair} castShadow>
          <sphereGeometry args={[0.112, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        </mesh>
        <mesh position={[0, 0.015, -0.048]} scale={[1.02, 0.78, 0.7]} material={mats.hair} castShadow>
          <sphereGeometry args={[0.1, 20, 14]} />
        </mesh>
        {([L, R] as const).map((s) => (
          <mesh key={`sideburn-${s}`} position={[s * 0.088, 0.0, -0.005]} scale={[0.32, 0.72, 0.5]} material={mats.hair} castShadow>
            <sphereGeometry args={[0.07, 12, 10]} />
          </mesh>
        ))}
      </group>

      {/* Neck */}
      <Bone a={[0, 1.43, 0.015]} b={[0, 1.53, 0.02]} radius={0.05} material={mats.skin} />

      {/* Shirt + collar. Scale Z so the torso is oval, not a lathe-of-revolution sausage. */}
      <mesh geometry={shirtGeom} position={[0, 0.88, 0]} scale={[1, 1, 0.7]} material={mats.shirt} castShadow receiveShadow />
      <mesh position={[0, 1.425, 0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.78, 1]} material={mats.shirt} castShadow>
        <torusGeometry args={[0.068, 0.015, 10, 24]} />
      </mesh>
      {([L, R] as const).map((s) => (
        <mesh key={s} position={[s * 0.2, 1.36, 0.01]} scale={[1.05, 0.62, 0.8]} material={mats.shirt} castShadow>
          <sphereGeometry args={[0.062, 16, 12]} />
        </mesh>
      ))}

      {/* Arms: left hangs, right reaches the `hand` bag slot */}
      {([L, R] as const).map((s) => (
        <group key={s}>
          <Joint p={sh(s)} r={0.058} material={mats.shirt} />
          <Bone a={sh(s)} b={lerp3(sh(s), elbow(s), 0.4)} radius={0.052} material={mats.shirt} />
          <Bone a={lerp3(sh(s), elbow(s), 0.38)} b={elbow(s)} radius={0.048} material={mats.skin} />
          <Joint p={elbow(s)} r={0.048} material={mats.skin} />
          <Bone a={elbow(s)} b={wrist(s)} radius={0.044} material={mats.skin} />
          <Joint p={wrist(s)} r={0.038} material={mats.skin} />
          <Hand at={s === 1 ? [0.42, 0.72, 0.12] : [-0.28, 0.74, 0.06]} side={s} />
        </group>
      ))}

      {/* Belt + buckle at the bag belt slots */}
      <mesh position={[0, 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.02, 0.78, 1]} material={mats.belt} castShadow>
        <torusGeometry args={[0.175, 0.018, 10, 28]} />
      </mesh>
      <mesh position={[0, 0.98, 0.14]} material={mats.buckle} castShadow>
        <boxGeometry args={[0.04, 0.032, 0.012]} />
      </mesh>

      {/* Hips / jeans yoke */}
      <mesh geometry={hipsGeom} position={[0, 0.82, 0]} scale={[1, 1, 0.78]} material={mats.pants} castShadow receiveShadow />

      {/* Legs */}
      {([L, R] as const).map((s) => (
        <group key={s}>
          <Bone a={hip(s)} b={knee(s)} radius={0.075} material={mats.pants} />
          <Joint p={knee(s)} r={0.062} material={mats.pants} />
          <Bone a={knee(s)} b={ankle(s)} radius={0.055} material={mats.pants} />
          {/* Pocket patch so thigh bags have a surface */}
          <mesh position={[s * 0.15, 0.78, 0.1]} material={mats.pants} castShadow>
            <boxGeometry args={[0.08, 0.11, 0.02]} />
          </mesh>
          <RoundedBox args={[0.09, 0.075, 0.25]} radius={0.02} smoothness={4} position={[s * 0.09, 0.048, 0.07]} material={mats.shoe} castShadow />
          <RoundedBox args={[0.094, 0.02, 0.26]} radius={0.008} smoothness={3} position={[s * 0.09, 0.012, 0.075]} material={mats.sole} />
        </group>
      ))}

      {/* EDC watch on the left wrist */}
      <group position={[-0.265, 0.84, 0.05]} rotation={[Math.PI / 2, 0.2, 0.4]}>
        <mesh material={mats.watch}><torusGeometry args={[0.02, 0.004, 8, 18]} /></mesh>
        <mesh material={mats.watchFace}><cylinderGeometry args={[0.015, 0.015, 0.005, 16]} /></mesh>
      </group>
    </group>
  );
}
