import React, { useRef, useMemo, memo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Torus } from '@react-three/drei';
import * as THREE from 'three';

// ─── State palette ─────────────────────────────────────────────────────────────
const PALETTE = {
  idle:     { core: '#00e5ff', glow: '#006090', wire: '#00e5ff', particle: '#00e5ff', intensity: 0.5 },
  thinking: { core: '#4488ff', glow: '#0033cc', wire: '#4488ff', particle: '#88aaff', intensity: 0.8 },
  speaking: { core: '#ffffff', glow: '#aaddff', wire: '#ffffff', particle: '#ffffff', intensity: 1.0 },
  error:    { core: '#ff2244', glow: '#7f0000', wire: '#ff2244', particle: '#ff6688', intensity: 0.9 },
};

// lerp factor for a 0.5s transition at ~60fps: 1-(1-k)^n ≈ target in ~0.5s
// k = 0.03 → reaches ~86% in 60 frames (1s). Use 0.04 for ~0.5s feel.
const LERP_K = 0.04;

// ─── Fresnel ShaderMaterial ────────────────────────────────────────────────────
const fresnelVert = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`;
const fresnelFrag = `
  uniform vec3  uColor;
  uniform float uPower;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uPower);
    gl_FragColor  = vec4(uColor * fresnel, fresnel * uOpacity);
  }
`;

function makeFresnelMaterial(color = '#00e5ff', power = 3.5, opacity = 0.85) {
  return new THREE.ShaderMaterial({
    vertexShader:   fresnelVert,
    fragmentShader: fresnelFrag,
    uniforms: {
      uColor:   { value: new THREE.Color(color) },
      uPower:   { value: power },
      uOpacity: { value: opacity },
    },
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
  });
}

// ─── 1. Energy Core ────────────────────────────────────────────────────────────
const EnergyCore = memo(function EnergyCore({ state }) {
  const ref    = useRef();
  const matRef = useRef();

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    const pal = PALETTE[state] || PALETTE.idle;
    const freq = state === 'thinking' ? 3.2 : state === 'speaking' ? 2.0 : 1.4;
    const amp  = state === 'thinking' ? 0.10 : 0.05;

    ref.current.scale.setScalar(1 + Math.sin(t * freq) * amp);

    if (matRef.current) {
      matRef.current.emissive.lerp(new THREE.Color(pal.core), LERP_K);
      matRef.current.color.lerp(new THREE.Color(pal.glow), LERP_K);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        matRef.current.emissiveIntensity, pal.intensity * 2.5, LERP_K
      );
    }
  });

  return (
    <Sphere ref={ref} args={[0.55, 64, 64]}>
      <meshStandardMaterial
        ref={matRef}
        color={PALETTE.idle.glow}
        emissive={PALETTE.idle.core}
        emissiveIntensity={1.4}
        roughness={0.0}
        metalness={0.1}
      />
    </Sphere>
  );
});

// ─── 2. Glass Shell (Fresnel) ──────────────────────────────────────────────────
const GlassShell = memo(function GlassShell({ state }) {
  const mat = useMemo(() => makeFresnelMaterial('#00e5ff', 3.5, 0.85), []);
  const ref  = useRef();

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    const pal = PALETTE[state] || PALETTE.idle;
    mat.uniforms.uColor.value.lerp(new THREE.Color(pal.core), LERP_K);
    const base = state === 'thinking' ? 0.92 : state === 'speaking' ? 0.75 : 0.85;
    mat.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      mat.uniforms.uOpacity.value, base, LERP_K
    );
    ref.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.012);
  });

  return (
    <Sphere ref={ref} args={[1.5, 128, 128]}>
      <primitive object={mat} attach="material" />
    </Sphere>
  );
});

// ─── 3. Wireframe Polyhedra ────────────────────────────────────────────────────
// polygonOffsetFactor diferente por camada elimina Z-fighting entre layers
function WirePolyhedron({ geometry, scale, speedX, speedY, state, opacity, zOffset }) {
  const ref    = useRef();
  const matRef = useRef();

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    ref.current.rotation.x = t * speedX;
    ref.current.rotation.y = t * speedY;

    if (matRef.current) {
      const pal = PALETTE[state] || PALETTE.idle;
      matRef.current.color.lerp(new THREE.Color(pal.wire), LERP_K);
      const targetOp = state === 'idle' ? opacity : Math.min(opacity * 1.6, 0.9);
      matRef.current.opacity = THREE.MathUtils.lerp(matRef.current.opacity, targetOp, LERP_K);
    }
  });

  return (
    <mesh ref={ref} scale={scale}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        ref={matRef}
        color={PALETTE.idle.wire}
        wireframe
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={zOffset}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
}

const WireframeLayers = memo(function WireframeLayers({ state }) {
  const icosa1 = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const icosa2 = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const dodeca = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);

  return (
    <>
      <WirePolyhedron geometry={icosa1} scale={1.85} speedX={0.18}  speedY={0.28}  state={state} opacity={0.22} zOffset={-1} />
      <WirePolyhedron geometry={dodeca} scale={2.20} speedX={-0.12} speedY={0.20}  state={state} opacity={0.15} zOffset={-2} />
      <WirePolyhedron geometry={icosa2} scale={2.65} speedX={0.08}  speedY={-0.15} state={state} opacity={0.10} zOffset={-3} />
    </>
  );
});

// ─── 4. Data Particles ─────────────────────────────────────────────────────────
const PARTICLE_COUNT = 180;

const DataParticles = memo(function DataParticles({ state }) {
  const ref = useRef();

  const { radii, speeds, phases } = useMemo(() => {
    const radii  = new Float32Array(PARTICLE_COUNT);
    const speeds = new Float32Array(PARTICLE_COUNT);
    const phases = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      radii[i]  = 1.8 + Math.random() * 1.6;
      speeds[i] = 0.15 + Math.random() * 0.35;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { radii, speeds, phases };
  }, []);

  const geometry = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    const pos = geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r     = radii[i];
      const angle = t * speeds[i] + phases[i];
      const phi   = Math.acos(2 * ((i / PARTICLE_COUNT) % 1) - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(angle);
      pos[i * 3 + 1] = r * Math.cos(phi) + Math.sin(t * 0.4 + phases[i]) * 0.12;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(angle);
    }
    geometry.attributes.position.needsUpdate = true;

    const pal = PALETTE[state] || PALETTE.idle;
    const mat = ref.current?.material;
    if (mat) {
      mat.color.lerp(new THREE.Color(pal.particle), LERP_K);
      const targetSize = state === 'thinking' ? 0.045 : state === 'speaking' ? 0.055 : 0.030;
      mat.size    = THREE.MathUtils.lerp(mat.size, targetSize, LERP_K);
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, state === 'idle' ? 0.55 : 0.85, LERP_K);
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        color={PALETTE.idle.particle}
        size={0.030}
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
});

// ─── 5. Orbital Rings ──────────────────────────────────────────────────────────
function OrbitalRing({ radius, tube, tiltX, tiltZ, speed, state, opacity }) {
  const ref    = useRef();
  const matRef = useRef();

  useFrame(({ clock }) => {
    ref.current.rotation.y = clock.getElapsedTime() * speed;
    if (matRef.current) {
      const pal = PALETTE[state] || PALETTE.idle;
      matRef.current.color.lerp(new THREE.Color(pal.wire), LERP_K);
    }
  });

  return (
    <group rotation={[tiltX, 0, tiltZ]}>
      <Torus ref={ref} args={[radius, tube, 3, 120]}>
        <meshBasicMaterial
          ref={matRef}
          color={PALETTE.idle.wire}
          transparent
          opacity={opacity}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </Torus>
    </group>
  );
}

// ─── 6. Ambient Halo ───────────────────────────────────────────────────────────
const AmbientHalo = memo(function AmbientHalo({ state }) {
  const ref = useRef();

  useFrame(({ clock }) => {
    const t   = clock.getElapsedTime();
    const pal = PALETTE[state] || PALETTE.idle;
    const base = state === 'idle' ? 0.06 : 0.14;
    ref.current.material.opacity = base + Math.sin(t * 1.8) * 0.025;
    ref.current.material.color.lerp(new THREE.Color(pal.core), LERP_K);
  });

  return (
    <Sphere ref={ref} args={[1.9, 32, 32]}>
      <meshBasicMaterial
        color={PALETTE.idle.core}
        transparent
        opacity={0.06}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </Sphere>
  );
});

// ─── Scene ─────────────────────────────────────────────────────────────────────
const Scene = memo(function Scene({ sphereState }) {
  return (
    <>
      <ambientLight intensity={0.08} />
      <pointLight position={[0, 0, 0]}    intensity={3.0} color="#00e5ff" distance={8}  />
      <pointLight position={[6, 6, 6]}    intensity={1.5} color="#00e5ff" distance={12} />
      <pointLight position={[-6, -4, -4]} intensity={0.8} color="#2244ff" distance={12} />
      <pointLight position={[0, -6, 5]}   intensity={0.5} color="#ffffff" distance={10} />

      <group scale={0.85}>
        <AmbientHalo      state={sphereState} />
        <GlassShell       state={sphereState} />
        <EnergyCore       state={sphereState} />
        <WireframeLayers  state={sphereState} />
        <DataParticles    state={sphereState} />
        <OrbitalRing radius={2.5} tube={0.013} tiltX={Math.PI / 2.2} tiltZ={0.3}  speed={0.55}  state={sphereState} opacity={0.45} />
        <OrbitalRing radius={3.0} tube={0.009} tiltX={0.4}           tiltZ={1.05} speed={-0.35} state={sphereState} opacity={0.28} />
        <OrbitalRing radius={3.5} tube={0.006} tiltX={1.1}           tiltZ={-0.5} speed={0.20}  state={sphereState} opacity={0.16} />
      </group>
    </>
  );
});

// ─── Configurações estáticas fora do componente ────────────────────────────────
// Objetos module-level: mesma referência sempre → Canvas NUNCA reconfigura o WebGL
const CAMERA = { position: [0, 0, 8.5], fov: 42 };
const GL     = { antialias: true, alpha: true, toneMapping: THREE.NoToneMapping };
const CANVAS_STYLE = { background: 'transparent', display: 'block' };

// Glow via radial-gradient em div separada — sem filter no pai do Canvas
const GLOW_COLOR = {
  idle:     '#00e5ff',
  thinking: '#4488ff',
  speaking: '#c8eeff',
  error:    '#ff2244',
};

// ─── Export ────────────────────────────────────────────────────────────────────
export default memo(function JarvisSphere({ sphereState = 'idle' }) {
  const color = GLOW_COLOR[sphereState] || GLOW_COLOR.idle;

  return (
    <div className="sphere-canvas-wrapper">
      {/* Glow radial em div própria — não interfere com o compositing do Canvas */}
      <div
        className="sphere-glow"
        style={{
          background: `radial-gradient(ellipse at center, ${color}28 0%, ${color}0a 45%, transparent 70%)`,
          transition: 'background 0.5s ease',
        }}
      />
      <Canvas camera={CAMERA} gl={GL} style={CANVAS_STYLE}>
        <Scene sphereState={sphereState} />
      </Canvas>
    </div>
  );
});
